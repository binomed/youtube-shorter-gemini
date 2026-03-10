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
  Delete,
  Req,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { createReadStream, existsSync, statSync } from 'fs';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
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
@ApiTags('projects')
@Controller('api/projects')
export class VideoController {
  constructor(
    private readonly videoService: VideoService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get upload configuration
   *
   * @returns Configuration object
   */
  @Get('config')
  @ApiOperation({ summary: 'Get video upload configuration' })
  @ApiResponse({
    status: 200,
    description: 'Returns max size and allowed formats',
  })
  getConfig() {
    return {
      success: true,
      data: {
        maxVideoSizeMb: this.configService.get<number>(
          'MAX_VIDEO_SIZE_MB',
          2048,
        ),
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
  @ApiOperation({ summary: 'Upload video and create a new project' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        deletionPolicyAcknowledged: { type: 'boolean' },
        aiLearningConsent: { type: 'boolean' },
        videoFile: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Project created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file or missing data' })
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
    const allowedMimeTypes = ALLOWED_VIDEO_MIME_TYPES;
    if (!allowedMimeTypes.includes(file.mimetype)) {
      const allowedExtensions = ALLOWED_VIDEO_EXTENSIONS;
      throw new HttpException(
        `Invalid file format. Only ${allowedExtensions.join(', ')} files are accepted.`,
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
  @ApiOperation({ summary: 'Get project details by ID' })
  @ApiResponse({ status: 200, description: 'Returns project metadata' })
  @ApiResponse({ status: 404, description: 'Project not found' })
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
  @ApiOperation({ summary: 'Stream video file for a project' })
  @ApiResponse({
    status: 200,
    description: 'Returns a streamable video file',
    content: { 'video/mp4': {} },
  })
  @ApiResponse({ status: 206, description: 'Partial content (range request)' })
  @ApiResponse({ status: 404, description: 'Project or video file not found' })
  async streamVideo(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ): Promise<StreamableFile> {
    const videoPath = await this.videoService.getVideoPath(id);

    if (!existsSync(videoPath)) {
      throw new NotFoundException('Video file not found on disk');
    }

    const stat = statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const file = createReadStream(videoPath, { start, end });

      res.set({
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      });
      res.status(HttpStatus.PARTIAL_CONTENT);

      return new StreamableFile(file);
    } else {
      res.set({
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      });

      const file = createReadStream(videoPath);
      return new StreamableFile(file);
    }
  }
  /**
   * Get all projects
   *
   * @returns List of all projects
   */
  @Get()
  @ApiOperation({ summary: 'Get all projects' })
  @ApiResponse({
    status: 200,
    description: 'Returns a list of all projects',
  })
  async findAll() {
    const projects = await this.videoService.findAll();
    return {
      success: true,
      data: projects,
    };
  }

  /**
   * Delete a project
   *
   * @param id - Project UUID
   * @returns Success status
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a project and its associated files' })
  @ApiResponse({ status: 200, description: 'Project deleted successfully' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async deleteProject(@Param('id') id: string) {
    await this.videoService.deleteProject(id);
    return {
      success: true,
      message: 'Project deleted successfully',
    };
  }
}
