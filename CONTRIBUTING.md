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

## 🛡 Ensurer la Stabilité de la CI

Pour éviter de "casser" la CI lors de vos commits, suivez ces règles et utilisez les outils de validation locale.

### ✅ Checklist Pré-Push (Obligatoire)
Avant chaque `git push`, lancez la commande suivante à la racine du projet :
```bash
npm run verify
```
Cette commande exécute séquentiellement :
1. `npm run build` : Vérifie la compilation et la résolution des types transverses.
2. `npm run lint` : Vérifie le style et les types non-safe.
3. `npm run test` : Lance la suite complète de tests (Back, Front, Shared).

### 🏗 Garde-fous Architecturaux
- **Pas d'imports dynamiques pour les built-ins Node** : Évitez `await import('fs/promises')` ou `path` à l'intérieur des fonctions. Utilisez des imports statiques en haut de fichier pour garantir la compatibilité avec l'environnement de test Jest/Vitest sans flags expérimentaux.
- **Hygiène des Mocks** : Dans vos tests (`.spec.ts`), assurez-vous de réinitialiser non seulement les compteurs d'appels (`jest.clearAllMocks()`) mais aussi les implémentations spécifiques (`mockResolvedValue`) dans le `beforeEach` si vous modifiez des modules globaux (ex: `fs`).
- **Dépendances Monorepo** : Si vous modifiez `packages/shared`, vous **devez** lancer `npm run build` à la racine pour que les changements soient visibles par `apps/back` et `apps/front`.

## 🔄 Development Workflow

1. Use `/sprint-planning` pour le suivi
2. `/create-story` pour détailler une tâche
3. `/dev-story` pour l'implémentation
4. **/verify-ci** : Vérifier que le code compile, passe le lint et les tests (obligatoire avant review)
5. `/code-review` avant de merger

## ⚖️ Licence

Chaque fichier doit inclure l'en-tête de licence Apache 2.0:

```typescript
/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
```
