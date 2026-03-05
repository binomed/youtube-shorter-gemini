/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';

/**
 * Main application layout component.
 *
 * Structure:
 * - Header (Logo, User Actions)
 * - Sidebar/Navigation (if applicable)
 * - Main Content Area (Slot)
 * - Footer
 *
 * Provides the common structure for all application pages.
 *
 * @element main-layout
 * @slot - The main content to display within the layout
 */
@customElement('main-layout')
export class MainLayout extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      background-color: var(--yts-bg-primary);
      color: var(--yts-text-primary);
    }

    main {
      width: 100%;
      height: 100%;
    }
  `;

  render(): unknown {
    return html`
      <main>
        <slot></slot>
      </main>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'main-layout': MainLayout;
  }
}
