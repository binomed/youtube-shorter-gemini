---
name: Modern CSS & Styling Architecture
description: Comprehensive styling guidelines combining Tailwind CSS, Shoelace custom theming, and modern aesthetics (Glassmorphism, Fluid Typography) within Lit Web Components.
trigger: glob
globs:
  - "**/*.css"
  - "apps/front/src/**/*.ts"
  - "apps/front/index.html"
---

# 🎨 Modern CSS & Styling Architecture Skill

## When to Use This Skill
You **MUST** use this skill whenever you are making visual changes to the frontend (`apps/front/`). This includes:
- Structuring new page layouts.
- Building or modifying Lit Web Components.
- Customizing Shoelace (`<sl-*>`) elements.
- Implementing modern UI effects (glassmorphism, dark mode, responsive text).

---

## 🏗️ 1. The Styling Boundary (Tailwind vs. Shadow DOM)

The most critical architectural rule in this project is understanding where Tailwind CSS is allowed and where it is strictly forbidden.

### 🟢 Outside Shadow DOM (Global Layouts)
**Use Tailwind CSS**
- **Where**: `index.html`, root page components (`apps/front/src/pages/*.ts`), or top-level grid/flex containers that do not encapsulate internal component logic.
- **Why**: Tailwind provides rapid, responsive macro-layouts (e.g., `grid grid-cols-1 md:grid-cols-2 gap-4 h-screen w-full`).

### 🔴 Inside Shadow DOM (Lit Web Components)
**DO NOT use Tailwind CSS classes.** They will be ignored.
- **Where**: Inside the `render()` method of any `yts-*.element.ts` component.
- **What to use instead**: 
  - Standard CSS inside `static styles = css\`.`
  - CSS Custom Properties (Variables) prefixed with `--yts-*`.
  - The project's central design tokens (e.g., `var(--yts-primary)`).

### 💉 How to Inject Shared CSS into Lit Components
To maintain a DRY architecture and avoid repeating Shoelace overrides or glass panels in every component, you MUST import and inject the shared `ytsPremiumStyles` from `apps/front/src/styles/yts-styles.ts`.

**Pattern:**
```typescript
import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
// 1. Import the shared styles
import { ytsPremiumStyles } from '../../styles/yts-styles.js';

@customElement('yts-example')
export class YtsExample extends LitElement {
  
  // 2. Inject it as an array along with component-specific styles
  static styles = [
    ytsPremiumStyles,
    css`
      :host {
        display: block;
        /* component specific styles here */
      }
    `
  ];

  render() {
    return html`<sl-button variant="primary">Restyled Button</sl-button>`;
  }
}
```

---

## 👟 2. Shoelace Theming & Customization

Shoelace provides robust web components, but they must be styled to match the project's premium aesthetic.

### Best Practices:
1. **Design Tokens (`--sl-*`)**: Override global Shoelace variables in the root CSS (`index.css`) to affect all components (e.g., `--sl-color-primary-500: var(--yts-primary);`).
2. **CSS Parts (`::part`)**: Use the `::part()` pseudo-element to target specific internal pieces of a Shoelace component from your Lit component's `static styles`.

**Example:**
```css
/* Inside yts-custom-button.element.ts */
static styles = css`
  /* Target the internal 'base' part of the Shoelace button */
  sl-button::part(base) {
    background: var(--yts-glass-bg);
    border: 1px solid var(--yts-glass-border);
    backdrop-filter: blur(var(--yts-blur));
    border-radius: var(--yts-radius);
    transition: all 0.3s ease;
  }

  sl-button::part(base):hover {
    background: var(--yts-glass-bg-hover);
    transform: translateY(-2px);
  }
`;
```

---

## ✨ 3. Modern Web App Aesthetics

This project demands a highly premium, modern, and dynamic interface. Basic flat designs are unacceptable.

### 🔍 Glassmorphism (Frosted Glass Effect)
Use glassmorphism to create depth, especially over vibrant backgrounds or video elements.

**Rules for Glassmorphism:**
1. **Translucency & Blur**: Combine `background: rgba(...)` with `backdrop-filter: blur(...)`.
2. **Subtle Borders**: Always add a semi-transparent, bright border to simulate the glass edge.
3. **Contrast**: Ensure text remains highly readable (WCAG AA) over the blurred background.

```css
.glass-panel {
  /* The core effect */
  background: rgba(30, 35, 50, 0.6); /* Semi-transparent dark */
  backdrop-filter: blur(16px);       /* The frost */
  -webkit-backdrop-filter: blur(16px);
  
  /* The physical glass properties */
  border: 1px solid rgba(255, 255, 255, 0.1); 
  border-radius: 24px;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
}
```

### 🌊 Fluid Typography
Text must adapt seamlessly to screen sizes without relying solely on abrupt media query breakpoints.

**Rules for Fluid Typography:**
- Use the CSS `clamp()` function for headings (`h1`, `h2`, `h3`) and large UI text.
- Format: `clamp(minimum_size, preferred_fluid_size, maximum_size)`

```css
h1 {
  /* Min: 2rem, Fluid: 4vw + 1rem, Max: 4rem */
  font-size: clamp(2rem, 4vw + 1rem, 4rem);
  line-height: 1.1;
  font-family: 'Inter', system-ui, sans-serif;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.body-text {
  /* Gentle scaling for body text */
  font-size: clamp(1rem, 1vw + 0.8rem, 1.125rem);
}
```

### 🔮 Micro-Animations & State Feedback
Interfaces must feel "alive".
- **Hover/Active States**: Every interactive element must provide immediate visual feedback (color shift, subtle scale).
- **Transitions**: Use `transition: all 0.2s cubic-bezier(...)` globally on interactive elements. Avoid jarring, instant state changes.

---

## 📝 Developer Checklist for Styling

Before finalizing any frontend styling tasks, verify:
- [ ] **No Tailwind classes** are used inside the `render()` method of Lit Web Components.
- [ ] **Shoelace overrides** utilize `::part()` instead of fragile DOM querying.
- [ ] **Glassmorphism** has a fallback background color in case `backdrop-filter` fails.
- [ ] **Typography** uses `clamp()` to scale smoothly between mobile and desktop dimensions.
- [ ] **Variables**: Colors and spacings reference `--yts-*` custom properties rather than hard-coded `#hex` values.
