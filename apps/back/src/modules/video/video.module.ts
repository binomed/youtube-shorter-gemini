// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VideoController } from './video.controller';
import { ProgressController } from './progress.controller';
import { VideoService } from './video.service';
import { FFmpegService } from '../../workers/ffmpeg.service';
import { ProgressService } from './progress.service';
import { CleanupService } from './cleanup.service';
import { Project } from '../../entities/project.entity';

/**
 * VideoModule handles video upload, processing, and project management
 * 
 * Responsibilities:
 * - Video file upload (multipart/form-data)
 * - File format and size validation (MP4/MOV, configurable max 2GB)
 * - Project creation and persistence (TypeORM + SQLite)
 * - Integration with FFmpegService for metadata extraction
 * - Real-time progress updates via SSE (ProgressController - for future async operations)
 * - Privacy-compliant cleanup (CleanupService - deletes DB records, not user files)
 * 
 * Note: ProgressService/ProgressController exist as infrastructure for future
 * async operations (Story 2+: rendering, AI analysis). Not actively used in Story 1.1
 * where processing is synchronous (<1s).
 * 
 * @module
 */
@Module({
    imports: [TypeOrmModule.forFeature([Project])],
    controllers: [VideoController, ProgressController],
    providers: [VideoService, FFmpegService, ProgressService, CleanupService],
    exports: [VideoService, CleanupService],
})
export class VideoModule { }
