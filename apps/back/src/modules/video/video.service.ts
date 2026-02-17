// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectResponse } from '@youtube-shorter/shared';
import { FFmpegService } from '../../workers/ffmpeg.service';
import { Project } from '../../entities/project.entity';
import { validateAbsolutePath, validateFileExtension } from '../../utils/file-validation';

/**
 * VideoService handles business logic for video upload and project management
 * 
 * Responsibilities:
 * - Create project records with video file references
 * - Coordinate with FFmpegService for metadata extraction
 * - Persist projects to SQLite database via TypeORM
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
 * Note on Progress Tracking:
 * Story 1.1 uses synchronous processing (metadata extraction <1s).
 * ProgressService/SSE infrastructure exists but is NOT used here.
 * It will be activated in Story 2+ for async operations (rendering, AI analysis).
 * 
 * @service
 */
@Injectable()
export class VideoService {
    private readonly logger = new Logger(VideoService.name);

    constructor(
        @InjectRepository(Project)
        private readonly projectRepository: Repository<Project>,
        private readonly ffmpegService: FFmpegService,
    ) { }

    /**
     * Create a new project with uploaded video
     * 
     * For desktop local files, we store the original file path directly.
     * No copying is performed to avoid disk duplication.
     * 
     * Processing is SYNCHRONOUS for Story 1.1:
     * - File upload completes before this method is called (handled by NestJS)
     * - Metadata extraction takes <1 second
     * - Returns complete project with metadata immediately
     * 
     * Future (Story 2+): Will be refactored to async pattern with job queue
     * when processing takes longer (rendering, AI analysis).
     * 
     * Steps:
     * 1. Store reference to original file path
     * 2. Extract video metadata (duration, resolution, codec)
     * 3. Create and save project to database
     * 4. Return complete project
     * 
     * @param name - Project name
     * @param file - Uploaded video file (contains original path)
     * @returns Created project with metadata
     */
    async createProject(
        name: string,
        file: Express.Multer.File,
    ): Promise<ProjectResponse> {
        // Validate and sanitize file path (Issue #2: Security)
        // Ensure we have a valid file path, prefer file.path over user-controlled originalname
        if (!file.path) {
            throw new BadRequestException('File upload failed: no file path provided');
        }

        // Validate file path is absolute and safe
        const videoPath = validateAbsolutePath(file.path);

        // Validate file extension (Issue #11: Pre-validation)
        const allowedExtensions = ['.mp4', '.mov', '.avi', '.mkv'];
        try {
            validateFileExtension(videoPath, allowedExtensions);
        } catch (error) {
            throw new BadRequestException(error.message);
        }

        this.logger.log(`Creating project "${name}" with video: ${videoPath}`);

        // Extract video metadata (Issue #3: Fail-fast on errors)
        let metadata;
        try {
            metadata = await this.ffmpegService.extractMetadata(videoPath);
        } catch (error) {
            this.logger.error(
                `FFmpeg metadata extraction failed for ${videoPath}: ${error.message}`,
            );
            // FAIL FAST: Don't create project with corrupted/invalid video
            throw new BadRequestException(
                `Invalid video file: ${error.message}. Please upload a valid MP4/MOV file.`,
            );
        }

        // Create project entity
        const project = this.projectRepository.create({
            name,
            videoPath,
            ...(metadata && {
                duration: metadata.duration,
                resolution: metadata.resolution,
                codec: metadata.codec,
            }),
        });

        // Save to database
        // Issue #1: Remove dangerous type cast
        // TypeORM's save() can return T | T[] depending on input
        // We pass a single entity, so result is always a single Project
        // Use proper type guard instead of blind cast
        const saveResult = await this.projectRepository.save(project);
        const savedProject: Project = Array.isArray(saveResult) ? saveResult[0] : saveResult;

        if (!savedProject || !savedProject.id) {
            throw new Error('Failed to save project to database');
        }

        this.logger.log(`Project created successfully: ${savedProject.id} - ${savedProject.name}`);

        // Return DTO
        return {
            id: savedProject.id,
            name: savedProject.name,
            videoPath: savedProject.videoPath,
            createdAt: savedProject.createdAt.toISOString(),
            ...(savedProject.duration && { duration: savedProject.duration }),
            ...(savedProject.resolution && { resolution: savedProject.resolution }),
            ...(savedProject.codec && { codec: savedProject.codec }),
        };
    }
}
