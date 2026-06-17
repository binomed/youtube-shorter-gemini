# Antigravity System Rules & Architecture

**Project:** youtube-shorter-gemini
**Purpose:** A productivity tool to transform long YouTube videos into vertical Shorts using Gemini AI.
**Architecture:** Monorepo using Turborepo and npm workspaces.

## 🧠 Global Instructions for Antigravity

1. **Zero-Destruction Policy**: Never force-delete resources, overwrite user configurations without confirmation, or run destructive DB commands outside of targeted test environments.
2. **CI-First Development**: You are explicitly forbidden from suggesting commits or finishing a feature if `npm run lint`, `npm test`, or `npm run build` are failing. 
3. **Monorepo Awareness**:
   - Always run commands with appropriate workspace flags (e.g., `npm run dev --workspace=front`).
   - Respect boundaries between `apps/front`, `apps/back`, and `packages/shared`.
4. **Tool Use**: Prefer reading explicit `SKILL.md` instruction files in `.agents/skills/` before generating code based on generic knowledge.
5. **OpenSpec Spec-Driven Development**:
   - We use the Fission AI **OpenSpec** framework (`openspec/`) to drive all project features and fixes.
   - AI agents MUST align on a specification (`openspec/changes/<change-id>/`) before implementing changes.
   - Follow the OpenSpec cycle: Propose changes via `/opsx:propose`, implement them step-by-step with `/opsx:apply`, verify, and archive them with `/opsx:archive`.

## 📂 Domain-Specific Context Navigation
Depending on the files you are modifying, you MUST consult the local `AGENTS.md` rules:
- **Frontend** (`apps/front/`): Lit, Signals, Web Components -> 👉 Read `apps/front/AGENTS.md`
- **Backend / Video Processing** (`apps/back/`): NestJS, FFmpeg, Gemini -> 👉 Read `apps/back/AGENTS.md`
- **Shared Library** (`packages/shared/`): DTOs, Enums -> 👉 Read `packages/shared/AGENTS.md`
