// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-20 License. See LICENSE file in the project root for full license information.

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Short } from '../../entities/short.entity';
import { Project } from '../../entities/project.entity';
import { Job } from '../../entities/job.entity';
import { StemService } from '../ai/stem.service';
import { FFmpegService } from '../../workers/ffmpeg.service';
import { JobService } from './job.service';
import { JobProgressService } from './job-progress.service';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';

/**
 * ProcessingModule — Domain: Local media processing (FFmpeg + Demucs).
 *
 * Responsibilities (SRP):
 * - Audio separation via Demucs (local CLI call)
 * - FFmpeg orchestration for low-level processing
 * - Persistent Job management (SQL-Queue, ADR-004)
 * - Export of final Shorts with hardcoded subtitles
 *
 * Do not include here: GeminiService (external API, belongs to AnalysisModule)
 *
 * @see audit_report.md Section 1 — Architecture Audit (SRP)
 * @see ADR-003 (Demucs), ADR-004 (SQL-Queue)
 */
@Module({
  imports: [TypeOrmModule.forFeature([Short, Project, Job])],
  controllers: [ExportController],
  providers: [
    StemService,
    FFmpegService,
    JobService,
    JobProgressService,
    ExportService,
  ],
  exports: [
    StemService,
    FFmpegService,
    JobService,
    JobProgressService,
    ExportService,
  ],
})
export class ProcessingModule {}
