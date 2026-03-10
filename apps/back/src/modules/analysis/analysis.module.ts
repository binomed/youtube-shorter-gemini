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

/**
 * AnalysisModule — Domaine: Analyse IA via API Gemini.
 *
 * Responsabilités (SRP) :
 * - Orchestration du pipeline d'analyse (frames → Gemini → DB)
 * - Exposition des endpoints REST/SSE pour l'analyse et la séparation de stems
 *
 * Importe ProcessingModule pour rendre StemService disponible dans AnalysisController.
 * (Pattern NestJS : cross-module dependency via imports)
 *
 * @see audit_report.md Section 1 — Audit Architecture (SRP)
 * @see ADR-004 (SQL-Queue)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Short, Project, Subtitle]),
    ProcessingModule, // Provides StemService + FFmpegService + JobService
  ],
  controllers: [AnalysisController],
  providers: [GeminiService, AnalysisService, WhisperService],
  exports: [AnalysisService, GeminiService, WhisperService],
})
export class AnalysisModule {}
