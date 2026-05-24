# 🛠️ KalendAI: Tech Stack & Versioning Documentation

This document provides a highly structured and detailed breakdown of the technical stack, runtime environments, frameworks, libraries, versions, and configurations powering the **KalendAI** full-stack workspace.

---

## 🧭 1. System Runtime & Architecture Layout

KalendAI is architected as an **NPM Workspace-based Monorepo** separating the presentation tier (frontend) and business/data tier (backend). Sharing and resolution of root dependencies are managed through hoisting mechanics.

```
kalendai/
├── package.json          # Root Monorepo configuration and shared dependencies
├── frontend/             # React SPA Frontend Client workspace
│   ├── package.json      # Frontend-specific dependencies and scripts
│   └── vite.config.ts    # Vite compiler and development proxy settings
└── backend/              # Node.js + Express API Server workspace
    ├── package.json      # Backend-specific dependencies and scripts
    └── tsconfig.json     # Backend TypeScript configuration
```

### ☕ Core Languages & Standards
- **TypeScript**: Used universally across both workspaces to guarantee static typing, predictable object model serialization, and clean compilation interfaces.
- **ES Modules (ESM)**: Both frontend and backend leverage modern ES6 Module standards (`import`/`export` syntax). The backend package explicitly sets `"type": "module"`.

---

## ⚙️ 2. Backend Workspace Stack

The backend API is designed as a modular RESTful service centered around Express.js and Prisma ORM.

### 📦 2.1. Direct Runtime Dependencies
Below is a detailed inventory of the exact library versions utilized to compile and run the backend server:

| Dependency | Target Version | Description / System Purpose |
| :--- | :--- | :--- |
| **express** | `^4.19.2` | Core web framework to handle routing, HTTP requests, responses, and controller middleware. |
| **@prisma/client** | `^5.11.0` | Node.js database ORM client utilized for database queries and relationship hydration. |
| **jsonwebtoken** | `^9.0.2` | Dual-token authentication generator to verify user sessions via JWT cryptographics. |
| **bcryptjs** | `^2.4.3` | Cryptographic salting (10 rounds) and password hashing library. |
| **@aws-sdk/client-s3** | `^3.540.0` | Official AWS SDK for S3 interactions, utilized to communicate with the local MinIO storage. |
| **@aws-sdk/s3-request-presigner** | `^3.540.0` | Ephemeral signed URL generator to support secure thumbnail rendering. |
| **multer** | `^1.4.5-lts.1` | Multipart Form-Data middleware utilized to load file streams into transient memory buffers. |
| **node-cron** | `^3.0.3` | Scheduled background task runner (daily rollover migrations and auto LLM updates). |
| **helmet** | `^7.1.0` | Security-oriented HTTP header injection middleware (XSS, Clickjacking, MIME checks). |
| **cors** | `^2.8.5` | Cross-Origin Resource Sharing control layer. |
| **zod** | `^3.22.4` | Strict schemas compilation and HTTP request body payload validators. |
| **dotenv** | `^16.4.5` | Loader of project-wide environment configurations. |

### 🛠️ 2.2. Development Dependencies
These libraries support testing, compiling, and bootstrapping the TypeScript environment in development mode:

- **typescript** (`^5.4.3`): Compiler support for modern syntax features.
- **tsx** (`^4.7.1`): Watch runner wrapper allowing direct execution of ESM TypeScript code inside Node runtime without manual pre-compilation passes.
- **prisma** (`^5.11.0`): CLI database migration, introspect, and type-generator helper.
- **@types/** definitions: Fully typed definitions for `node` (`^20.11.30`), `express`, `bcryptjs`, `jsonwebtoken`, `multer`, `cors`, and `node-cron` to maintain 100% strict type check coverage.

---

## 🖥️ 3. Frontend Workspace Stack

The frontend is a single page application built on top of React 18, utilizing Tailwind v4 and DnD-Kit for interface management.

### 📦 3.1. Direct Runtime Dependencies

| Dependency | Target Version | Description / System Purpose |
| :--- | :--- | :--- |
| **react** | `^18.2.0` | Core declarative UI rendering engine. |
| **react-dom** | `^18.2.0` | Virtual DOM management layer. |
| **@dnd-kit/core** | `^6.1.0` | Drag & drop baseline sensors, overlay handlers, and coordinates framework. |
| **@dnd-kit/sortable** | `^8.0.0` | Layout sortable list utilities and ordering calculations (used on Kanban tasks). |
| **@dnd-kit/utilities** | `^3.2.2` | Drag operations geometric transform helpers. |
| **axios** | `^1.6.8` | HTTP client configured with response interceptors for JWT expiration handling. |
| **zustand** | `^4.5.2` | Minimalist and fast state store for sharing component states globally. |
| **lucide-react** | `^0.368.0` | Beautiful vector micro-icons representing system triggers, statuses, and navigation. |
| **react-hot-toast** | `^2.4.1` | Lightweight, highly customizable notification popups for immediate user feedback. |

### 🛠️ 3.2. Development Dependencies
- **vite** (`^5.2.0`): Fast Next-Gen builder and bundling ecosystem.
- **@tailwindcss/vite** (`^4.1.14`): Direct Tailwind CSS v4 compiler integration designed for lightning fast performance.
- **tailwindcss** (`^4.1.14`): The styling utility system.
- **autoprefixer** (`^10.4.19`): Automatically injects vendor prefixes into compiled CSS.
- **@types/react** & **@types/react-dom** (`^18.2.66`): Type guarantees for React components and lifecycle hooks.
- **typescript** (`^5.2.2`): The frontend compiler constraints system.

---

## 🔗 4. Monorepo Shared Root Dependencies

Certain libraries are hoisted to the monorepo root `/package.json` to allow shared usage across environments:

- **@google/genai** (`^2.4.0`): The unified Google GenAI SDK used to communicate with Gemini LLM models for generating embedding dimensions (`text-embedding-004`) and daily summaries.
- **react-router-dom** (`^7.15.1`): Used for frontend SPA page mapping, pathing, and route protection checks.
- **node-fetch** (`^3.3.2`): High-performance HTTP request library enabling standard raw REST calls to Ollama or Deepseek API.
- **better-sqlite3** (`^12.10.0`) & **sqlite3** (`^6.0.1`): Native bindings supporting the SQLite filesystem databases.

---

## ⚡ 5. Compiling, Running & Commands

The project uses standard workspace mapping to run builds from a single terminal.

### 🏃 5.1. Common Monorepo Scripts
Run these commands from the root directory:

- **Launch Development Environment**:
  ```bash
  npm run dev
  ```
  Runs both `frontend` (Vite, port 3000 with backend proxy on 3001) and `backend` (tsx watch mode, port 3001) concurrently.
- **Production Build Compile**:
  ```bash
  npm run build
  ```
  Compiles both TS workspaces. Backend assets end up in `backend/dist` and frontend static files end up in `frontend/dist`.
- **System-Wide Lint Analysis**:
  ```bash
  npm run lint
  ```
  Enforces ES linting guidelines.

### 🐳 5.2. Containerization and Production Runtime
In production, KalendAI compiles inside standard lightweight container stacks orchestrated via `docker-compose.yml`:

- **Node.js Environment**: Minimum Node v18+ (Node v20 LTS recommended).
- **Relational Storage**: `ankane/pgvector:latest` Docker image. This is a PostgreSQL extension adding support for vector dimensions mapping (1536 parameters).
- **Object Storage**: A MinIO container running on ports `9000` (API) and `9001` (Console) virtualizing the S3 layer locally.
- **Reverse Proxy**: Nginx routing rules to cleanly bridge public SSL connections on port `80`/`443` to the internal API and SPA build static outputs.
