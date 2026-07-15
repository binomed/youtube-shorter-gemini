import { LitElement, html, css } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import type SlDialog from '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import { ytsPremiumStyles } from '../../styles/yts-styles.ts';

/**
 * A standardized dialog component for the YouTube Shorter project.
 * Wraps Shoelace sl-dialog and applies the project's glassmorphism aesthetic.
 * 
 * @slot - The dialog's content
 * @slot footer - The dialog's footer actions
 * @fires sl-show - Dispatched when the dialog opens
 * @fires sl-after-show - Dispatched after the dialog opens
 * @fires sl-hide - Dispatched when the dialog closes
 * @fires sl-after-hide - Dispatched after the dialog closes
 * @fires sl-initial-focus - Dispatched when the dialog opens to set initial focus
 * @fires sl-request-close - Dispatched when the user attempts to close the dialog
 */
@customElement('yts-dialog')
export class YtsDialog extends LitElement {
  @property({ type: String }) label = '';
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: Boolean }) hoist = false;

  @query('sl-dialog') private slDialog!: SlDialog;

  static styles = [
    ytsPremiumStyles,
    css`
    :host {
      display: contents;
    }

    sl-dialog {
      --sl-panel-background-color: transparent;
      --sl-panel-border-width: 0;
      --sl-z-index-dialog: 99999;
      z-index: 99999;
    }

    sl-dialog::part(panel) {
      position: relative !important;
      background: linear-gradient(180deg, #1e223c 0%, #17192f 100%) !important;
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6),
                  inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
      border: 1px solid #4f46e5 !important; /* Vivid blue border */
      border-radius: 16px !important;
      max-width: var(--yts-dialog-max-width, 440px) !important;
      max-height: var(--yts-dialog-max-height, 86vh) !important;
      display: flex !important;
      flex-direction: column !important;
      width: 100% !important;
      overflow: hidden !important; /* rounds the footer corners */
    }

    sl-dialog::part(header) {
      padding: 32px 32px 16px 32px !important;
      flex-shrink: 0 !important;
    }

    sl-dialog::part(title) {
      color: white !important;
      font-size: 1.5rem !important; /* 24px */
      font-weight: 700 !important;
      letter-spacing: -0.01em !important;
    }

    sl-dialog::part(close-button) {
      position: absolute !important;
      top: 24px !important;
      right: 24px !important;
    }

    sl-dialog::part(close-button__button) {
      color: rgba(255, 255, 255, 0.4) !important;
      font-size: 1.5rem !important;
      transition: color 0.2s ease;
    }

    sl-dialog::part(close-button__button):hover {
      color: white !important;
    }

    sl-dialog::part(body) {
      color: rgba(255, 255, 255, 0.7) !important;
      font-size: 15px !important;
      line-height: 1.6 !important;
      padding: 0 32px 24px 32px !important;
      overflow-y: auto !important;
      flex: 1 1 auto !important;
      min-height: 0 !important;
    }

    sl-dialog::part(overlay) {
      backdrop-filter: blur(8px) !important;
      background-color: rgba(0, 0, 0, 0.5) !important;
    }

    sl-dialog::part(footer) {
      background-color: #0d0f1c !important; /* Darker bottom section */
      padding: 20px 32px !important;
      border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
      flex-shrink: 0 !important;
    }

    .footer-container {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 12px;
      width: 100%;
    }
    
    ::slotted([slot="footer"]) {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 12px;
      width: 100%;
      flex: 1;
    }
  `];

  render() {
    return html`
      <sl-dialog
        label=${this.label}
        ?open=${this.open}
        ?hoist=${this.hoist}
        @sl-show=${this._handleShow}
        @sl-hide=${this._handleHide}
        @sl-initial-focus=${this._forwardEvent}
        @sl-request-close=${this._forwardEvent}
        @sl-after-show=${this._forwardEvent}
        @sl-after-hide=${this._forwardEvent}
      >
        <slot></slot>
        <div slot="footer" class="footer-container">
          <slot name="footer"></slot>
        </div>
      </sl-dialog>
    `;
  }

  public show() {
    this.slDialog.show();
  }

  public hide() {
    this.slDialog.hide();
  }

  private _handleShow() {
    this.open = true;
    this.dispatchEvent(new CustomEvent('sl-show', { bubbles: true, composed: true }));
  }

  private _handleHide() {
    this.open = false;
    this.dispatchEvent(new CustomEvent('sl-hide', { bubbles: true, composed: true }));
  }

  private _forwardEvent(e: Event) {
    this.dispatchEvent(new CustomEvent(e.type, {
      detail: (e as CustomEvent).detail,
      bubbles: true,
      composed: true
    }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'yts-dialog': YtsDialog;
  }
}
