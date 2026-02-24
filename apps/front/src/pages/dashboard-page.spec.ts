// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock projectService before importing the component
vi.mock('../services/project.service.js', () => ({
    projectService: {
        getProjects: vi.fn().mockResolvedValue([]),
        deleteProject: vi.fn().mockResolvedValue(undefined),
    },
}));

// Mock shoelace components to avoid custom elements registration issues in tests
vi.mock('@shoelace-style/shoelace/dist/components/button/button.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/icon/icon.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/icon-button/icon-button.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/tab-group/tab-group.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/tab/tab.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/dialog/dialog.js', () => ({}));

import { DashboardPage } from './dashboard-page.js';

describe('DashboardPage', () => {
    beforeEach(() => vi.clearAllMocks());

    it('should be defined as a custom element', () => {
        expect(customElements.get('dashboard-page')).toBeDefined();
    });

    it('should call loadProjects on connectedCallback', async () => {
        const { projectService } = await import('../services/project.service.js');

        const el = new DashboardPage();
        await (el as any).loadProjects();

        expect(projectService.getProjects).toHaveBeenCalled();
    });

    it('should dispatch create-project custom event when project is submitted', () => {
        const el = new DashboardPage();
        let capturedEvent: CustomEvent | null = null;
        el.addEventListener('create-project', (e: Event) => {
            capturedEvent = e as CustomEvent;
        });

        // Set state directly to simulate user input
        (el as any).projectName = 'My Test Video';
        const mockFile = new File(['content'], 'test.mp4', { type: 'video/mp4' });
        (el as any).selectedFile = mockFile;

        (el as any).handleCreateProject();

        expect(capturedEvent).not.toBeNull();
        expect((capturedEvent as unknown as CustomEvent).detail.name).toBe('My Test Video');
        expect((capturedEvent as unknown as CustomEvent).detail.file).toBe(mockFile);
    });

    it('should update selectedFile and projectName when file is dropped', () => {
        const el = new DashboardPage();
        const mockFile = new File(['content'], 'myvideo.mp4', { type: 'video/mp4' });
        const mockDragEvent = {
            preventDefault: vi.fn(),
            dataTransfer: { files: [mockFile] },
        } as unknown as DragEvent;

        (el as any).isDragActive = true;
        (el as any).handleDrop(mockDragEvent);

        expect((el as any).selectedFile).toBe(mockFile);
        expect((el as any).projectName).toBe('myvideo'); // extension stripped
        expect((el as any).isDragActive).toBe(false);
    });

    it('should NOT update projectName if already set when file is dropped', () => {
        const el = new DashboardPage();
        (el as any).projectName = 'Existing Name';
        const mockFile = new File(['content'], 'other.mp4', { type: 'video/mp4' });
        const mockDragEvent = {
            preventDefault: vi.fn(),
            dataTransfer: { files: [mockFile] },
        } as unknown as DragEvent;

        (el as any).handleDrop(mockDragEvent);

        expect((el as any).projectName).toBe('Existing Name'); // unchanged
    });

    it('should ignore non-video files when dropped', () => {
        const el = new DashboardPage();
        const textFile = new File(['content'], 'readme.txt', { type: 'text/plain' });
        const mockDragEvent = {
            preventDefault: vi.fn(),
            dataTransfer: { files: [textFile] },
        } as unknown as DragEvent;

        (el as any).handleDrop(mockDragEvent);

        expect((el as any).selectedFile).toBeNull();
    });
});
