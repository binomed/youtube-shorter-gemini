---
name: Lit Web Components
description: Building reactive web components with Lit 3.x and Lit Signals for the YouTube-Shorter-Gemini frontend
---

# Lit Custom Skill

## When to Use This Skill

Use this skill when working on ANY frontend component in `apps/front/src/components/`. This includes:
- Creating new web components
- Managing component state with Lit Signals
- Implementing reactive UI patterns
- Working with Shadow DOM styling
- Building accessible, performant components

## Core Principles

### 1. Lit 3.x Component Architecture
- Use **class-based** LitElement components (aligns with project's OOP preference)
- Leverage **Lit Signals** for reactive state management (NO external state libraries)
- Follow **Atomic Design** organization: `atoms/`, `molecules/`, `organisms/`, `templates/`
- Use **Shadow DOM** for style encapsulation with CSS custom properties for theming

### 2. TypeScript-First Development
- **Strong typing** for all props, events, and state
- Use `@property()` decorator with explicit types
- Define custom event types as interfaces
- Export component types for consumers

### 3. Performance & Accessibility
- Lazy load heavy components
- Use `@query()` for efficient DOM access
- Implement ARIA attributes systematically
- Test keyboard navigation in all interactive components

## Mandatory Patterns & Rules

### File Naming & Organization

```
apps/front/src/components/
├── atoms/
│   └── yts-button.element.ts          ← Naming: {prefix}-{name}.element.ts
├── molecules/
│   └── yts-progress-bar.element.ts
└── organisms/
    └── yts-video-editor.element.ts
```

**Rules:**
- ✅ Prefix all components with `yts-` (YouTube Shorter)
- ✅ File extension: `.element.ts`
- ✅ One component per file
- ✅ Co-locate test file: `yts-button.element.spec.ts`

### Component Structure Template

```typescript
import { LitElement, html, css } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { signal, computed } from '@lit-labs/signals';

/**
 * A reusable button component with loading states.
 * 
 * @fires yts-click - Dispatched when button is clicked
 * @slot - Button label content
 * @csspart button - The native button element
 */
@customElement('yts-button')
export class YtsButton extends LitElement {
  // Public reactive properties
  @property({ type: Boolean, reflect: true })
  disabled = false;

  @property({ type: String })
  variant: 'primary' | 'secondary' = 'primary';

  // Internal state (not exposed as attribute)
  @state()
  private isLoading = false;

  // DOM queries (prefer @query over querySelector)
  @query('button')
  private buttonElement!: HTMLButtonElement;

  // Lit Signals for shared/global state
  private static userPreferences = signal({ theme: 'dark' });

  // Computed values from signals
  private buttonTheme = computed(() => 
    YtsButton.userPreferences.value.theme === 'dark' ? 'dark-btn' : 'light-btn'
  );

  static styles = css`
    :host {
      display: inline-block;
    }

    button {
      /* Use CSS custom properties for theming */
      background: var(--yts-button-bg, #007bff);
      color: var(--yts-button-color, white);
      padding: var(--yts-spacing-md, 0.75rem 1.5rem);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      transition: background 0.2s;
    }

    button:hover:not(:disabled) {
      background: var(--yts-button-bg-hover, #0056b3);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Shadow part for external styling */
    button::part(icon) {
      margin-right: 0.5rem;
    }
  `;

  render() {
    return html`
      <button
        part="button"
        ?disabled=${this.disabled || this.isLoading}
        @click=${this._handleClick}
        aria-busy=${this.isLoading}
        class=${this.buttonTheme.value}
      >
        ${this.isLoading 
          ? html`<span class="spinner"></span>` 
          : html`<slot></slot>`
        }
      </button>
    `;
  }

  /**
   * Handles click events and dispatches custom event.
   * Private methods use underscore prefix.
   */
  private _handleClick(e: MouseEvent) {
    if (this.disabled || this.isLoading) return;

    this.dispatchEvent(
      new CustomEvent('yts-click', {
        detail: { timestamp: Date.now() },
        bubbles: true,
        composed: true, // Cross shadow DOM boundary
      })
    );
  }

  /**
   * Public API method for external control.
   */
  public async simulateLoading(duration: number): Promise<void> {
    this.isLoading = true;
    await new Promise(resolve => setTimeout(resolve, duration));
    this.isLoading = false;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'yts-button': YtsButton;
  }
}
```

### State Management with Lit Signals

**Global state location:** `apps/front/src/state/`

```typescript
// apps/front/src/state/video-state.ts
import { signal, computed } from '@lit-labs/signals';

export interface VideoSegment {
  id: string;
  startTime: number;
  endTime: number;
  selected: boolean;
}

// Signals are reactive primitives
export const videoSegments = signal<VideoSegment[]>([]);
export const currentVideo = signal<string | null>(null);

// Computed values auto-update
export const selectedSegmentsCount = computed(() => 
  videoSegments.value.filter(s => s.selected).length
);

// Actions modify signals
export const addSegment = (segment: VideoSegment) => {
  videoSegments.value = [...videoSegments.value, segment];
};

export const toggleSegmentSelection = (id: string) => {
  videoSegments.value = videoSegments.value.map(s =>
    s.id === id ? { ...s, selected: !s.selected } : s
  );
};
```

**Using in components:**

```typescript
import { videoSegments, toggleSegmentSelection } from '../state/video-state.js';

@customElement('yts-segment-list')
export class YtsSegmentList extends LitElement {
  render() {
    // Signals auto-trigger re-render
    return html`
      ${videoSegments.value.map(segment => html`
        <yts-segment-item
          .segment=${segment}
          @toggle=${() => toggleSegmentSelection(segment.id)}
        ></yts-segment-item>
      `)}
    `;
  }
}
```

### Event Communication Patterns

**1. Parent → Child (Properties/Attributes)**
```typescript
html`<yts-button .disabled=${true} variant="primary"></yts-button>`
```

**2. Child → Parent (Custom Events)**
```typescript
// In child
this.dispatchEvent(new CustomEvent('segment-selected', {
  detail: { segmentId: '123' },
  bubbles: true,
  composed: true
}));

// In parent
html`
  <yts-segment-list 
    @segment-selected=${(e: CustomEvent) => console.log(e.detail.segmentId)}
  ></yts-segment-list>
`
```

**3. Sibling Components (Signals)**
```typescript
// Use shared signals for cross-component communication
import { currentUser } from '../state/app-state.js';
```

## Common Pitfalls

### ❌ DON'T: Mix reactive patterns
```typescript
// BAD: Using both signals and @state for same data
@state() private count = 0;
private countSignal = signal(0);
```

### ✅ DO: Use one reactive pattern
```typescript
// GOOD: Use signals for shared state, @state for component-local
private localLoadingState = signal(false);
```

### ❌ DON'T: Mutate signal values directly
```typescript
// BAD
videoSegments.value.push(newSegment); 
```

### ✅ DO: Replace signal values immutably
```typescript
// GOOD
videoSegments.value = [...videoSegments.value, newSegment];
```

### ❌ DON'T: Use querySelector in render()
```typescript
// BAD: Causes performance issues
render() {
  const button = this.shadowRoot?.querySelector('button');
  return html`...`;
}
```

### ✅ DO: Use @query decorator
```typescript
// GOOD
@query('button') private button!: HTMLButtonElement;
```

## Testing Requirements

### Unit Tests (Vitest + @open-wc/testing)

```typescript
// yts-button.element.spec.ts
import { fixture, html, expect } from '@open-wc/testing';
import { YtsButton } from './yts-button.element.js';

describe('YtsButton', () => {
  it('renders with default properties', async () => {
    const el = await fixture<YtsButton>(html`
      <yts-button>Click me</yts-button>
    `);

    expect(el.disabled).to.be.false;
    expect(el.variant).to.equal('primary');
  });

  it('dispatches yts-click event', async () => {
    const el = await fixture<YtsButton>(html`
      <yts-button>Click me</yts-button>
    `);

    let clickCount = 0;
    el.addEventListener('yts-click', () => clickCount++);

    const button = el.shadowRoot!.querySelector('button')!;
    button.click();

    expect(clickCount).to.equal(1);
  });

  it('is accessible', async () => {
    const el = await fixture<YtsButton>(html`
      <yts-button disabled>Disabled</yts-button>
    `);

    await expect(el).to.be.accessible();
  });
});
```

### Integration with SSE

When consuming **Server-Sent Events** for real-time updates:

```typescript
import { videoProcessingStatus } from '../state/processing-state.js';

@customElement('yts-render-monitor')
export class YtsRenderMonitor extends LitElement {
  private eventSource?: EventSource;

  connectedCallback() {
    super.connectedCallback();
    this._initSSE();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.eventSource?.close();
  }

  private _initSSE() {
    this.eventSource = new EventSource('/api/render/progress');
    
    this.eventSource.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data);
      videoProcessingStatus.value = {
        ...videoProcessingStatus.value,
        progress: data.percentage
      };
    });

    this.eventSource.onerror = () => {
      console.error('SSE connection lost');
      this.eventSource?.close();
    };
  }

  render() {
    const status = videoProcessingStatus.value;
    return html`
      <div class="progress-monitor">
        <progress value=${status.progress} max="100"></progress>
        <span>${status.progress}%</span>
      </div>
    `;
  }
}
```

## Integration with Shoelace

When using Shoelace components (as mentioned in README):

```typescript
import '@shoelace-style/shoelace/dist/components/button/button.js';
import { html } from 'lit';

// Wrap Shoelace for project-specific behavior
@customElement('yts-dialog')
export class YtsDialog extends LitElement {
  render() {
    return html`
      <sl-dialog label="Confirm Action">
        <slot></slot>
        <sl-button slot="footer" variant="primary">Confirm</sl-button>
      </sl-dialog>
    `;
  }
}
```

## Checklist for Every Component

Before committing a new Lit component:
- [ ] Component has JSDoc with @fires, @slot, @csspart documentation
- [ ] All props use @property with explicit types
- [ ] Custom events have defined TypeScript interfaces
- [ ] Accessibility attributes (ARIA) are present
- [ ] Unit tests cover happy path + edge cases
- [ ] Test includes `await expect(el).to.be.accessible()`
- [ ] Component is registered in `HTMLElementTagNameMap`
- [ ] File follows naming convention: `yts-{name}.element.ts`

## Resources

- [Lit Documentation](https://lit.dev)
- [Lit Signals Guide](https://lit.dev/docs/data/signals/)
- [Open WC Testing](https://open-wc.org/docs/testing/testing-package/)
- Project Architecture: `_bmad-output/planning-artifacts/architecture.md`
