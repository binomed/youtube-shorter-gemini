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
    @property({ type: Boolean }) isPlaying = false;

    @state() private draggingEdge: 'start' | 'end' | null = null;
    @state() private _zoom = 1; // 1 = 100% of container is 60s or duration

    /**
   * True framerate of the original video (e.g. 24, 25, 29.97, 60).
   * Used to snap timeline actions perfectly to video frames.
   */
  @property({ type: Number })
  fps = 30;

  private get _frameDuration() {
    return 1 / (this.fps > 0 ? this.fps : 30);
  }

    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            height: auto;
            position: relative;
            user-select: none;
            overflow: visible;
            box-sizing: border-box;
            font-family: 'Inter', system-ui, sans-serif;
            color: white;
        }

        .header {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 24px;
            color: #f1f5f9;
        }

        .timeline-container {
            position: relative;
            height: 80px;
            background: rgba(30, 41, 59, 0.5);
            border-radius: 12px;
            padding: 0 16px; 
            display: flex;
            align-items: center;
            gap: 16px;
            overflow: hidden;
        }

        .timeline-scroll-container {
            flex: 1;
            height: 100%;
            display: flex;
            align-items: center;
            overflow-x: auto;
            overflow-y: hidden;
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
            padding: 0 40px; /* Padding for handles at edges */
        }

        .timeline-scroll-container::-webkit-scrollbar {
            height: 4px;
        }

        .timeline-scroll-container::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 10px;
        }

        .play-btn {
            background: transparent;
            border: none;
            color: white;
            padding: 8px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            flex-shrink: 0;
        }

        .play-btn:hover {
            background: rgba(255, 255, 255, 0.1);
        }

        .play-btn sl-icon {
            font-size: 24px;
        }

        .timeline-track {
            position: relative;
            width: 100%; /* Will be overridden by inline style for zoom */
            min-width: 100%;
            flex-shrink: 0; /* CRITICAL: Prevent flexbox from squishing the zoomed track */
            height: 48px;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 8px;
            cursor: pointer;
            overflow: visible;
        }

        /* Waveform decorative effect */
        .waveform-bg {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: space-around;
            padding: 0 4px;
            opacity: 0.2;
            pointer-events: none;
        }

        .waveform-bar {
            width: 2px;
            background: #64748b;
            border-radius: 1px;
        }

        .current-time-indicator {
            position: absolute;
            top: -10px;
            bottom: -10px;
            width: 2px;
            background: white;
            z-index: 30;
            pointer-events: none;
        }

        .playhead-bubble {
            position: absolute;
            top: -8px; /* Lower position to avoid IN label overlap */
            left: 50%;
            transform: translateX(-50%);
            background: rgba(30, 41, 59, 1);
            border: 1px solid rgba(255,255,255,0.2);
            color: #e2e8f0;
            padding: 2px 8px; /* Slightly more compact */
            border-radius: 12px;
            font-size: 11px;
            font-weight: 700;
            box-shadow: 0 4px 12px rgba(0,0,0,0.6);
            white-space: nowrap;
            cursor: grab;
            pointer-events: auto; /* Enable interaction */
            z-index: 50; /* Ensure it stays on top of segment blocks */
        }

        .playhead-bubble:active {
            cursor: grabbing;
        }

        .playhead-pointer {
            position: absolute;
            bottom: -10px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-bottom: 5px solid rgba(30, 41, 59, 1);
            transform: rotate(180deg);
        }

        .segment-block {
            position: absolute;
            top: 0;
            bottom: 0;
            background: linear-gradient(90deg, #0ea5e9 0%, #a855f7 100%);
            opacity: 0.4;
            border: 2px solid #0ea5e9;
            border-left: none;
            border-right: none;
            box-sizing: border-box;
            z-index: 10;
        }

        .handle {
            position: absolute;
            top: 0;
            bottom: 0;
            width: 2px;
            background: white;
            z-index: 25;
            cursor: col-resize;
            overflow: visible;
        }

        .handle-circle {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 14px;
            height: 14px;
            border-radius: 50%;
            border: 2px solid white;
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
        }

        .handle-start .handle-circle { background: #0ea5e9; }
        .handle-end .handle-circle { background: #a855f7; }

        .floating-label {
            position: absolute;
            top: -50px;
            padding: 6px 14px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 8px;
            white-space: nowrap;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            z-index: 40;
        }

        .label-in {
            left: 0;
            transform: translateX(-50%);
            background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%);
        }

        .label-out {
            top: auto;
            bottom: -50px;
            right: 0;
            transform: translateX(50%);
            background: linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%);
        }

        .label-pointer {
            position: absolute;
            bottom: -6px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 6px solid currentColor;
        }

        .label-in .label-pointer { color: #3b82f6; }
        
        .label-out .label-pointer { 
            color: #8b5cf6;
            top: -6px;
            bottom: auto;
            border-top: none;
            border-bottom: 6px solid currentColor;
        }

        .time-footer {
            display: flex;
            justify-content: space-between;
            margin-top: 12px;
            font-size: 12px;
            font-weight: 700;
            color: #94a3b8;
            letter-spacing: 0.5px;
        }

        .time-footer span {
            color: white;
            margin-left: 4px;
        }

        .keyframe-marker {
            position: absolute;
            top: 0;
            bottom: 0;
            width: 14px; /* Hit area */
            margin-left: -7px; /* Center it */
            z-index: 15;
            cursor: pointer;
            pointer-events: auto;
            display: flex;
            justify-content: center;
        }

        .keyframe-line {
            width: 2px;
            height: 100%;
            background: #ef4444;
            box-shadow: 0 0 5px rgba(239, 68, 68, 0.4);
        }

        .keyframe-marker::after {
            content: '';
            position: absolute;
            top: -5px;
            left: 50%;
            transform: translateX(-50%) rotate(45deg);
            width: 10px;
            height: 10px;
            background: #ef4444;
            box-shadow: 0 0 10px rgba(239, 68, 68, 0.8);
        }
    `;

    render() {
        if (!this.segment) return html``;

        const startPct = this._timeToPercent(this.segment.startTime);
        const endPct = this._timeToPercent(this.segment.endTime);
        const widthPct = endPct - startPct;
        const currentPct = this._timeToPercent(this.currentTime);

        return html`
            <div class="header">Timeline Editing Zone</div>
            
            <div class="timeline-container">
                <sl-tooltip content="Play / Pause (Space)">
                    <button class="play-btn" @click=${this._togglePlay} aria-label="${this.isPlaying ? 'Pause' : 'Play'}">
                        <sl-icon name="${this.isPlaying ? 'pause-fill' : 'play-fill'}"></sl-icon>
                    </button>
                </sl-tooltip>

                <div class="timeline-scroll-container">
                    <div 
                        class="timeline-track" 
                        style="width: ${this._zoom * 100}%;" 
                        @mousedown=${this._onTrackClick}
                    >
                    <div class="waveform-bg">
                        ${Array.from({ length: 40 }).map(() => html`
                            <div class="waveform-bar" style="height: ${20 + Math.random() * 60}%"></div>
                        `)}
                    </div>

                    <div 
                        class="current-time-indicator" 
                        style="left: ${currentPct}%"
                    >
                        <div class="playhead-bubble" @mousedown=${this._startPlayheadDrag}>
                            ${this._formatTimeShort(this.currentTime)}
                            <div class="playhead-pointer"></div>
                        </div>
                    </div>

                    <div class="segment-block" style="left: ${startPct}%; width: ${widthPct}%"></div>

                    ${(this.segment.layoutTimeline || []).map(ev => html`
                        <div 
                            class="keyframe-marker" 
                            style="left: ${this._timeToPercent(ev.timestamp)}%"
                            title="Keyframe at ${ev.timestamp.toFixed(2)}s"
                            @mousedown=${(e: MouseEvent) => { e.stopPropagation(); this._emitSeek(ev.timestamp); }}
                        >
                            <div class="keyframe-line"></div>
                        </div>
                    `)}

                    <div
                        class="handle handle-start"
                        style="left: ${startPct}%"
                        @mousedown=${(e: MouseEvent) => this._startDrag(e, 'start')}
                    >
                        <div class="floating-label label-in">
                            <sl-icon name="play-fill" style="font-size: 14px;"></sl-icon> IN ${this._formatTimeShort(this.segment.startTime)}
                            <div class="label-pointer"></div>
                        </div>
                        <div class="handle-circle"></div>
                    </div>

                    <div
                        class="handle handle-end"
                        style="left: ${endPct}%"
                        @mousedown=${(e: MouseEvent) => this._startDrag(e, 'end')}
                    >
                        <div class="floating-label label-out">
                            <sl-icon name="play-fill" style="font-size: 14px;"></sl-icon> OUT ${this._formatTimeShort(this.segment.endTime)}
                            <div class="label-pointer"></div>
                        </div>
                        <div class="handle-circle"></div>
                    </div>
                </div>
                </div>
            </div>

            <div class="time-footer">
                <div>IN: <span style="color: white; border: 1px solid rgba(255,255,255,0.3); padding: 1px 4px; border-radius: 4px;">${this._formatTimeShort(this.segment.startTime)}</span> / ${this._formatTimeShort(this.duration)}</div>
                <div>OUT: <span style="color: white; border: 1px solid rgba(255,255,255,0.3); padding: 1px 4px; border-radius: 4px;">${this._formatTimeShort(this.segment.endTime)}</span> / ${this._formatTimeShort(this.duration)}</div>
            </div>
        `;
    }

    private _formatTimeShort(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    private _timeToPercent(time: number): number {
        if (!this.duration) return 0;
        // Total width is controlled by zoom. 100% is the "viewport" width.
        // We calculate position relative to the track's total width.
        return (time / this.duration) * 100;
    }

    private _snapToFrame(time: number): number {
        return Math.round(time / this._frameDuration) * this._frameDuration;
    }

    private _startDrag(e: MouseEvent, edge: 'start' | 'end') {
        e.stopPropagation();
        this.draggingEdge = edge;

        const onMouseMove = (moveEvent: MouseEvent) => {
            if (!this.draggingEdge || !this.segment) return;
            const rect = this.shadowRoot!.querySelector('.timeline-track')!.getBoundingClientRect();
            const x = moveEvent.clientX - rect.left;
            const percent = Math.max(0, Math.min(1, x / rect.width));
            const rawTime = percent * this.duration;
            const newTime = this._snapToFrame(rawTime);

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
        if (!this.segment) return;
        // Prevent trigger if clicking handles
        if ((e.target as HTMLElement).closest('.handle')) return;

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percent = Math.max(0, Math.min(1, x / rect.width));
        const rawTime = percent * this.duration;
        let seekTime = this._snapToFrame(rawTime);

        // Clamp seekTime between IN and OUT
        seekTime = Math.max(this.segment.startTime, Math.min(this.segment.endTime, seekTime));

        this._emitSeek(seekTime);

        // Also start playhead drag on click
        this._startPlayheadDrag(e);
    }

    private _startPlayheadDrag(e: MouseEvent) {
        if (!this.segment) return;
        e.stopPropagation();

        const rect = (this.shadowRoot!.querySelector('.timeline-track') as HTMLElement).getBoundingClientRect();

        const onMouseMove = (moveEvent: MouseEvent) => {
            const x = moveEvent.clientX - rect.left;
            const percent = Math.max(0, Math.min(1, x / rect.width));
            const rawTime = percent * this.duration;
            let seekTime = this._snapToFrame(rawTime);

            // Clamp seekTime between IN and OUT
            if (this.segment) {
                seekTime = Math.max(this.segment.startTime, Math.min(this.segment.endTime, seekTime));
            }

            this._emitSeek(seekTime);
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }

    private _emitSeek(time: number) {
        this.dispatchEvent(new CustomEvent('timeline-seek', {
            detail: { time },
            bubbles: true,
            composed: true
        }));
    }

    private _togglePlay() {
        this.dispatchEvent(new CustomEvent('toggle-play', {
            bubbles: true,
            composed: true
        }));
    }

    connectedCallback() {
        super.connectedCallback();
        window.addEventListener('keydown', this._handleKeydown, { capture: true });
    }

    disconnectedCallback() {
        window.removeEventListener('keydown', this._handleKeydown, { capture: true });
        super.disconnectedCallback();
    }

    protected firstUpdated() {
        const scrollContainer = this.shadowRoot?.querySelector('.timeline-scroll-container');
        if (scrollContainer) {
            // Must use non-passive listener to be able to call preventDefault()
            scrollContainer.addEventListener('wheel', (e) => this._onWheel(e as WheelEvent), { passive: false });
        }
    }

    private _handleKeydown = (e: KeyboardEvent) => {
        // Only trigger if focus is potentially on or near the timeline or no other input is focused
        const activeElement = e.composedPath()[0] as HTMLElement;
        const isInput =
            activeElement instanceof HTMLInputElement ||
            activeElement instanceof HTMLTextAreaElement ||
            activeElement.isContentEditable;

        if (isInput) return;

        const isZoomIn = (e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=');
        const isZoomOut = (e.ctrlKey || e.metaKey) && (e.key === '-');

        if (isZoomIn) {
            e.preventDefault();
            e.stopImmediatePropagation();
            this._applyZoom(1.2);
        } else if (isZoomOut) {
            e.preventDefault();
            e.stopImmediatePropagation();
            this._applyZoom(0.8);
        }
    };

    private _onWheel(e: WheelEvent) {
        console.log('onWheel', e.ctrlKey, e.metaKey)
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this._applyZoom(delta, e.clientX);
            console.log('onWheel', delta, e.clientX)
        }
    }

    private _applyZoom(factor: number, clientX?: number) {
        const container = this.shadowRoot?.querySelector('.timeline-scroll-container') as HTMLElement;
        const track = this.shadowRoot?.querySelector('.timeline-track') as HTMLElement;
        if (!container || !track) return;

        const oldZoom = this._zoom;
        const maxZoom = Math.max(1, this.duration / 30); // Max zoom allows 30s to fill the viewport
        const newZoom = Math.max(1, Math.min(maxZoom, this._zoom * factor));

        if (newZoom === oldZoom) return;

        // Calculate visual center of zoom
        let pivotPercent = 0.5;
        if (clientX !== undefined) {
            const rect = container.getBoundingClientRect();
            const xInContainer = clientX - rect.left;
            pivotPercent = (xInContainer + container.scrollLeft) / (track.offsetWidth || 1);
        }

        this._zoom = newZoom;

        // Adjust scroll to keep pivot point pinned
        this.updateComplete.then(() => {
            const newTrackWidth = track.offsetWidth;
            const newScrollLeft = pivotPercent * newTrackWidth - (clientX !== undefined ? (clientX - container.getBoundingClientRect().left) : (container.offsetWidth / 2));
            container.scrollLeft = newScrollLeft;
        });
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'yts-precision-multi-timeline': YtsPrecisionMultiTimeline;
    }
}
