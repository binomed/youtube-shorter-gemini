# Story 0.1: monorepo-scaffolding

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Developer,
I want to initialize a Turborepo with apps for Back (NestJS) and Front (Lit),
so that I have a clean, shared workspace.

## Acceptance Criteria

1. A Turborepo monorepo is initialized using npm workspaces.
2. `apps/back` contains a standard NestJS initialization.
3. `apps/front` contains a Lit + Vite initialization.
4. `packages/shared` is set up for cross-app code sharing.
5. Common build, lint, and test commands work from the root via Turbo.
6. A base Tailwind CSS 4.x configuration is set up for the frontend.
7. Shoelace components are integrated into the frontend.
8. ESLint and Prettier are configured at the root and enforced across all packages.
9. A root README.md, CONTRIBUTING.md, and initial ADR (Architecture Decision Record) are created.
10. A complete structure for custom project skills (Lit, Nest, FFmpeg, Gemini IA, Testing, Workers, Security) is initialized.

## Tasks / Subtasks

- [x] Initialize Root Monorepo (AC: 1, 5)
  - [x] Create `package.json` with npm workspaces
  - [x] Configure `turbo.json` for base tasks (build, lint, test, dev)
- [x] Scaffold Apps (AC: 2, 3)
  - [x] Create `apps/back` using Nest CLI
  - [x] Create `apps/front` using Vite (Lit template)
- [x] Set up Shared Package (AC: 4)
  - [x] Initialize `packages/shared` with standard TS structure
  - [x] Link `packages/shared` as a dependency in `apps/back` and `apps/front`
- [x] Configure Frontend Styling & UI (AC: 6, 7)
  - [x] Install and configure Tailwind CSS 4.x in `apps/front`
  - [x] Install Shoelace in `apps/front` and verify component rendering
- [x] Linting & Formatting Scaffolding (AC: 8)
  - [x] Create root `.prettierrc` and `.prettierignore`
  - [x] Configure root ESLint with base rules for TS, Nest, and Lit
- [x] Project Documentation (AC: 9)
  - [x] Create a comprehensive root `README.md`
  - [x] Create `CONTRIBUTING.md` with guidelines on conventional commits and workflow
  - [x] Initialize `docs/adr` with the first ADR (from architecture.md)
- [x] Custom Project Skills Scaffolding (AC: 10)
  - [x] Create `.agent/custom-skills` directory
  - [x] Initialize placeholder instructions for:
    - [x] `lit.md` & `nest.md` (Framework standards)
    - [x] `ffmpeg.md` (Media processing)
    - [x] `gemini-ia.md` (Multimodal analysis & prompting)
    - [x] `testing.md` (Vitest, Jest, Playwright patterns)
    - [x] `workers.md` (Resilient background jobs)
    - [x] `security-privacy.md` (Zero-persistence & data handling)
    - [x] `accessibility.md` (WCAG 2.1 AA)
    - [x] `performance.md` (Profiling & SSE efficiency)
- [x] Global Quality Baseline (AC: 5)
  - [x] Add Apache 2.0 license headers to all initial source files [Source: architecture.md#Process Patterns]

## Dev Notes

- **Architecture Compliance:**
  - Naming: `camelCase` for variables/methods, `PascalCase` for Classes/Types [Source: architecture.md#Naming Patterns].
  - License: Apache 2.0 header required in every file [Source: architecture.md#Process Patterns].
  - Commits: Conventional Commits mandatory [Source: architecture.md#Process Patterns].
- **Tech Stack:**
  - Turborepo, NestJS v10+, Lit v3, Vite 6.x, Tailwind 4.x, Shoelace.
- **Project Structure:**
  - Follow the structure defined in [architecture.md#monorepo Structure](file:///Users/jeanfrancoisgarreau/Projets/youtube-shorter-gemini/_bmad-output/planning-artifacts/architecture.md#L62-L86).

### Project Structure Notes

- Use `npm workspaces` as requested in the architecture document despite Turborepo often being used with pnpm.
- `apps/front` will use the Vertical Reel layout pattern defined in [ux-design-specification.md](file:///Users/jeanfrancoisgarreau/Projets/youtube-shorter-gemini/_bmad-output/planning-artifacts/ux-design-specification.md).

### References

- [PRD](file:///Users/jeanfrancoisgarreau/Projets/youtube-shorter-gemini/_bmad-output/planning-artifacts/prd.md)
- [Architecture Decisions](file:///Users/jeanfrancoisgarreau/Projets/youtube-shorter-gemini/_bmad-output/planning-artifacts/architecture.md)
- [UX Design Specification](file:///Users/jeanfrancoisgarreau/Projets/youtube-shorter-gemini/_bmad-output/planning-artifacts/ux-design-specification.md)
- [Epics](file:///Users/jeanfrancoisgarreau/Projets/youtube-shorter-gemini/_bmad-output/planning-artifacts/epics.md)

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

- Root monorepo initialized with Turborepo and npm workspaces.
- apps/back (NestJS) and apps/front (Lit) scaffolded.
- packages/shared created and linked to both apps.
- Tailwind CSS 4.x set up in apps/front with @tailwindcss/vite.
- Shoelace integrated into apps/front (verified with sl-button).
- Root-level ESLint and Prettier configured.
- Apache 2.0 license headers added to all source files.
- Documentation (README, CONTRIBUTING, ADR 001) created.
- Custom project skills placeholders initialized in .agent/custom-skills.

### File List

- package.json (root)
- turbo.json
- eslint.config.js
- .prettierrc
- README.md
- CONTRIBUTING.md
- docs/adr/001-monorepo-structure.md
- apps/back/ (all files)
- apps/front/ (all files)
- packages/shared/ (all files)
- .agent/custom-skills/ (all md files)
