/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/preact-signals';
import type { SubtitleStyle, SubtitlePreset } from '@youtube-shorter/shared';
import '@shoelace-style/shoelace/dist/components/select/select.js';
import '@shoelace-style/shoelace/dist/components/option/option.js';
import '@shoelace-style/shoelace/dist/components/range/range.js';
import '@shoelace-style/shoelace/dist/components/checkbox/checkbox.js';
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
    @property({ type: String })
    shortId?: string;

    @property({ type: Object })
    subtitleStyle: SubtitleStyle | null = null;

    @state()
    private isSavePresetDialogOpen = false;

    @state()
    private presetNameInput = '';

    connectedCallback() {
        super.connectedCallback();
        // Load presets from backend when this component mounts
        presetState.loadPresets().then(() => {
            this.autoDetectPreset();
        });
    }

    updated(changedProperties: Map<string | number | symbol, unknown>) {
        super.updated(changedProperties);
        if (changedProperties.has('shortId')) {
            this.autoDetectPreset();
        }
    }

    private autoDetectPreset() {
        if (!this.subtitleStyle) {
            presetState.activePresetId.value = null;
            return;
        }

        const presets = presetState.presets.value;
        const match = presets.find(p => this.stylesMatch(p.style, this.subtitleStyle));
        presetState.activePresetId.value = match ? match.id : null;
    }

    private stylesMatch(a: Partial<SubtitleStyle> | null, b: Partial<SubtitleStyle> | null): boolean {
        if (!a || !b) return false;

        // Convert to strings for normalized hex comparison or just direct value comparison
        // Font sizes and positions can be numbers
        return a.font === b.font &&
            a.fontSize === b.fontSize &&
            a.color === b.color &&
            a.backgroundColor === b.backgroundColor &&
            a.positionY === b.positionY;
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

    private handleAlignmentChange(alignment: 'left' | 'center' | 'right' | 'justify') {
        this.emitStyleChange({ textAlign: alignment });
    }

    private handleBorderToggle(e: Event) {
        const sw = e.target as HTMLInputElement;
        this.emitStyleChange({ borderEnabled: sw.checked });
    }

    private handleBorderWidthChange(e: Event) {
        const input = e.target as HTMLInputElement;
        this.emitStyleChange({ borderWidth: parseInt(input.value, 10) });
    }

    private handleBorderColorChange(e: Event) {
        const picker = e.target as HTMLInputElement;
        this.emitStyleChange({ borderColor: picker.value });
    }

    private handleShadowToggle(e: Event) {
        const sw = e.target as HTMLInputElement;
        this.emitStyleChange({ textShadow: sw.checked });
    }

    private handleOutlineToggle(e: Event) {
        const sw = e.target as HTMLInputElement;
        this.emitStyleChange({ textOutline: sw.checked });
    }

    private handleReset() {
        this.emitStyleChange({
            font: 'inherit',
            fontSize: 40,
            color: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.6)',
            positionX: 0,
            positionY: 0,
            textAlign: 'center',
            borderEnabled: false,
            borderWidth: 3,
            borderColor: '#000000',
            textShadow: true,
            textOutline: false
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

        sl-checkbox::part(control) {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            width: 18px;
            height: 18px;
        }

        sl-checkbox::part(checked-icon) {
            width: 12px;
            height: 12px;
        }

        sl-checkbox::part(control--checked) {
            background: #0ea5e9;
            border-color: #0ea5e9;
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
            background: conic-gradient(from 180deg at 50% 50%, #ff0000 0%, #ff00ff 17%, #0000ff 33%, #00ffff 50%, #00ff00 67%, #ffff00 83%, #ff0000 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            text-shadow: 0 0 2px rgba(0,0,0,0.5);
            font-size: 14px;
            padding: 0;
            box-sizing: border-box;
        }

        sl-color-picker::part(trigger) {
            display: none;
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
        /* Alignment & Effects */
        .section-title {
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
            color: var(--yts-text-3, #94a3b8);
            margin-bottom: 12px;
            margin-top: 24px;
        }

        .align-group {
            display: flex;
            gap: 8px;
            background: var(--yts-glass-bg, #2a2d3d);
            padding: 4px;
            border-radius: var(--yts-radius, 8px);
            width: fit-content;
        }

        .align-btn {
            background: transparent;
            border: none;
            color: var(--yts-text-3, #94a3b8);
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            border-radius: 4px;
            transition: all 0.2s;
        }

        .align-btn:hover {
            background: rgba(255,255,255,0.05);
            color: var(--yts-text-1, #f8fafc);
        }

        .align-btn.active {
            background: var(--yts-surface-3, #334155);
            color: var(--yts-text-1, #f8fafc);
        }

        .effect-row {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
        }

        .effect-label {
            display: flex;
            align-items: center;
            gap: 8px;
            flex: 1;
            font-size: 13px;
        }

        sl-switch::part(control) {
           --sl-input-height-small: 18px;
           --sl-input-width-small: 32px;
        }

        .border-controls {
            display: flex;
            align-items: center;
            gap: 12px;
            flex: 2;
        }

        .color-dot {
            width: 20px;
            height: 20px;
            border-radius: 4px;
            border: 1px solid rgba(255,255,255,0.2);
            cursor: pointer;
        }

        .gradient-btn {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 600;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            font-size: 13px;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
        }

        .gradient-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(79, 70, 229, 0.4);
            filter: brightness(1.1);
        }

        .gradient-btn:disabled {
            background: #475569;
            box-shadow: none;
            cursor: not-allowed;
            transform: none;
            opacity: 0.7;
        }

        .apply-btn {
            composes: gradient-btn; /* Note: Lit doesn't support 'composes', so I'll just use the class */
        }

        .footer-btn {
            background: var(--yts-glass-bg, #2a2d3d);
            border: 1px solid var(--yts-border, rgba(255,255,255,0.1));
            color: var(--yts-text-1, #f8fafc);
            padding: 8px 16px;
            border-radius: 8px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
            font-size: 13px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }

        .footer-btn:hover {
            background: var(--yts-surface-3, #334155);
            border-color: rgba(255,255,255,0.2);
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
        const select = event.target as HTMLSelectElement;
        const presetId = select.value;
        if (!presetId) {
            presetState.activePresetId.value = null;
            return;
        }

        const preset = presetState.presets.value.find((p: SubtitlePreset) => p.id === presetId);
        if (preset && preset.style) {
            presetState.activePresetId.value = preset.id;
            this.emitStyleChange(preset.style);
        }
    }

    private handleUpdatePreset() {
        if (!presetState.activePresetId.value || !this.subtitleStyle) return;
        presetState.updatePreset(presetState.activePresetId.value, {
            style: this.subtitleStyle
        });
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
        const currentColor = this.subtitleStyle?.color || '#ffffff';
        const currentBgColor = this.subtitleStyle?.backgroundColor || 'rgba(0,0,0,0.6)';

        let textColorToggle = 'custom';
        if (currentColor === '#000' || currentColor === 'black') textColorToggle = 'black';
        if (currentColor === '#fff' || currentColor === 'white' || currentColor === '#ffffff') textColorToggle = 'white';

        let bgColorToggle = 'custom';
        if (currentBgColor === '#facc15' || currentBgColor === 'yellow') bgColorToggle = 'yellow';
        if (currentBgColor === 'rgba(0,0,0,0.6)' || currentBgColor === 'rgba(0, 0, 0, 0.6)') bgColorToggle = 'black';

        const presets = presetState.presets.value;
        const isLoading = presetState.isLoading.value;

        const textAlign = this.subtitleStyle?.textAlign || 'center';
        const borderEnabled = this.subtitleStyle?.borderEnabled || false;
        const borderWidth = this.subtitleStyle?.borderWidth || 3;
        const borderColor = this.subtitleStyle?.borderColor || '#000000';
        const textShadow = this.subtitleStyle?.textShadow ?? true;
        const textOutline = this.subtitleStyle?.textOutline || false;

        return html`
            ${this._renderPresetsHeader(presets, isLoading)}
            ${this.isSavePresetDialogOpen ? this._renderSavePresetForm() : ''}
            ${this._renderFontSection(currentFont)}
            ${this._renderSizeSection(currentSize)}
            ${this._renderColorsPreviewSection(currentFont, currentColor, currentBgColor, textColorToggle, bgColorToggle, textAlign, borderEnabled, borderWidth, borderColor, textShadow, textOutline)}
            ${this._renderAlignmentSection(textAlign)}
            ${this._renderEffectsSection(borderEnabled, borderWidth, borderColor, textShadow, textOutline)}
            ${this._renderPositionSection(currentPosY)}
            ${this._renderFooterActions()}
        `;
    }

    private _renderPresetsHeader(presets: SubtitlePreset[], isLoading: boolean) {
        return html`
            <div class="preset-header">
                ${isLoading ? html`<sl-icon name="arrow-clockwise" class="spin"></sl-icon> Loading presets...` : html`
                    <sl-select class="preset-select" placeholder="Choose a saved preset..." clearable .value=${presetState.activePresetId.value || ''} @sl-change=${this.handleApplyPreset}>
                        ${presets.map((p: SubtitlePreset) => html`
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

                ${presetState.activePresetId.value ? html`
                    <sl-tooltip content="Update the currently selected preset" placement="bottom">
                        <button class="gradient-btn" style="width: auto; padding: 6px 12px; flex: none; margin-right: 8px;" @click=${this.handleUpdatePreset}>
                            <sl-icon slot="prefix" name="pencil"></sl-icon> Update
                        </button>
                    </sl-tooltip>
                ` : ''}

                <sl-tooltip content="Save current styles as a new preset" placement="bottom">
                    <button class="gradient-btn" style="width: auto; padding: 6px 12px; flex: none;" @click=${() => this.isSavePresetDialogOpen = !this.isSavePresetDialogOpen}>
                        <sl-icon slot="prefix" name="box-arrow-in-down"></sl-icon> ${presetState.activePresetId.value ? 'Save as New' : 'Save'}
                    </button>
                </sl-tooltip>
            </div>
        `;
    }

    private _renderSavePresetForm() {
        return html`
            <div class="save-preset-block">
                <input
                    type="text"
                    class="custom-input"
                    placeholder="e.g. Big Yellow Impact"
                    .value=${this.presetNameInput}
                    @input=${(e: Event) => this.presetNameInput = (e.target as HTMLInputElement).value}
                    @keyup=${(e: KeyboardEvent) => { if (e.key === 'Enter') this.handleSavePreset() }}
                />
                <button class="gradient-btn" style="flex: none; padding: 8px 16px;" @click=${this.handleSavePreset} ?disabled=${!this.presetNameInput.trim()}>
                    Save
                </button>
            </div>
        `;
    }

    private _renderFontSection(currentFont: string) {
        return html`
            <div class="panel-row">
                <label class="label" id="font-label">Font</label>
                <div class="select-wrapper">
                    <sl-tooltip content="Select subtitle font family" placement="bottom">
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
        `;
    }

    private _renderSizeSection(currentSize: number) {
        return html`
            <div class="size-slider-group">
                <label class="label" id="size-label" style="width: 70px;">Size: ${currentSize}px</label>
                <sl-tooltip content="Adjust subtitle font size" placement="bottom">
                    <input type="range" class="custom-slider" aria-labelledby="size-label" min="12" max="150" value="${currentSize}" @input=${this.handleFontSizeChange}>
                </sl-tooltip>
                <sl-tooltip content="Decrease font size" placement="bottom">
                    <button type="button" class="size-btn" aria-label="Decrease font size" @click=${() => this.emitStyleChange({ fontSize: Math.max(12, currentSize - 2) })}>-</button>
                </sl-tooltip>
                <sl-tooltip content="Increase font size" placement="bottom">
                    <button type="button" class="size-btn" aria-label="Increase font size" @click=${() => this.emitStyleChange({ fontSize: Math.min(150, currentSize + 2) })}>+</button>
                </sl-tooltip>
            </div>
        `;
    }

    private _renderColorsPreviewSection(
        currentFont: string,
        currentColor: string,
        currentBgColor: string,
        textColorToggle: string,
        bgColorToggle: string,
        textAlign: string,
        borderEnabled: boolean,
        borderWidth: number,
        borderColor: string,
        textShadow: boolean,
        textOutline: boolean
    ) {
        // Build CSS for preview
        let previewStyle = `
            font-family: ${currentFont};
            color: ${currentColor};
            background-color: ${currentBgColor};
            text-align: ${textAlign === 'justify' ? 'justify' : textAlign};
            padding: 8px 12px;
            border-radius: 4px;
        `;

        if (borderEnabled) {
            previewStyle += `border: ${borderWidth}px solid ${borderColor};`;
        }

        if (textShadow) {
            previewStyle += `text-shadow: 2px 2px 4px rgba(0,0,0,0.5);`;
        }

        if (textOutline) {
            previewStyle += `-webkit-text-stroke: 1px ${currentColor === '#ffffff' ? '#000000' : '#ffffff'};`;
        }

        return html`
            <div class="colors-preview-container">
                <div class="colors-col">
                    <div>
                        <div class="color-group-title" id="text-color-label">TEXT COLOR</div>
                        <div class="color-bubbles" role="group" aria-labelledby="text-color-label">
                            <sl-dropdown distance="5">
                                <sl-tooltip slot="trigger" content="Pick a custom text color" placement="bottom">
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
                this.emitStyleChange({ color: (e.target as HTMLInputElement).value });
            }}
                                ></sl-color-picker>
                            </sl-dropdown>

                            <sl-tooltip content="Set text color to Black" placement="bottom">
                                <button type="button" class="color-bubble ${textColorToggle === 'black' ? 'active' : ''}" style="background: #000;" aria-label="Set text color to Black" @click=${() => this.setTextColor('black')}></button>
                            </sl-tooltip>
                            <sl-tooltip content="Set text color to White" placement="bottom">
                                <button type="button" class="color-bubble ${textColorToggle === 'white' ? 'active' : ''}" style="background: #fff;" aria-label="Set text color to White" @click=${() => this.setTextColor('white')}></button>
                            </sl-tooltip>
                        </div>
                    </div>

                    <div style="margin-top: 8px;">
                        <div class="color-group-title" id="bg-color-label">BACKGROUND COLOR</div>
                        <div class="color-bubbles" role="group" aria-labelledby="bg-color-label">
                            <sl-dropdown distance="5">
                                <sl-tooltip slot="trigger" content="Pick a custom background color" placement="bottom">
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
                this.emitStyleChange({ backgroundColor: (e.target as HTMLInputElement).value });
            }}
                                ></sl-color-picker>
                            </sl-dropdown>

                            <sl-tooltip content="Set background color to Yellow" placement="bottom">
                                <button type="button" class="color-bubble ${bgColorToggle === 'yellow' ? 'active' : ''}" style="background: #facc15;" aria-label="Set background color to Yellow" @click=${() => this.setBgColor('yellow')}></button>
                            </sl-tooltip>
                            <sl-tooltip content="Set background color to Semi-transparent Black" placement="bottom">
                                <button type="button" class="color-bubble ${bgColorToggle === 'black' ? 'active' : ''}" style="background: rgba(0,0,0,0.6);" aria-label="Set background color to Semi-transparent Black" @click=${() => this.setBgColor('black')}></button>
                            </sl-tooltip>
                        </div>
                    </div>
                </div>

                <div class="generic-preview" aria-hidden="true">
                    <div class="preview-blur-bg"></div>
                    <div class="preview-text" style="${previewStyle}">Sample subtitle text for preview</div>
                </div>
            </div>
        `;
    }

    private _renderAlignmentSection(textAlign: string) {
        return html`
            <div class="section-title">Text Alignment</div>
            <div class="align-group">
                <button class="align-btn ${textAlign === 'left' ? 'active' : ''}" @click=${() => this.handleAlignmentChange('left')}>
                    <sl-icon name="text-left"></sl-icon>
                </button>
                <button class="align-btn ${textAlign === 'center' ? 'active' : ''}" @click=${() => this.handleAlignmentChange('center')}>
                    <sl-icon name="text-center"></sl-icon>
                </button>
                <button class="align-btn ${textAlign === 'right' ? 'active' : ''}" @click=${() => this.handleAlignmentChange('right')}>
                    <sl-icon name="text-right"></sl-icon>
                </button>
                <button class="align-btn ${textAlign === 'justify' ? 'active' : ''}" @click=${() => this.handleAlignmentChange('justify')}>
                    <sl-icon name="justify"></sl-icon>
                </button>
            </div>
        `;
    }

    private _renderEffectsSection(
        borderEnabled: boolean,
        borderWidth: number,
        borderColor: string,
        textShadow: boolean,
        textOutline: boolean
    ) {
        return html`
            <div class="section-title">Text Effects</div>

            <div class="effect-row">
                <div class="effect-label">
                    <sl-checkbox ?checked=${borderEnabled} @sl-change=${this.handleBorderToggle}>Border</sl-checkbox>
                </div>
                <div class="border-controls">
                    <input type="range" class="custom-slider" min="1" max="10" .value=${borderWidth} @input=${this.handleBorderWidthChange} ?disabled=${!borderEnabled}>
                    <sl-dropdown distance="5">
                        <div slot="trigger" class="color-dot" style="background: ${borderColor}"></div>
                        <sl-color-picker
                            inline
                            format="rgba"
                            .value=${borderColor}
                            @sl-change=${this.handleBorderColorChange}
                        ></sl-color-picker>
                    </sl-dropdown>
                    <sl-icon name="pencil" style="font-size: 14px; color: var(--yts-text-3);"></sl-icon>
                </div>
            </div>

            <div class="effect-row">
                <div class="effect-label">
                    <span>Text Shadow</span>
                </div>
                <sl-checkbox ?checked=${textShadow} @sl-change=${this.handleShadowToggle}></sl-checkbox>
            </div>

            <div class="effect-row">
                <div class="effect-label">
                    <span>Text Outline/Glow</span>
                </div>
                <sl-checkbox ?checked=${textOutline} @sl-change=${this.handleOutlineToggle}></sl-checkbox>
            </div>
        `;
    }

    private _renderPositionSection(currentPosY: number) {
        return html`
            <div class="section-title">Vertical Offset</div>
            <div class="positioning-container" style="grid-template-columns: 1fr;">
                <div class="v-offset-group">
                    <sl-tooltip content="Adjust vertical position of subtitles" placement="bottom">
                        <input type="range" class="custom-slider" aria-labelledby="v-offset-label" min="-150" max="150" value="${currentPosY}" @input=${this.handleVerticalOffsetChange}>
                    </sl-tooltip>
                </div>
            </div>
        `;
    }

    private _renderFooterActions() {
        return html`
            <div style="display: flex; gap: 12px; margin-top: 24px;">
                <button class="gradient-btn" style="flex: 1;" @click=${this.handleApplyToAll}>Apply to All</button>
                <button class="footer-btn" style="flex: none; width: 80px;" @click=${this.handleReset}>Reset</button>
            </div>
        `;
    }

}

declare global {
    interface HTMLElementTagNameMap {
        'yts-subtitle-style-panel': YtsSubtitleStylePanel;
    }
}
