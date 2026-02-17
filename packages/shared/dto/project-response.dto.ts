// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

/**
 * Response DTO for project operations
 * 
 * Returned by API endpoints after project creation/retrieval
 */
export class ProjectResponseDto {
    /**
     * Unique project identifier (UUID)
     */
    id: string;

    /**
     * Project name
     */
    name: string;

    /**
     * Path to video file in temporary storage
     */
    videoPath: string;

    /**
     * ISO 8601 timestamp of project creation
     */
    createdAt: string;

    /**
     * Video duration in seconds (extracted by FFmpeg)
     */
    duration?: number;

    /**
     * Video resolution (width x height)
     * @example "1920x1080"
     */
    resolution?: string;

    /**
     * Video codec name
     * @example "h264"
     */
    codec?: string;
}
