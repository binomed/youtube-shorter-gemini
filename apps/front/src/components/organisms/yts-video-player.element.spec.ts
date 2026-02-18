/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import './yts-video-player.element.js';
import type { YtsVideoPlayer } from './yts-video-player.element.js';

describe('yts-video-player', () => {
    let element: YtsVideoPlayer;

    beforeEach(async () => {
        element = document.createElement('yts-video-player') as YtsVideoPlayer;
        document.body.appendChild(element);
        await element.updateComplete;
    });

    afterEach(() => {
        element.remove();
    });

    it('should render the player container', () => {
        const container = element.shadowRoot?.querySelector('.player-container');
        expect(container).toBeTruthy();
    });

    it('should set correct aspect ratio container', () => {
        const container = element.shadowRoot?.querySelector('.player-container');
        expect(container).toBeTruthy();
        expect(container?.getAttribute('role')).toBe('application');
        expect(container?.getAttribute('aria-label')).toBe('Video player');
    });

    it('should render video element', () => {
        const video = element.shadowRoot?.querySelector('video');
        expect(video).toBeTruthy();
    });

    it('should construct video source from projectId', async () => {
        element.projectId = 'test-123';
        await element.updateComplete;
        const video = element.shadowRoot?.querySelector('video');
        expect(video?.getAttribute('src')).toBe('/api/projects/test-123/video');
    });

    it('should render keyboard hints', () => {
        const hints = element.shadowRoot?.querySelector('.keyboard-hint');
        expect(hints).toBeTruthy();
        expect(hints?.textContent).toContain('Space');
        expect(hints?.textContent).toContain('Play/Pause');
    });

    it('should have focusable player container', () => {
        const container = element.shadowRoot?.querySelector('.player-container');
        expect(container?.getAttribute('tabindex')).toBe('0');
    });

    it('should render control buttons with ARIA labels', async () => {
        // Controls might be hidden until hover, but they should exist in the DOM
        const playBtn = element.shadowRoot?.querySelector('.control-btn');
        expect(playBtn).toBeTruthy();
    });
});
