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

    @state() private _isDragging = false;
    private _dragStartY = 0;
    private _initialPosY = 0;
    private _hasDragged = false;
    @state() private _currentPosY = 0;

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

    private _onPointerDown(e: PointerEvent) {
        if (!this.activeSubtitle) return;

        // Only trigger on primary button (left click) or touch
        if (e.button !== 0 && e.pointerType === 'mouse') return;

        e.preventDefault(); // Prevent text selection

        this._isDragging = true;
        this._hasDragged = false;

        this._dragStartY = e.clientY;

        this._initialPosY = this.subtitleStyle?.positionY || 0;
        this._currentPosY = this._initialPosY;

        window.addEventListener('pointermove', this._onPointerMove);
        window.addEventListener('pointerup', this._onPointerUp);
        window.addEventListener('pointercancel', this._onPointerUp);
    }

    private _onPointerMove = (e: PointerEvent) => {
        if (!this._isDragging) return;

        // Downward is positive deltaY
        const deltaY = e.clientY - this._dragStartY;

        if (Math.abs(deltaY) > 3) {
            this._hasDragged = true;
        }

        this._currentPosY = this._initialPosY + deltaY;
    };

    private _onPointerUp = (e: PointerEvent) => {
        if (!this._isDragging) return;
        this._isDragging = false;

        window.removeEventListener('pointermove', this._onPointerMove);
        window.removeEventListener('pointerup', this._onPointerUp);
        window.removeEventListener('pointercancel', this._onPointerUp);

        if (this._hasDragged) {
            this.dispatchEvent(
                new CustomEvent('subtitle-moved', {
                    detail: {
                        positionX: 0,
                        positionY: this._currentPosY
                    },
                    bubbles: true,
                    composed: true,
                })
            );
        } else {
            this.dispatchClickEvent(e);
        }
    };

    private dispatchClickEvent(e: Event) {
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
            cursor: grab;
            user-select: none;
            text-align: center;
            padding: var(--yts-spacing-sm) var(--yts-spacing-md);
            border-radius: var(--yts-radius-md);
            max-width: 90%;
            word-wrap: break-word;
            touch-action: none; /* Prevent scrolling on mobile while dragging */

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

        const posX = 0; // X is always locked to center
        const posY = this._isDragging ? this._currentPosY : (this.subtitleStyle?.positionY || 0);

        const styles = {
            fontFamily: this.subtitleStyle?.font || 'inherit',
            fontSize: this.subtitleStyle?.fontSize ? `${this.subtitleStyle.fontSize}px` : '24px',
            color: this.subtitleStyle?.color || '#ffffff',
            backgroundColor: this.subtitleStyle?.backgroundColor || 'rgba(0, 0, 0, 0.6)',
            transform: `translate(${posX}px, ${posY}px)`,
            cursor: this._isDragging ? 'grabbing' : 'grab'
        };

        return html`
            ${this.activeSubtitle ? html`
                <div
                    class="subtitle-container"
                    style=${styleMap(styles)}
                    @pointerdown=${this._onPointerDown}
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
