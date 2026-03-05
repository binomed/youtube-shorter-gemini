/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { LitElement, html, css } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import type { SubtitleResponse, SubtitleStyle } from '@youtube-shorter/shared';
import { styleMap } from 'lit/directives/style-map.js';

/**
 * Component for editing subtitle text inline over the video.
 * Auto-pauses video (handled by parent logic) and saves on blur/Enter.
 *
 * @element yts-subtitle-editor
 */
@customElement('yts-subtitle-editor')
export class YtsSubtitleEditor extends LitElement {
    @property({ type: Object })
    subtitle!: SubtitleResponse;

    @property({ type: Object })
    subtitleStyle?: SubtitleStyle;

    @state()
    private editText = '';

    @query('textarea')
    private inputElement!: HTMLTextAreaElement;

    connectedCallback() {
        super.connectedCallback();
        this.editText = this.subtitle?.text || '';
    }

    updated(changedProperties: Map<string, unknown>) {
        if (changedProperties.has('subtitle') && this.subtitle) {
            this.editText = this.subtitle.text;
        }
    }

    firstUpdated() {
        // Auto-focus the input on mount
        setTimeout(() => this.inputElement?.focus(), 50);
    }

    private handleInput(e: Event) {
        const target = e.target as HTMLTextAreaElement;
        this.editText = target.value;
    }

    private handleKeyDown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.save();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this.cancel();
        }
    }

    private handleBlur() {
        // Save on blur as requested by UX
        this.save();
    }

    private save() {
        if (this.editText.trim() !== this.subtitle.text) {
            this.dispatchEvent(
                new CustomEvent('save-subtitle', {
                    detail: { subtitleId: this.subtitle.id, text: this.editText.trim() },
                    bubbles: true,
                    composed: true,
                })
            );
        } else {
            this.cancel();
        }
    }

    private cancel() {
        this.dispatchEvent(
            new CustomEvent('cancel-edit', {
                bubbles: true,
                composed: true,
            })
        );
    }

    static styles = css`
        :host {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-end; /* Default bottom alignment */
            padding-bottom: 20%;
            z-index: 30;
            background-color: rgba(0, 0, 0, 0.4); /* Dim background slightly to focus on edit */
        }

        .editor-container {
            width: 80%;
            max-width: 400px;
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 8px;

            /* Add some transform to place it correctly if defined */
            transition: all 0.2s;
        }

        .editor-input {
            width: 100%;
            background-color: rgba(0, 0, 0, 0.8) !important;
            color: #ffffff !important;
            font-size: 24px;
            font-weight: bold;
            text-align: center;
            border: 2px solid var(--yts-accent, #6366f1);
            border-radius: var(--yts-radius-md);
            padding: var(--yts-spacing-sm) var(--yts-spacing-md);
            outline: none;
            resize: none;
            overflow: hidden;
            box-shadow: var(--yts-shadow-lg);
            font-family: inherit;
        }

        .editor-input::placeholder {
            color: rgba(255, 255, 255, 0.3);
        }

        .hint {
            color: #ccc;
            font-size: 12px;
            text-align: center;
            font-family: monospace;
            text-shadow: 1px 1px 2px black;
        }
    `;

    render() {
        if (!this.subtitle) return html``;

        const containerStyles = {
            transform: `translate(${this.subtitleStyle?.positionX || 0}px, ${this.subtitleStyle?.positionY || 0}px)`
        };

        const inputStyles = {
            fontFamily: this.subtitleStyle?.font || 'inherit',
            fontSize: this.subtitleStyle?.fontSize ? `${this.subtitleStyle.fontSize}px` : '24px',
            color: this.subtitleStyle?.color || '#ffffff',
            backgroundColor: this.subtitleStyle?.backgroundColor || 'rgba(0, 0, 0, 0.8)',
        };

        return html`
            <div class="editor-container" style=${styleMap(containerStyles)}>
                <textarea
                    class="editor-input"
                    rows="3"
                    style=${styleMap(inputStyles)}
                    .value=${this.editText}
                    @input=${this.handleInput}
                    @keydown=${this.handleKeyDown}
                    @blur=${this.handleBlur}
                    placeholder="Enter subtitle text..."
                ></textarea>
                <div class="hint">Enter to save • Esc to cancel</div>
            </div>
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'yts-subtitle-editor': YtsSubtitleEditor;
    }
}
