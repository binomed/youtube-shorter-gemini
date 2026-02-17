// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import {
    Controller,
    Post,
    UploadedFile,
    UseInterceptors,
    Body,
    HttpException,
    HttpStatus,
    UsePipes,
    ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateProjectDto } from '@youtube-shorter/shared';
import { VideoService } from './video.service';


/**
 * VideoController handles HTTP endpoints for video upload and project management
 * 
 * @controller
 */
@Controller('api/projects')
export class VideoController {
    constructor(
        private readonly videoService: VideoService,
        private readonly configService: ConfigService,
    ) { }

    /**
     * Create a new project with video upload
     * 
     * Handles multipart/form-data upload with validation:
     * - Accepts MP4 and MOV files only
     * - Max file size: 500MB
     * - Validates project name (required, max 255 chars)
     * 
     * @param createProjectDto - Project creation data (name)
     * @param file - Uploaded video file
     * @returns Created project with metadata
     * @throws HttpException 400 if validation fails
     * 
     * @example
     * POST /api/projects
     * Content-Type: multipart/form-data
     * 
     * name: "My Awesome Project"
     * videoFile: <binary MP4 file>
     */
    @Post()
    @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    @UseInterceptors(FileInterceptor('videoFile'))
    async createProject(
        @Body() createProjectDto: CreateProjectDto,
        @UploadedFile() file: Express.Multer.File,
    ) {
        // Validate file presence
        if (!file) {
            throw new HttpException(
                'Video file is required',
                HttpStatus.BAD_REQUEST,
            );
        }

        // Validate file format (MP4/MOV only)
        const allowedMimeTypes = ['video/mp4', 'video/quicktime'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
            throw new HttpException(
                'Invalid file format. Only MP4 and MOV files are accepted.',
                HttpStatus.BAD_REQUEST,
            );
        }

        // Validate file size (configurable via MAX_VIDEO_SIZE_MB env var, default 2048MB = 2GB)
        const maxSizeMB = this.configService.get<number>('MAX_VIDEO_SIZE_MB', 2048);
        const maxSize = maxSizeMB * 1024 * 1024; // Convert MB to bytes
        if (file.size > maxSize) {
            throw new HttpException(
                `File size exceeds the maximum limit of ${maxSizeMB}MB.`,
                HttpStatus.BAD_REQUEST,
            );
        }

        // Create project
        const project = await this.videoService.createProject(
            createProjectDto.name,
            file,
        );

        return {
            success: true,
            data: project,
        };
    }
}
