/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import type { SubtitleStyle } from '@youtube-shorter/shared';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import '@shoelace-style/shoelace/dist/components/range/range.js';
import '@shoelace-style/shoelace/dist/components/switch/switch.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '@shoelace-style/shoelace/dist/components/dropdown/dropdown.js';
import '@shoelace-style/shoelace/dist/components/color-picker/color-picker.js';
import '@shoelace-style/shoelace/dist/components/tooltip/tooltip.js';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';

import { presetState } from '../../state/preset-state';

/**
 * Panel for configuring subtitle styles (font, size, color, bg color, position).
 * Dispatches 'style-changed' events when user customizes styling.
 * 
 * @element yts-subtitle-style-panel
 */
@customElement('yts-subtitle-style-panel')
export class YtsSubtitleStylePanel extends SignalWatcher(LitElement) {
    @property({ type: Object })
    subtitleStyle: SubtitleStyle | null = null;

    @state()
    private isSavePresetDialogOpen = false;

    @state()
    private presetNameInput = '';

    connectedCallback() {
        super.connectedCallback();
        // Load presets from backend when this component mounts
        presetState.loadPresets();
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
        this.emitStyleChange({ color: color === 'white' ? '#ffffff' : '#000000' });
    }

    private setBgColor(color: string) {
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
            color: var(--yts-text-1, #f8fafc);
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
            color: var(--yts-text-3, #94a3b8);
            font-weight: 500;
        }

        /* Font & Size */
        .font-row {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .custom-select {
            background-color: var(--yts-glass-bg, #2a2d3d);
            border: 1px solid var(--yts-border, rgba(255,255,255,0.1));
            color: var(--yts-text-1, #f8fafc);
            padding: 8px 12px;
            border-radius: var(--yts-radius, 20px);
            width: 180px;
            font-size: 13px;
            font-family: inherit;
            cursor: pointer;
            outline: none;
            appearance: none;
            transition: border-color 0.2s;
        }

        .custom-select:focus, .custom-select:focus-visible {
            border-color: var(--yts-primary, #0ea5e9);
            outline: none;
        }

        .custom-select:focus-visible {
            box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.3);
        }

        .select-wrapper {
            position: relative;
        }

        .select-wrapper::after {
            content: '▼';
            font-size: 10px;
            color: var(--yts-text-3, #94a3b8);
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
            background: var(--yts-glass-bg, #334155);
            border-radius: 2px;
            outline: none;
        }
        
        .custom-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: var(--yts-text-1, #f8fafc);
            cursor: pointer;
            transition: transform 0.1s;
        }

        .custom-slider:focus-visible::-webkit-slider-thumb {
            box-shadow: 0 0 0 3px var(--yts-primary, #0ea5e9);
        }

        .size-btn {
            background: var(--yts-glass-bg, #2a2d3d);
            border: 1px solid transparent;
            border-radius: 6px;
            color: var(--yts-text-1, #f8fafc);
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            font-size: 16px;
            transition: all 0.2s;
        }

        .size-btn:hover {
            background: var(--yts-surface-3, #334155);
        }

        .size-btn:focus-visible {
            outline: 2px solid var(--yts-primary, #0ea5e9);
            outline-offset: 2px;
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
            color: var(--yts-text-1, #f8fafc);
            font-weight: 600;
            margin-bottom: 8px;
        }

        .color-bubbles {
            display: flex;
            align-items: center;
            gap: 8px;
            background: var(--yts-glass-bg, #2a2d3d);
            padding: 4px;
            border-radius: var(--yts-radius, 20px);
            width: fit-content;
        }

        .color-bubble {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            cursor: pointer;
            border: 2px solid transparent; /* ensure border is there for sizing */
            overflow: hidden;
            background-clip: padding-box;
            box-sizing: border-box;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .color-bubble:focus {
            outline: none;
        }
        
        .color-bubble:focus-visible {
            outline: 2px solid var(--yts-text-1, #ffffff);
            outline-offset: 2px;
        }

        .color-bubble.active {
            border: 2px solid var(--yts-primary, #0ea5e9);
        }

        .rainbow-picker {
            background: conic-gradient(#ff0097 0%, #ff0097 100%); /* Fallback SDR gradient */
            background: conic-gradient(in oklch longer hue, oklch(70% .3 0) 0%, oklch(70% .3 0) 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #000000;
            font-size: 14px;
            padding: 0;
            box-sizing: border-box;
        }

        sl-color-picker {
            background: var(--yts-surface-2, #1e2332);
            padding: 8px;
            border-radius: var(--yts-radius, 12px);
            border: 1px solid var(--yts-border, rgba(255, 255, 255, 0.1));
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
        }

        .preset-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid var(--yts-border, rgba(255,255,255,0.1));
        }

        .preset-select {
            flex: 1;
            margin-right: 12px;
        }

        .preset-actions {
            display: flex;
            gap: 8px;
        }

        .save-preset-block {
            background: var(--yts-glass-bg, #2a2d3d);
            border: 1px solid var(--yts-border, rgba(255,255,255,0.1));
            border-radius: var(--yts-radius, 12px);
            padding: 12px;
            margin-bottom: 24px;
            display: flex;
            gap: 8px;
            align-items: center;
            animation: slideDown 0.2s ease-out;
        }

        @keyframes slideDown {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .custom-input {
            flex: 1;
            background: var(--yts-surface-1, #0f172a);
            border: 1px solid var(--yts-border, rgba(255,255,255,0.1));
            color: var(--yts-text-1, #f8fafc);
            padding: 8px 12px;
            border-radius: var(--yts-radius, 6px);
            outline: none;
            font-size: 13px;
        }

        .custom-input:focus {
            border-color: var(--yts-primary, #0ea5e9);
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
            border: 1px solid var(--yts-border, rgba(255,255,255,0.1));
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
        .positioning-container {
            display: grid;
            grid-template-columns: 1fr;
            gap: 24px;
            align-items: center;
            margin-bottom: 24px;
        }

        .v-offset-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        /* Footer Action Buttons */
        .footer-actions {
            display: flex;
            gap: 12px;
            margin-top: auto;
        }

        .footer-btn {
            flex: 1;
            background: var(--yts-glass-bg, #2a2d3d);
            color: var(--yts-text-1, #f8fafc);
            border: 1px solid transparent;
            padding: 10px 0;
            border-radius: var(--yts-radius, 20px);
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        }

        .footer-btn:hover {
            background: var(--yts-surface-3, #334155);
        }

        .footer-btn:focus-visible {
            outline: 2px solid var(--yts-primary, #0ea5e9);
            outline-offset: 2px;
        }
        
        .footer-btn-reset {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }

        .sr-only {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
    `;

    private handleSavePreset() {
        if (!this.subtitleStyle || !this.presetNameInput.trim()) return;

        presetState.savePreset({
            name: this.presetNameInput.trim(),
            style: this.subtitleStyle,
        }).then(() => {
            this.isSavePresetDialogOpen = false;
            this.presetNameInput = '';
        });
    }

    private handleApplyPreset(event: Event) {
        const select = event.target as any;
        const presetId = select.value;
        if (!presetId) return;

        const preset = presetState.presets.value.find((p: any) => p.id === presetId);
        if (preset && preset.style) {
            this.emitStyleChange(preset.style);
        }
    }

    private handleDeletePreset(presetId: string) {
        if (confirm('Are you sure you want to delete this preset?')) {
            presetState.deletePreset(presetId);
        }
    }

    render() {
        const currentFont = this.subtitleStyle?.font || 'inherit';
        const currentSize = this.subtitleStyle?.fontSize || 40;
        const currentPosY = this.subtitleStyle?.positionY || 0;
        // ... (We keep custom colors processing)

        const currentColor = this.subtitleStyle?.color || '#ffffff';
        const currentBgColor = this.subtitleStyle?.backgroundColor || 'rgba(0,0,0,0.6)';

        let textColorToggle = 'custom';
        if (currentColor === '#000' || currentColor === 'black') textColorToggle = 'black';
        if (currentColor === '#fff' || currentColor === 'white' || currentColor === '#ffffff') textColorToggle = 'white';

        let bgColorToggle = 'custom';
        if (currentBgColor === '#facc15' || currentBgColor === 'yellow') bgColorToggle = 'yellow';
        if (currentBgColor === 'rgba(0,0,0,0.6)' || currentBgColor === 'rgba(0, 0, 0, 0.6)') bgColorToggle = 'black';

        // Reactive signal wrap
        const presets = presetState.presets.value;
        const isLoading = presetState.isLoading.value;

        return html`
            <!-- Presets Header -->
            <div class="preset-header">
                ${isLoading ? html`<sl-icon name="arrow-clockwise" class="spin"></sl-icon> Loading presets...` : html`
                    <sl-select class="preset-select" placeholder="Choose a saved preset..." clearable @sl-change=${this.handleApplyPreset}>
                        ${presets.map((p: any) => html`
                            <sl-option value="${p.id}">
                                ${p.name}
                                <sl-icon slot="suffix" name="trash" @click=${(e: Event) => {
                e.stopPropagation();
                this.handleDeletePreset(p.id);
            }} style="cursor: pointer; color: var(--yts-text-3, #94a3b8);"></sl-icon>
                            </sl-option>
                        `)}
                    </sl-select>
                `}
                
                <sl-tooltip content="Save current styles as a new preset">
                    <button class="footer-btn" style="width: auto; padding: 6px 12px; border-radius: 6px; flex: none;" @click=${() => this.isSavePresetDialogOpen = !this.isSavePresetDialogOpen}>
                        <sl-icon slot="prefix" name="save"></sl-icon> Save
                    </button>
                </sl-tooltip>
            </div>

            <!-- Inline Save Form -->
            ${this.isSavePresetDialogOpen ? html`
                <div class="save-preset-block">
                    <input 
                        type="text" 
                        class="custom-input" 
                        placeholder="e.g. Big Yellow Impact" 
                        .value=${this.presetNameInput} 
                        @input=${(e: Event) => this.presetNameInput = (e.target as HTMLInputElement).value}
                        @keyup=${(e: KeyboardEvent) => { if (e.key === 'Enter') this.handleSavePreset() }}
                    />
                    <button class="footer-btn" style="flex: none; padding: 8px 16px;" @click=${this.handleSavePreset} ?disabled=${!this.presetNameInput.trim()}>
                        Save
                    </button>
                </div>
            ` : ''}

            <!-- Font Row -->
            <div class="panel-row">
                <label class="label" id="font-label">Font</label>
                <div class="select-wrapper">
                    <sl-tooltip content="Select subtitle font family">
                        <select class="custom-select" aria-labelledby="font-label" .value="${currentFont}" @change=${this.handleFontChange}>
                            <option value="inherit">System Sans-Serif</option>
                            <option value="'Roboto', sans-serif">Roboto</option>
                            <option value="'Montserrat', sans-serif">Montserrat</option>
                            <option value="'Oswald', sans-serif">Oswald</option>
                            <option value="'Impact', sans-serif">Impact</option>
                        </select>
                    </sl-tooltip>
                </div>
            </div>

            <!-- Size Slider Row -->
            <div class="size-slider-group">
                <label class="label" id="size-label" style="width: 70px;">Size: ${currentSize}px</label>
                <sl-tooltip content="Adjust subtitle font size">
                    <input type="range" class="custom-slider" aria-labelledby="size-label" min="12" max="150" value="${currentSize}" @input=${this.handleFontSizeChange}>
                </sl-tooltip>
                <sl-tooltip content="Decrease font size">
                    <button type="button" class="size-btn" aria-label="Decrease font size" @click=${() => this.emitStyleChange({ fontSize: Math.max(12, currentSize - 2) })}>-</button>
                </sl-tooltip>
                <sl-tooltip content="Increase font size">
                    <button type="button" class="size-btn" aria-label="Increase font size" @click=${() => this.emitStyleChange({ fontSize: Math.min(150, currentSize + 2) })}>+</button>
                </sl-tooltip>
            </div>

            <!-- Colors & Preview Grid -->
            <div class="colors-preview-container">
                <div class="colors-col">
                    <div>
                        <div class="color-group-title" id="text-color-label">Colors</div>
                        <div class="color-bubbles" role="group" aria-labelledby="text-color-label">
                            <sl-dropdown distance="5">
                                <sl-tooltip slot="trigger" content="Pick a custom text color">
                                    <button type="button" class="color-bubble rainbow-picker ${textColorToggle === 'custom' ? 'active' : ''}" aria-label="Custom text color">
                                        <sl-icon name="eyedropper"></sl-icon>
                                    </button>
                                </sl-tooltip>
                                <sl-color-picker 
                                    inline 
                                    format="rgba"
                                    opacity
                                    label="Custom text color picker"
                                    .value=${currentColor} 
                                    @sl-change=${(e: Event) => {
                this.emitStyleChange({ color: (e.target as any).value });
            }}
                                ></sl-color-picker>
                            </sl-dropdown>

                            <sl-tooltip content="Set text color to Black">
                                <button type="button" class="color-bubble ${textColorToggle === 'black' ? 'active' : ''}" style="background: #000;" aria-label="Set text color to Black" @click=${() => this.setTextColor('black')}></button>
                            </sl-tooltip>
                            <sl-tooltip content="Set text color to White">
                                <button type="button" class="color-bubble ${textColorToggle === 'white' ? 'active' : ''}" style="background: #fff;" aria-label="Set text color to White" @click=${() => this.setTextColor('white')}></button>
                            </sl-tooltip>
                        </div>
                        <!-- TODO: Add advanced style edit buttons here later (Outline, Shadow, Background Padding) -->
                    </div>
                    
                    <div style="margin-top: 8px;">
                        <div class="color-group-title" id="bg-color-label">Background Color</div>
                        <div class="color-bubbles" role="group" aria-labelledby="bg-color-label">
                            <sl-dropdown distance="5">
                                <sl-tooltip slot="trigger" content="Pick a custom background color">
                                    <button type="button" class="color-bubble rainbow-picker ${bgColorToggle === 'custom' ? 'active' : ''}" aria-label="Custom background color">
                                        <sl-icon name="eyedropper"></sl-icon>
                                    </button>
                                </sl-tooltip>
                                <sl-color-picker 
                                    inline 
                                    format="rgba"
                                    opacity
                                    label="Custom background color picker"
                                    .value=${currentBgColor} 
                                    @sl-change=${(e: Event) => {
                this.emitStyleChange({ backgroundColor: (e.target as any).value });
            }}
                                ></sl-color-picker>
                            </sl-dropdown>

                            <sl-tooltip content="Set background color to Yellow">
                                <button type="button" class="color-bubble ${bgColorToggle === 'yellow' ? 'active' : ''}" style="background: #facc15;" aria-label="Set background color to Yellow" @click=${() => this.setBgColor('yellow')}></button>
                            </sl-tooltip>
                            <sl-tooltip content="Set background color to Semi-transparent Black">
                                <button type="button" class="color-bubble ${bgColorToggle === 'black' ? 'active' : ''}" style="background: rgba(0,0,0,0.6);" aria-label="Set background color to Semi-transparent Black" @click=${() => this.setBgColor('black')}></button>
                            </sl-tooltip>
                        </div>
                    </div>
                </div>

                <div class="generic-preview" aria-hidden="true">
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

            <!-- TODO: Add "Highlight Words" feature toggle here later -->

            <div class="positioning-container" style="grid-template-columns: 1fr;">
                <div class="v-offset-group">
                    <label class="label" id="v-offset-label">Vertical Offset</label>
                    <sl-tooltip content="Adjust vertical position of subtitles">
                        <input type="range" class="custom-slider" aria-labelledby="v-offset-label" min="-150" max="150" value="${currentPosY}" @input=${this.handleVerticalOffsetChange}>
                    </sl-tooltip>
                </div>
            </div>

            <!-- Footer Buttons -->
            <div class="footer-actions">
                <sl-tooltip content="Apply these styles to all subtitles">
                    <button type="button" class="footer-btn" aria-label="Apply to All" @click=${this.handleApplyToAll}>Apply to All</button>
                </sl-tooltip>
                <sl-tooltip content="Reset styles to default">
                    <button type="button" class="footer-btn footer-btn-reset" aria-label="Reset styles to default" @click=${this.handleReset}>
                        Reset
                        <sl-icon name="stars" style="color: var(--yts-text-2, #cbd5e1);"></sl-icon>
                    </button>
                </sl-tooltip>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'yts-subtitle-style-panel': YtsSubtitleStylePanel;
    }
}
