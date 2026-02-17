// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { FFmpegService } from '../../workers/ffmpeg.service';

/**
 * VideoService handles business logic for video upload and project management
 * 
 * Responsibilities:
 * - Create project records with video file references
 * - Coordinate with FFmpegService for metadata extraction
 * 
 * Design Decision: For desktop local use case, we store the original file path
 * directly instead of copying to a temporary directory. This avoids:
 * - Disk space duplication (important for large 2GB+ video files)
 * - Unnecessary file copying time
 * - Cleanup complexity
 * 
 * Future: When implementing YouTube download (Epic 2+), downloads will be
 * stored in a temporary location with appropriate cleanup.
 * 
 * @service
 */
@Injectable()
export class VideoService {
    private readonly logger = new Logger(VideoService.name);

    constructor(private readonly ffmpegService: FFmpegService) { }

    /**
     * Create a new project with uploaded video
     * 
     * For desktop local files, we store the original file path directly.
     * No copying is performed to avoid disk duplication.
     * 
     * Steps:
     * 1. Generate unique project ID
     * 2. Store reference to original file path
     * 3. Extract video metadata (duration, resolution, codec)
     * 4. Create project record in database
     * 
     * @param name - Project name
     * @param file - Uploaded video file (contains original path)
     * @returns Created project with metadata
     */
    async createProject(
        name: string,
        file: Express.Multer.File,
    ): Promise<ProjectResponse> {
        const projectId = uuidv4();

        // Use original file path directly - no copy needed for desktop use case
        // Note: file.path contains the absolute path to the original file
        const videoPath = file.path || file.originalname;

        this.logger.log(`Creating project "${name}" with video: ${videoPath}`);

        // Extract video metadata
        let metadata;
        try {
            metadata = await this.ffmpegService.extractMetadata(videoPath);
        } catch (error) {
            this.logger.warn(
                `Failed to extract metadata for ${videoPath}: ${error.message}`,
            );
            // Continue without metadata rather than failing the entire request
            metadata = null;
        }

        // TODO: Store project in database (requires TypeORM repository injection)
        const project: ProjectResponse = {
            id: projectId,
            name,
            videoPath,
            createdAt: new Date().toISOString(),
            ...(metadata && {
                duration: metadata.duration,
                resolution: metadata.resolution,
                codec: metadata.codec,
            }),
        };

        this.logger.log(`Project created: ${projectId}`);

        return project;
    }
}

/**
 * Response DTO for project creation
 * TODO: Move to shared package
 */
interface ProjectResponse {
    id: string;
    name: string;
    videoPath: string;
    createdAt: string;
    duration?: number;
    resolution?: string;
    codec?: string;
}
