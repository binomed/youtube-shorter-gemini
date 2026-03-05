/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { type VideoSegment } from '@youtube-shorter/shared';

/**
 * Precision timeline component for multi-segment capture.
 *
 * Features:
 * - Displays segments as interactive blocks
 * - Draggable In/Out handles per segment
 * - Live timing display during drag
 * - Click-to-seek on timeline
 *
 * @element yts-precision-multi-timeline
 */
@customElement('yts-precision-multi-timeline')
export class YtsPrecisionMultiTimeline extends LitElement {
    @property({ type: Number }) duration = 0;
    @property({ type: Object }) segment?: VideoSegment;
    @property({ type: Number }) currentTime = 0;

    @state() private draggingEdge: 'start' | 'end' | null = null;

    static styles = css`
        :host {
            display: block;
            width: 100%;
            height: 90px;
            background: rgba(15, 23, 42, 0.4);
            border-radius: 12px;
            position: relative;
            user-select: none;
            overflow: visible;
            padding: 0 40px; /* Increased padding to accommodate label overflow at edges */
            box-sizing: border-box;
        }

        .timeline-track {
            position: absolute;
            top: 25px;
            left: 20px;
            right: 20px;
            height: 10px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 5px;
            cursor: pointer;
        }

        .current-time-indicator {
            position: absolute;
            top: 0;
            bottom: 0;
            width: 2px;
            background: var(--yts-accent, #0ea5e9);
            z-index: 10;
            pointer-events: none;
        }

        .segment-block {
            position: absolute;
            top: 0;
            height: 100%;
            background: rgba(14, 165, 233, 0.3);
            border: 1px solid rgba(14, 165, 233, 0.6);
            border-radius: 2px;
            box-sizing: border-box;
        }

        .handle {
            position: absolute;
            top: -12px;
            bottom: -12px;
            width: 4px;
            background: white;
            border-radius: 2px;
            cursor: col-resize;
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
            z-index: 20;
        }

        .handle::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 12px;
            height: 24px;
            background: rgba(255,255,255,0.2);
            border-radius: 4px;
        }

        .handle-start { left: 0; }
        .handle-end { right: 0; }

        .timing-label {
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            background: #0ea5e9;
            color: white;
            padding: 2px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-family: monospace;
            font-weight: bold;
            white-space: nowrap;
            pointer-events: none;
            opacity: 1;
            z-index: 50;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.2);
        }

        .handle-start .timing-label {
            bottom: -32px;
            transform: translateX(-20%);
        }

        .handle-end .timing-label {
            top: -32px;
            transform: translateX(-80%);
        }

        .handle:hover .timing-label,
        .handle-dragging .timing-label {
            opacity: 1;
        }

        .handle-dragging {
            background: var(--yts-accent, #0ea5e9);
        }
    `;

    render() {
        if (!this.segment) return html``;

        return html`
            <div class="timeline-track" @mousedown=${this._onTrackClick}>
                <div class="current-time-indicator" style="left: ${this._timeToPercent(this.currentTime)}%"></div>

                <div
                    class="segment-block"
                    style="left: ${this._timeToPercent(this.segment.startTime)}%; width: ${this._timeToPercent(this.segment.endTime - this.segment.startTime)}%"
                >
                    <div
                        class="handle handle-start ${this.draggingEdge === 'start' ? 'handle-dragging' : ''}"
                        @mousedown=${(e: MouseEvent) => this._startDrag(e, 'start')}
                    >
                        <div class="timing-label">${this._formatTime(this.segment.startTime)}</div>
                    </div>
                    <div
                        class="handle handle-end ${this.draggingEdge === 'end' ? 'handle-dragging' : ''}"
                        @mousedown=${(e: MouseEvent) => this._startDrag(e, 'end')}
                    >
                        <div class="timing-label">${this._formatTime(this.segment.endTime)}</div>
                    </div>
                </div>
            </div>
        `;
    }

    private _timeToPercent(time: number): number {
        if (!this.duration) return 0;
        return (time / this.duration) * 100;
    }

    private _formatTime(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }

    private _startDrag(e: MouseEvent, edge: 'start' | 'end') {
        e.stopPropagation();
        this.draggingEdge = edge;

        const onMouseMove = (moveEvent: MouseEvent) => {
            if (!this.draggingEdge || !this.segment) return;
            const rect = this.shadowRoot!.querySelector('.timeline-track')!.getBoundingClientRect();
            const x = moveEvent.clientX - rect.left;
            const percent = Math.max(0, Math.min(1, x / rect.width));
            const newTime = percent * this.duration;

            const updatedSegment = { ...this.segment };

            if (edge === 'start') {
                updatedSegment.startTime = Math.min(newTime, updatedSegment.endTime - 0.1);
            } else {
                updatedSegment.endTime = Math.max(newTime, updatedSegment.startTime + 0.1);
            }

            this.segment = updatedSegment;

            this.dispatchEvent(new CustomEvent('segment-change', {
                detail: { segment: this.segment, edge },
                bubbles: true,
                composed: true
            }));
        };

        const onMouseUp = () => {
            this.draggingEdge = null;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);

            this.dispatchEvent(new CustomEvent('segment-settled', {
                detail: { segment: this.segment },
                bubbles: true,
                composed: true
            }));
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }

    private _onTrackClick(e: MouseEvent) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = x / rect.width;
        const seekTime = percent * this.duration;

        this.dispatchEvent(new CustomEvent('timeline-seek', {
            detail: { time: seekTime },
            bubbles: true,
            composed: true
        }));
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'yts-precision-multi-timeline': YtsPrecisionMultiTimeline;
    }
}
