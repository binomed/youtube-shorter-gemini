/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { SubtitleStyle } from '@youtube-shorter/shared';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import '@shoelace-style/shoelace/dist/components/range/range.js';
import '@shoelace-style/shoelace/dist/components/switch/switch.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '@shoelace-style/shoelace/dist/components/dropdown/dropdown.js';
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

    @state() private textColorToggle = 'white';
    @state() private bgColorToggle = 'black';

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

    private handleFontChange(e: Event) {
        const select = e.target as HTMLSelectElement;
        this.emitStyleChange({ font: select.value });
    }

    private handleFontSizeChange(e: Event) {
        const input = e.target as HTMLInputElement;
        this.emitStyleChange({ fontSize: parseInt(input.value, 10) });
    }

    private handleVerticalOffsetChange(e: Event) {
        const input = e.target as HTMLInputElement;
        this.emitStyleChange({ positionY: parseInt(input.value, 10) });
    }

    private setTextColor(color: string) {
        this.textColorToggle = color;
        this.emitStyleChange({ color: color === 'white' ? '#ffffff' : '#000000' });
    }

    private setBgColor(color: string) {
        this.bgColorToggle = color;
        this.emitStyleChange({
            backgroundColor: color === 'yellow' ? '#facc15' : color === 'black' ? 'rgba(0,0,0,0.6)' : 'transparent'
        });
    }

    private handleReset() {
        this.emitStyleChange({
            font: 'inherit',
            fontSize: 24,
            color: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.6)',
            positionX: 0,
            positionY: 0
        });
        this.textColorToggle = 'white';
        this.bgColorToggle = 'black';
    }

    private handleApplyToAll() {
        this.dispatchEvent(new CustomEvent('apply-all-styles', {
            bubbles: true,
            composed: true
        }));
    }

    static styles = css`
        :host {
            display: block;
            color: #f8fafc;
            font-family: var(--yts-font-family, sans-serif);
            font-size: 13px;
        }

        .panel-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
        }

        .label {
            color: #94a3b8;
            font-weight: 500;
        }

        /* Font & Size */
        .font-row {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .custom-select {
            background-color: #2a2d3d;
            border: 1px solid rgba(255,255,255,0.1);
            color: #f8fafc;
            padding: 8px 12px;
            border-radius: 20px;
            width: 180px;
            font-size: 13px;
            font-family: inherit;
            cursor: pointer;
            outline: none;
            appearance: none;
        }

        .custom-select:focus {
            border-color: #0ea5e9;
        }

        .select-wrapper {
            position: relative;
        }

        .select-wrapper::after {
            content: '▼';
            font-size: 10px;
            color: #94a3b8;
            position: absolute;
            right: 12px;
            top: 50%;
            transform: translateY(-50%);
            pointer-events: none;
        }

        .size-slider-group {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-top: 12px;
            margin-bottom: 24px;
        }

        .custom-slider {
            flex: 1;
            -webkit-appearance: none;
            height: 4px;
            background: #334155;
            border-radius: 2px;
            outline: none;
        }
        
        .custom-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #f8fafc;
            cursor: pointer;
        }

        .size-btn {
            background: #2a2d3d;
            border: none;
            border-radius: 6px;
            color: #f8fafc;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 16px;
        }

        /* Colors & Preview Grid */
        .colors-preview-container {
            display: grid;
            grid-template-columns: 1fr 180px;
            gap: 16px;
            margin-bottom: 24px;
        }

        .colors-col {
            display: flex;
            flex-direction: column;
            gap: 16px;
            position: relative;
            z-index: 100;
        }

        .color-group-title {
            color: #f8fafc;
            font-weight: 600;
            margin-bottom: 8px;
        }

        .color-bubbles {
            display: flex;
            align-items: center;
            gap: 8px;
            background: #2a2d3d;
            padding: 4px;
            border-radius: 20px;
            width: fit-content;
        }

        .color-bubble {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            cursor: pointer;
            border: 2px solid transparent;
        }

        .color-bubble:focus, .color-bubble:focus-visible, .color-bubble:active {
            outline: none !important;
            box-shadow: none !important;
        }

        .color-bubble.active {
            border-color: #0ea5e9;
        }

        .rainbow-picker {
            background: conic-gradient(from 180deg at 50% 50%, #ff0000, #ff8000, #ffff00, #00ff00, #00ffff, #0000ff, #8000ff, #ff00ff, #ff0000);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #000000;
            font-size: 14px;
            padding: 0;
            box-sizing: border-box;
        }

        /* Style Icons */
        .style-icons {
            display: flex;
            gap: 6px;
            margin-top: 4px;
        }

        .style-icon {
            width: 24px;
            height: 24px;
            background: #2a2d3d;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: #94a3b8;
        }

        /* Generic Preview Box */
        .generic-preview {
            background: linear-gradient(135deg, rgba(79, 70, 229, 0.4), rgba(14, 165, 233, 0.4));
            border-radius: 12px;
            padding: 12px;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            position: relative;
            overflow: hidden;
            border: 1px solid rgba(255,255,255,0.1);
        }

        .preview-blur-bg {
            position: absolute;
            inset: 0;
            background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect x="20" y="20" width="60" height="60" fill="%23ffffff" opacity="0.1" rx="30"/></svg>');
            background-size: cover;
            filter: blur(10px);
            z-index: 1;
        }

        .preview-text {
            position: relative;
            z-index: 2;
            font-weight: bold;
            font-size: 14px;
            text-align: center;
        }

        /* Highlight & Positioning */
        .highlight-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
        }

        .positioning-container {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 24px;
            align-items: center;
            margin-bottom: 24px;
        }

        .v-offset-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .grid-3x3 {
            display: grid;
            grid-template-columns: repeat(3, 16px);
            grid-template-rows: repeat(3, 16px);
            gap: 2px;
        }

        .grid-cell {
            background: #2a2d3d;
            border-radius: 2px;
            cursor: pointer;
        }
        
        .grid-cell.active {
            background: #0ea5e9;
        }

        /* Animation Button */
        .animation-btn {
            width: 100%;
            background: #2a2d3d;
            border: 1px solid rgba(255,255,255,0.05);
            color: #f8fafc;
            padding: 12px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 13px;
            font-family: inherit;
            cursor: pointer;
            margin-bottom: 24px;
        }

        /* Footer Action Buttons */
        .footer-actions {
            display: flex;
            gap: 12px;
            margin-top: auto;
        }

        .footer-btn {
            flex: 1;
            background: #2a2d3d;
            color: #f8fafc;
            border: none;
            padding: 10px 0;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
        }

        .footer-btn:hover {
            background: #334155;
        }
        
        .footer-btn-reset {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }
    `;

    render() {
        const currentFont = this.subtitleStyle?.font || 'inherit';
        const currentSize = this.subtitleStyle?.fontSize || 24;
        const currentPosY = this.subtitleStyle?.positionY || 0;

        return html`
            <!-- Font Row -->
            <div class="panel-row">
                <span class="label">Font</span>
                <div class="select-wrapper">
                    <select class="custom-select" .value="${currentFont}" @change=${this.handleFontChange}>
                        <option value="inherit">System Sans-Serif</option>
                        <option value="'Roboto', sans-serif">Roboto</option>
                        <option value="'Montserrat', sans-serif">Montserrat</option>
                        <option value="'Oswald', sans-serif">Oswald</option>
                        <option value="'Impact', sans-serif">Impact</option>
                    </select>
                </div>
            </div>

            <!-- Size Slider Row -->
            <div class="size-slider-group">
                <span class="label" style="width: 70px;">Size: ${currentSize}px</span>
                <input type="range" class="custom-slider" min="12" max="150" value="${currentSize}" @input=${this.handleFontSizeChange}>
                <button class="size-btn" @click=${() => this.emitStyleChange({ fontSize: Math.max(12, currentSize - 2) })}>-</button>
                <button class="size-btn" @click=${() => this.emitStyleChange({ fontSize: Math.min(150, currentSize + 2) })}>+</button>
            </div>

            <!-- Colors & Preview Grid -->
            <div class="colors-preview-container">
                <div class="colors-col">
                    <div>
                        <div class="color-group-title">Colors</div>
                        <div class="color-bubbles">
                            <sl-dropdown distance="5">
                                <div slot="trigger" class="color-bubble rainbow-picker ${this.textColorToggle === 'custom' ? 'active' : ''}" title="Custom Color">
                                    <sl-icon name="eyedropper"></sl-icon>
                                </div>
                                <sl-color-picker 
                                    inline 
                                    format="rgba"
                                    opacity
                                    .value=${this.subtitleStyle?.color && this.subtitleStyle.color.startsWith('#') ? this.subtitleStyle.color : '#ffffff'} 
                                    @sl-change=${(e: Event) => {
                this.textColorToggle = 'custom';
                this.emitStyleChange({ color: (e.target as any).value });
            }}
                                ></sl-color-picker>
                            </sl-dropdown>

                            <div class="color-bubble ${this.textColorToggle === 'black' ? 'active' : ''}" style="background: #000;" @click=${() => this.setTextColor('black')}></div>
                            <div class="color-bubble ${this.textColorToggle === 'white' ? 'active' : ''}" style="background: #fff;" @click=${() => this.setTextColor('white')}></div>
                        </div>
                        <!-- Style Icons -->
                        <div class="style-icons">
                            <div class="style-icon" title="Outline"><sl-icon name="type-strikethrough"></sl-icon></div>
                            <div class="style-icon" title="Shadow"><sl-icon name="textarea-t"></sl-icon></div>
                            <div class="style-icon" title="Background Padding"><sl-icon name="border-width"></sl-icon></div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 8px;">
                        <div class="color-group-title">Background Color</div>
                        <div class="color-bubbles">
                            <sl-dropdown distance="5">
                                <div slot="trigger" class="color-bubble rainbow-picker ${this.bgColorToggle === 'custom' ? 'active' : ''}" title="Custom Background">
                                    <sl-icon name="eyedropper"></sl-icon>
                                </div>
                                <sl-color-picker 
                                    inline 
                                    format="rgba"
                                    opacity
                                    .value=${this.subtitleStyle?.backgroundColor || 'rgba(0,0,0,0.6)'} 
                                    @sl-change=${(e: Event) => {
                this.bgColorToggle = 'custom';
                this.emitStyleChange({ backgroundColor: (e.target as any).value });
            }}
                                ></sl-color-picker>
                            </sl-dropdown>

                            <div class="color-bubble ${this.bgColorToggle === 'yellow' ? 'active' : ''}" style="background: #facc15;" @click=${() => this.setBgColor('yellow')}></div>
                            <div class="color-bubble ${this.bgColorToggle === 'black' ? 'active' : ''}" style="background: rgba(0,0,0,0.6);" @click=${() => this.setBgColor('black')}></div>
                        </div>
                    </div>
                </div>

                <div class="generic-preview">
                    <div class="preview-blur-bg"></div>
                    <div class="preview-text" style="
                        font-family: ${currentFont};
                        color: ${this.subtitleStyle?.color || '#ffffff'};
                        background-color: ${this.subtitleStyle?.backgroundColor || 'transparent'};
                        padding: 4px 8px;
                        border-radius: 4px;
                    ">Hey Listen!</div>
                </div>
            </div>

            <!-- Highlights & Positioning -->
            <div class="highlight-row">
                <span class="color-group-title" style="margin:0;">Highlight Words <span style="display:inline-block; width:8px; height:8px; background:#475569; border-radius:50%; margin-left:8px;"></span></span>
                <span class="label">Positioning</span>
            </div>

            <div class="positioning-container" style="grid-template-columns: 1fr;">
                <div class="v-offset-group">
                    <span class="label">Vertical Offset</span>
                    <input type="range" class="custom-slider" min="-150" max="150" value="${currentPosY}" @input=${this.handleVerticalOffsetChange}>
                </div>
            </div>

            <!-- Footer Buttons -->
            <div class="footer-actions">
                <button class="footer-btn" @click=${() => console.log('Save Preset - To do')}>Save Preset</button>
                <button class="footer-btn" @click=${this.handleApplyToAll}>Apply to All</button>
                <button class="footer-btn footer-btn-reset" @click=${this.handleReset}>
                    Reset
                    <sl-icon name="stars" style="color: #cbd5e1;"></sl-icon>
                </button>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'yts-subtitle-style-panel': YtsSubtitleStylePanel;
    }
}
