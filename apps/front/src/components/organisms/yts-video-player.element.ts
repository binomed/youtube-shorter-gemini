/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { LitElement, html, css } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';

/**
 * Vertical video player component (9:16 aspect ratio).
 *
 * Features:
 * - HTML5 video playback in vertical format
 * - Custom controls: play/pause, seek, volume, time display
 * - Keyboard shortcuts: Space (play/pause), J/K/L (nav), arrows (frame-by-frame)
 * - Loading and error states
 * - WCAG 2.1 AA accessible (focus, ARIA)
 *
 * @element yts-video-player
 */
@customElement('yts-video-player')
export class YtsVideoPlayer extends LitElement {
    /** Project ID to load video from */
    @property({ type: String })
    projectId = '';

    @state() private isPlaying = false;
    @state() private currentTime = 0;
    @state() private duration = 0;
    @state() private volume = 1;
    @state() private isLoading = true;
    @state() private hasError = false;
    @state() private errorMessage = '';

    @query('video') private videoElement!: HTMLVideoElement;


    static styles = css`
        :host {
            display: block;
            width: 100%;
            max-width: 360px;
        }

        /* ===== Video Container ===== */
        .player-container {
            position: relative;
            width: 100%;
            aspect-ratio: 9 / 16; /* Vertical format ratio */
            background: var(--yts-bg-secondary);
            border-radius: var(--yts-radius-lg);
            overflow: hidden;
            border: 1px solid var(--yts-border);
            box-shadow: var(--yts-shadow-lg);
        }

        .player-container:focus-visible {
            outline: 2px solid var(--yts-accent);
            outline-offset: 2px;
        }

        video {
            width: 100%;
            height: 100%;
            object-fit: contain; /* Ensure video fits without distortion */
            background: #000;
        }

        /* ===== Loading & Error Overlays ===== */
        .loading-overlay,
        .error-overlay {
            position: absolute;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.7); /* Semi-transparent dimming */
            color: var(--yts-text-primary);
            gap: var(--yts-spacing-sm);
            z-index: 10;
        }

        .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid var(--yts-border);
            border-top-color: var(--yts-accent);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .error-overlay {
            color: var(--yts-error);
        }

        .error-icon {
            font-size: 2rem;
        }

        .error-text {
            font-size: var(--yts-font-size-sm);
            text-align: center;
            padding: 0 var(--yts-spacing-md);
            color: var(--yts-text-secondary);
        }

        /* ===== Controls ===== */
        /* ===== Custom Controls Layer ===== */
        .controls {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: linear-gradient(transparent, rgba(0, 0, 0, 0.85)); /* Fade background for readability */
            padding: var(--yts-spacing-xl) var(--yts-spacing-md) var(--yts-spacing-md);
            display: flex;
            flex-direction: column;
            gap: var(--yts-spacing-sm);
            opacity: 0; /* Auto-hide controls */
            transition: opacity var(--yts-transition-normal);
        }

        /* Show controls on hover or when interacting via keyboard */
        .player-container:hover .controls,
        .player-container:focus-within .controls {
            opacity: 1;
        }

        /* ===== Sliders (Seek & Volume) ===== */
        .seek-bar {
            width: 100%;
            height: 4px;
            -webkit-appearance: none;
            appearance: none;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 2px;
            cursor: pointer;
            outline: none;
        }

        .seek-bar::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 12px;
            height: 12px;
            background: var(--yts-accent);
            border-radius: 50%;
            cursor: pointer;
        }

        /* ===== Control Row ===== */
        .control-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .control-left {
            display: flex;
            align-items: center;
            gap: var(--yts-spacing-sm);
        }

        .control-btn {
            background: none;
            border: none;
            color: white;
            font-size: 1.2rem;
            cursor: pointer;
            padding: var(--yts-spacing-xs);
            border-radius: var(--yts-radius-sm);
            transition: background var(--yts-transition-fast);
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 32px;
            min-height: 32px;
        }

        .control-btn:hover {
            background: rgba(255, 255, 255, 0.15);
        }

        .control-btn:focus-visible {
            outline: 2px solid var(--yts-accent);
            outline-offset: 2px;
        }

        .time-display {
            font-size: var(--yts-font-size-xs);
            color: rgba(255, 255, 255, 0.8);
            font-variant-numeric: tabular-nums;
        }

        /* ===== Volume ===== */
        .volume-slider {
            width: 60px;
            height: 3px;
            -webkit-appearance: none;
            appearance: none;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 2px;
            cursor: pointer;
            outline: none;
        }

        .volume-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 10px;
            height: 10px;
            background: white;
            border-radius: 50%;
            cursor: pointer;
        }

        /* ===== Keyboard Hint ===== */
        .keyboard-hint {
            text-align: center;
            font-size: var(--yts-font-size-xs);
            color: var(--yts-text-muted);
            margin-top: var(--yts-spacing-sm);
        }

        kbd {
            background: var(--yts-bg-card);
            border: 1px solid var(--yts-border);
            border-radius: 3px;
            padding: 1px 4px;
            font-size: 0.7rem;
            font-family: inherit;
        }

        /* Material Icons sizing */
        .material-symbols-outlined {
            font-size: 1.5rem;
            vertical-align: middle;
        }
    `;

    connectedCallback() {
        super.connectedCallback();
    }

    /**
     * Renders the video player UI.
     * Includes video element, overlay spinners/errors, and custom controls.
     */
    render() {
        const videoSrc = this.projectId
            ? `/api/projects/${this.projectId}/video`
            : '';

        return html`
            <div
                class="player-container"
                tabindex="0"
                role="application"
                aria-label="Video player"
                @keydown=${this._onKeydown}
            >
                <video
                    src=${videoSrc}
                    @loadedmetadata=${this._onLoadedMetadata}
                    @timeupdate=${this._onTimeUpdate}
                    @play=${() => (this.isPlaying = true)}
                    @pause=${() => (this.isPlaying = false)}
                    @waiting=${() => (this.isLoading = true)}
                    @canplay=${() => (this.isLoading = false)}
                    @error=${this._onVideoError}
                    preload="metadata"
                    playsinline
                ></video>

                ${this.renderLoadingOverlay()}
                ${this.renderErrorOverlay()}
                ${this.renderControls()}
            </div>
            ${this.renderKeyboardHints()}
        `;
    }

    /** Renders a spinner overlay while the video is buffering. */
    private renderLoadingOverlay() {
        if (!this.isLoading || this.hasError) return '';
        return html`
            <div class="loading-overlay" aria-live="polite">
                <div class="spinner"></div>
                <span>Loading video...</span>
            </div>
        `;
    }

    /** Renders an error overlay when the video fails to load. */
    private renderErrorOverlay() {
        if (!this.hasError) return '';
        return html`
            <div class="error-overlay" role="alert">
                <span class="error-icon material-symbols-outlined" style="font-size: 48px;">error</span>
                <span class="error-text">${this.errorMessage}</span>
            </div>
        `;
    }

    /** Renders the full controls bar (seek bar + control row). Only shown when no error. */
    private renderControls() {
        if (this.hasError) return '';
        return html`
            <div class="controls">
                ${this.renderSeekBar()}
                ${this.renderControlRow()}
            </div>
        `;
    }

    /** Renders the seek/scrubber bar. */
    private renderSeekBar() {
        return html`
            <input
                class="seek-bar"
                type="range"
                min="0"
                max=${this.duration}
                step="0.1"
                .value=${String(this.currentTime)}
                @input=${this._onSeek}
                aria-label="Seek"
            />
        `;
    }

    /** Renders the bottom row: play/pause button, time display, mute button and volume slider. */
    private renderControlRow() {
        return html`
            <div class="control-row">
                <div class="control-left">
                    <button
                        class="control-btn"
                        @click=${this._togglePlay}
                        aria-label=${this.isPlaying ? 'Pause' : 'Play'}
                    >
                        ${this.isPlaying
                ? html`<span class="material-symbols-outlined">pause</span>`
                : html`<span class="material-symbols-outlined">play_arrow</span>`}
                    </button>
                    <span class="time-display">
                        ${this._formatTime(this.currentTime)} /
                        ${this._formatTime(this.duration)}
                    </span>
                </div>
                <div class="control-left">
                    <button
                        class="control-btn"
                        @click=${this._toggleMute}
                        aria-label=${this.volume === 0 ? 'Unmute' : 'Mute'}
                    >
                        ${this.volume === 0
                ? html`<span class="material-symbols-outlined">volume_off</span>`
                : html`<span class="material-symbols-outlined">volume_up</span>`}
                    </button>
                    <input
                        class="volume-slider"
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        .value=${String(this.volume)}
                        @input=${this._onVolumeChange}
                        aria-label="Volume"
                    />
                </div>
            </div>
        `;
    }

    /** Renders the keyboard shortcut hints below the player. */
    private renderKeyboardHints() {
        return html`
            <div class="keyboard-hint">
                <kbd>Space</kbd> Play/Pause
                <kbd>J</kbd> -10s
                <kbd>K</kbd> Pause
                <kbd>L</kbd> +10s
                <kbd>←</kbd><kbd>→</kbd> ±5s
            </div>
        `;
    }


    // ─── Video Event Handlers ──────────────────

    /**
     * Called when video metadata is loaded.
     * Updates duration state and hides loading spinner.
     */

    private _onLoadedMetadata() {
        this.duration = this.videoElement.duration;
        this.isLoading = false;
    }

    private _onTimeUpdate() {
        this.currentTime = this.videoElement.currentTime;
    }

    private _onVideoError() {
        this.isLoading = false;
        this.hasError = true;
        this.errorMessage =
            'Unable to load video. The file may be corrupted or in an unsupported format.';
    }

    // ─── Control Handlers ──────────────────

    /**
     * Toggles play/pause state of the video.
     */
    private _togglePlay() {
        if (!this.videoElement) return;
        if (this.videoElement.paused) {
            this.videoElement.play();
        } else {
            this.videoElement.pause();
        }
    }

    private _onSeek(e: Event) {
        const input = e.target as HTMLInputElement;
        this.videoElement.currentTime = parseFloat(input.value);
    }

    private _onVolumeChange(e: Event) {
        const input = e.target as HTMLInputElement;
        this.volume = parseFloat(input.value);
        this.videoElement.volume = this.volume;
    }

    private _toggleMute() {
        if (this.volume > 0) {
            this.videoElement.volume = 0;
            this.volume = 0;
        } else {
            this.videoElement.volume = 1;
            this.volume = 1;
        }
    }

    /**
     * Keyboard shortcuts handler.
     * Supports standard NLE shortcuts (J/K/L) and arrow keys for seeking/volume.
     */
    private _onKeydown(e: KeyboardEvent) {
        if (!this.videoElement) return;

        switch (e.key) {
            // Toggle Play/Pause
            case ' ':
                e.preventDefault();
                this._togglePlay();
                break;
            // K: Pause (standard NLE shortcut)
            case 'k':
            case 'K':
                e.preventDefault();
                this.videoElement.pause();
                break;
            // J: Rewind 10s (standard NLE shortcut)
            case 'j':
            case 'J':
                e.preventDefault();
                this.videoElement.currentTime = Math.max(
                    0,
                    this.videoElement.currentTime - 10,
                );
                break;
            // L: Forward 10s (standard NLE shortcut)
            case 'l':
            case 'L':
                e.preventDefault();
                this.videoElement.currentTime = Math.min(
                    this.duration,
                    this.videoElement.currentTime + 10,
                );
                break;
            // Arrow Left: Rewind 5s (precise seeking)
            case 'ArrowLeft':
                e.preventDefault();
                this.videoElement.currentTime = Math.max(
                    0,
                    this.videoElement.currentTime - 5,
                );
                break;
            // Arrow Right: Forward 5s (precise seeking)
            case 'ArrowRight':
                e.preventDefault();
                this.videoElement.currentTime = Math.min(
                    this.duration,
                    this.videoElement.currentTime + 5,
                );
                break;
            // Arrow Up: Volume Up 10%
            case 'ArrowUp':
                e.preventDefault();
                this.volume = Math.min(1, this.volume + 0.1);
                this.videoElement.volume = this.volume;
                break;
            // Arrow Down: Volume Down 10%
            case 'ArrowDown':
                e.preventDefault();
                this.volume = Math.max(0, this.volume - 0.1);
                this.videoElement.volume = this.volume;
                break;
        }
    }

    // ─── Helpers ──────────────────

    private _formatTime(seconds: number): string {
        if (!isFinite(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'yts-video-player': YtsVideoPlayer;
    }
}
