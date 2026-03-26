---
name: Accessibility (WCAG 2.1 AA)
description: Accessible component design and WCAG 2.1 AA compliance standards for the YouTube-Shorter-Gemini frontend
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

## Core Principles

### 1. Semantic HTML First
- Use native HTML elements before custom components
- Leverage built-in browser accessibility
- Enhance with ARIA only when necessary

### 2. Keyboard Navigation
- All functionality available via keyboard
- Logical tab order
- Visible focus indicators
- Escape key to close modals/dialogs

### 3. Screen Reader Support
- Meaningful labels for all interactive elements
- Live regions for dynamic updates
- Alternative text for images/icons

### 4. Perceivable Content
- Color contrast ratios meet WCAG AA (4.5:1 for text, 3:1 for UI)
- Don't rely on color alone to convey information
- Provide captions for video content

## Mandatory Patterns & Rules

### Accessible Button Component

```typescript
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * Accessible button following WCAG 2.1 AA guidelines.
 * 
 * @fires yts-click - Dispatched on activation (click or Enter/Space)
 * @slot - Button label (required for accessibility)
 * @slot icon - Optional icon (decorative)
 */
@customElement('yts-button')
export class YtsButton extends LitElement {
  @property({ type: Boolean, reflect: true })
  disabled = false;

  @property({ type: String })
  variant: 'primary' | 'secondary' = 'primary';

  /**
   * Accessible label for screen readers.
   * Use when button only contains an icon.
   */
  @property({ type: String, attribute: 'aria-label' })
  ariaLabel?: string;

  /**
   * Loading state indicator.
   */
  @property({ type: Boolean })
  loading = false;

  static styles = css`
    :host {
      display: inline-block;
    }

    button {
      background: var(--yts-button-bg, #0066cc);
      color: var(--yts-button-color, #ffffff);
      padding: 0.75rem 1.5rem;
      border: 2px solid transparent;
      border-radius: 4px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      
      /* WCAG AA contrast: 4.5:1 minimum */
      /* #0066cc on white = 7.15:1 ✓ */
    }

    /* Visible focus indicator (WCAG 2.4.7) */
    button:focus-visible {
      outline: 3px solid var(--yts-focus-color, #005299);
      outline-offset: 2px;
    }

    /* Remove default focus outline, rely on :focus-visible */
    button:focus:not(:focus-visible) {
      outline: none;
    }

    button:hover:not(:disabled) {
      background: var(--yts-button-bg-hover, #005299);
      transform: translateY(-1px);
    }

    button:active:not(:disabled) {
      transform: translateY(0);
    }

    button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      background: var(--yts-button-bg-disabled, #cccccc);
    }

    /* Loading spinner */
    .spinner {
      display: inline-block;
      width: 1em;
      height: 1em;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    /* Reduced motion support (WCAG 2.3.3) */
    @media (prefers-reduced-motion: reduce) {
      button,
      .spinner {
        animation: none;
        transition: none;
      }
    }
  `;

  render() {
    return html`
      <button
        ?disabled=${this.disabled || this.loading}
        @click=${this._handleClick}
        @keydown=${this._handleKeydown}
        aria-label=${this.ariaLabel || nothing}
        aria-busy=${this.loading}
      >
        ${this.loading
          ? html`
              <span class="spinner" role="status">
                <span class="sr-only">Loading...</span>
              </span>
            `
          : html`
              <slot name="icon"></slot>
              <slot></slot>
            `
        }
      </button>
    `;
  }

  private _handleClick(e: MouseEvent) {
    if (this.disabled || this.loading) return;
    
    this.dispatchEvent(
      new CustomEvent('yts-click', {
        detail: { originalEvent: e },
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Handle keyboard activation (Enter and Space).
   * Required for full keyboard accessibility.
   */
  private _handleKeydown(e: KeyboardEvent) {
    if (this.disabled || this.loading) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._handleClick(e as any);
    }
  }
}
```

### Accessible Form Input

```typescript
/**
 * Accessible text input with label and error support.
 * 
 * @fires yts-input - Dispatched on input change
 */
@customElement('yts-input')
export class YtsInput extends LitElement {
  @property({ type: String })
  label = '';

  @property({ type: String })
  value = '';

  @property({ type: String })
  placeholder = '';

  @property({ type: Boolean })
  required = false;

  @property({ type: Boolean })
  disabled = false;

  @property({ type: String })
  error = ''; // Error message

  @property({ type: String })
  helperText = ''; // Helper text

  private inputId = `yts-input-${Math.random().toString(36).substr(2, 9)}`;
  private errorId = `${this.inputId}-error`;
  private helperId = `${this.inputId}-helper`;

  static styles = css`
    :host {
      display: block;
      margin-bottom: 1rem;
    }

    label {
      display: block;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--yts-label-color, #333);
    }

    input {
      width: 100%;
      padding: 0.75rem;
      border: 2px solid var(--yts-input-border, #ccc);
      border-radius: 4px;
      font-size: 1rem;
      transition: border-color 0.2s;
    }

    input:focus {
      outline: none;
      border-color: var(--yts-focus-color, #0066cc);
      box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
    }

    input[aria-invalid="true"] {
      border-color: var(--yts-error-color, #d32f2f);
    }

    .error {
      color: var(--yts-error-color, #d32f2f);
      font-size: 0.875rem;
      margin-top: 0.25rem;
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .helper {
      color: var(--yts-helper-color, #666);
      font-size: 0.875rem;
      margin-top: 0.25rem;
    }

    .required {
      color: var(--yts-error-color, #d32f2f);
    }
  `;

  render() {
    const hasError = this.error.length > 0;

    return html`
      <label for=${this.inputId}>
        ${this.label}
        ${this.required ? html`<span class="required" aria-label="required">*</span>` : ''}
      </label>

      <input
        id=${this.inputId}
        type="text"
        .value=${this.value}
        placeholder=${this.placeholder}
        ?required=${this.required}
        ?disabled=${this.disabled}
        aria-invalid=${hasError}
        aria-describedby=${hasError ? this.errorId : this.helperId}
        @input=${this._handleInput}
      />

      ${hasError
        ? html`
            <div id=${this.errorId} class="error" role="alert">
              ⚠️ ${this.error}
            </div>
          `
        : this.helperText
        ? html`
            <div id=${this.helperId} class="helper">
              ${this.helperText}
            </div>
          `
        : ''}
    `;
  }

  private _handleInput(e: InputEvent) {
    const target = e.target as HTMLInputElement;
    this.value = target.value;

    this.dispatchEvent(
      new CustomEvent('yts-input', {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      })
    );
  }
}
```

### Live Regions for Dynamic Content

Use for SSE progress updates:

```typescript
/**
 * Accessible progress indicator with live region.
 * Announces progress to screen readers.
 */
@customElement('yts-progress')
export class YtsProgress extends LitElement {
  @property({ type: Number })
  value = 0; // 0-100

  @property({ type: String })
  label = 'Progress';

  static styles = css`
    :host {
      display: block;
    }

    .progress-container {
      width: 100%;
    }

    .progress-bar {
      width: 100%;
      height: 8px;
      background: var(--yts-progress-bg, #e0e0e0);
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--yts-progress-color, #0066cc);
      transition: width 0.3s ease;
    }

    @media (prefers-reduced-motion: reduce) {
      .progress-fill {
        transition: none;
      }
    }
  `;

  render() {
    return html`
      <div class="progress-container">
        <div class="progress-bar" role="progressbar" aria-valuenow=${this.value} aria-valuemin="0" aria-valuemax="100" aria-label=${this.label}>
          <div class="progress-fill" style="width: ${this.value}%"></div>
        </div>

        <!-- Live region for screen reader announcements -->
        <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">
          ${this.label}: ${this.value}% complete
        </div>
      </div>
    `;
  }
}
```

### Skip Links for Navigation

```typescript
/**
 * Skip navigation link for keyboard users.
 * First focusable element on page.
 */
@customElement('yts-skip-link')
export class YtsSkipLink extends LitElement {
  static styles = css`
    a {
      position: absolute;
      left: -9999px;
      z-index: 999;
      padding: 1rem;
      background: var(--yts-focus-color, #0066cc);
      color: white;
      text-decoration: none;
      font-weight: bold;
    }

    a:focus {
      left: 0;
      top: 0;
    }
  `;

  render() {
    return html`
      <a href="#main-content">Skip to main content</a>
    `;
  }
}
```

### Screen Reader Only Utility Class

```css
/* Add to global styles */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

## Color Contrast Standards

### WCAG AA Requirements
- **Normal text**: 4.5:1 minimum contrast ratio
- **Large text** (18pt+ or 14pt+ bold): 3:1 minimum
- **UI components** (buttons, icons): 3:1 minimum

### Approved Color Palette

```css
:root {
  /* Primary colors (WCAG AA compliant on white) */
  --yts-primary: #0066cc; /* 7.15:1 on white ✓ */
  --yts-primary-hover: #005299; /* 9.17:1 on white ✓ */
  
  /* Semantic colors */
  --yts-success: #2e7d32; /* 4.52:1 on white ✓ */
  --yts-error: #d32f2f; /* 4.53:1 on white ✓ */
  --yts-warning: #f57c00; /* 3.96:1 on white - use bold text */
  
  /* Text colors */
  --yts-text-primary: #212121; /* 16.1:1 on white ✓ */
  --yts-text-secondary: #666666; /* 5.74:1 on white ✓ */
  
  /* Focus indicator */
  --yts-focus-color: #005299;
  --yts-focus-outline: 3px solid var(--yts-focus-color);
}
```

## Testing for Accessibility

### Automated Tests

```typescript
import { fixture, expect } from '@open-wc/testing';
import { YtsButton } from './yts-button.element';

describe('YtsButton Accessibility', () => {
  it('passes automated accessibility audit', async () => {
    const el = await fixture<YtsButton>(html`
      <yts-button>Accessible Button</yts-button>
    `);

    // Runs axe-core accessibility checks
    await expect(el).to.be.accessible();
  });

  it('has sufficient color contrast', async () => {
    const el = await fixture<YtsButton>(html`
      <yts-button>Button</yts-button>
    `);

    // Check computed contrast ratio
    await expect(el).shadowDom.to.be.accessible();
  });

  it('is keyboard navigable', async () => {
    const el = await fixture<YtsButton>(html`
      <yts-button>Press Enter</yts-button>
    `);

    let clicked = false;
    el.addEventListener('yts-click', () => { clicked = true; });

    const button = el.shadowRoot!.querySelector('button')!;
    
    // Simulate Enter key
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(clicked).to.be.true;
  });
});
```

### Manual Testing Checklist

- [ ] Navigate entire app using only keyboard (Tab, Shift+Tab, Enter, Space, Escape)
- [ ] Test with screen reader (VoiceOver on macOS, NVDA on Windows)
- [ ] Verify focus indicators visible on all interactive elements
- [ ] Check color contrast with browser DevTools
- [ ] Test with browser zoom at 200%
- [ ] Verify all images have alt text
- [ ] Test with reduced motion preference enabled
- [ ] Ensure forms have proper labels and error messages

## Common Pitfalls

### ❌ DON'T: Use divs as buttons
```typescript
// BAD: Not keyboard accessible, no semantic meaning
html`<div @click=${this.handleClick}>Click me</div>`
```

### ✅ DO: Use native button element
```typescript
// GOOD: Keyboard accessible, semantic
html`<button @click=${this.handleClick}>Click me</button>`
```

### ❌ DON'T: Hide content with display: none when it should be accessible
```typescript
// BAD: Screen readers can't access
.error { display: none; }
```

### ✅ DO: Use aria-live for dynamic content
```typescript
// GOOD: Announced to screen readers
html`<div role="alert" aria-live="assertive">${error}</div>`
```

### ❌ DON'T: Remove focus outlines globally
```typescript
// BAD: Breaks keyboard navigation
* { outline: none; }
```

### ✅ DO: Style focus indicators properly
```typescript
// GOOD: Visible focus with :focus-visible
button:focus-visible {
  outline: 3px solid #0066cc;
  outline-offset: 2px;
}
```

## ARIA Attributes Reference

| Attribute | Usage | Example |
|-----------|-------|---------|
| `aria-label` | Label when no visible text | `<button aria-label="Close">✕</button>` |
| `aria-labelledby` | Reference to label element | `<input aria-labelledby="label-id">` |
| `aria-describedby` | Reference to description | `<input aria-describedby="error-id">` |
| `aria-live` | Announce dynamic updates | `<div aria-live="polite">Loading...</div>` |
| `aria-busy` | Loading indicator | `<button aria-busy="true">Loading</button>` |
| `aria-invalid` | Form validation error | `<input aria-invalid="true">` |
| `aria-hidden` | Hide from screen readers | `<span aria-hidden="true">🎬</span>` |
| `role` | Define semantic role | `<div role="dialog">Modal content</div>` |

## Accessibility Checklist

Before deploying any component:
- [ ] Semantic HTML used where possible
- [ ] All interactive elements keyboard accessible
- [ ] Focus indicators visible and styled
- [ ] Color contrast meets WCAG AA (4.5:1 text, 3:1 UI)
- [ ] All images have alt text or aria-label
- [ ] Forms have associated labels
- [ ] Error messages use role="alert"
- [ ] Dynamic content uses aria-live regions
- [ ] Automated accessibility tests pass
- [ ] Manual keyboard navigation tested
- [ ] Screen reader tested (VoiceOver/NVDA)

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- Architecture: `_bmad-output/planning-artifacts/architecture.md` (WCAG 2.1 AA requirement)
