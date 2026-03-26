# 🎨 Frontend Domain Rules

These instructions apply to modifications within `apps/front/`.

## 🛠️ Tech Stack & Environment
- **Framework**: Lit 3.x
- **State Management**: `@lit-labs/signals` (Do not use Redux, Zustand, or simple `@state` properties for global state).
- **Styling**: Vanilla CSS inside Shadow DOM leveraging `--yts-*` custom properties. Tailwind 4.x is permitted ONLY outside of Shadow DOM (in global layouts like `index.html` or main UI grids).
- **UI Library**: Shoelace (wrapped in specific `yts-` elements when needed).
- **Build Tool**: Vite.

## 📜 Critical Rules
1. **Component Design**: 
   - All components must be class-based `LitElement` prefixed with `yts-` (e.g., `yts-button.element.ts`).
   - Use atomic design principles (`atoms/`, `molecules/`, `organisms/`).
   - Decompose large `render()` templates into private methods.
2. **Reactivity & Communication**:
   - For global state: Use Lit Signals (`apps/front/src/state/`).
   - For local component behavior: Use `@state()`.
   - Never mutate signal values directly. Always replace immutably.
   - Use custom events for Child -> Parent communication.
3. **Styling Limitations**:
   - You MUST use the design system's CSS variables (`--yts-*`) for colors, borders, and backgrounds inside `static styles = css`.
   - Tailwind classes inside `LitElement` tags are ignored due to Shadow DOM.

## 📚 Required Context
Before generating code, reference the deep skills in `.agents/skills/`:
- `lit_web_components/SKILL.md`
- `modern_css_styling/SKILL.md`
- `accessibility_wcag/SKILL.md`

## ✅ Pre-Commit Verification
Within this context, ensure you can successfully run:
```bash
npm run test:coverage --workspace=front
npm run test:a11y --workspace=front
```
