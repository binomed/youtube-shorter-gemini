// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Module } from '@nestjs/common';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';

/**
 * VideoModule handles video upload, processing, and project management
 * 
 * Responsibilities:
 * - Video file upload (multipart/form-data)
 * - File format and size validation (MP4/MOV, max 500MB)
 * - Project creation and persistence
 * - Integration with FFmpegService for metadata extraction
 * 
 * @module
 */
@Module({
    controllers: [VideoController],
    providers: [VideoService],
    exports: [VideoService],
})
export class VideoModule { }
