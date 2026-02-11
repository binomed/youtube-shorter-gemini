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

```bash
# Run all tests across the monorepo
npm run test

# Run tests in a specific package
cd apps/back && npm test
cd apps/front && npm test
cd packages/shared && npm test
```

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
- `feat:` : Nouvelle fonctionnalité
- `fix:` : Correction de bug
- `docs:` : Documentation
- `style:` : Formattage
- `refactor:` : Refactorisation
- `test:` : Ajout de tests
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

## 🔄 Development Workflow

1. Use `/sprint-planning` pour le suivi
2. `/create-story` pour détailler une tâche
3. `/dev-story` pour l'implémentation
4. `/code-review` avant de merger

## ⚖️ Licence

Chaque fichier doit inclure l'en-tête de licence Apache 2.0:

```typescript
/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
```
