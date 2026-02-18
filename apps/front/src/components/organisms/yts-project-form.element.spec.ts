import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import './yts-project-form.element.js';
import type { YtsProjectForm } from './yts-project-form.element.js';

// Auto-mock axios
vi.mock('axios');

import { projectService } from '../../services/project.service';



describe('yts-project-form', () => {
    let element: YtsProjectForm;

    beforeEach(async () => {
        // Reset mocks
        vi.resetAllMocks();

        // Mock config request
        vi.spyOn(projectService, 'getConfig').mockResolvedValue({
            maxVideoSizeMb: 500,
            allowedExtensions: ['.mp4', '.mov'],
            allowedMimeTypes: ['video/mp4', 'video/quicktime'],
        });

        element = document.createElement('yts-project-form') as YtsProjectForm;
        document.body.appendChild(element);
        await element.updateComplete;
    });

    afterEach(() => {
        element.remove();
        vi.clearAllMocks();
    });

    it('should render the form container', () => {
        const container = element.shadowRoot?.querySelector('.form-container');
        expect(container).toBeTruthy();
    });

    it('should render the heading', () => {
        const heading = element.shadowRoot?.querySelector('h1');
        expect(heading?.textContent).toContain('New Project');
    });

    it('should render privacy checkboxes', () => {
        const checkboxes = element.shadowRoot?.querySelectorAll('sl-checkbox');
        expect(checkboxes?.length).toBe(2);
        expect(checkboxes?.[0].textContent).toContain('acknowledge that my video is processed locally');
    });

    it('should render dropzone', () => {
        const dropzone = element.shadowRoot?.querySelector('.dropzone');
        expect(dropzone).toBeTruthy();
        expect(dropzone?.getAttribute('role')).toBe('button');
        expect(dropzone?.getAttribute('tabindex')).toBe('0');
    });

    it('should have a disabled submit button by default', () => {
        const button = element.shadowRoot?.querySelector('sl-button');
        expect(button?.hasAttribute('disabled')).toBe(true);
    });

    it('should render the hidden file input with accept attribute', () => {
        const fileInput = element.shadowRoot?.querySelector('#file-input') as HTMLInputElement;
        expect(fileInput).toBeTruthy();
        expect(fileInput?.getAttribute('accept')).toContain('.mp4');
        expect(fileInput?.getAttribute('accept')).toContain('.mov');
    });
});
