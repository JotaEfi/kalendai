# 📜 Coding Conventions & Style Guide

This document establishes and documents the coding styles, linting configurations, naming conventions, and architectural best practices observed throughout the **KalendAI** monorepo codebase. All developers and AI agents must adhere strictly to these conventions when writing, refactoring, or reviewing code.

---

## 🛠️ 1. Language & Compiler Standards

The entire project is built using **TypeScript** as the standard language. The monorepo has two distinct project spaces with tailored compiler targets and module systems:

### ⚙️ Backend Compiler Settings (`backend/tsconfig.json`)
The backend uses modern **NodeNext** ESM configurations:
*   **Target**: `ES2022`
*   **Module System**: `NodeNext`
*   **Module Resolution**: `NodeNext`
*   **Strict Mode**: `strict: true` (strictly enforced, explicit types are required)
*   **Key Directive**: **ESModule relative imports must include the `.js` file extension** (e.g., `import app from './app.js';` and `import { prisma } from '../lib/prisma.js';`). Omitting this will result in runtime resolution errors under `NodeNext`.

### ✨ Frontend Compiler Settings (`frontend/tsconfig.json`)
The frontend is compiled as a modern React SPA using Vite:
*   **Target**: `ES2022`
*   **Module System**: `ESNext`
*   **Module Resolution**: `bundler` (tailored for Vite resolution)
*   **Path Aliases**: `@/*` is configured to map to `./src/*` (`"@/*": ["./*"]`) for cleaner imports (e.g., `import api from '@/services/api'`).
*   **Strict Typings**: No output emitting (`noEmit: true`) as type checking is run during linting.

---

## 🧹 2. Linting & Formatting Standards

Linting is integrated into the workspace pipeline via ESLint, with dedicated scripts in `package.json` for validation.

### Linting Scripts
*   **Frontend**: `tsc --noEmit && eslint src --ext ts,tsx --report-unused-disable-directives --max-warnings 0`
    *   *Note*: The frontend validates type compliance via the compiler and subsequently runs ESLint, enforcing a strict zero-warning rule (`--max-warnings 0`) before production builds.
*   **Backend**: `eslint src`
    *   *Note*: Scans the Express server codebase for styling and type errors.

### Formatting Style Guide (Observed Patterns)
Across the codebase, the following formatting standards are applied:
1.  **Indentation**: Strict **2-space indentation** (no tabs).
2.  **Semicolons**: **Always explicit**. Every statement must terminate with a semicolon.
3.  **Quotes**: **Single quotes** (`'`) for string literals inside JS/TS files. Double quotes (`"`) are reserved for HTML/JSX properties and JSON files.
4.  **Variable Declaration**: Preference for immutable data declarations. Use `const` by default; use `let` only when the variable's reference value changes. Never use `var`.
5.  **Arrow Functions**: Preferred syntax for controllers, handlers, callbacks, and inline components:
    ```typescript
    const handleAction = async () => { ... };
    ```

---

## 🏷️ 3. Naming Conventions

Consistency in naming allows high readability and easy navigation of components and database relationships.

### Directory Structures
*   **Folders**: Lowercase camelCase or kebab-case (e.g., `components`, `context`, `services`, `middleware`, `routes`, `jobs`).

### File Naming Conventions
*   **React Components**: **PascalCase** filenames (e.g., `SortableKanbanCard.tsx`, `Calendar.tsx`, `Layout.tsx`).
*   **Routes, Services, and Middleware**: **camelCase** filenames (e.g., `authRoutes.ts`, `minioService.ts`, `authMiddleware.ts`, `cronJobs.ts`).
*   **Database Models (Prisma)**: **PascalCase** singular names for model files and schemas (e.g., `User`, `KanbanCard`, `CardImage`, `DailyReport`, `RefreshToken`).

### Source Code Conventions
*   **Functions & Methods**: camelCase names starting with a verb (e.g., `processDailyRollover`, `generateDailyReport`, `getPresignedUrl`).
*   **Variables & Properties**: camelCase (e.g., `currentDate`, `isPastDay`, `passwordHash`, `completedAt`).
*   **API Routes**: Pluralized entities using lowercase RESTful standards:
    *   `GET /api/kanban/:date`
    *   `POST /api/kanban`
    *   `POST /api/kanban/:id/images`
    *   `DELETE /api/kanban/:id/images/:imageId`

---

## 🏗️ 4. Code Architecture & Design Patterns

### 🔄 Asynchronous Operations
All asynchronous functions are structured with the `async/await` syntax. `Promise.then` chaining is only used in frontend files for inline triggers (like updating state in a background API call without blocking UI state transitions).
*   **Strict Error Catching**: Every async call is wrapped in a `try-catch` block.
*   **Explicit Logging**: Catch blocks must log errors to the console (`console.error`) with a clear error context string.
*   **Catch-Clause Type Casting**: TS catch variables are explicitly typed as `any` or `Error` for handling:
    ```typescript
    } catch (error: any) {
      console.error('Error fetching cards:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
    ```

### 🔀 Modular UI Separation
Frontend components are designed around the separation of **functional layout wrapping** and **stateless rendering UIs**:
*   *Example*: `SortableKanbanCard` utilizes the `@dnd-kit/sortable` hooks to inject dragging states, and passes those properties directly down to a purely presentation-focused `KanbanCardUI` component. This increases component reusability and simplifies unit testing since the presentation layer can be isolated.

### 🌐 Cross-Database Adaptability (SQLite ⟷ PostgreSQL)
To facilitate smooth offline developer workflows alongside robust containerized cloud databases, the codebase incorporates dual-database compatibility conventions:
*   **Schema Adaptations**: The `schema.prisma` uses string representations (`String`) rather than database-specific Enums (like `Role` or `KanbanStatus`) to allow seamless SQLite migrations locally, while production uses PostgreSQL.
*   **Vector Embeddings Fallback**: When using PostgreSQL in production, embeddings are stored using raw SQL insertions with the `::vector` type. For local SQLite development, embedding arrays are serialized and saved inside a standard `String?` field.
*   **Robust Driver Failure Workarounds**: In Express controllers, connection timeouts or initialization failures from PostgreSQL (identified by `PrismaClientInitializationError` or error code prefixes matching `P`) automatically redirect execution to an in-memory mocked state (`global.mockCards`). This maintains a functional visual application for offline developer preview:
    ```typescript
    } catch (error: any) {
      if (error.name === 'PrismaClientInitializationError' || (error.code && error.code.startsWith('P'))) {
        // SQLite or disconnected dev fallback
        return res.json(global.mockCards);
      }
      res.status(500).json({ error: 'Server Error' });
    }
    ```

### 🔐 Security & Access Control
*   **Stateful JWT Authentication**: The application segregates auth into Access Tokens (short-lived, passed in memory or request payloads) and Refresh Tokens (long-lived, stored securely).
*   **HTTP Client Interceptors**: Frontend Axios clients (`frontend/src/services/api.ts`) handle expired access tokens automatically. If a call fails with `401` and a `TOKEN_EXPIRED` code, the interceptor fires a refresh request to `/api/auth/refresh`, updates credentials in local storage, and retries the original request seamlessly.
*   **MinIO Presigned Safety**: S3 assets are kept private in the object storage. The backend exposes public access via temporary presigned URLs (`getPresignedUrl`) with strict expiration limits, preventing static exposure of direct media paths.
