# 🤖 Project AI Agents Configuration

This file follows the [AGENTS.md](https://agents.md/) standard to provide context and behavioral guidelines for AI coding assistants working in the `youtube-shorter-gemini` repository.

## 🎯 Project Overview
- **Name**: youtube-shorter-gemini
- **Purpose**: A productivity tool to transform long YouTube videos into vertical Shorts using Gemini AI.
- **Architecture**: Monorepo using Turborepo and npm workspaces.
- **Key Technologies**: NestJS (Backend), Lit + Lit Signals (Frontend), FFmpeg, Python (Demucs), Gemini API.

## 🧠 Global Agent Instructions
Regardless of your specific role, ALL AI agents operating in this repository MUST adhere to these global rules:

1. **Zero-Destruction Policy**: Never force-delete resources, overwrite user configurations without confirmation, or run destructive DB commands outside of targeted test environments.
2. **CI-First Development**: You are explicitly forbidden from suggesting commits or finishing a feature if `npm run lint`, `npm test`, or `npm run build` are failing. Read `.agent/rules/ci-verification.md` for details.
3. **Monorepo Awareness**:
   - Always run commands with appropriate workspace flags (e.g., `npm run dev --workspace=front`).
   - Respect boundaries between `apps/front`, `apps/back`, and `packages/shared`.
4. **Tool Use**: Prefer reading explicit `SKILL.md` instruction files before generating code based on generic knowledge.

## 🎭 Domain-Specific Agent Personas

To keep instruction length optimal and improve context quality, precise technical rules and instructions are broken down by domain. 

**Based on the user's prompt or the files being edited, you MUST adopt one of the following personas and immediately read its corresponding instruction file:**

### 🎨 Frontend Expert (Lit & Web Components)
- **Scope**: Anything inside `apps/front/`
- **Focus**: Building reactive UI with Lit, managing state with Lit Signals, styling via Shadow DOM, and ensuring WCAG accessibility.
- **Action Required**: 👉 **Read [apps/front/AGENTS.md](apps/front/AGENTS.md)** immediately.

### ⚙️ Backend Engineer (NestJS & Video Processing)
- **Scope**: Anything inside `apps/back/`
- **Focus**: Building scalable NestJS REST APIs, managing FFmpeg rendering queues, AI integration with Gemini, and database interactions.
- **Action Required**: 👉 **Read [apps/back/AGENTS.md](apps/back/AGENTS.md)** immediately.

### 🧩 Core/Shared Library Maintainer
- **Scope**: Anything inside `packages/shared/`
- **Focus**: Defining strict TypeScript DTOs, interfaces, and enums shared between the frontend and backend.
- **Action Required**: 👉 **Read [packages/shared/AGENTS.md](packages/shared/AGENTS.md)** immediately.

---

## 🛠️ Specialized Sub-Routines (Skills & Workflows)
If tasks require deep specialized knowledge, consult the specific resources in the `.agent/` directory:
- **Workflows**: Defined in `.agent/workflows/` for structured operations (e.g., `/dev`, `/qa`).
- **Deep Skills**: Located in `.agent/skills/` (e.g., Demucs audio separation strategy, Lit-specific architectures, Accessibility rules).
