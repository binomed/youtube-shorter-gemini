// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Short } from '../../entities/short.entity';
import { Project } from '../../entities/project.entity';
import { Subtitle } from '../../entities/subtitle.entity';
import { GeminiService } from '../ai/gemini.service';
import { AnalysisService } from '../ai/analysis.service';
import { AnalysisController } from '../ai/analysis.controller';
import { WhisperService } from '../ai/whisper.service';
import { ProcessingModule } from '../processing/processing.module';
import { SettingsModule } from '../settings/settings.module';

/**
 * AnalysisModule — Domain: AI Analysis via Gemini API.
 *
 * Responsibilities (SRP):
 * - Analysis pipeline orchestration (frames → Gemini → DB)
 * - Exposure of REST/SSE endpoints for analysis and stem separation
 *
 * Imports ProcessingModule to make StemService available in AnalysisController.
 * (NestJS Pattern: cross-module dependency via imports)
 *
 * @see audit_report.md Section 1 — Architecture Audit (SRP)
 * @see ADR-004 (SQL-Queue)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Short, Project, Subtitle]),
    ProcessingModule, // Provides StemService + FFmpegService + JobService
    SettingsModule,
  ],

  controllers: [AnalysisController],
  providers: [GeminiService, AnalysisService, WhisperService],
  exports: [AnalysisService, GeminiService, WhisperService],
})
export class AnalysisModule {}
