# Contributing to youtube-shorter-gemini

## 🚀 Setup Local Development

### Prerequisites
- Node.js 18+ and npm 10+
- FFmpeg installed locally
- (Optional) Ollama for local AI processing

### Installation Steps
```bash
# Install dependencies
npm install

# Start development servers
npm run dev
```

The command will start:
- Backend (NestJS) on `http://localhost:3000`
- Frontend (Lit/Vite) on `http://localhost:5173`

## 🧪 Running Tests

### Run All Tests
```bash
# Run all tests across the monorepo (Turbo orchestration)
npm run test

# Run tests with coverage
npm run test:cov --workspace=back    # Backend (Jest)
npm run test:coverage --workspace=front  # Frontend (Vitest)
```

### Package-Specific Tests
```bash
# Backend (Jest)
cd apps/back && npm test
npm run test:watch  # Watch mode
npm run test:e2e    # Integration tests

# Frontend (Vitest)
cd apps/front && npm test
npm run test:watch  # Watch mode with UI
npm run test:coverage  # Generate coverage reports

# Shared package (Jest)
cd packages/shared && npm test
```

### Testing Strategy
- **Backend**: Jest 30.0.0 for unit and integration tests
- **Frontend**: Vitest 4.x for component and accessibility tests
- **Coverage Target**: 80% for core business logic
- **Test Co-location**: `*.spec.ts` files next to source code
- **Accessibility**: WCAG 2.1 AA compliance (see [ADR-002](docs/adr/002-testing-strategy.md))

### Writing Tests
- **Unit tests**: Co-locate with source (`*.spec.ts`)
- **Integration tests**: Place in `apps/back/test/` directory
- **Accessibility tests**: Use `apps/front/test/accessibility.spec.ts` as reference
- **Coverage**: All new code should maintain 80%+ coverage

## 🏗 Project Structure

- **`apps/back/`**: NestJS backend API
  - `src/modules/`: Business logic organized by domain
  - `src/entities/`: TypeORM entities (Data Mapper pattern)
  - `src/workers/`: Background jobs (FFmpeg, AI processing)
- **`apps/front/`**: Lit web components frontend
  - `src/components/`: Atomic Design structure (atoms, molecules, organisms)
  - `src/state/`: Lit Signals for global state
  - `src/services/`: API client and SSE handlers
- **`packages/shared/`**: Shared types, DTOs, and validation schemas
- **`.agent/skills/`**: Custom AI agent skills for development assistance

## 🖋 Commit Conventions

We use **Conventional Commits**:
- `feat:` : New feature
- `fix:` : Bug fix
- `docs:` : Documentation
- `style:` : Formatting
- `refactor:` : Refactoring
- `test:` : Adding tests
- `chore:` : Maintenance

### Example
```bash
git commit -m "feat: add video segment analysis service"
```

## 📝 Code Style

- **Naming**: `camelCase` for variables/methods, `PascalCase` for classes/types
- **TypeScript**: Strong typing required - enable `explicit-function-return-type`
- **Documentation**: JSDoc required for all public APIs and business logic
- **Tests**: Co-located (`.spec.ts` next to source files)

## 🛡 Ensuring CI Stability

To avoid "breaking" the CI during your commits, follow these rules and use local validation tools.

### ✅ Pre-Push Checklist (Mandatory)
Before each `git push`, run the following command at the project root:
```bash
npm run verify
```
This command executes sequentially:
1. `npm run build`: Verifies compilation and resolution of cross-cutting types.
2. `npm run lint`: Verifies style and unsafe types.
3. `npm run test`: Launches the complete test suite (Back, Front, Shared).

### 🏗 Architectural Safeguards
- **No dynamic imports for Node built-ins**: Avoid `await import('fs/promises')` or `path` inside functions. Use static imports at the top of the file to ensure compatibility with Jest/Vitest test environments without experimental flags.
- **Mock Hygiene**: In your tests (`.spec.ts`), ensure you reset not only call counters (`jest.clearAllMocks()`) but also specific implementations (`mockResolvedValue`) in the `beforeEach` if you modify global modules (e.g., `fs`).
- **Monorepo Dependencies**: If you modify `packages/shared`, you **must** run `npm run build` at the root for the changes to be visible to `apps/back` and `apps/front`.

## 🔄 Development Workflow

1. Use `/sprint-planning` for tracking
2. `/create-story` for detailing a task
3. `/dev-story` for implementation
4. **/verify-ci**: Verify that code compiles, passes lint and tests (mandatory before review)
5. `/code-review` before merging

## ⚖️ Licence

Chaque fichier doit inclure l'en-tête de licence Apache 2.0:

```typescript
/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
```
