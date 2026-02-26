/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import type { SubtitleResponse, SubtitleStyle } from '@youtube-shorter/shared';

/**
 * Component responsible for displaying and styling the active subtitle
 * over the video player during playback.
 * 
 * @element yts-subtitle-overlay
 */
@customElement('yts-subtitle-overlay')
export class YtsSubtitleOverlay extends LitElement {
    @property({ type: Number })
    currentTime = 0;

    @property({ type: Array })
    subtitles: SubtitleResponse[] = [];

    @property({ type: Object })
    subtitleStyle?: SubtitleStyle;

    @state()
    private activeSubtitle: SubtitleResponse | null = null;

    willUpdate(changedProperties: Map<string, unknown>) {
        if (changedProperties.has('currentTime') || changedProperties.has('subtitles')) {
            this.updateActiveSubtitle();
        }
    }

    private updateActiveSubtitle() {
        if (!this.subtitles || this.subtitles.length === 0) {
            this.activeSubtitle = null;
            return;
        }

        // Find the subtitle that encompasses the current time
        const active = this.subtitles.find(
            (sub) => this.currentTime >= sub.startTime && this.currentTime <= sub.endTime
        );
        this.activeSubtitle = active || null;
    }

    private dispatchClickEvent(e: MouseEvent) {
        if (this.activeSubtitle) {
            e.preventDefault();
            this.dispatchEvent(
                new CustomEvent('subtitle-clicked', {
                    detail: { subtitle: this.activeSubtitle },
                    bubbles: true,
                    composed: true,
                })
            );
        }
    }

    static styles = css`
        :host {
            position: absolute;
            inset: 0;
            pointer-events: none; /* Let clicks pass through except on the text */
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-end; /* Default bottom alignment */
            padding-bottom: 20%;
            z-index: 20;
        }

        .subtitle-container {
            pointer-events: auto; /* Allow interaction with the subtitle text */
            cursor: pointer;
            text-align: center;
            padding: var(--yts-spacing-sm) var(--yts-spacing-md);
            border-radius: var(--yts-radius-md);
            transition: all 0.2s ease-in-out;
            max-width: 90%;
            word-wrap: break-word;
            
            /* Default styles overridden by subtitleStyle prop */
            background-color: rgba(0, 0, 0, 0.6);
            color: #ffffff;
            font-size: 24px;
            font-weight: bold;
            text-shadow: 1px 1px 3px rgba(0,0,0,0.8);
        }

        .subtitle-container:hover {
            transform: scale(1.05);
            outline: 2px solid var(--yts-accent);
            outline-offset: 2px;
        }
    `;

    render() {
        if (!this.activeSubtitle && !this.subtitleStyle) {
            return html``;
        }

        const styles = {
            fontFamily: this.subtitleStyle?.font || 'inherit',
            fontSize: this.subtitleStyle?.fontSize ? `${this.subtitleStyle.fontSize}px` : '24px',
            color: this.subtitleStyle?.color || '#ffffff',
            backgroundColor: this.subtitleStyle?.backgroundColor || 'rgba(0, 0, 0, 0.6)',
            transform: `translate(${this.subtitleStyle?.positionX || 0}px, ${this.subtitleStyle?.positionY || 0}px)`
        };

        return html`
            ${this.activeSubtitle ? html`
                <div 
                    class="subtitle-container" 
                    style=${styleMap(styles)}
                    @click=${this.dispatchClickEvent}
                    role="button"
                    tabindex="0"
                    aria-label="Edit subtitle"
                >
                    ${this.activeSubtitle.text}
                </div>
            ` : html``}
        `;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'yts-subtitle-overlay': YtsSubtitleOverlay;
    }
}
