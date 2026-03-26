---
name: Monorepo & Turborepo Management
description: Rules for managing the Turborepo monorepo and npm workspaces in the YouTube Shorter project.
trigger: glob
globs:
  - "turbo.json"
  - "package.json"
  - "packages/**"
  - "apps/**"
---

# 🏗️ Monorepo & Turborepo Management Skill

## Overview
This project is a monorepo managed by **Turborepo** and **npm workspaces**. 

## 📂 Architecture
- `apps/front`: Lit Frontend (Vite)
- `apps/back`: NestJS Backend
- `packages/shared`: Common types, DTOs, and utility functions used by both front and back.

---

## 🛠️ Commands & Workspace Discipline
**NEVER** use `cd` into a workspace to run commands unless diagnostic tools require it.

- ✅ **Correct**: `npm run build --workspace=front`
- ✅ **Correct**: `npm run dev --workspace=back`
- ❌ **Incorrect**: `cd apps/back && npm run build`

### Common Commands:
- `npm run dev`: Launch all applications in parallel (Front + Back).
- `npm run lint`: Lint all workspaces.
- `npm run test`: Run tests across all workspaces.

---

## 📦 Dependency Isolation
- Shared code MUST live in `packages/shared`.
- `apps/front` and `apps/back` can only depend on `packages/shared`.
- Avoid circular dependencies between apps and packages.
- Shared utilities for both environments (e.g., date formatting, validation) should be in `packages/shared/src/utils/`.

---

## 🚀 Turborepo Pipelines (`turbo.json`)
- **Dependencies**: Tasks are defined in `turbo.json`. Ensure `dependsOn` is correctly set for build order (e.g., `build` tasks should depend on `^build` meaning building dependent packages first).
- **Cache**: Turborepo caches successful builds and tests. Do not bypass the cache unless testing non-deterministic behavior.

---

## 📝 Rules
1. **Always use workspace flags** in the root directory.
2. **Synchronize Versions**: Keep shared dependencies (like TypeScript version) consistent across `package.json` files if possible.
3. **Internal Imports**: Reference the shared package as `@youtube-shorter/shared`.
