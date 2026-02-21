// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Short } from '../../entities/short.entity';
import { Project } from '../../entities/project.entity';
import { GeminiService } from './gemini.service';
import { AnalysisService } from './analysis.service';
import { AnalysisController } from './analysis.controller';
import { StemService } from './stem.service';
import { FFmpegService } from '../../workers/ffmpeg.service';

/**
 * AI module for Gemini-powered video analysis and audio processing.
 *
 * Provides:
 * - GeminiService: Multimodal frame analysis via Gemini API
 * - AnalysisService: Orchestration pipeline (frames → Gemini → DB)
 * - StemService: Audio stem separation via demucs
 * - AnalysisController: REST + SSE endpoints
 */
@Module({
  imports: [TypeOrmModule.forFeature([Short, Project])],
  controllers: [AnalysisController],
  providers: [GeminiService, AnalysisService, StemService, FFmpegService],
  exports: [AnalysisService, GeminiService, StemService],
})
export class AiModule { }
