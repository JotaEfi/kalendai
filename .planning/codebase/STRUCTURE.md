# 📂 KalendAI: Project Structure & Directory Layout

This document provides a highly detailed mapping of the KalendAI codebase directory hierarchy, detailing the purpose and responsibility of each directory, service module, configuration, and frontend/backend entrypoint.

---

## 🗺️ 1. Project Directory Layout (Tree View)

KalendAI is designed as a unified monorepo divided into a `frontend` single page application and a `backend` server. Below is the comprehensive structural layout of the workspace:

```text
kalendai/
├── .github/                      # CI/CD pipelines
│   └── workflows/
│       └── deploy.yml            # Auto build, push & Deploy SSH VPS workflow
├── .planning/                    # GSD Planning and Codebase mapping files
│   └── codebase/
│       ├── ARCHITECTURE.md       # High-level architecture documentation
│       └── STRUCTURE.md          # [This File] Codebase structure documentation
├── backend/                      # Node.js + Express REST API Server
│   ├── prisma/                   # Database migrations and configuration
│   │   ├── schema.prisma         # Prisma Schema Model definitions
│   │   └── dev.db                # SQLite Local Development Database
│   ├── src/                      # Backend source files
│   │   ├── jobs/                 # Cron background routines
│   │   │   ├── cronJobs.ts       # Cron schedule registrations (Sao Paulo Time)
│   │   │   └── rollover.ts       # Task rollover routines
│   │   ├── lib/                  # Library wrappers and singletons
│   │   │   └── prisma.ts         # Instantiate Prisma client instance
│   │   ├── middleware/           # Express middleware interceptors
│   │   │   └── authMiddleware.ts # JWT verification & validation check
│   │   ├── routes/               # API route definitions
│   │   │   ├── authRoutes.ts     # Login, refresh, profile & logout routing
│   │   │   ├── dashboardRoutes.ts# Bento metrics & weekly chart routing
│   │   │   ├── eventRoutes.ts    # User event/scheduler placeholder routing
│   │   │   ├── kanbanRoutes.ts   # CRUD cards, images upload & direct reports
│   │   │   └── reportRoutes.ts   # Historic daily report routes
│   │   ├── services/             # Main business service layer
│   │   │   ├── aiProvider.ts     # Low-level API Gateway (Gemini, Deepseek, OpenAI)
│   │   │   ├── aiService.ts      # LLM wrapper & semantic embedding generator
│   │   │   ├── kanbanService.ts  # Rollover logic & daily report processors
│   │   │   └── minioService.ts   # Private AWS S3/MinIO bucket manager
│   │   ├── app.ts                # Express app middleware & route mounting
│   │   └── server.ts             # Main backend server runner & seeder
│   ├── package.json              # Server dependencies & launch scripts
│   ├── seed.ts                   # Idempotent Prisma DB initial data seeder
│   └── tsconfig.json             # Backend compiler settings
├── frontend/                     # React v18 + Vite SPA Client
│   ├── src/                      # Frontend source files
│   │   ├── components/           # Reusable UI component blocks
│   │   │   ├── Layout.tsx        # Responsive grid layout with sidebar menu
│   │   │   ├── SortableColumn.tsx# Reorderable Kanban status column container
│   │   │   └── SortableKanbanCard.tsx# Sortable Kanban card component
│   │   ├── context/              # Global React Context managers
│   │   │   └── AuthContext.tsx   # Auth states, session cache & login actions
│   │   ├── pages/                # Main dashboard page views
│   │   │   ├── Calendar.tsx      # Interactive Calendar & drag-and-drop daily Kanban
│   │   │   ├── Dashboard.tsx     # Performance Metrics & Weekly charts
│   │   │   └── Login.tsx         # User authentication gate page
│   │   ├── services/             # Client request integrations
│   │   │   └── api.ts            # Axios instances with auth silent retry interceptors
│   │   ├── styles/               # Global tailwind styles
│   │   │   └── global.css        # Animations & standard style variables
│   │   ├── App.tsx               # Client routes & app layout wrapping
│   │   ├── index.css             # Tailwind baseline directives
│   │   └── main.tsx              # React mounting file
│   ├── index.html                # Vite template HTML root page
│   ├── package.json              # Client dependencies & scripts
│   ├── tsconfig.json             # Frontend compiler settings
│   └── vite.config.ts            # Vite compile and proxy configurations
├── docker-compose.yml            # Docker orchestration configuration
├── KALENDAI_SUMMARY.md           # Project history & contextual brief
└── README.md                     # Basic launch commands
```

---

## ⚙️ 2. Backend Architecture Details (`backend/`)

The backend codebase is organized as a lightweight, clean layered architecture.

### 📊 2.1. Prisma Schema & Models (`backend/prisma/schema.prisma`)
Prisma models dictate the structure of the database. The models are:
- **`User`**: Holds user profiles and maps relationships to cards, events, reports, and active refresh tokens.
- **`KanbanCard`**: Individual task entities with `title`, `description`, `color`, `status` (`OPEN`, `IN_PROGRESS`, `DONE`), sorting `order`, `dayDate` (calendar date anchor), `completedAt`, and metadata flags (`isRolledOver`, `isSnapshot`, `originalDayDate`).
- **`CardImage`**: Tracks attachments stored inside MinIO, linking files via `objectKey`, `bucket`, and `mimeType` back to parent `KanbanCard` records.
- **`DailyReport`**: Immutable records containing the text reports synthesized by the LLM, labeled with `isAutomatic`, `generatedAt`, and a stringified or vector-typed `embedding` field.
- **`RefreshToken`**: Cryptographic keys linked to a `User` with an exact expiration timestamp to validate persistent sessions.
- **`Event`**: User event scheduling records (currently unused placeholder).

---

### 📂 2.2. Service Layer (`backend/src/services/`)
The core processing rules of KalendAI reside in decoupled services:

| Service File | Responsibility | Core Functions / SDKs Used |
| :--- | :--- | :--- |
| **`minioService.ts`** | Manages interaction with the private object storage bucket. Handles bucket initialization, image buffer upload, deletion, and presigned transient URL creation. | `S3Client`, `@aws-sdk/s3-request-presigner`, `getSignedUrl()` (1hr expiration) |
| **`aiProvider.ts`** | Acts as an API gateway for calling external language models, encapsulating provider differences under a unified contract. | `@google/genai` (`GoogleGenAI`), standard HTTP raw calls using `node-fetch` |
| **`aiService.ts`** | Prepares token-optimized task payloads, designs system instructions, calls providers for text reports, and converts texts into semantic vectors. | `generateReport()`, `generateEmbedding()` (supports Gemini `text-embedding-004` & Deepseek `deepseek-embed`) |
| **`kanbanService.ts`**| Coordinates complex multi-model processes. Houses the daily background Rollover and automated AI Report routines. | `processDailyRollover()`, `processDailyReport()` |

---

### 🛣️ 2.3. Routing & Controllers (`backend/src/routes/`)
Routes decode HTTP requests, parse query/body inputs, perform authorization checks, and return standardized JSON packages.

- **`authRoutes.ts`**: Encapsulates user session management.
  - `POST /login`: Validates user password via `bcrypt.compare()`, signs dual JWT tokens (Access + Refresh), saves the refresh token in the database, and returns the tokens with user details.
  - `POST /refresh`: Authenticates a client's `refreshToken`, validates expiration/revocation, and issues a fresh short-term `accessToken`.
  - `POST /logout`: Revokes and deletes the client's `refreshToken` from the database.
  - `PUT /profile`: Modifies user details (email and name).
- **`kanbanRoutes.ts`**: Core route processing tasks, drag-and-drop transitions, and upload configurations.
  - `GET /:date`: Retrieves all task cards for a specific date, mapping MinIO images to temporary presigned URLs.
  - `POST /`: Creates a new card default status `OPEN`.
  - `PUT /:id`: Updates card properties. Triggers `completedAt` timestamp logs if the card status is set to `DONE`.
  - `PUT /reorder/bulk`: Invoked by drag-and-drop actions. Updates sorting orders and status values in a single transaction.
  - `POST /:id/images`: Uploads image attachments into S3 buckets and creates `CardImage` DB records.
  - `DELETE /:id/images/:imageId`: Excludes images from S3 and database.
  - `POST /report`: Explicitly requests manual AI report generation for a single day.
- **`dashboardRoutes.ts`**: Compiles multi-variable metrics.
  - `GET /`: Calculates month totals, task completion percentages, average task duration times (using completion intervals), segmentizes week-level counts for dual-bar charts, and returns the last 5 generated reports.

---

### 🔄 2.4. Entrypoint and Server Bootstrap Lifecycle (`backend/src/`)
1. **`server.ts`**: Starts execution by reading `.env` variables. Runs:
   - **`seedAdmin()`**: Scans the database. If the configured `ADMIN_EMAIL` does not exist, it creates a default administrator with an encrypted password hash.
   - **`initializeMinio()`**: Issues a S3 bucket scan command. If `MINIO_BUCKET_NAME` does not exist, it creates it automatically.
   - **`setupCronJobs()`**: Binds background task schedulers.
   - **Network Bind**: Binds the application to the network port (`3000` in production, `3001` in development). Serves static build files from the React frontend when in production.
2. **`app.ts`**: Configures the base Express application. Injects defensive security headers (`helmet`), opens safe browser paths (`cors`), mounts the REST endpoint modules under `/api/`, and maps global generic error traps.
3. **`middleware/authMiddleware.ts`**: Inspects header Bearer payloads. If a token signature is valid, it injects the identity (`req.user = decoded`). If the token signature is expired, it returns an explicit `TOKEN_EXPIRED` code to prompt silent recovery on the client side.

---

## 🖥️ 3. Frontend Architecture Details (`frontend/`)

The frontend is structured as a component-driven React single page application.

### 🔌 3.1. API & Interceptors Context (`frontend/src/services/api.ts`)
The API helper isolates network request details. It configures a base Axios client with standard path prefixes and injects a vital response interceptor:
- **Automatic Token Recovery**: If a request fails with an HTTP status code `401` and the response body returns `TOKEN_EXPIRED`, the interceptor automatically locks the query pipeline, issues a POST `/api/auth/refresh` request, stores the new access token in `localStorage`, updates standard Axios header configurations, and retries the original failed request seamlessly without user intervention.

---

### 🎨 3.2. State & Context Providers (`frontend/src/context/`)
- **`AuthContext.tsx`**: Provides authentication state across the application. It loads cached user logs and tokens from `localStorage` upon initialization. It exposes `login()`, `logout()` (which calls the backend `/logout` endpoint to clean DB states), and authentication flags globally.

---

### 🧱 3.3. UI & Page View Layouts (`frontend/src/pages/`)
1. **`Calendar.tsx`**: The main workflow workspace.
   - **Interactive Calendar Grid**: Renders a complete monthly calendar with indicators, themes, and weekday toggle options.
   - **Kanban Daily Board**: Integrates the `@dnd-kit` drag-and-drop pipeline. Features three reorderable columns: `OPEN` (A Fazer), `IN_PROGRESS` (Fazendo), and `DONE` (Concluído).
   - **Task CRUD Dialogs**: Allows quick card adjustments, card deletions, hex-color tag coloring, and image attachment management.
   - **AI Widget Panel**: Houses an interactive drawer to request, review, copy, and modify daily textual reports generated by the LLM.
2. **`Dashboard.tsx`**: An interactive performance viewport.
   - **Bento Grid Cards**: Displays static cards showing created tasks, completed tasks, completion rate metrics, and average completion duration in hours.
   - **Double-Bar Weeks Chart**: Visualizes progress using weekly blocks (Days 1-7, 8-14, etc.) formatted using pure Tailwind flex columns.
   - **Historical Report Logs**: Renders a listing of the last 5 reports generated by the AI, complete with a read-more modal dialog.
3. **`Login.tsx`**: A clean, single-form interface designed to collect authentication credentials and trigger the React authentication pipeline.

---

## 🗺️ 4. Monorepo Configuration Mappings

- **`docker-compose.yml`**: Configures multi-container coordination. Hooks up backend and frontend nodes alongside the PostgreSQL service, allowing simple one-command environments:
  ```bash
  docker compose up --build -d
  ```
- **`package.json`**: Root project descriptor containing run configurations for starting development systems inside both folders concurrently.
- **`.github/workflows/deploy.yml`**: Outlines continuous integration pipelines. On merges to `main`, it triggers a runner to build images, push packages to Docker Hub, connect to production systems via SSH, pull updated containers, and reload applications safely.
