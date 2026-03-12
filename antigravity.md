# Antigravity System Rules & Architecture Router

> **CRITICAL DIRECTIVE FOR AGENT**: You MUST explicitly read the files listed in this document using the `view_file` tool BEFORE taking any action or writing any plan, based on the context of the user's request. **Do not rely solely on your generic knowledge.**

You have been configured to support the emerging `AGENTS.md` standard.

1. First, **you MUST read the central registry**: `AGENTS.md` (located at the root of the project).
2. Follow the persona routing instructions located inside `AGENTS.md` to identify your role (Frontend, Backend, Shared) for the current task.
3. Once you determine your role, you MUST read the corresponding sub-directory `*/AGENTS.md` before writing code.

---

## Pre-Commit / Pre-Review Mandatory Verification

Before concluding a task, asking for code review, or attempting any git operations:
- You MUST read and follow the instructions in `.agent/rules/ci-verification.md`.
- No code should be committed by the agent if it fails linting, building, or testing.

