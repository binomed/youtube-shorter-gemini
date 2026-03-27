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
            pointer-events: none;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-end;
            padding-bottom: 20%;
            z-index: 2;
            
            /* Enable container queries on the player frame */
            container-type: size;
        }

        .subtitle-container {
            pointer-events: auto;
            cursor: grab;
            user-select: none;
            /* text-align removed because we map it dynamically */
            
            /* Responsive Padding: Match the backend 'Outline' of 20px (per 1000px height) */
            /* 20px / 562.5px design width = 3.55cqw. We use 3.5cqw for parity. */
            padding: 1.5cqh 3.5cqw;
            
            border-radius: 0.8cqw;
            
            /* Match backend MarginL/R of 5.4% (5% gap on each side) */
            /* In backend we set 54px for 1080px width, which is 5%. */
            /* So max-width is 100% - 10% = 90%. */
            max-width: 90%;
            
            word-wrap: break-word;
            touch-action: none;

            background-color: rgba(0, 0, 0, 0.6);
            color: #ffffff;
            font-weight: bold;
        }

        .subtitle-container:hover {
            transform: scale(1.02);
            outline: 0.5cqw solid var(--yts-accent);
            outline-offset: 0.5cqw;
        }

        .word-wrapper {
            display: flex;
            flex-wrap: wrap;
            /* justify-content is mapped dynamically to support left/right/center alignment */
            gap: 0.4cqw 0.8cqw;
        }

        .word {
            display: inline-block;
            transition: color 0.15s ease, transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            white-space: pre-wrap;
        }

        .word.active {
            color: var(--highlight-color, #facc15);
            transform: scale(var(--highlight-scale, 1.15));
            /* Inherit text-shadow instead of overriding */
        }
    `;

    render() {
        if (!this.activeSubtitle && !this.subtitleStyle) {
            return html``;
        }

        const posX = 0; // X is always locked to center
        const posY = this._isDragging ? this._currentPosY : (this.subtitleStyle?.positionY || 0);

        // Convert UI design pixels to responsive container units (cqw/cqh)
        // Reference Width for 9:16 inside a 1000px height is 562.5px
        const fsValue = this.subtitleStyle?.fontSize || 40;
        const responsiveFontSize = `${(fsValue / 562.5) * 100}cqw`;
        
        // Alignment Mapping
        let alignSelf = 'center';
        let justifyContent = 'center';
        if (this.subtitleStyle?.textAlign === 'left') { 
            alignSelf = 'flex-start'; 
            justifyContent = 'flex-start';
        } else if (this.subtitleStyle?.textAlign === 'right') { 
            alignSelf = 'flex-end'; 
            justifyContent = 'flex-end'; 
        }

        const styles: Record<string, string | number> = {
            fontFamily: this.subtitleStyle?.font || 'inherit',
            fontSize: responsiveFontSize,
            color: this.subtitleStyle?.color || '#ffffff',
            backgroundColor: this.subtitleStyle?.backgroundColor || 'rgba(0, 0, 0, 0.6)',
            textAlign: this.subtitleStyle?.textAlign || 'center',
            alignSelf: alignSelf,
            transform: `translate(${posX}px, ${posY}px)`,
            cursor: this._isDragging ? 'grabbing' : 'grab',
            '--highlight-color': this.subtitleStyle?.highlightColor || '#facc15',
            '--highlight-scale': (this.subtitleStyle?.highlightScale || 115) / 100
        };

        // Border as WebkitTextStroke (FFMPEG BorderStyle: 1 Outline)
        if (this.subtitleStyle?.borderEnabled) {
            const bw = this.subtitleStyle.borderWidth || 3;
            styles.WebkitTextStroke = `calc(${(bw / 562.5) * 100}cqw) ${this.subtitleStyle.borderColor || '#000000'}`;
        } else {
            styles.WebkitTextStroke = '0';
        }

        // Shadow and Glow
        const shadows = [];
        if (this.subtitleStyle?.textShadow) {
            shadows.push('0.4cqw 0.4cqw 0.8cqw rgba(0,0,0,0.8)');
        }
        
        if (this.subtitleStyle?.textOutline) {
            // Apply Glow
            const isDarkColor = this.subtitleStyle.color === '#000000' || this.subtitleStyle.color === 'black';
            const glowColor = isDarkColor ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.8)';
            shadows.push(`0 0 1.5cqw ${glowColor}`);
        }
        
        styles.textShadow = shadows.length > 0 ? shadows.join(', ') : 'none';

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
                    ${this.subtitleStyle?.highlightEnabled && this.activeSubtitle.words && this.activeSubtitle.words.length > 0 ? html`
                        <div class="word-wrapper" style="justify-content: ${justifyContent}">
                            ${this.activeSubtitle.words.map(w => {
                                const isActive = this.currentTime >= w.startTime && this.currentTime <= w.endTime;
                                return html`
                                    <span class="word ${isActive ? 'active' : ''}">${w.text}</span>
                                `;
                            })}
                        </div>
                    ` : this.activeSubtitle.text}
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
