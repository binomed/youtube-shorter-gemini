import { describe, it, expect, beforeEach } from 'vitest';
import { projectSignal, setProject, updateShortInProject, setShorts, clearProject, addShortToProject } from './project.state';
import type { ProjectResponse, ShortResponse } from '@youtube-shorter/shared';

describe('Project State', () => {
    const mockProject: ProjectResponse = {
        id: 'project-1',
        name: 'Test Project',
        videoPath: '/path/to/video.mp4',
        createdAt: new Date().toISOString(),
        shorts: [
            { id: 'short-1', title: 'Short 1', startTime: 0, endTime: 10, segments: [], projectId: 'project-1' } as unknown as ShortResponse,
            { id: 'short-2', title: 'Short 2', startTime: 20, endTime: 30, segments: [], projectId: 'project-1' } as unknown as ShortResponse
        ]
    };

    beforeEach(() => {
        clearProject();
    });

    it('should set and get project', () => {
        setProject(mockProject);
        expect(projectSignal.get()).toEqual(mockProject);
    });

    it('should update a specific short in the project', () => {
        setProject(mockProject);
        
        const updatedShort: ShortResponse = {
            ...mockProject.shorts![0],
            title: 'Updated Short 1'
        };

        updateShortInProject(updatedShort);

        const currentProject = projectSignal.get();
        expect(currentProject?.shorts?.[0].title).toBe('Updated Short 1');
        expect(currentProject?.shorts?.[1].title).toBe('Short 2');
    });

    it('should set shorts list for current project', () => {
        setProject({ ...mockProject, shorts: [] });
        
        const newShorts: ShortResponse[] = [
            { id: 'short-3', title: 'Short 3', startTime: 40, endTime: 50, segments: [], projectId: 'project-1' } as unknown as ShortResponse
        ];

        setShorts(newShorts);

        expect(projectSignal.get()?.shorts).toEqual(newShorts);
    });

    it('should do nothing if project is null when updating short', () => {
        updateShortInProject({ id: 'any' } as unknown as ShortResponse);
        expect(projectSignal.get()).toBeNull();
    });

    it('should clear project', () => {
        setProject(mockProject);
        clearProject();
        expect(projectSignal.get()).toBeNull();
    });

    it('should add a new short to the project shorts list', () => {
        setProject(mockProject);
        
        const newShort: ShortResponse = {
            id: 'short-new',
            title: 'New Manual Short',
            startTime: 10,
            endTime: 20,
            segments: [],
            projectId: 'project-1'
        } as unknown as ShortResponse;

        addShortToProject(newShort);

        const currentProject = projectSignal.get();
        expect(currentProject?.shorts).toHaveLength(3);
        expect(currentProject?.shorts?.[2].id).toBe('short-new');
        expect(currentProject?.shorts?.[2].title).toBe('New Manual Short');
    });
});
