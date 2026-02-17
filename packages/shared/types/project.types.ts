// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

/**
 * Project type interface
 * 
 * Shared type definition for project data across frontend and backend
 */
export interface Project {
    id: string;
    name: string;
    videoPath: string;
    createdAt: string;
    duration?: number;
    resolution?: string;
    codec?: string;
}
