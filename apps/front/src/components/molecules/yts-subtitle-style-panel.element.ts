/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { SubtitleStyle } from '@youtube-shorter/shared';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import '@shoelace-style/shoelace/dist/components/range/range.js';
import '@shoelace-style/shoelace/dist/components/color-picker/color-picker.js';

/**
 * Panel for configuring subtitle styles (font, size, color, bg color, position).
 * Dispatches 'style-changed' events when user customizes styling.
 * 
 * @element yts-subtitle-style-panel
 */
@customElement('yts-subtitle-style-panel')
export class YtsSubtitleStylePanel extends LitElement {
    @property({ type: Object })
    subtitleStyle: SubtitleStyle = {};

    private handleFontChange(e: Event) {
        const select = e.target as HTMLSelectElement;
        this.emitStyleChange({ font: select.value });
    }

    private handleFontSizeChange(e: Event) {
        // @ts-expect-error value exists on sl-range
        const value = e.target.value as number;
        this.emitStyleChange({ fontSize: value });
    }

    private handleColorChange(e: Event) {
        // @ts-expect-error value exists on sl-color-picker
        const value = e.target.value as string;
        this.emitStyleChange({ color: value });
    }

    private handleBgColorChange(e: Event) {
        // @ts-expect-error value exists on sl-color-picker
        const value = e.target.value as string;
        this.emitStyleChange({ backgroundColor: value });
    }

    private handlePositionYChange(e: Event) {
        // @ts-expect-error value exists on sl-range
        const value = e.target.value as number;
        this.emitStyleChange({ positionY: value });
    }

    private emitStyleChange(update: Partial<SubtitleStyle>) {
        const newStyle = { ...this.subtitleStyle, ...update };
        this.dispatchEvent(
            new CustomEvent('style-changed', {
                detail: { subtitleStyle: newStyle },
                bubbles: true,
                composed: true,
            })
        );
    }

    static styles = css`
        :host {
            display: block;
            color: var(--yts-text-primary, #ffffff);
            font-family: var(--yts-font-family, sans-serif);
        }

        .panel-section {
            margin-bottom: var(--yts-spacing-lg, 16px);
            padding: var(--yts-spacing-md, 12px);
            background: rgba(255, 255, 255, 0.05);
            border-radius: var(--yts-radius-md, 8px);
        }

        .panel-section h4 {
            margin: 0 0 var(--yts-spacing-sm, 8px) 0;
            font-size: 14px;
            color: var(--yts-text-secondary, #94a3b8);
            font-weight: 500;
        }

        .control-group {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-top: 8px;
        }

        sl-select {
            width: 100%;
        }

        .color-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .color-label {
            font-size: 14px;
        }
    `;

    render() {
        // Default values if undefined
        const currentFont = this.subtitleStyle?.font || 'inherit';
        const currentSize = this.subtitleStyle?.fontSize || 24;
        const currentColor = this.subtitleStyle?.color || '#ffffff';
        const currentBgColor = this.subtitleStyle?.backgroundColor || 'rgba(0, 0, 0, 0.6)';
        const currentPosY = this.subtitleStyle?.positionY || 0;

        return html`
            <div class="panel-section">
                <h4>Typography</h4>
                <div class="control-group">
                    <sl-select 
                        placeholder="Select Font" 
                        value=${currentFont}
                        @sl-change=${this.handleFontChange}
                        size="small"
                    >
                        <sl-option value="inherit">Default (System)</sl-option>
                        <sl-option value="'Roboto', sans-serif">Roboto</sl-option>
                        <sl-option value="'Montserrat', sans-serif">Montserrat</sl-option>
                        <sl-option value="'Oswald', sans-serif">Oswald</sl-option>
                        <sl-option value="'Impact', sans-serif">Impact</sl-option>
                    </sl-select>

                    <sl-range 
                        label="Font Size" 
                        min="12" max="64" step="1" 
                        value=${currentSize}
                        @sl-change=${this.handleFontSizeChange}
                    ></sl-range>
                </div>
            </div>

            <div class="panel-section">
                <h4>Colors</h4>
                <div class="control-group">
                    <div class="color-row">
                        <span class="color-label">Text Color</span>
                        <sl-color-picker 
                            value=${currentColor} 
                            opacity 
                            @sl-change=${this.handleColorChange}
                            size="small"
                        ></sl-color-picker>
                    </div>
                    <div class="color-row">
                        <span class="color-label">Background Color</span>
                        <sl-color-picker 
                            value=${currentBgColor} 
                            opacity 
                            @sl-change=${this.handleBgColorChange}
                            size="small"
                        ></sl-color-picker>
                    </div>
                </div>
            </div>

            <div class="panel-section">
                <h4>Positioning</h4>
                <div class="control-group">
                    <sl-range 
                        label="Vertical Position (Offset)" 
                        min="-300" max="300" step="10" 
                        value=${currentPosY}
                        @sl-change=${this.handlePositionYChange}
                    ></sl-range>
                </div>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'yts-subtitle-style-panel': YtsSubtitleStylePanel;
    }
}
