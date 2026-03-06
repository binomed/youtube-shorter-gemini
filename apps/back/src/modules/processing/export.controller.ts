import { Controller, Post, Get, Param, Body, Sse, MessageEvent, BadRequestException, Res } from '@nestjs/common';
import { Subject, Observable, map } from 'rxjs';
import * as path from 'path';
import { ExportService } from './export.service';
import { ExportShortDto } from '@youtube-shorter/shared';
import type { ExportProgressEvent } from '@youtube-shorter/shared';

@Controller('api/projects/:projectId/shorts/:shortId/export')
export class ExportController {
    // Store active SSE subjects per short export job
    private exportSubjects = new Map<string, Subject<ExportProgressEvent>>();

    constructor(private readonly exportService: ExportService) { }

    @Post()
    async requestExport(
        @Param('projectId') projectId: string,
        @Param('shortId') shortId: string,
        @Body() dto: ExportShortDto,
    ): Promise<{ success: boolean; message: string; exportUrl?: string }> {
        if (dto.shortId !== shortId) {
            throw new BadRequestException('Path shortId must match body shortId');
        }

        // Create new subject for SSE
        const exportKey = `${projectId}_${shortId}`;
        let subject = this.exportSubjects.get(exportKey);
        if (!subject) {
            subject = new Subject<ExportProgressEvent>();
            this.exportSubjects.set(exportKey, subject);
        }

        try {
            // Non-blocking trigger of export logic. Handled via async
            void this.exportService.exportShort(projectId, dto, subject)
                .then((filename) => {
                    const exportUrl = `/api/projects/${projectId}/shorts/${shortId}/export/download/${filename}`;
                    subject!.next({
                        phase: 'complete',
                        progress: 100,
                        message: 'Ready',
                        shortId,
                        exportUrl
                    });
                    this.exportSubjects.delete(exportKey);
                })
                .catch(() => {
                    this.exportSubjects.delete(exportKey);
                });

            return { success: true, message: 'Export job registered and started' };
        } catch (error) {
            this.exportSubjects.delete(exportKey);
            throw error;
        }
    }

    @Sse('progress')
    exportProgress(
        @Param('projectId') projectId: string,
        @Param('shortId') shortId: string,
    ): Observable<MessageEvent> {
        const exportKey = `${projectId}_${shortId}`;
        let subject = this.exportSubjects.get(exportKey);

        // If client connects after job completion or before start, just send an idle event
        if (!subject) {
            subject = new Subject<ExportProgressEvent>();
            setTimeout(() => {
                subject!.complete();
            }, 500);
        }

        return subject.pipe(
            map((event) => ({
                type: 'export-progress',
                data: event,
            } as MessageEvent)),
        );
    }

    @Get('download/:filename')
    downloadExport(
        @Param('filename') filename: string,
        @Res() res: any,
    ): void {
        // Security check: only allow .mp4 files and alphanumeric/dash names
        if (!/^[a-zA-Z0-0123456789-_]+\.mp4$/.test(filename)) {
            throw new BadRequestException('Invalid filename');
        }

        const filePath = path.join(process.cwd(), 'uploads', 'exports', filename);
        res.download(filePath, filename);
    }
}
