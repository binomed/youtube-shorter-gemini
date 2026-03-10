// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Controller, Sse, Param, MessageEvent } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Observable, map } from 'rxjs';
import { ProgressService } from './progress.service';

/**
 * ProgressController handles Server-Sent Events (SSE) for real-time progress updates
 *
 * SSE allows server to push updates to client without polling.
 * Used for:
 * - Video processing status (file received, metadata extraction)
 * - Future: Rendering progress, AI analysis
 *
 * Architecture:
 * - VideoService emits progress events to ProgressService
 * - ProgressService manages event streams (one per project)
 * - ProgressController exposes SSE endpoint that streams these events to frontend
 *
 * @controller
 */
@ApiTags('projects')
@Controller('api/projects')
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  /**
   * SSE endpoint for project progress updates
   *
   * Streams REAL progress events emitted by VideoService during processing:
   * 1. 'received' (25%) - File received by backend
   * 2. 'processing' (50%) - Extracting metadata
   * 3. 'complete' (100%) - Project created
   * 4. 'error' (0%) - Processing failed
   *
   * Client connects using EventSource:
   * ```javascript
   * const eventSource = new EventSource('/api/projects/abc-123/progress');
   * eventSource.onmessage = (event) => {
   *   const data = JSON.parse(event.data);
   *   console.log(data.type, data.progress, data.message);
   * };
   * eventSource.onerror = () => eventSource.close();
   * ```
   *
   * Stream automatically closes after 'complete' or 'error' event.
   *
   * @param projectId - Project ID to monitor
   * @returns Observable stream of real progress events
   *
   * @example
   * GET /api/projects/abc-123/progress
   *
   * Stream response:
   * data: {"type":"received","progress":25,"message":"Video file received","projectId":"abc-123","timestamp":"2026-02-17T..."}
   * data: {"type":"processing","progress":50,"message":"Extracting video metadata...","projectId":"abc-123","timestamp":"2026-02-17T..."}
   * data: {"type":"complete","progress":100,"message":"Project created successfully","projectId":"abc-123","timestamp":"2026-02-17T..."}
   */
  @Sse(':id/progress')
  @ApiOperation({ summary: 'SSE stream for initial video processing progress' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({
    status: 200,
    description: 'Observable stream of progress events',
  })
  progress(@Param('id') projectId: string): Observable<MessageEvent> {
    // Stream real progress events from ProgressService
    return this.progressService.getProgressStream(projectId).pipe(
      map(
        (event) =>
          ({
            data: event,
          }) as MessageEvent,
      ),
    );
  }
}
