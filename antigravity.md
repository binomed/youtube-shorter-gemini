# Antigravity System Rules & Architecture Router

> **CRITICAL DIRECTIVE FOR AGENT**: You MUST explicitly read the files listed in this document using the `view_file` tool BEFORE taking any action or writing any plan, based on the context of the user's request. **Do not rely solely on your generic knowledge.**

## 1. Domain-Specific Routing

Depending on which part of the codebase you are modifying, you MUST read the following architecture rules and skills:

### 🌟 FULL-STACK / ARCHITECTURE
If the user's request involves changing shared interfaces, DTOs, or overall logic:
- `.agent/rules/ci-verification.md`

### 💻 FRONTEND (`apps/front/`)
If you are asked to create, modify, or debug frontend components (Lit, UI, State):
1. **First**, read strictly: `.agent/rules/lit-web-components.md`
2. **Second**, read the comprehensive skill: `.agent/skills/lit_web_components/SKILL.md`
3. **If touching CSS/UI**, read: `.agent/skills/accessibility_wcag/SKILL.md`

### ⚙️ BACKEND (`apps/back/`)
If you are asked to create, modify, or debug backend features (NestJS API, Services, DB):
1. **First**, read strictly: `.agent/rules/nestjs-backend.md`
2. **Second**, read the comprehensive skill: `.agent/skills/nestjs_backend/SKILL.md`
3. **If processing video/audio**, read: `.agent/skills/ffmpeg_media_processing/SKILL.md`
4. **If using Gemini API**, read: `.agent/skills/gemini_ai_integration/SKILL.md`

---

## 2. Workflows & Agents Commands (`.agent/workflows`)

The user has defined specific `.md` workflows in `.agent/workflows/` (e.g., `/dev`, `/qa`, `/pm`).
If the user mentions a specific workflow or slash command, or if their request clearly maps to one of those known project workflows (like writing a technical spec or doing an architectural review):
- You MUST use `view_file` on the corresponding `[workflow-name].md` file inside `.agent/workflows/`.
- Follow the workflow steps sequentially and rigorously.

---

## 3. Pre-Commit / Pre-Review Mandatory Verification

Before concluding a task, asking for code review, or attempting any git operations:
- You MUST read and follow the instructions in `.agent/rules/ci-verification.md`.
- No code should be committed by the agent if it fails linting, building, or testing.
