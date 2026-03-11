// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Sse,
  Logger,
  HttpCode,
  HttpStatus,
  MessageEvent,
  StreamableFile,
  Res,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import type { Response } from 'express';
import { Observable, map, finalize } from 'rxjs';
import {
  AnalysisService,
  type AnalysisProgressEvent,
} from './analysis.service';
import { StemService } from './stem.service';
import { JobProgressService } from '../processing/job-progress.service';
import {
  UpdateSubtitleStyleDto,
  UpdateSubtitleTextDto,
} from './dto/update-subtitle.dto';
import type {
  StemProgressEvent,
  ShortResponse,
  SubtitleStyle,
  UpdateShortSegmentsDto,
} from '@youtube-shorter/shared';

/**
 * Controller for AI-powered video analysis endpoints.
 *
 * Provides:
 * - POST /api/projects/:id/analyze — Triggers analysis + returns results
 * - GET /api/projects/:id/analyze/progress — SSE stream for analysis progress
 * - GET /api/projects/:id/shorts — Get existing shorts for a project
 */
@ApiTags('analysis')
@Controller('api/projects')
export class AnalysisController {
  private readonly logger = new Logger(AnalysisController.name);

  constructor(
    private readonly analysisService: AnalysisService,
    private readonly stemService: StemService,
    private readonly jobProgressService: JobProgressService,
  ) {}

  /**
   * Trigger AI analysis for a project's video.
   * Extracts frames, sends to Gemini, saves detected Shorts.
   *
   * @param id - Project UUID
   * @returns Analysis result with detected shorts
   */
  @Post(':id/analyze')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger AI analysis for a project' })
  @ApiResponse({
    status: 200,
    description: 'Analysis started and results returned',
  })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async analyzeProject(
    @Param('id') id: string,
  ): Promise<{ projectId: string; jobId: string }> {
    this.logger.log(`Starting analysis for project ${id}`);

    // Initialize Job in SQLite via unified service
    const jobId = await this.jobProgressService.startJob({
      type: 'analysis',
      projectId: id,
    });

    // Run analysis in background
    void (async () => {
      try {
        await this.analysisService.analyzeProject(id, jobId);
      } catch (err) {
        this.logger.error(
          `Background analysis failed for ${id}: ${(err as Error).message}`,
        );
        // Error already handled in service.analyzeProject (it calls jobProgressService.fail)
      }
    })();

    return {
      projectId: id,
      jobId,
    };
  }

  /**
   * SSE endpoint for real-time analysis progress.
   *
   * @param id - Project UUID
   * @param jobId - Job ID to monitor
   */
  @Sse(':id/analyze/progress')
  @ApiOperation({ summary: 'SSE stream for real-time analysis progress' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({
    status: 200,
    description: 'Observable stream of AnalysisProgressEvent',
  })
  async analyzeProgress(
    @Param('id') id: string,
    @Query('jobId') queryJobId?: string,
  ): Promise<Observable<MessageEvent>> {
    let jobId = queryJobId;

    if (!jobId) {
      jobId = await this.jobProgressService.getLatestJobIdByProject(
        id,
        'analysis',
      );
    }

    if (!jobId) {
      throw new BadRequestException(
        'jobId query parameter is required and no recent job found',
      );
    }

    return this.jobProgressService.getStream<AnalysisProgressEvent>(jobId).pipe(
      map(
        (event) =>
          ({
            data: event,
            type: 'analysis-progress',
          }) as MessageEvent,
      ),
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
  @ApiOperation({ summary: 'Get all segments/shorts detected for a project' })
  @ApiResponse({ status: 200, description: 'List of detected shorts' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getShorts(@Param('id') id: string): Promise<ShortResponse[]> {
    const shorts = await this.analysisService.getShortsByProject(id);
    return shorts.map((s) => this.mapToShortResponse(s, id));
  }

  /**
   * Helper to map Short entity to ShortResponse DTO.
   */
  private mapToShortResponse(s: any, projectId: string): ShortResponse {
    const rawShort = s as {
      id: string;
      projectId: string;
      title: string;
      description: string;
      startTime: number;
      endTime: number;
      confidence: number;
      orderIndex: number;
      thumbnailPath?: string;
      vocalsPath?: string;
      accompanimentPath?: string;
      subtitleStyle: SubtitleStyle;
      segments: any[];
      subtitles?: any[];
      createdAt: any;
    };

    return {
      id: rawShort.id,
      projectId: rawShort.projectId,
      title: rawShort.title,
      description: rawShort.description,
      startTime: rawShort.startTime,
      endTime: rawShort.endTime,
      confidence: rawShort.confidence,
      orderIndex: rawShort.orderIndex,
      thumbnailUrl: rawShort.thumbnailPath
        ? `/api/projects/${projectId}/shorts/${rawShort.id}/thumbnail`
        : undefined,
      stemsAvailable: !!(rawShort.vocalsPath && rawShort.accompanimentPath),
      subtitleStyle: rawShort.subtitleStyle,
      segments: rawShort.segments,
      subtitles: rawShort.subtitles?.map((sub: any) => {
        const rawSub = sub as {
          id: string;
          shortId: string;
          startTime: number;
          endTime: number;
          text: string;
        };
        return {
          id: rawSub.id,
          shortId: rawSub.shortId,
          startTime: rawSub.startTime,
          endTime: rawSub.endTime,
          text: rawSub.text,
        };
      }),
      createdAt: (rawShort.createdAt instanceof Date
        ? rawShort.createdAt
        : new Date(rawShort.createdAt as string | number | Date)
      ).toISOString(),
    };
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
  @ApiOperation({ summary: 'Get thumbnail image for a short' })
  @ApiResponse({ status: 200, description: 'Returns JPEG image stream' })
  @ApiResponse({ status: 404, description: 'Short or thumbnail not found' })
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
   * @returns Success with jobId
   */
  @Post(':id/shorts/:shortId/stems')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger audio stem separation for a short' })
  @ApiResponse({ status: 200, description: 'Stem separation started' })
  async separateStems(
    @Param('id') id: string,
    @Param('shortId') shortId: string,
  ): Promise<{
    success: boolean;
    jobId: string;
  }> {
    this.logger.log(
      `Starting stem separation for short ${shortId} in project ${id}`,
    );

    // Initialize Job in SQLite via unified service
    const jobId = await this.jobProgressService.startJob({
      type: 'stem_separation',
      projectId: id,
      shortId,
    });

    // Background trigger
    void (async () => {
      try {
        await this.stemService.separateStems(id, shortId, jobId);
      } catch (err) {
        this.logger.error(
          `Stem separation failed for ${shortId}: ${(err as Error).message}`,
        );
      }
    })();

    return {
      success: true,
      jobId,
    };
  }

  /**
   * SSE endpoint for real-time stem separation progress.
   *
   * @param id - Project UUID
   * @param shortId - Short UUID
   * @param jobId - Job ID to monitor
   */
  @Sse(':id/shorts/:shortId/stems/progress')
  @ApiOperation({ summary: 'SSE stream for stem separation progress' })
  @ApiResponse({
    status: 200,
    description: 'Observable stream of StemProgressEvent',
  })
  async stemProgress(
    @Param('id') id: string,
    @Param('shortId') shortId: string,
    @Query('jobId') queryJobId?: string,
  ): Promise<Observable<MessageEvent>> {
    let jobId = queryJobId;
    if (!jobId) {
      jobId = await this.jobProgressService.getLatestJobIdByShort(shortId);
    }

    if (!jobId) {
      throw new BadRequestException(
        'jobId query parameter is required and no recent job found',
      );
    }

    return this.jobProgressService.getStream<StemProgressEvent>(jobId).pipe(
      map(
        (event) =>
          ({
            data: event,
            type: 'stem-progress',
          }) as MessageEvent,
      ),
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
  @ApiOperation({ summary: 'Download/Stream separated audio stem' })
  @ApiResponse({ status: 200, description: 'Returns WAV audio stream' })
  @ApiResponse({ status: 404, description: 'Stem file not found' })
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
      filePath = short.vocalsPath ?? undefined;
    } else if (stem === 'accompaniment') {
      filePath = short.accompanimentPath ?? undefined;
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
  @ApiOperation({ summary: 'Update subtitle style for a short' })
  @ApiResponse({ status: 200, description: 'Style updated' })
  async updateSubtitleStyle(
    @Param('id') projectId: string,
    @Param('shortId') shortId: string,
    @Body() styleDto: UpdateSubtitleStyleDto,
  ): Promise<void> {
    await this.analysisService.updateSubtitleStyle(
      projectId,
      shortId,
      styleDto,
    );
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
  @ApiOperation({ summary: 'Update specific subtitle line text' })
  @ApiResponse({ status: 200, description: 'Text updated' })
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

  /**
   * Update the segments (jump cuts) for a specific short.
   *
   * @param id - Project UUID
   * @param shortId - Short UUID
   * @param segmentsDto - New segments list
   */
  @Patch(':id/shorts/:shortId/segments')
  @ApiOperation({ summary: 'Update jump cut segments for a short' })
  @ApiResponse({ status: 200, description: 'Segments updated' })
  async updateShortSegments(
    @Param('id') id: string,
    @Param('shortId') shortId: string,
    @Body() updateDto: UpdateShortSegmentsDto,
  ): Promise<ShortResponse> {
    const short = await this.analysisService.updateShortSegments(
      id,
      shortId,
      updateDto,
    );
    return this.mapToShortResponse(short, id);
  }
}
