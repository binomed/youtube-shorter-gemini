// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { AppSettings, GeminiModelInfo } from '@youtube-shorter/shared';

import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import { ytsPremiumStyles } from '../../styles/yts-styles';

const GEMINI_MODELS: GeminiModelInfo[] = [
  {
    name: 'Gemini 3.1 Pro (Preview)',
    code: 'gemini-3.1-pro-preview',
    pricing: '$2.00 - $4.00 per 1M input / $12.00 - $18.00 per 1M output',
  },
  {
    name: 'Gemini 3.1 Flash-Lite Preview',
    code: 'gemini-3.1-flash-lite-preview',
    pricing: '$0.05 - $0.10 per 1M input / $0.15 - $0.30 per 1M output',
  },
  {
    name: 'Gemini 3 Flash Preview',
    code: 'gemini-3-flash-preview',
    pricing: '$0.10 - $0.20 per 1M input / $0.30 - $0.60 per 1M output',
  },
  {
    name: 'Gemini 2.5 Pro',
    code: 'gemini-2.5-pro',
    pricing: '$1.25 - $2.50 per 1M input / $10.00 - $15.00 per 1M output',
  },
  {
    name: 'Gemini 2.5 Flash-Lite',
    code: 'gemini-2.5-flash-lite',
    pricing: '$0.075 - $0.15 per 1M input / $0.30 - $0.60 per 1M output',
  },
  {
    name: 'Gemini 1.5 Flash',
    code: 'gemini-1.5-flash',
    pricing: 'Legacy - Stable',
  },
  {
    name: 'Gemini 1.5 Pro',
    code: 'gemini-1.5-pro',
    pricing: 'Legacy - Stable',
  },
];

@customElement('settings-tab')
export class SettingsTab extends LitElement {
  static styles = [
    ytsPremiumStyles,
    css`
      :host {
        display: block;
        padding: 24px;
        color: var(--yts-text-1);
      }

      .settings-form {
        display: flex;
        flex-direction: column;
        gap: 32px;
        max-width: 800px;
        margin: 0 auto;
      }

      .setting-item {
        display: flex;
        flex-direction: column;
        gap: 12px;
        position: relative;
      }

      /* Ensure the first item (select) is above the second (input) */
      .setting-item:nth-child(1) {
        z-index: 10;
      }

      .setting-item:nth-child(2) {
        z-index: 5;
      }

      .setting-label {
        font-weight: 600;
        font-size: 16px;
        color: var(--yts-text-1);
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .setting-description {
        font-size: 14px;
        color: var(--yts-text-3);
        line-height: 1.5;
        margin-bottom: 4px;
      }

      sl-select::part(base),
      sl-input::part(base) {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--yts-border);
        color: white;
        transition: all 0.2s ease;
      }

      sl-select::part(base):hover,
      sl-input::part(base):hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: var(--yts-accent);
      }

      /* Dropdown Menu Styles */
      sl-select::part(listbox) {
        background: rgba(15, 15, 25, 0.95);
        backdrop-filter: blur(16px);
        border: 1px solid var(--yts-border);
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        padding: 8px;
        z-index: 2000;
      }


      sl-option::part(base) {
        border-radius: 8px;
        transition: all 0.2s ease;
        padding: 8px 12px;
      }

      sl-option::part(base):hover {
        background: rgba(99, 102, 241, 0.1);
      }

      .option-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
        line-height: normal;
      }

      .option-name {
        font-weight: 600;
        font-size: 14px;
        color: var(--yts-text-1);
      }

      .option-pricing {
        font-size: 11px;
        color: var(--yts-text-3);
      }

      .pricing-info {
        font-size: 13px;
        color: var(--yts-text-2);
        margin-top: 8px;
        padding: 12px 16px;
        background: rgba(99, 102, 241, 0.05);
        border-radius: 12px;
        border-left: 4px solid var(--yts-accent);
        line-height: 1.6;
      }

      .actions {
        margin-top: 40px;
        display: flex;
        justify-content: flex-end;
        padding-top: 24px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }

      .save-btn {
        width: auto !important;
        min-width: 180px;
      }
    `,
  ];

  @state() private settings: AppSettings = {
    geminiModel: 'gemini-1.5-flash',
    frameInterval: 3.0,
  };

  @state() private loading = true;
  @state() private saving = false;

  async connectedCallback() {
    super.connectedCallback();
    await this.fetchSettings();
  }

  private async fetchSettings() {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        this.settings = await response.json();
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      this.loading = false;
    }
  }

  private async handleSave(): Promise<void> {
    this.saving = true;
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.settings),
      });
      if (response.ok) {
        // Success feedback could be added here
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      this.saving = false;
    }
  }

  private updateSetting(key: keyof AppSettings, value: string | number): void {
    this.settings = { ...this.settings, [key]: value };
  }

  render(): unknown {
    if (this.loading) return html`<p>Loading...</p>`;

    const selectedModel = GEMINI_MODELS.find(m => m.code === this.settings.geminiModel);

    return html`
      <div class="settings-form">
        <div class="setting-item">
          <label class="setting-label">AI Analysis Model</label>
          <p class="setting-description">Select the Gemini intelligence level for viral moment detection. More powerful models provide better reasoning but may have different pricing.</p>
          <sl-select 
            hoist
            value=${this.settings.geminiModel} 
            @sl-change=${(e: CustomEvent): void => {
              const target = e.target as any;
              this.updateSetting('geminiModel', target.value);
            }}
          >
            ${GEMINI_MODELS.map(
              (m) => html`
                <sl-option value=${m.code}>
                  <div class="option-content">
                    <span class="option-name">${m.name}</span>
                    <span class="option-pricing">${m.pricing}</span>
                  </div>
                </sl-option>
              `,
            )}
          </sl-select>
          <div class="pricing-info">
            <strong>Current Selection Pricing:</strong><br>
            ${selectedModel?.pricing || 'Custom / Unknown Model'}
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">Frame Interval (seconds)</label>
          <p class="setting-description">Time between each frame sent to Gemini for visual analysis. Lower values (e.g. 0.5) extract more frames, increasing precision for fast-paced content but consuming more tokens.</p>
          <sl-input 
            type="number" 
            step="0.1" 
            min="0.1"
            max="10"
            .value=${this.settings.frameInterval.toString()} 
            @sl-input=${(e: CustomEvent): void => {
              const target = e.target as any;
              this.updateSetting('frameInterval', parseFloat(target.value));
            }}
          ></sl-input>

        </div>

        <div class="actions">
          <sl-button 
            variant="primary" 
            class="save-btn" 
            ?loading=${this.saving}
            @click=${this.handleSave}
          >
            Save Settings
          </sl-button>
        </div>
      </div>
    `;
  }
}
