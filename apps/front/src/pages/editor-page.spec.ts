// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock project state and service before importing the component
vi.mock('../state/project.state.js', () => ({
    projectSignal: { get: vi.fn().mockReturnValue({ id: 'proj-1', name: 'Test Project' }) },
    setProject: vi.fn(),
}));

vi.mock('../services/project.service.js', () => ({
    projectService: {
        getProject: vi.fn().mockResolvedValue({ id: 'proj-1', name: 'Test Project' }),
        getShorts: vi.fn().mockResolvedValue([
            { id: 'short-1', title: 'Scene 1', startTime: 5, endTime: 30, score: 0.9, reasoning: 'High energy', thumbnailUrl: null },
        ]),
    },
}));

vi.mock('../components/short-player.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/button/button.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/icon-button/icon-button.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/tab-group/tab-group.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/tab/tab.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/range/range.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/icon/icon.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/spinner/spinner.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/badge/badge.js', () => ({}));

import { EditorPage } from './editor-page.js';

describe('EditorPage', () => {
    beforeEach(() => vi.clearAllMocks());

    it('should be defined as a custom element', () => {
        expect(customElements.get('editor-page')).toBeDefined();
    });

    it('should load shorts on init (onBeforeEnter)', async () => {
        const { projectService } = await import('../services/project.service.js');
        const el = new EditorPage();

        await (el as any).onBeforeEnter({ params: { projectId: 'proj-1' } });

        expect(projectService.getShorts).toHaveBeenCalledWith('proj-1');
        expect((el as any).shorts).toHaveLength(1);
        expect((el as any).loading).toBe(false);
    });

    it('should set currentShort when playShort is called', async () => {
        const el = new EditorPage();
        const mockShort = { id: 'short-1', title: 'Scene 1', startTime: 5, endTime: 30 };

        (el as any).playShort(mockShort);

        expect((el as any).currentShort).toEqual(mockShort);
        expect((el as any).stemAvailable).toBe(false);
        expect((el as any).stemSeparating).toBe(false);
    });

    it('formatTime should correctly format seconds to MM:SS', () => {
        const el = new EditorPage();
        expect((el as any).formatTime(0)).toBe('00:00');
        expect((el as any).formatTime(90)).toBe('01:30');
        expect((el as any).formatTime(3661)).toBe('61:01');
    });

    it('should not trigger stem separation without projectId and shortId', async () => {
        const el = new EditorPage();
        (el as any).currentShort = null;

        // Should return early without throwing
        await expect((el as any).triggerStemSeparation()).resolves.toBeUndefined();
    });

    it('should have 4 separate render methods (render decomposition)', () => {
        const el = new EditorPage();
        expect(typeof (el as any).renderSegmentsSidebar).toBe('function');
        expect(typeof (el as any).renderReelCenter).toBe('function');
        expect(typeof (el as any).renderToolsPanel).toBe('function');
        expect(typeof (el as any).renderAudioPanel).toBe('function');
    });
});
