# KalendAI Codebase Concerns & Technical Debt

This document outlines the security vulnerabilities, severe performance bottlenecks, high technical debt, and reliability risks identified in the KalendAI codebase. It serves as a guide for engineering refactoring and risk management.

---

## 1. Critical Security Vulnerabilities

### 1.1 Insecure Direct Object References (IDOR)
* **Location:** [kanbanRoutes.ts](file:///c:/Users/Admin/source/repos/kalendai/backend/src/routes/kanbanRoutes.ts#L328-L409)
* **Severity:** **CRITICAL**
* **Details:**
  Several endpoints in the Kanban routes perform database mutations using path parameters without verifying if the authenticated user owns the resource.
  - **DELETE `/:id`:** Deletes the Kanban card directly using only the card UUID.
  - **PUT `/:id`:** Updates the Kanban card (title, description, color, status, order, attachments) using only the card UUID.
  - **PUT `/reorder/bulk`:** Reorders and alters the status of multiple cards through a direct transaction mapping of card UUIDs.
* **Impact:** Any authenticated user can modify, reorder, or delete any other user's Kanban cards, descriptions, and data by simply sending the target card's UUID in the request payload or URL path.
* **Mitigation Recommendation:**
  Validate user ownership before performing mutations. For example, instead of running `prisma.kanbanCard.delete({ where: { id } })`, execute a conditional mutation or look up ownership first:
  ```typescript
  const card = await prisma.kanbanCard.findFirst({ where: { id, userId } });
  if (!card) return res.status(404).json({ error: 'Card not found or unauthorized' });
  ```

---

### 1.2 SQL Injection via Raw Unsafe Queries
* **Location:** [kanbanService.ts](file:///c:/Users/Admin/source/repos/kalendai/backend/src/services/kanbanService.ts#L180-L196)
* **Severity:** **HIGH**
* **Details:**
  When inserting or updating the vector embeddings for daily reports in a PostgreSQL environment, raw query execution is performed using string interpolation in `$executeRawUnsafe`:
  ```typescript
  await prisma.$executeRawUnsafe(`UPDATE "DailyReport" SET embedding = '${embeddingFormat}'::vector WHERE id = '${existing.id}'`);
  ```
* **Impact:** Although the inputs are formatted internally (ID and floats array), using `$executeRawUnsafe` with string interpolation breaks standard security design patterns and opens security doors. If these formats ever accept user-influenced strings, it could lead to SQL Injection.
* **Mitigation Recommendation:** Use standard parameterized query syntax `$executeRaw` to let Prisma handle escaping:
  ```typescript
  await prisma.$executeRaw`UPDATE "DailyReport" SET embedding = ${embedding}::vector WHERE id = ${id}`;
  ```

---

### 1.3 Unrestricted File Upload Vulnerability
* **Location:** [kanbanRoutes.ts](file:///c:/Users/Admin/source/repos/kalendai/backend/src/routes/kanbanRoutes.ts#L11-L14)
* **Severity:** **HIGH**
* **Details:**
  The backend endpoint `POST /api/kanban/:id/images` uses Multer to handle image uploads, but it lacks a file format/extension filter (`fileFilter`). 
* **Impact:** Attackers can upload arbitrary, potentially malicious files (such as executable scripts, `.html` files containing cross-site scripting payloads, or massive binaries) to the MinIO/S3 compatible bucket. These files are then saved with their original content-types and extensions.
* **Mitigation Recommendation:**
  Define a strict `fileFilter` in Multer to limit uploads only to valid image mime-types:
  ```typescript
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 3 * 1024 * 1024 }, // Limit to 3MB
    fileFilter: (req, file, cb) => {
      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG, PNG and WEBP are allowed.'));
      }
    }
  });
  ```

---

## 2. Severe Performance Bottlenecks

### 2.1 Database N+1 Query Multipliers in Rollover and Reports
* **Location:** [kanbanService.ts](file:///c:/Users/Admin/source/repos/kalendai/backend/src/services/kanbanService.ts#L5-L206)
* **Severity:** **HIGH**
* **Details:**
  The daily rollover job (`processDailyRollover`) and report generator (`processDailyReport`) are executed inside synchronous user iteration loops:
  - **In `processDailyRollover`:** 
    1. A single user query fetches all users: `const users = await prisma.user.findMany()`.
    2. A loop is executed for *each* user.
    3. Inside the loop, `prisma.kanbanCard.findMany` is queried.
    4. For *each* card found, individual inserts (`prisma.kanbanCard.create`), nested child queries (`prisma.cardImage.create`), and individual updates (`prisma.kanbanCard.update`) are performed sequentially.
  - **In `processDailyReport`:** 
    1. Loops over each user.
    2. Queries tasks inside the loop.
    3. Fetches presigned URLs for *each* image sequentially using `Promise.all` but within the serial user loop.
    4. Sequentially triggers external AI text generation (`generateReport`) and embedding API requests (`generateEmbedding`) per user inside the loop.
* **Impact:** 
  If there are 500 users, each with 5 active tasks, the daily rollover will trigger **thousands** of sequential database read/write requests. Similarly, the report generation will perform hundreds of sequential network calls to Gemini/Deepseek APIs. This can result in:
  - Long-running execution locks.
  - Database pool exhaustion.
  - Cron timeout failures.
  - Severe API rate limits or gateway timeouts.
* **Mitigation Recommendation:**
  - Group queries and updates using set-based operations. 
  - Utilize bulk insertion operations (`prisma.kanbanCard.createMany`) and transactional bulk updates.
  - Parallelize AI reports generation with batch limits (e.g., using a worker pool or `p-limit`) instead of a single massive serial `for` loop.

---

### 2.2 Bloated Base64 DB Storage (Database Inflation)
* **Location:** [Calendar.tsx](file:///c:/Users/Admin/source/repos/kalendai/frontend/src/pages/Calendar.tsx#L524-L551)
* **Severity:** **HIGH**
* **Details:**
  When a user pastes an attachment (such as an image or a PDF) in the card editor, the frontend handles the file via `handlePasteAttachment`, converting the binary into a base64 DataURL (up to 3MB):
  ```typescript
  const reader = new FileReader();
  reader.onload = (event) => {
      if (event.target && typeof event.target.result === 'string') {
          setEditAttachments(prev => [...prev, event.target!.result as string]);
      }
  };
  reader.readAsDataURL(file);
  ```
  When the card is saved, the entire array is stringified and saved directly inside the `attachments` string column of the `KanbanCard` table.
* **Impact:** Saving multiple 3MB base64 images directly inside text fields in SQLite or PostgreSQL is a critical design issue. It results in **massive database bloating**, extremely high memory usage during queries, and degrades standard dashboard and calendar load queries since large strings must be serialized and deserialized constantly.
* **Mitigation Recommendation:**
  Do not store binary base64 representations in the database. When a file is pasted or attached, immediately upload it to MinIO via a dedicated endpoint, and store only the resulting object keys or reference URLs in the database.

---

### 2.3 Multer Memory Exhaustion (OOM Vulnerability)
* **Location:** [kanbanRoutes.ts](file:///c:/Users/Admin/source/repos/kalendai/backend/src/routes/kanbanRoutes.ts#L10)
* **Severity:** **MEDIUM**
* **Details:**
  The card image upload router is configured with memory storage (`multer.memoryStorage()`) and a large file limit of 10MB.
* **Impact:** Under concurrent file upload traffic (e.g. multiple users uploading images simultaneously), loading several 10MB raw files entirely into the system RAM can trigger node process Out-Of-Memory (OOM) crashes.
* **Mitigation Recommendation:**
  Switch from memory storage to temporary disk storage (`multer.diskStorage()`) or reduce the `fileSize` limit to a maximum of 3MB, which is more than sufficient for Kanban attachments.

---

## 3. High Technical Debt & Architectural Gaps

### 3.1 Database Mismatch (SQLite vs. PostgreSQL & pgvector)
* **Location:** [schema.prisma](file:///c:/Users/Admin/source/repos/kalendai/backend/prisma/schema.prisma#L8-L11)
* **Severity:** **HIGH**
* **Details:**
  The Prisma schema is currently configured to use **SQLite** (`dev.db`), but the codebase is peppered with comments and conditional code designed for **PostgreSQL** and **pgvector** extensions. The embedding field is stored as a temporary `String?` for SQLite, while the services perform raw Postgres casting operations:
  ```typescript
  const isPostgres = process.env.DATABASE_URL?.includes('postgresql://') || ...;
  // ...
  if (isPostgres && embedding.length > 0) {
     await prisma.$executeRawUnsafe(`UPDATE "DailyReport" SET embedding = '${embeddingFormat}'::vector WHERE id = '${newReport.id}'`);
  }
  ```
* **Impact:** Maintaining conditional raw SQL logic for dual-database engines (SQLite in development, Postgres in production) is highly error-prone. Migrations cannot be safely auto-generated via Prisma, and differences in vector operations will cause production bugs that cannot be easily caught in SQLite-based dev environments.
* **Mitigation Recommendation:**
  Standardize on a single database provider. Given the AI vector-search requirements, use PostgreSQL and pgvector for both development (via Docker Compose) and production.

---

### 3.2 Lack of Indexes on Frequently Queried Foreign Keys
* **Location:** [schema.prisma](file:///c:/Users/Admin/source/repos/kalendai/backend/prisma/schema.prisma#L32-L100)
* **Severity:** **MEDIUM**
* **Details:**
  The Prisma models completely omit explicit index configurations (`@@index`). Highly queried foreign keys and date filters are left unindexed:
  - `KanbanCard`: `userId`, `dayDate`, `status`
  - `CardImage`: `cardId`
  - `DailyReport`: `userId`, `date`
  - `Event`: `userId`, `eventDate`
* **Impact:** As the database tables grow over time, fetching user cards or checking daily reports requires the database engine to perform full-table scans. This will result in deteriorating response times and high server CPU load.
* **Mitigation Recommendation:** Add explicit indexes to the schema:
  ```prisma
  model KanbanCard {
    ...
    @@index([userId])
    @@index([dayDate])
    @@index([status])
  }
  ```

---

### 3.3 Lack of Database-Level Enums
* **Location:** [schema.prisma](file:///c:/Users/Admin/source/repos/kalendai/backend/prisma/schema.prisma#L18-L40)
* **Severity:** **MEDIUM**
* **Details:**
  To support SQLite limitations, standard type-safe database enums (like `Role` and `KanbanStatus`) are commented out and mapped to generic `String` fields with defaults (e.g. `role String @default("USER")`, `status String @default("OPEN")`).
* **Impact:** Omission of database-level constraints removes data-integrity guarantees, making it possible for invalid role names or status values to be persisted in the database.
* **Mitigation Recommendation:** Once standardized on PostgreSQL, re-enable proper Prisma `enum` structures for roles and task statuses.

---

### 3.4 Global Fallback Mocking State
* **Location:** [kanbanRoutes.ts](file:///c:/Users/Admin/source/repos/kalendai/backend/src/routes/kanbanRoutes.ts#L275-L365)
* **Severity:** **MEDIUM**
* **Details:**
  In several endpoints (GET `/:date`, POST `/`, PUT `/:id`), the try-catch block intercepts database errors and, if the error is a database connection issue (`PrismaClientInitializationError`), falls back to managing cards in a global in-memory state:
  ```typescript
  } catch (error: any) {
    if (error.name === 'PrismaClientInitializationError' || (error.code && error.code.startsWith('P'))) {
      const g = global as any;
      g.mockCards = g.mockCards || [];
      ...
  ```
* **Impact:** Using global variables as an in-memory database fallback is highly dangerous. If the database crashes, the application will silently continue working in-memory, causing silent data inconsistencies, loss of persistence upon server restart, and different data per node instance.
* **Mitigation Recommendation:**
  Remove mock database fallbacks from production-bound routes. Database connection errors should fail loud, return a clear `503 Service Unavailable` status, and trigger alerting mechanisms.

---

### 3.5 Stub Inactive Endpoints
* **Location:** [eventRoutes.ts](file:///c:/Users/Admin/source/repos/kalendai/backend/src/routes/eventRoutes.ts#L7-L9)
* **Severity:** **LOW**
* **Details:**
  The `Event` model exists in the database schema, but its corresponding API routes are empty stubs returning static empty arrays (`[]`), and no controller or service logic is present.
* **Impact:** Crucial system features (calendar scheduling/reminders) are unimplemented stubs, leaving unused models in the database schema.
* **Mitigation Recommendation:** Complete the implementation of `eventRoutes` or clean up unused database tables and router imports if events are out of scope.

---

### 3.6 Double Scheduling / Duplicate Cron Setup
* **Locations:**
  - [cronJobs.ts](file:///c:/Users/Admin/source/repos/kalendai/backend/src/jobs/cronJobs.ts#L4-L18)
  - [rollover.ts](file:///c:/Users/Admin/source/repos/kalendai/backend/src/jobs/rollover.ts#L4-L18)
* **Severity:** **LOW**
* **Details:**
  The application has duplicate background job scheduling routines. 
  - `cronJobs.ts` registers a midnight rollover job: `cron.schedule('1 0 * * *', () => processDailyRollover())`.
  - `rollover.ts` registers an identical midnight rollover job: `cron.schedule('1 0 * * *', () => performRollover())`.
  - Both processes are initialized inside `server.ts` or imports, which can cause conflict or execution of different rollover algorithms.
* **Impact:** Unnecessary processing overhead, race conditions on task rollover snapshots, and duplicated logs.
* **Mitigation Recommendation:** Consolidation is needed. Keep a single background jobs manager file (`cronJobs.ts`) and remove `rollover.ts`'s cron registration, keeping only the service functions.

---

## 4. Reliability & Consistency Gaps

### 4.1 Missing Database Transaction Safety in Rollover
* **Location:** [kanbanService.ts](file:///c:/Users/Admin/source/repos/kalendai/backend/src/services/kanbanService.ts#L5-L82)
* **Severity:** **HIGH**
* **Details:**
  In `processDailyRollover`, the snapshot duplication, image cloning, and card relocation are performed through sequential database requests without an encompassing database transaction context.
* **Impact:** If the server crashes or loses database connection halfway through moving a card or copying its images, the database will land in an inconsistent state (e.g., a card gets cloned to yesterday but its original card fails to jump to today, resulting in visual task duplication).
* **Mitigation Recommendation:** Wrap the entire operation in a Prisma transaction (`$transaction`):
  ```typescript
  await prisma.$transaction(async (tx) => {
    // Perform all snapshot creations and updates inside the transaction context
  });
  ```

---

### 4.2 Orphaned Files (Storage Leakage)
* **Location:** [kanbanRoutes.ts](file:///c:/Users/Admin/source/repos/kalendai/backend/src/routes/kanbanRoutes.ts#L372-L381)
* **Severity:** **MEDIUM**
* **Details:**
  When a card is deleted via `DELETE /:id`, the database cascades deletion to `CardImage` records. However, the system never triggers S3 deletion for the corresponding binary file keys inside the MinIO bucket.
* **Impact:** Binary image files remain stored in the MinIO/S3 bucket forever, resulting in continuous storage leakages and accumulation of unreferenced files.
* **Mitigation Recommendation:**
  Before deleting a card, fetch all associated `CardImage` records, delete their corresponding files from MinIO, and only then proceed to delete the card in the database.

---

### 4.3 Timezone-Shift Vulnerabilities in Date Manipulations
* **Locations:**
  - [Calendar.tsx](file:///c:/Users/Admin/source/repos/kalendai/frontend/src/pages/Calendar.tsx#L50)
  - [dashboardRoutes.ts](file:///c:/Users/Admin/source/repos/kalendai/backend/src/routes/dashboardRoutes.ts#L80)
* **Severity:** **MEDIUM**
* **Details:**
  Date parsing and calculations are prone to client-server offset mismatches:
  - In the frontend, the app offsets date strings by manually subtracting time offsets (`new Date(selectedDate.getTime() - offset)`).
  - In `dashboardRoutes.ts`, UTC dates are converted directly: `const cardDay = new Date(card.dayDate).getUTCDate()`.
* **Impact:** These timezone transformations behave unpredictably across timezones and during Daylight Saving Time (DST) changes. A card created on a specific calendar day in São Paulo might appear on the day before or after in a UTC server or under different local offsets.
* **Mitigation Recommendation:**
  Standardize all dates on ISO 8601 calendar dates (e.g. `YYYY-MM-DD` strings) for task groupings, instead of instantiating active timezone-aware `Date` objects which are subject to runtime environment locations.
