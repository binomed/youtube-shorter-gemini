import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { Router } from '@vaadin/router';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import '@shoelace-style/shoelace/dist/components/tooltip/tooltip.js';

/**
 * Global application header component.
 *
 * Provides branding (logo + name) and a slot for page-specific actions.
 *
 * @element yts-header
 * @slot actions - Slot for page-specific action buttons (like Export)
 */
@customElement('yts-header')
export class YtsHeader extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 64px;
      z-index: 100;
      background: rgba(15, 15, 25, 0.6);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      box-sizing: border-box;
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 100%;
      padding: 0 24px;
      max-width: 100%;
    }

    .branding {
      display: flex;
      align-items: center;
      gap: 12px;
      cursor: pointer;
      text-decoration: none;
      transition: opacity 0.2s;
    }

    .branding:hover {
      opacity: 0.8;
    }

    .logo {
      height: 32px;
      width: auto;
    }

    .app-name {
      font-size: 18px;
      font-weight: 700;
      background: linear-gradient(135deg, #f1f5f9 0%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.02em;
    }

    .actions-container {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .home-btn {
      color: #94a3b8;
      font-size: 20px;
      --sl-color-neutral-600: #94a3b8;
    }

    .home-btn:hover {
      color: #f8fafc;
    }
  `;

  private _goHome() {
    Router.go('/');
  }

  render() {
    return html`
      <header class="header-content">
        <div class="branding" @click=${this._goHome} aria-label="Go to Dashboard">
          <img src="/logo-transparent.png" alt="Youtube Shorter Logo" class="logo">
          <span class="app-name">Youtube Shorter</span>
        </div>

        <div class="actions-container">
          <slot name="actions"></slot>
          
          <sl-tooltip content="Back to Dashboard">
            <sl-icon-button 
              name="house-door-fill" 
              class="home-btn"
              @click=${this._goHome}
              label="Home"
            ></sl-icon-button>
          </sl-tooltip>
        </div>
      </header>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'yts-header': YtsHeader;
  }
}
