
/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { signal } from '@lit-labs/signals';
import type { ProjectResponse } from '@youtube-shorter/shared';

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
 * Clears the current project from the global state.
 */
export const clearProject = (): void => {
    projectSignal.set(null);
};
