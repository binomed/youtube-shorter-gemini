/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
const BYTES_PER_MB = 1024 * 1024;

import {
  Controller,
  Post,
  Get,
  Param,
  Res,
  UploadedFile,
  UseInterceptors,
  Body,
  HttpException,
  HttpStatus,
  UsePipes,
  ValidationPipe,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  CreateProjectDto,
  ALLOWED_VIDEO_EXTENSIONS,
  ALLOWED_VIDEO_MIME_TYPES,
} from '@youtube-shorter/shared';
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
   * Get upload configuration
   *
   * @returns Configuration object
   */
  @Get('config')
  getConfig() {
    return {
      success: true,
      data: {
        maxVideoSizeMb: this.configService.get<number>('MAX_VIDEO_SIZE_MB', 2048),
        allowedExtensions: ALLOWED_VIDEO_EXTENSIONS,
        allowedMimeTypes: ALLOWED_VIDEO_MIME_TYPES,
      },
    };
  }

  /**
   * Create a new project with video upload
   *
   * Handles multipart/form-data upload with validation:
   * - Accepts MP4, MOV, AVI, MKV files
   * - Max file size: Configurable via MAX_VIDEO_SIZE_MB (default 2048MB)
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
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  @UseInterceptors(FileInterceptor('videoFile'))
  async createProject(
    @Body() createProjectDto: CreateProjectDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // Validate file presence
    if (!file) {
      throw new HttpException('Video file is required', HttpStatus.BAD_REQUEST);
    }

    // Validate file format (MP4/MOV/AVI/MKV - defined in shared constants)
    if (!ALLOWED_VIDEO_MIME_TYPES.includes(file.mimetype)) {
      throw new HttpException(
        `Invalid file format. Only ${ALLOWED_VIDEO_EXTENSIONS.join(', ')} files are accepted.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate file size (configurable via MAX_VIDEO_SIZE_MB env var, default 2048MB = 2GB)
    const maxSizeMB = this.configService.get<number>('MAX_VIDEO_SIZE_MB', 2048);
    const maxSize = maxSizeMB * BYTES_PER_MB; // Convert MB to bytes
    if (file.size > maxSize) {
      throw new HttpException(
        `File size exceeds the maximum limit of ${maxSizeMB}MB.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Create project
    const project = await this.videoService.createProject(
      createProjectDto,
      file,
    );

    return {
      success: true, // Legacy format
      data: project,
    };
  }

  /**
   * Get project by ID
   *
   * @param id - Project UUID
   * @returns Project data
   * @throws NotFoundException if project not found
   */
  @Get(':id')
  async getProject(@Param('id') id: string) {
    const project = await this.videoService.getProject(id);
    return {
      success: true,
      data: project,
    };
  }

  /**
   * Stream video file for a project
   *
   * Serves the uploaded video file with appropriate content-type header.
   * Supports range requests for seeking in the video player.
   *
   * @param id - Project UUID
   * @param res - Express response for setting headers
   * @returns Streamable file
   * @throws NotFoundException if project or video file not found
   */
  @Get(':id/video')
  async streamVideo(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const videoPath = await this.videoService.getVideoPath(id);

    if (!existsSync(videoPath)) {
      throw new NotFoundException('Video file not found on disk');
    }

    res.set({
      'Content-Type': 'video/mp4',
      'Content-Disposition': 'inline',
    });

    const fileStream = createReadStream(videoPath);
    return new StreamableFile(fileStream);
  }
}
