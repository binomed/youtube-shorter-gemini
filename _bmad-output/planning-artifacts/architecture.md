---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments: ['_bmad-output/planning-artifacts/prd.md']
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-02-08'
project_name: 'youtube-shorter-gemini'
author: 'jef'
date: '2026-02-07'
---

# Architecture Decisions - youtube-shorter-gemini

This document records the architectural decisions for the youtube-shorter-gemini project, ensuring consistency and preventing implementation conflicts.

## Executive Summary

[TBD: Architectural vision and core technical strategy]

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
The system must allow ingestion of local videos, their semantic analysis via Gemini, precise realignment (AI Timing), audio separation, and final vertical rendering, all driven by a minimalist SPA interface. Accessibility (WCAG 2.1 AA) is a major functional prerequisite.

**Non-Functional Requirements:**
- **Performance:** Local rendering < 60s for a 60s segment. Real-time status feedback.
- **Privacy:** Zero-persistence and local media processing.
- **Code Quality:** SOLID, KISS, unit tests (classes), strong typing (TypeScript). Object-oriented style (classes) preferred.
- **Documentation:** JSDoc, ADRs, Contribution Guide (CONTRIBUTING.md), Agent docs.

## Implementation Patterns & Consistency Rules

### Naming Patterns
- **Backend (TS):** `camelCase` for methods/variables, `PascalCase` for Classes/Types. Files: `domain-name.service.ts`.
- **Frontend (Lit):** `camelCase` for props/methods. Files: `my-component.element.ts`.
- **Database:** `snake_case` for tables/columns (SQL). `camelCase` mapping in TypeORM entities.
- **REST API:** Plural kebab-case (e.g., `/api/video-segments`).

### Structure Patterns
- **Co-location:** Test files (`*.spec.ts`) next to the source code.
- **Frontend:** **Atomic Design** organization (`atoms/`, `molecules/`, `organisms/`, `templates/`).
- **Shared Package:** A `shared` package centralizes DTOs, validation interfaces, and common types to ensure Back/Front consistency.

### Format Patterns
- **API Enveloping:** All REST responses follow `{ success: boolean, data: T, error?: string }`.
- **Temporal:** Dates in **ISO 8601** format (strings).
- **Errors:** Systematic use of NestJS exceptions (`HttpException`).

### Process Patterns
- **Documentation:** **JSDoc** mandatory for all business logic and public APIs.
- **Commits:** **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`).
- **License:** Apache 2.0 license header present in each source file.

## System Layout & Boundaries

### monorepo Structure (Turborepo + npm workspaces)

```text
youtube-shorter-gemini/
├── apps/
│   ├── back/                # Backend NestJS
│   │   ├── src/
│   │   │   ├── modules/     # Logic by domain (Video, IA, Project)
│   │   │   ├── entities/    # TypeORM Classes
│   │   │   └── workers/     # BullMQ Jobs (FFmpeg)
│   │   └── test/            # Jest Unit/Integration
│   └── front/               # Frontend Lit
│       ├── src/
│       │   ├── components/  # Atomic Design (Atoms, Molecules...)
│       │   ├── state/       # Lit Signals (Global state)
│       │   └── services/    # API Client (REST/SSE)
│       └── vite.config.ts
├── packages/
│   ├── shared/              # Shared logic
│   │   ├── dto/             # API request/response classes
│   │   ├── types/           # Common Interfaces
│   │   └── validation/      # Class-validator schemas
│   └── config/              # Shared build config (ESLint, Prettier)
├── docker/                  # Optional: Local LLM (Ollama) helpers
├── package.json             # Root package.json with npm workspaces
├── turbo.json               # Monorepo orchestration
└── .env.sample              # Configuration template
```

### Architectural Boundaries & Integration

**1. API Boundary (REST/SSE):**
- The Frontend never directly manipulates the file system or AI models.
- All interaction goes through the `back` service via typed endpoints.
- Rendering progress notifications (FFmpeg) are pushed via **SSE**.

**2. Data Boundary (Local SQLite):**
- Only the Backend has access to the SQLite instance.
- Data is isolated by project. No binary media storage in the database.

**3. Media Boundary (FFmpeg):**
- Orchestration via a **JobService (TypeORM + SQLite)**. Long tasks (FFmpeg, AI) are recorded in the database for persistence.
- Execution via `child_process.spawn` in isolated services to avoid blocking the Event Loop.
- Progress state updated in the database and broadcast via **SSE**.

### Feature Mapping (Requirements to Code)
- **Ingestion (FR-01):** `apps/back/modules/ingestion`
- **AI Detection (FR-04):** `apps/back/modules/analysis` (Gemini API / Ollama)
- **AI Timing (FR-05):** `apps/back/modules/processing/timing`
- **Rendering (FR-12):** `apps/back/modules/processing/render` (FFmpeg Wrapper handling multi-segment concatenation + JobService)
- **UI (FR-15):** `apps/front/components/organisms/shorts-editor`

### Technical Constraints & Dependencies
- **Monorepo:** Clear separation but unified code management.
- **Backend:** REST API with **NestJS**. CPU-intensive orchestration (FFmpeg) via a queue (**JobService (TypeORM + SQLite)** for persistence and simplicity).
- **Frontend:** SPA with **LitElement** and **Lit Signals** (native). Build via **Vite**.
- **Data:** **SQLite** for project metadata. No persistent media storage.
- **AI:** Hybrid (Gemini Cloud + Ollama Local).
- **Standards:** Prettier, Commit Convention, Apache 2.0 License.
- **Accessibility:** Priority for WCAG standards from design.

### Cross-Cutting Concerns
- **Multimedia Orchestration:** Asynchronous management of FFmpeg tasks to avoid blocking the main thread.
- **Real-time Feedback:** Use of **SSE** to notify the frontend of backend processing progress.
- **Decision Traceability:** Implementation of ADRs from the start.

## Core Architectural Decisions

### Data Architecture
- **Database:** SQLite (local storage engine, single file).
- **ORM:** **TypeORM v0.3.x** (Data Mapper pattern). Allows clear separation between DB entities and business logic, facilitating **SOLID**.
- **Migrations:** Managed via TypeORM CLI to ensure traceability of schema evolutions.

### Security & Secret Management
- **Authentication:** None (local use only).
- **Secrets:** Use of `.env` files ignored by Git. A `.env.sample` file will be provided to configure Gemini/Ollama keys.
- **Middlewares:** **Helmet** for basic NestJS API security.
- **Validation:** Strict input validation via **class-validator** and NestJS Pipes.

### API & Communication Patterns
- **REST API:** Standard for all synchronous interactions (project management, segment CRUD).
- **SSE (Server-Sent Events):** Used for state streaming during asynchronous tasks (FFmpeg segmenting, AI analysis).
- **Interface Contract:** Shared DTOs (TypeScript) in the monorepo's `shared` package.

### Frontend Architecture
- **State Management:** **Lit Signals** (native) for fine-grained reactivity without overhead.
- **Routing:** **@vaadin/router** (lightweight and standards-compliant).
- **Atomic Design:** Components organized by atoms/molecules, using **pure CSS** (Shadow DOM) with Tailwind for global layout.

### SQL-Queue Mechanism (Reactive)

To ensure lightweightness (KISS) and resilience, we use an event-driven queue:

1.  **Reception (Front -> Back):** The Frontend sends a processing request. The Backend immediately records the job in the database (`jobs` table) with `status: 'PENDING'`.
2.  **Reactive Activation:** Instead of "polling" the database, the Backend immediately triggers processing via an `EventEmitter` (or direct call to the `ProcessorService`) upon insertion.
3.  **FFmpeg Execution:** The Worker starts `child_process.spawn`. NestJS listens to FFmpeg's `stdout/stderr` streams.
4.  **In-flight Update:** Each time progress is detected in the FFmpeg output, the Backend updates the database row **AND** emits a message via the **SSE** stream opened by the client.
5.  **Recovery (Auto-Watchdog):** A lightweight background service only checks the database **at startup** or in case of a crash to restart jobs that may have stayed stuck in `PROCESSING`. In normal operation, everything is event-driven.

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
- The **Turborepo + NestJS + Lit** stack is perfectly coherent for a Full-Stack TypeScript project in 2026.
- **TypeORM + SQLite** is the most stable solution for class-typed local database management.
- The **SSE + reactive SQL-Queue** approach eliminates heavy dependencies (Redis) while ensuring persistence.

**Pattern Consistency:**
- Naming patterns (camelCase/snake_case) and the **Atomic Design** structure directly support the goal of clean code (SOLID).

### Requirements Coverage Validation ✅

**Functional Requirements Coverage:**
- **Ingestion/Projects:** Covered by `apps/back/modules/ingestion` and TypeORM.
- **AI Analysis:** Covered by `apps/back/modules/analysis` (Gemini API).
- **Processing/Render:** Covered by the reactive `JobService` and FFmpeg in `apps/back/modules/processing`.
- **UI:** Covered by Lit and Lit Signals in `apps/front`.

**Non-Functional Requirements Coverage:**
- **Performance:** Asynchronous `spawn` ensures the NestJS Event Loop is never blocked.
- **Local-first:** Redis removal for a "Zero-Config" deployment via SQLite/FFmpeg.

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION
**Confidence Level:** HIGH

**AI Agent Guidelines:**
- Use `apps/back` and `apps/front` as roots.
- Share DTOs via `packages/shared`.
- Respect the reactive SQL Job pattern for any task > 2s.

---
*Created as part of the youtube-shorter-gemini architecture definition.*

## Starter Template Evaluation

### Primary Technology Domain
**Full-Stack Monorepo** (Local + Cloud Hybrid) based on the TypeScript ecosystem.

### Starter Options Considered

1.  **Nx:** Very powerful, excellent NestJS/Vite support, but can be too complex (Over-engineering) for a "KISS" individual project.
2.  **NestJS Native Monorepo:** Simple for the backend, but less equipped to manage a Lit/Vite frontend within the same repo smoothly.
3.  **Turborepo + npm workspaces:** **SELECTED**. Offers the best balance between configuration simplicity (KISS) and performance.

### Selected Starter: Turborepo (via npm workspaces)

**Rationale for Selection:**
Turborepo allows a clean separation between `apps/api` (NestJS) and `apps/web` (Lit/Vite) while facilitating code sharing (DTOs, Types) via local libraries. Its configuration is minimal (`turbo.json`) and its execution is extremely fast.

**Initialization Command:**

```bash
pnpm create turbo@latest ./ --example kitchen-sink (adapted for Nest/Vite)
# Or manual initialization for total SOLID/KISS control```

### Architectural Decisions Provided by Starter

**Language & Runtime:**
- **TypeScript 5.x** configured via shared `tsconfig` at the root.
- **npm workspaces** for dependency management and local linking.

**Styling Solution:**
- **Tailwind CSS 4.x** integrated via Vite for the frontend.
- **Pure CSS** for Lit components (Atomic Design).

**Build Tooling:**
- **Vite 6.x** for the frontend (ultra-fast HMR).
- **Nest CLI** for the backend.
- **Turbo** to orchestrate builds, lint and tests in parallel.

**Testing Framework:**
- **Vitest** (Frontend) and **Jest** (Backend/NestJS) for complete class coverage.

**Code Organization:**
- `apps/api` : Backend NestJS.
- `apps/web` : Frontend Lit.
- `packages/shared`: Interface contract (DTOs), shared constants and types.
