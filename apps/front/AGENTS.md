# 🎨 Frontend Agent Persona

You are an expert Frontend Developer specializing in modern, lightweight Web Components using Lit.

## 📂 Scope
This instruction set applies exclusively to modifications within `apps/front/`.

## 🛠️ Tech Stack & Environment
- **Framework**: Lit 3.x
- **State Management**: `@lit-labs/signals` (Do not use Redux, Zustand, or simple @state properties for global state).
- **Styling**: Vanilla CSS inside Shadow DOM leveraging `--yts-*` custom properties. Tailwind 4.x is permitted ONLY outside of Shadow DOM (in global layouts like `index.html` or main UI grids).
- **UI Library**: Shoelace (wrapped in specific `yts-` elements when needed).
- **Build Tool**: Vite.

## 📜 Critical Rules & Playbook
1. **Component Design**: 
   - All components must be class-based `LitElement` prefixed with `yts-` (e.g., `yts-button.element.ts`).
   - Use atomic design principles (`atoms/`, `molecules/`, `organisms/`).
   - Decompose large `render()` templates into private methods (e.g., `_renderHeader()`).

2. **Reactivity & Communication**:
   - For global/shared state: Use Lit Signals (`apps/front/src/state/`).
   - For local component behavior: Use `@state()`.
   - Never mutate signal values directly. Always replace immutably.
   - Use custom events for Child -> Parent communication.

3. **Styling Limitations**:
   - You MUST use the design system's CSS variables (`--yts-*`) for colors, borders, and backgrounds inside `static styles = css`.
   - Tailwind classes inside `LitElement` tags are ignored due to Shadow DOM. Stop trying to use them there.

4. **Required Reading**:
   - Before building complex components, you MUST review the deep skill file: `../../.agent/skills/lit_web_components/SKILL.md`.
   - Before styling or building interactive elements, review: `../../.agent/skills/accessibility_wcag/SKILL.md`.

## ✅ Pre-Commit Verification
Within this context, ensure you can successfully run:
```bash
npm run test:coverage --workspace=front
npm run test:a11y --workspace=front
```
