---
trigger: glob
globs: apps/front/src/**/*.ts
---

# Accessibility Custom Skill

## When to Use This Skill

Use this skill for ALL frontend components in `apps/front/src/components/`. Accessibility is a **functional requirement** (FR-15 in architecture), not optional.

WCAG 2.1 Level AA compliance is **mandatory** for:
- All interactive components (buttons, forms, inputs)
- Navigation and routing
- Dynamic content updates (SSE progress, notifications)
- Media controls
- Color contrast and typography

Use and read .agents/skills/accessibility_wcag/SKILL.md !