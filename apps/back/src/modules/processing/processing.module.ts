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
 * ProcessingModule — Domaine: Traitement média local (FFmpeg + Demucs).
 *
 * Responsabilités (SRP) :
 * - Séparation audio via Demucs (appel CLI local)
 * - Orchestration FFmpeg pour les traitements bas-niveau
 * - Gestion des Jobs persistants (SQL-Queue, ADR-004)
 * - Exportation des Shorts finaux avec sous-titres incrustés
 *
 * Ne pas inclure ici : GeminiService (API externe, appartient à AnalysisModule)
 *
 * @see audit_report.md Section 1 — Audit Architecture (SRP)
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
