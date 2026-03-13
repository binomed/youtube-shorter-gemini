import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  Sse,
  MessageEvent,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { Observable, map } from 'rxjs';
import * as path from 'path';
import { ExportService } from './export.service';
import { JobProgressService } from './job-progress.service';
import { ExportShortDto } from '@youtube-shorter/shared';
import type { ExportProgressEvent } from '@youtube-shorter/shared';

@ApiTags('processing')
@Controller('api/projects/:projectId/shorts/:shortId/export')
export class ExportController {
  constructor(
    private readonly exportService: ExportService,
    private readonly jobProgressService: JobProgressService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Request high-quality export for a short' })
  @ApiResponse({ status: 200, description: 'Export job started' })
  async requestExport(
    @Param('projectId') projectId: string,
    @Param('shortId') shortId: string,
    @Body() dto: ExportShortDto,
  ): Promise<{ success: boolean; message: string; jobId: string }> {
    if (dto.shortId !== shortId) {
      throw new BadRequestException('Path shortId must match body shortId');
    }

    // Initialize Job in SQLite via unified service
    const jobId = await this.jobProgressService.startJob({
      type: 'export',
      projectId,
      shortId,
    });

    // Non-blocking trigger of export logic.
    void (async () => {
      try {
        const filename = await this.exportService.exportShort(
          projectId,
          dto,
          jobId,
        );
        const exportUrl = `/api/projects/${projectId}/shorts/${shortId}/export/download/${filename}`;

        // Final terminal event with download URL
        await this.jobProgressService.emit(jobId, {
          phase: 'complete',
          progress: 100,
          message: 'Export finished! Your download should start automatically.',
          shortId,
          exportUrl,
        } as any);

        // Finally mark the job as finished in DB and close stream gracefully (after 1s delay in service)
        await this.jobProgressService.complete(jobId);
      } catch (err: unknown) {
        // Ensure job is marked as failed if an unexpected error bubbles up
        const errorMessage = err instanceof Error ? err.message : String(err);
        await this.jobProgressService.fail(jobId, errorMessage);
      }
    })();

    return {
      success: true,
      message: 'Export job registered and started',
      jobId,
    };
  }

  @Sse('progress')
  @ApiOperation({ summary: 'SSE stream for export progress' })
  @ApiResponse({
    status: 200,
    description: 'Observable stream of ExportProgressEvent',
  })
  async exportProgress(
    @Param('projectId') projectId: string,
    @Param('shortId') shortId: string,
    @Query('jobId') queryJobId?: string,
  ): Promise<Observable<MessageEvent>> {
    let jobId = queryJobId;
    if (!jobId) {
      jobId = await this.jobProgressService.getLatestJobIdByShort(shortId);
    }

    if (!jobId) {
      throw new BadRequestException(
        'jobId query parameter is required for SSE subscription and no recent job found',
      );
    }

    return this.jobProgressService.getStream<ExportProgressEvent>(jobId).pipe(
      map(
        (event) =>
          ({
            type: 'export-progress',
            data: event,
          }) as MessageEvent,
      ),
    );
  }

  @Get('download/:filename')
  @ApiOperation({ summary: 'Download final exported MP4 file' })
  @ApiResponse({ status: 200, description: 'Returns MP4 file binary stream' })
  @ApiResponse({ status: 400, description: 'Invalid filename' })
  downloadExport(
    @Param('filename') filename: string,
    @Res() res: Response,
  ): void {
    // Security check: only allow .mp4 files and alphanumeric/dash names
    if (!/^[a-zA-Z0-9_\-]+\.mp4$/.test(filename)) {
      throw new BadRequestException('Invalid filename');
    }

    const filePath = path.join(process.cwd(), 'uploads', 'exports', filename);

    res.download(filePath, filename);
  }
}
