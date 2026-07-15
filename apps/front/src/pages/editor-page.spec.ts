// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { fixture, html } from '@open-wc/testing-helpers';
import type { ShortResponse, SubtitleResponse } from '@youtube-shorter/shared';

// Mock project state and service before importing the component
vi.mock('../state/project.state.js', () => ({
    projectSignal: { 
        get: vi.fn().mockReturnValue({ id: 'proj-1', name: 'Test Project', shorts: [] }),
        set: vi.fn()
    },
    setProject: vi.fn(),
    setShorts: vi.fn(),
    updateShortInProject: vi.fn(),
}));

vi.mock('../services/project.service.js', () => ({
    projectService: {
        getProject: vi.fn().mockResolvedValue({ id: 'proj-1', name: 'Test Project' }),
        getShorts: vi.fn().mockResolvedValue([
            { id: 'short-1', title: 'Scene 1', startTime: 5, endTime: 30, score: 0.9, reasoning: 'High energy', thumbnailUrl: null },
        ]),
    },
}));

vi.mock('../components/organisms/yts-short-player.element.js', () => ({}));
vi.mock('../components/molecules/yts-thumbnail-editor.element.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/button/button.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/icon-button/icon-button.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/tab-group/tab-group.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/tab/tab.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/range/range.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/icon/icon.js', () => {
  class SafeSlIcon extends HTMLElement {}
  if (!customElements.get('sl-icon')) {
    customElements.define('sl-icon', SafeSlIcon);
  }
  return { default: SafeSlIcon };
});
vi.mock('@shoelace-style/shoelace/dist/components/spinner/spinner.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/badge/badge.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/dialog/dialog.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/checkbox/checkbox.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/dropdown/dropdown.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/menu/menu.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/menu-item/menu-item.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/alert/alert.js', () => {
  class MockSlAlert extends HTMLElement {
    toast = vi.fn();
  }
  if (!customElements.get('sl-alert')) {
    customElements.define('sl-alert', MockSlAlert);
  }
  return { default: MockSlAlert };
});
vi.mock('@shoelace-style/shoelace/dist/components/input/input.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/select/select.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/option/option.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/textarea/textarea.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/tooltip/tooltip.js', () => ({}));
vi.mock('@shoelace-style/shoelace/dist/components/divider/divider.js', () => ({}));

vi.mock('../components/molecules/yts-subtitle-editor.element.js', () => ({}));
vi.mock('../components/molecules/yts-subtitle-style-panel.element.js', () => ({}));
vi.mock('../components/molecules/yts-precision-multi-timeline.element.js', () => ({}));
vi.mock('../components/molecules/yts-header.element.js', () => ({}));
vi.mock('../components/molecules/yts-dialog.element.ts', () => ({}));

import { EditorPage } from './editor-page.js';

const overrideShoelaceProto = (tag: string): void => {
  const el = customElements.get(tag);
  if (el) {
    let proto = el.prototype;
    while (proto && proto !== HTMLElement.prototype) {
      if (Object.prototype.hasOwnProperty.call(proto, 'attributeChangedCallback')) {
        proto.attributeChangedCallback = function(): void {};
      }
      proto = Object.getPrototypeOf(proto);
    }
  }
};

// Helper type to access private members in tests
type EditorPageInternal = {
    loading: boolean;
    onBeforeEnter(location: { params: { projectId: string } }): Promise<void>;
    playShort(short: { id: string; title: string; startTime: number; endTime: number }): void;
    formatTime(seconds: number): string;
    triggerStemSeparation(): Promise<void>;
    renderSegmentsSidebar(): unknown;
    renderReelCenter(): unknown;
    renderToolsPanel(): unknown;
    renderAudioPanel(): unknown;
    currentShort: ShortResponse | null;
    stemAvailable: boolean;
    stemSeparating: boolean;
    formatSRTTime(seconds: number): string;
    copyTranscript(): Promise<void>;
    downloadTranscript(format: 'srt' | 'txt'): void;
    showToast(variant: 'success' | 'danger', message: string): void;
};

describe('EditorPage', () => {
    beforeEach(() => vi.clearAllMocks());

    it('should be defined as a custom element', () => {
        expect(customElements.get('editor-page')).toBeDefined();
    });

    it('should load shorts on init (onBeforeEnter)', async () => {
        const { projectService } = await import('../services/project.service.js');
        const { setShorts } = await import('../state/project.state.js');
        const el = new EditorPage();

        await (el as unknown as EditorPageInternal).onBeforeEnter({ params: { projectId: 'proj-1' } });

        expect(projectService.getShorts).toHaveBeenCalledWith('proj-1');
        expect(setShorts).toHaveBeenCalled();
        expect((el as unknown as EditorPageInternal).loading).toBe(false);
    });

    it('should set currentShort when playShort is called', async () => {
        const el = new EditorPage();
        const mockShort = { id: 'short-1', title: 'Scene 1', startTime: 5, endTime: 30 };

        (el as unknown as EditorPageInternal).playShort(mockShort);

        expect((el as unknown as EditorPageInternal).currentShort).toEqual(mockShort);
        expect((el as unknown as EditorPageInternal).stemAvailable).toBe(false);
        expect((el as unknown as EditorPageInternal).stemSeparating).toBe(false);
    });

    it('formatTime should correctly format seconds to MM:SS', () => {
        const el = new EditorPage();
        expect((el as unknown as EditorPageInternal).formatTime(0)).toBe('00:00');
        expect((el as unknown as EditorPageInternal).formatTime(90)).toBe('01:30');
        expect((el as unknown as EditorPageInternal).formatTime(3661)).toBe('61:01');
    });

    it('should not trigger stem separation without projectId and shortId', async () => {
        const el = new EditorPage();
        (el as unknown as EditorPageInternal).currentShort = null;

        // Should return early without throwing
        await expect((el as unknown as EditorPageInternal).triggerStemSeparation()).resolves.toBeUndefined();
    });

    it('should have 4 separate render methods (render decomposition)', () => {
        const el = new EditorPage();
        expect(typeof (el as unknown as EditorPageInternal).renderSegmentsSidebar).toBe('function');
        expect(typeof (el as unknown as EditorPageInternal).renderReelCenter).toBe('function');
        expect(typeof (el as unknown as EditorPageInternal).renderToolsPanel).toBe('function');
        expect(typeof (el as unknown as EditorPageInternal).renderAudioPanel).toBe('function');
    });

    describe('Transcript Export & Copy', () => {
        let el: EditorPage;
        let mockSubtitles: SubtitleResponse[];
        let createdLink: HTMLAnchorElement | null = null;

        beforeEach(() => {
            el = new EditorPage();
            mockSubtitles = [
                { id: 'sub-2', shortId: 'short-1', startTime: 5.5, endTime: 8.2, text: ' second segment. ' },
                { id: 'sub-1', shortId: 'short-1', startTime: 1.2, endTime: 4.0, text: 'First segment' },
            ];
            
            // Mock clipboard
            Object.defineProperty(navigator, 'clipboard', {
                value: {
                    writeText: vi.fn().mockResolvedValue(undefined)
                },
                configurable: true,
                writable: true
            });

            // Mock URL methods
            window.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
            window.URL.revokeObjectURL = vi.fn();

            // Mock document body append/remove to avoid Happy DOM node manipulation side effects
            vi.spyOn(document.body, 'append').mockImplementation(() => {});
            vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
            vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

            // Spy on document.createElement
            createdLink = null;
            const originalCreateElement = document.createElement.bind(document);
            vi.spyOn(document, 'createElement').mockImplementation((tag) => {
                const element = originalCreateElement(tag);
                if (tag === 'a') {
                    createdLink = element as HTMLAnchorElement;
                    vi.spyOn(createdLink, 'click').mockImplementation(() => {});
                }
                return element;
            });
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('formatSRTTime should format timings correctly including milliseconds', () => {
            const editor = el as unknown as EditorPageInternal;
            expect(editor.formatSRTTime(0)).toBe('00:00:00,000');
            expect(editor.formatSRTTime(90.005)).toBe('00:01:30,005');
            expect(editor.formatSRTTime(3661.123)).toBe('01:01:01,123');
            expect(editor.formatSRTTime(5.25)).toBe('00:00:05,250');
        });

        it('copyTranscript should copy trimmed and space-concatenated subtitles and toast success', async () => {
            const editor = el as unknown as EditorPageInternal;
            editor.currentShort = {
                id: 'short-1',
                projectId: 'proj-1',
                title: 'Test Short',
                startTime: 0,
                endTime: 10,
                confidence: 100,
                orderIndex: 0,
                stemsAvailable: false,
                createdAt: new Date().toISOString(),
                thumbnailUrl: undefined,
                subtitles: mockSubtitles
            };

            const toastSpy = vi.spyOn(editor, 'showToast');

            await editor.copyTranscript();

            expect(navigator.clipboard.writeText).toHaveBeenCalledWith('First segment second segment.');
            expect(toastSpy).toHaveBeenCalledWith('success', 'Transcript copied to clipboard!');
        });

        it('copyTranscript should show danger toast if no subtitles are available', async () => {
            const editor = el as unknown as EditorPageInternal;
            editor.currentShort = {
                id: 'short-1',
                projectId: 'proj-1',
                title: 'Test Short',
                startTime: 0,
                endTime: 10,
                confidence: 100,
                orderIndex: 0,
                stemsAvailable: false,
                createdAt: new Date().toISOString(),
                thumbnailUrl: undefined,
                subtitles: []
            };

            const toastSpy = vi.spyOn(editor, 'showToast');

            await editor.copyTranscript();

            expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
            expect(toastSpy).toHaveBeenCalledWith('danger', 'No transcript available to copy');
        });

        it('downloadTranscript in txt format should export space-concatenated plain text and trigger click', () => {
            const editor = el as unknown as EditorPageInternal;
            editor.currentShort = {
                id: 'short-1',
                projectId: 'proj-1',
                title: 'Test Short',
                startTime: 0,
                endTime: 10,
                confidence: 100,
                orderIndex: 0,
                stemsAvailable: false,
                createdAt: new Date().toISOString(),
                thumbnailUrl: undefined,
                subtitles: mockSubtitles
            };

            const toastSpy = vi.spyOn(editor, 'showToast');

            editor.downloadTranscript('txt');

            expect(URL.createObjectURL).toHaveBeenCalled();
            expect(createdLink).not.toBeNull();
            expect(createdLink!.href).toBe('blob:mock-url');
            expect(createdLink!.getAttribute('download')).toBe('test_short-transcript.txt');
            expect(createdLink!.click).toHaveBeenCalled();
            expect(toastSpy).toHaveBeenCalledWith('success', 'Transcript exported as .txt successfully!');
        });

        it('downloadTranscript in srt format should export valid SRT and trigger click', () => {
            const editor = el as unknown as EditorPageInternal;
            editor.currentShort = {
                id: 'short-1',
                projectId: 'proj-1',
                title: 'Test Short',
                startTime: 0,
                endTime: 10,
                confidence: 100,
                orderIndex: 0,
                stemsAvailable: false,
                createdAt: new Date().toISOString(),
                thumbnailUrl: undefined,
                subtitles: mockSubtitles
            };

            const toastSpy = vi.spyOn(editor, 'showToast');

            // Spy on Blob constructor to check content
            const blobSpy = vi.spyOn(globalThis, 'Blob');

            editor.downloadTranscript('srt');

            expect(blobSpy).toHaveBeenCalled();
            const blobArgs = blobSpy.mock.calls[0][0] as string[];
            const blobText = blobArgs[0];
            
            // Should be sorted chronologically: sub-1 (1.2 -> 4.0), then sub-2 (5.5 -> 8.2)
            expect(blobText).toContain('1\n00:00:01,200 --> 00:00:04,000\nFirst segment\n');
            expect(blobText).toContain('2\n00:00:05,500 --> 00:00:08,200\nsecond segment.\n');

            expect(createdLink).not.toBeNull();
            expect(createdLink!.href).toBe('blob:mock-url');
            expect(createdLink!.getAttribute('download')).toBe('test_short-transcript.srt');
            expect(createdLink!.click).toHaveBeenCalled();
            expect(toastSpy).toHaveBeenCalledWith('success', 'Transcript exported as .srt successfully!');

            blobSpy.mockRestore();
        });
    });

    describe('Segment Cards and Cover Image Rendering (Tasks 6.6 & 6.7)', () => {
        beforeEach(() => {
            overrideShoelaceProto('sl-icon');
        });

        it('should render segment cards with aspect-ratio: 9/16 and support click-to-play (Task 6.6)', async () => {
            const { projectSignal } = await import('../state/project.state.js');
            const mockShort: ShortResponse = {
                id: 'short-101',
                projectId: 'proj-1',
                title: 'Aspect Ratio Test Scene',
                startTime: 10,
                endTime: 20,
                confidence: 90,
                orderIndex: 0,
                stemsAvailable: false,
                createdAt: new Date().toISOString(),
                thumbnailUrl: '/thumbs/s101.jpg',
            };
            (projectSignal.get as Mock).mockReturnValue({
                id: 'proj-1',
                name: 'Test Project',
                shorts: [mockShort],
            });

            const el = await fixture<EditorPage>(html`<editor-page></editor-page>`);
            (el as unknown as EditorPageInternal).loading = false;
            await el.updateComplete;

            const card = el.shadowRoot?.querySelector('.segment-card') as HTMLButtonElement;
            expect(card).toBeTruthy();

            const thumbDiv = card.querySelector('.segment-thumb') as HTMLElement;
            expect(thumbDiv).toBeTruthy();

            const styleText = (el.constructor as typeof EditorPage).styles.toString();
            expect(styleText).toContain('aspect-ratio: 9/16');

            const playSpy = vi.spyOn(el as unknown as EditorPageInternal, 'playShort');
            card.click();
            expect(playSpy).toHaveBeenCalledWith(mockShort);
        });

        it('should verify image source priority: coverImageUrl > thumbnailUrl > placeholder (Task 6.7)', async () => {
            const { projectSignal } = await import('../state/project.state.js');
            const shortWithCover: ShortResponse = {
                id: 'short-1',
                projectId: 'proj-1',
                title: 'With Cover',
                startTime: 0,
                endTime: 10,
                confidence: 90,
                orderIndex: 0,
                stemsAvailable: false,
                createdAt: new Date().toISOString(),
                coverImageUrl: '/covers/c1.jpg',
                thumbnailUrl: '/thumbs/t1.jpg',
            };
            const shortWithThumb: ShortResponse = {
                id: 'short-2',
                projectId: 'proj-1',
                title: 'With Thumb',
                startTime: 10,
                endTime: 20,
                confidence: 90,
                orderIndex: 1,
                stemsAvailable: false,
                createdAt: new Date().toISOString(),
                thumbnailUrl: '/thumbs/t2.jpg',
            };
            const shortNoImage: ShortResponse = {
                id: 'short-3',
                projectId: 'proj-1',
                title: 'No Image',
                startTime: 20,
                endTime: 30,
                confidence: 90,
                orderIndex: 2,
                stemsAvailable: false,
                createdAt: new Date().toISOString(),
            };

            (projectSignal.get as Mock).mockReturnValue({
                id: 'proj-1',
                name: 'Test Project',
                shorts: [shortWithCover, shortWithThumb, shortNoImage],
            });

            const el = await fixture<EditorPage>(html`<editor-page></editor-page>`);
            (el as unknown as EditorPageInternal).loading = false;
            await el.updateComplete;

            const cards = Array.from(el.shadowRoot?.querySelectorAll('.segment-card') || []);
            expect(cards).toHaveLength(3);

            // 1. coverImageUrl priority over thumbnailUrl
            const img1 = cards[0].querySelector('img');
            expect(img1?.getAttribute('src')).toBe('/covers/c1.jpg');

            // 2. thumbnailUrl fallback when no coverImageUrl
            const img2 = cards[1].querySelector('img');
            expect(img2?.getAttribute('src')).toBe('/thumbs/t2.jpg');

            // 3. empty placeholder when neither exists
            const img3 = cards[2].querySelector('img');
            expect(img3).toBeNull();
            const iconPlaceholder = cards[2].querySelector('sl-icon[name="image"]');
            expect(iconPlaceholder).toBeTruthy();
        });
    });
});
