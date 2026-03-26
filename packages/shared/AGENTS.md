# 🧩 Shared Library Rules

These instructions apply exclusively to modifications within `packages/shared/`.

## 🛠️ Tech Stack & Environment
- **Language**: TypeScript (Ensure complete strictness `strict: true`).
- **Validations**: Class-Validator decorators.
- **Format**: ECMAScript Modules (`.js` imports internally) and CommonJS exports for dual-package publishing.

## 📜 Critical Rules
1. **Contract Stability**: 
   - Never introduce breaking changes without validating the impact on BOTH `apps/front/` and `apps/back/`.
   - Before renaming an established interface, you must use search and replace across the entire repository.
2. **Types vs Interfaces**:
   - Prefer `interface` over `type` when defining object structures to optimize compiler performance and enable declaration merging.
   - Use `enum` sparingly, relying heavily on discriminated unions or const assertions.
3. **No Business Logic**:
   - The `packages/shared/` directory is purely for defining the **shape** of data.
   - You MUST NOT import any library that binds to a specific environment (e.g., no Node `fs`, no DOM `window`).
4. **Consistency**:
   - Ensure all event payloads between Frontend Signals and Backend SSE are typed here.

## ✅ Pre-Commit Verification
Within this context, ensure you can successfully build the package:
```bash
npm run build --workspace=shared
```
