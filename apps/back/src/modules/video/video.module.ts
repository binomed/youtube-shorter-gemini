// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Module } from '@nestjs/common';
import { VideoController } from './video.controller';
import { ProgressController } from './progress.controller';
import { VideoService } from './video.service';
import { FFmpegService } from '../../workers/ffmpeg.service';
import { ProgressService } from './progress.service';

/**
 * VideoModule handles video upload, processing, and project management
 * 
 * Responsibilities:
 * - Video file upload (multipart/form-data)
 * - File format and size validation (MP4/MOV, configurable max 2GB)
 * - Project creation and persistence
 * - Integration with FFmpegService for metadata extraction
 * - Real-time progress updates via Server-Sent Events (SSE)
 * 
 * @module
 */
@Module({
    controllers: [VideoController, ProgressController],
    providers: [VideoService, FFmpegService, ProgressService],
    exports: [VideoService],
})
export class VideoModule { }
