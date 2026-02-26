// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Sse,
  Logger,
  HttpCode,
  HttpStatus,
  MessageEvent,
  StreamableFile,
  Res,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable, Subject, map, finalize } from 'rxjs';
import { AnalysisService } from './analysis.service';
import { StemService } from './stem.service';
import {
  UpdateSubtitleStyleDto,
  UpdateSubtitleTextDto,
} from './dto/update-subtitle.dto';
import type {
  AnalysisResponse,
  AnalysisProgressEvent,
  StemProgressEvent,
  ShortResponse,
  SubtitleStyle,
} from '@youtube-shorter/shared';

/**
 * Controller for AI-powered video analysis endpoints.
 *
 * Provides:
 * - POST /api/projects/:id/analyze — Triggers analysis + returns results
 * - GET /api/projects/:id/analyze/progress — SSE stream for analysis progress
 * - GET /api/projects/:id/shorts — Get existing shorts for a project
 */
@Controller('api/projects')
export class AnalysisController {
  private readonly logger = new Logger(AnalysisController.name);
  private readonly activeAnalyses = new Map<
    string,
    Subject<AnalysisProgressEvent>
  >();
  private readonly activeStemJobs = new Map<
    string,
    Subject<StemProgressEvent>
  >();

  constructor(
    private readonly analysisService: AnalysisService,
    private readonly stemService: StemService,
  ) { }

  /**
   * Trigger AI analysis for a project's video.
   * Extracts frames, sends to Gemini, saves detected Shorts.
   *
   * @param id - Project UUID
   * @returns Analysis result with detected shorts
   */
  @Post(':id/analyze')
  @HttpCode(HttpStatus.OK)
  async analyzeProject(@Param('id') id: string): Promise<AnalysisResponse> {
    this.logger.log(`Starting analysis for project ${id}`);

    // Reuse SSE progress subject if SSE was connected first, otherwise create one
    let progress$ = this.activeAnalyses.get(id);
    if (!progress$) {
      progress$ = new Subject<AnalysisProgressEvent>();
      this.activeAnalyses.set(id, progress$);
    }

    try {
      const shorts = await this.analysisService.analyzeProject(id, progress$);

      const shortResponses: ShortResponse[] = shorts.map((s) => ({
        id: s.id,
        projectId: s.projectId,
        title: s.title,
        description: s.description,
        startTime: s.startTime,
        endTime: s.endTime,
        confidence: s.confidence,
        orderIndex: s.orderIndex,
        thumbnailUrl: s.thumbnailPath
          ? `/api/projects/${id}/shorts/${s.id}/thumbnail`
          : undefined,
        stemsAvailable: !!(s.vocalsPath && s.accompanimentPath),
        createdAt: s.createdAt.toISOString(),
      }));

      return {
        projectId: id,
        count: shortResponses.length,
        shorts: shortResponses,
      };
    } finally {
      progress$.complete();
      this.activeAnalyses.delete(id);
    }
  }

  /**
   * SSE endpoint for real-time analysis progress.
   * Connect BEFORE triggering POST /analyze to receive all events.
   *
   * @param id - Project UUID
   */
  @Sse(':id/analyze/progress')
  analyzeProgress(@Param('id') id: string): Observable<MessageEvent> {
    this.logger.log(`SSE connection opened for project ${id}`);

    // Get or create progress subject
    let progress$ = this.activeAnalyses.get(id);
    if (!progress$) {
      progress$ = new Subject<AnalysisProgressEvent>();
      this.activeAnalyses.set(id, progress$);
    }

    return progress$.pipe(
      map((event) => ({
        data: JSON.stringify(event),
        type: 'analysis-progress',
      })),
      finalize(() => {
        this.logger.log(`SSE connection closed for project ${id}`);
      }),
    );
  }

  /**
   * Get existing shorts for a project.
   *
   * @param id - Project UUID
   * @returns Array of shorts
   */
  @Get(':id/shorts')
  async getShorts(@Param('id') id: string): Promise<ShortResponse[]> {
    const shorts = await this.analysisService.getShortsByProject(id);

    return shorts.map((s) => ({
      id: s.id,
      projectId: s.projectId,
      title: s.title,
      description: s.description,
      startTime: s.startTime,
      endTime: s.endTime,
      confidence: s.confidence,
      orderIndex: s.orderIndex,
      thumbnailUrl: s.thumbnailPath
        ? `/api/projects/${id}/shorts/${s.id}/thumbnail`
        : undefined,
      stemsAvailable: !!(s.vocalsPath && s.accompanimentPath),
      subtitleStyle: s.subtitleStyle as SubtitleStyle,
      subtitles: s.subtitles?.map((sub) => ({
        id: sub.id,
        shortId: sub.shortId,
        startTime: sub.startTime,
        endTime: sub.endTime,
        text: sub.text,
      })),
      createdAt: s.createdAt.toISOString(),
    }));
  }

  /**
   * Get thumbnail for a specific short
   *
   * @param id - Project UUID
   * @param shortId - Short UUID
   * @param res - Response object
   * @returns StreamableFile
   */
  @Get(':id/shorts/:shortId/thumbnail')
  async getThumbnail(
    @Param('id') id: string,
    @Param('shortId') shortId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { createReadStream, existsSync } = await import('fs');

    const thumbnailPath = await this.analysisService.getThumbnailPath(
      id,
      shortId,
    );

    if (!existsSync(thumbnailPath)) {
      throw new NotFoundException('Thumbnail file not found on disk');
    }

    res.set({
      'Content-Type': 'image/jpeg',
      'Content-Disposition': 'inline',
    });

    const fileStream = createReadStream(thumbnailPath);
    return new StreamableFile(fileStream);
  }

  // ─── STEM SEPARATION ENDPOINTS ────────────────────────────────────

  /**
   * Trigger audio stem separation for a specific short.
   *
   * @param id - Project UUID
   * @param shortId - Short UUID
   * @returns Success with stem paths
   */
  @Post(':id/shorts/:shortId/stems')
  @HttpCode(HttpStatus.OK)
  async separateStems(
    @Param('id') id: string,
    @Param('shortId') shortId: string,
  ): Promise<{
    success: boolean;
    data: { vocalsPath?: string; accompanimentPath?: string };
  }> {
    this.logger.log(
      `Starting stem separation for short ${shortId} in project ${id}`,
    );

    // Reuse SSE progress subject if SSE was connected first
    const stemKey = `${id}:${shortId}`;
    let progress$ = this.activeStemJobs.get(stemKey);
    if (!progress$) {
      progress$ = new Subject<StemProgressEvent>();
      this.activeStemJobs.set(stemKey, progress$);
    }

    try {
      const short = await this.stemService.separateStems(
        id,
        shortId,
        progress$,
      );

      return {
        success: true,
        data: {
          vocalsPath: short.vocalsPath,
          accompanimentPath: short.accompanimentPath,
        },
      };
    } finally {
      progress$.complete();
      this.activeStemJobs.delete(stemKey);
    }
  }

  /**
   * SSE endpoint for real-time stem separation progress.
   * Connect BEFORE triggering POST stems to receive all events.
   *
   * @param id - Project UUID
   * @param shortId - Short UUID
   */
  @Sse(':id/shorts/:shortId/stems/progress')
  stemProgress(
    @Param('id') id: string,
    @Param('shortId') shortId: string,
  ): Observable<MessageEvent> {
    this.logger.log(
      `SSE connection opened for stem separation: ${id}/${shortId}`,
    );

    const stemKey = `${id}:${shortId}`;
    let progress$ = this.activeStemJobs.get(stemKey);
    if (!progress$) {
      progress$ = new Subject<StemProgressEvent>();
      this.activeStemJobs.set(stemKey, progress$);
    }

    return progress$.pipe(
      map((event) => ({
        data: JSON.stringify(event),
        type: 'stem-progress',
      })),
      finalize(() => {
        this.logger.log(
          `SSE connection closed for stem separation: ${id}/${shortId}`,
        );
      }),
    );
  }

  /**
   * Stream a stem audio file for a specific short.
   *
   * @param id - Project UUID
   * @param shortId - Short UUID
   * @param stem - stem type: 'vocals' or 'accompaniment'
   * @param res - Response object
   * @returns StreamableFile
   */
  @Get(':id/shorts/:shortId/stems/:stem')
  async getStemAudio(
    @Param('id') id: string,
    @Param('shortId') shortId: string,
    @Param('stem') stem: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { createReadStream, existsSync } = await import('fs');

    const shorts = await this.analysisService.getShortsByProject(id);
    const short = shorts.find((s) => s.id === shortId);

    if (!short) {
      throw new NotFoundException(`Short ${shortId} not found`);
    }

    let filePath: string | undefined;
    if (stem === 'vocals') {
      filePath = short.vocalsPath;
    } else if (stem === 'accompaniment') {
      filePath = short.accompanimentPath;
    } else {
      throw new NotFoundException(
        `Unknown stem type: ${stem}. Use 'vocals' or 'accompaniment'.`,
      );
    }

    if (!filePath || !existsSync(filePath)) {
      throw new NotFoundException(
        `Stem '${stem}' file not found. Run stem separation first.`,
      );
    }

    res.set({
      'Content-Type': 'audio/wav',
      'Content-Disposition': `inline; filename="${stem}.wav"`,
    });

    const fileStream = createReadStream(filePath);
    return new StreamableFile(fileStream);
  }

  /**
   * Update the subtitle style preferences for a specific short.
   * 
   * @param projectId - Project UUID
   * @param shortId - Short UUID
   * @param styleDto - Update parameters for styling
   */
  @Patch(':id/shorts/:shortId/style')
  async updateSubtitleStyle(
    @Param('id') projectId: string,
    @Param('shortId') shortId: string,
    @Body() styleDto: UpdateSubtitleStyleDto,
  ): Promise<void> {
    await this.analysisService.updateSubtitleStyle(projectId, shortId, styleDto);
  }

  /**
   * Update the text of a specific subtitle line.
   * 
   * @param projectId - Project UUID
   * @param shortId - Short UUID
   * @param subtitleId - Subtitle UUID
   * @param textDto - Update parameters containing text
   */
  @Patch(':id/shorts/:shortId/subtitles/:subtitleId')
  async updateSubtitleText(
    @Param('id') projectId: string,
    @Param('shortId') shortId: string,
    @Param('subtitleId') subtitleId: string,
    @Body() textDto: UpdateSubtitleTextDto,
  ): Promise<void> {
    await this.analysisService.updateSubtitleText(
      projectId,
      shortId,
      subtitleId,
      textDto,
    );
  }
}
