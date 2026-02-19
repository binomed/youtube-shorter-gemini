// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import {
    Controller,
    Post,
    Get,
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
import type { AnalysisResponse, AnalysisProgressEvent, ShortResponse } from '@youtube-shorter/shared';

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
    private readonly activeAnalyses = new Map<string, Subject<AnalysisProgressEvent>>();

    constructor(private readonly analysisService: AnalysisService) { }

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
            thumbnailUrl: s.thumbnailPath ? `/api/projects/${id}/shorts/${s.id}/thumbnail` : undefined,
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
        const path = await import('path');
        const { createReadStream, existsSync } = await import('fs');

        const thumbnailPath = await this.analysisService.getThumbnailPath(id, shortId);

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
}
