// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { FFmpegService } from '../../workers/ffmpeg.service';
import { ProgressService } from './progress.service';

/**
 * VideoService handles business logic for video upload and project management
 * 
 * Responsibilities:
 * - Create project records with video file references
 * - Coordinate with FFmpegService for metadata extraction
 * - Emit real-time progress events via ProgressService
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

    constructor(
        private readonly ffmpegService: FFmpegService,
        private readonly progressService: ProgressService,
    ) { }

    /**
     * Create a new project with uploaded video
     * 
     * For desktop local files, we store the original file path directly.
     * No copying is performed to avoid disk duplication.
     * 
     * Progress Events Emitted:
     * 1. 'received' (25%) - File uploaded and received by backend
     * 2. 'processing' (50%) - Extracting metadata with FFmpeg
     * 3. 'complete' (100%) - Project created successfully
     * 4. 'error' (0%) - Processing failed at any stage
     * 
     * Steps:
     * 1. Generate unique project ID
     * 2. Emit 'received' progress
     * 3. Store reference to original file path
     * 4. Emit 'processing' progress
     * 5. Extract video metadata (duration, resolution, codec)
     * 6. Create project record in database
     * 7. Emit 'complete' progress
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

        try {
            // Use original file path directly - no copy needed for desktop use case
            // Note: file.path contains the absolute path to the original file
            const videoPath = file.path || file.originalname;

            this.logger.log(`Creating project "${name}" with video: ${videoPath}`);

            // 1. File received
            this.progressService.emitProgress(
                projectId,
                'received',
                25,
                'Video file received',
            );

            // 2. Start metadata extraction
            this.progressService.emitProgress(
                projectId,
                'processing',
                50,
                'Extracting video metadata...',
            );

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

            // 3. Project creation complete
            this.progressService.emitProgress(
                projectId,
                'complete',
                100,
                'Project created successfully',
            );

            return project;
        } catch (error) {
            // Emit error event
            this.progressService.emitError(
                projectId,
                `Failed to create project: ${error.message}`,
            );
            throw error;
        }
    }
}

/**
 * Project response DTO
 */
export interface ProjectResponse {
    id: string;
    name: string;
    videoPath: string;
    createdAt: string;
    duration?: number;
    resolution?: string;
    codec?: string;
}
