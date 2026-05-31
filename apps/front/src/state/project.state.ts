
import { signal } from '@lit-labs/signals';
import type { ProjectResponse, ShortResponse } from '@youtube-shorter/shared';

/**
 * Global reactive state for the current project.
 * Uses Lit Signals for fine-grained reactivity.
 */
export const projectSignal = signal<ProjectResponse | null>(null);

/**
 * Updates the current project in the global state.
 * @param project The project data to set
 */
export const setProject = (project: ProjectResponse | null): void => {
    projectSignal.set(project);
};

/**
 * Updates a single short within the current project.
 * Useful for keeping the sidebar in sync with editor changes.
 * @param updatedShort The updated short data
 */
export const updateShortInProject = (updatedShort: ShortResponse): void => {
    const current = projectSignal.get();
    if (current && current.shorts) {
        const updatedShorts = current.shorts.map(s => s.id === updatedShort.id ? updatedShort : s);
        projectSignal.set({ ...current, shorts: updatedShorts });
    }
};

/**
 * Sets the list of shorts for the current project.
 * @param shorts Array of shorts
 */
export const setShorts = (shorts: ShortResponse[]): void => {
    const current = projectSignal.get();
    if (current) {
        projectSignal.set({ ...current, shorts });
    }
};

/**
 * Adds a new short to the current project's shorts list.
 * @param newShort The new short data
 */
export const addShortToProject = (newShort: ShortResponse): void => {
    const current = projectSignal.get();
    if (current) {
        const updatedShorts = [...(current.shorts || []), newShort];
        projectSignal.set({ ...current, shorts: updatedShorts });
    }
};

/**
 * Clears the current project from the global state.
 */
export const clearProject = (): void => {
    projectSignal.set(null);
};
