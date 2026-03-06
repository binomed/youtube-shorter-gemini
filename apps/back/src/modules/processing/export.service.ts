import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Subject } from 'rxjs';
import { Short } from '../../entities/short.entity';
import { Project } from '../../entities/project.entity';
import { FFmpegService } from '../../workers/ffmpeg.service';
import { JobService } from './job.service';
import { ExportShortDto } from '@youtube-shorter/shared';
import type { ExportProgressEvent, SubtitleStyle, SubtitleResponse } from '@youtube-shorter/shared';

@Injectable()
export class ExportService {
    private readonly logger = new Logger(ExportService.name);

    constructor(
        @InjectRepository(Short)
        private readonly shortRepository: Repository<Short>,
        @InjectRepository(Project)
        private readonly projectRepository: Repository<Project>,
        private readonly ffmpegService: FFmpegService,
        private readonly jobService: JobService,
    ) { }

    /**
     * Run high-quality export for a specific Short.
     * Uses SQL-Queue for job processing and emits SSE progress.
     */
    async exportShort(
        projectId: string,
        dto: ExportShortDto,
        progress$?: Subject<ExportProgressEvent>,
    ): Promise<string> {
        const project = await this.projectRepository.findOneBy({ id: projectId });
        if (!project) {
            throw new NotFoundException(`Project ${projectId} not found`);
        }

        const short = await this.shortRepository.findOne({
            where: { id: dto.shortId, projectId },
            relations: ['subtitles'],
        });
        if (!short) {
            throw new NotFoundException(`Short ${dto.shortId} not found`);
        }

        const job = await this.jobService.create({
            type: 'export',
            projectId,
            shortId: dto.shortId,
        });

        const tempDir = '/tmp/yts-processing';
        await fs.mkdir(tempDir, { recursive: true }).catch(() => { });

        // Unique ID for this export run
        const exportId = `export-${Date.now()}-${short.id}`;
        const outputPath = path.join(process.cwd(), 'uploads', 'exports', `${exportId}.mp4`);
        const assPath = path.join(tempDir, `${exportId}.ass`);

        // Create exports directory if missing
        await fs.mkdir(path.dirname(outputPath), { recursive: true }).catch(() => { });

        try {
            await this.persistAndEmitProgress(job.id, progress$, {
                phase: 'extracting',
                progress: 10,
                message: 'Gathering short segments...',
                shortId: short.id,
            });

            // 1. Resolve segments to render
            let segmentPaths: string[] = [];
            const tempSegmentsToClean: string[] = [];
            const segmentsToProcess = short.segments?.length ? short.segments : [{ startTime: short.startTime, endTime: short.endTime }];

            await this.persistAndEmitProgress(job.id, progress$, {
                phase: 'processing',
                progress: 20,
                message: 'Extracting jump cut segments...',
                shortId: short.id,
            });

            segmentPaths = await this.ffmpegService.splitVideoIntoSegments(
                project.videoPath,
                segmentsToProcess,
                (p) => {
                    const pg = 20 + Math.floor(p * 0.3);
                    if (progress$) progress$.next({ phase: 'processing', progress: pg, message: 'Extracting...', shortId: short.id });
                }
            );
            tempSegmentsToClean.push(...segmentPaths);

            // 2. Build `.ass` subtitles file if subtitles exist
            await this.persistAndEmitProgress(job.id, progress$, {
                phase: 'processing',
                progress: 55,
                message: 'Generating subtitle styling...',
                shortId: short.id,
            });

            let subtitleAssPath: string | undefined = undefined;
            if (short.subtitles && short.subtitles.length > 0) {
                let currentOffset = 0;
                const adjustedSubs: SubtitleResponse[] = [];

                for (const seg of segmentsToProcess) {
                    const segDuration = seg.endTime - seg.startTime;
                    const subsInSeg = short.subtitles.filter(s => s.startTime < seg.endTime && s.endTime > seg.startTime);

                    for (const s of subsInSeg) {
                        const subStart = Math.max(s.startTime, seg.startTime);
                        const subEnd = Math.min(s.endTime, seg.endTime);
                        const newStart = currentOffset + (subStart - seg.startTime);
                        const newEnd = currentOffset + (subEnd - seg.startTime);
                        adjustedSubs.push({ ...s, startTime: newStart, endTime: newEnd });
                    }
                    currentOffset += segDuration;
                }

                const assContent = this.generateAssFile(adjustedSubs, short.subtitleStyle);
                await fs.writeFile(assPath, assContent);
                const absoluteAssPath = await fs.realpath(assPath);
                this.logger.log(`ASS generated (real path): ${absoluteAssPath}`);
                this.logger.log(`ASS Content Sample: ${assContent.split('Dialogue:')[1]?.substring(0, 100)}`);

                subtitleAssPath = absoluteAssPath;
                tempSegmentsToClean.push(absoluteAssPath);
            } else {
                this.logger.warn(`No subtitles found or adjusted for short ${short.id}`);
            }

            // 3. Render vertical video with FFmpeg
            await this.persistAndEmitProgress(job.id, progress$, {
                phase: 'saving',
                progress: 60,
                message: 'Encoding final vertical video (this may take a while)...',
                shortId: short.id,
            });

            const options = {
                subtitleAssPath,
                vocalsPath: dto.includeVocals ? short.vocalsPath ?? undefined : undefined,
                musicPath: dto.includeMusic ? short.accompanimentPath ?? undefined : undefined,
                onProgress: (p: number, msg: string) => {
                    const pg = 60 + Math.floor(p * 0.35); // maps 0-100 to 60-95
                    if (progress$) progress$.next({ phase: 'saving', progress: pg, message: msg, shortId: short.id });
                }
            };

            await this.ffmpegService.concatenateAndRenderVertical(segmentPaths, outputPath, options);

            await this.persistAndEmitProgress(job.id, progress$, {
                phase: 'complete',
                progress: 100,
                message: 'Export completed successfully!',
                shortId: short.id,
            });

            await this.jobService.complete(job.id);

            for (const p of tempSegmentsToClean) {
                await fs.unlink(p).catch(e => this.logger.warn(`Failed to cleanup ${p}: ${e.message}`));
            }

            return `${exportId}.mp4`;

        } catch (error) {
            const errorMessage = (error as Error).message;
            await this.jobService.fail(job.id, errorMessage);
            this.emitProgress(progress$, {
                phase: 'error',
                progress: 0,
                message: `Export failed: ${errorMessage}`,
                shortId: short.id,
            });
            await fs.unlink(outputPath).catch(() => { });
            throw error;
        }
    }

    private generateAssFile(subtitles: SubtitleResponse[], style?: SubtitleStyle): string {
        // 1. Sanitize Font Name: Extract exact TTF font name for ffmpeg fontsdir matching
        let rawFontName = style?.font || 'inherit';
        let fontName = 'Roboto-Bold'; // Default fallback mapped to our TTF

        if (rawFontName.includes('Montserrat')) fontName = 'Montserrat';
        else if (rawFontName.includes('Oswald')) fontName = 'Oswald';
        else if (rawFontName.includes('Impact')) fontName = 'Impact';
        else if (rawFontName.includes('Roboto')) fontName = 'Roboto';

        const fontSize = style?.fontSize || 80;

        // 2. Color Conversion Helper: Handles #RGB, #RRGGBB, #RRGGBBAA, and rgba()
        const toAssColor = (cssColor: string | undefined, defaultAss: string): string => {
            if (!cssColor) return defaultAss;

            try {
                let r = 255, g = 255, b = 255, a = 0; // ASS alpha is 0 (opaque) to 255 (transparent)

                if (cssColor.startsWith('#')) {
                    const hex = cssColor.substring(1);
                    if (hex.length === 3) {
                        r = parseInt(hex[0] + hex[0], 16);
                        g = parseInt(hex[1] + hex[1], 16);
                        b = parseInt(hex[2] + hex[2], 16);
                    } else if (hex.length === 6) {
                        r = parseInt(hex.substring(0, 2), 16);
                        g = parseInt(hex.substring(2, 4), 16);
                        b = parseInt(hex.substring(4, 6), 16);
                    } else if (hex.length === 8) {
                        r = parseInt(hex.substring(0, 2), 16);
                        g = parseInt(hex.substring(2, 4), 16);
                        b = parseInt(hex.substring(4, 6), 16);
                        a = 255 - parseInt(hex.substring(6, 8), 16);
                    }
                } else if (cssColor.startsWith('rgba') || cssColor.startsWith('rgb')) {
                    const match = cssColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
                    if (match) {
                        r = parseInt(match[1], 10);
                        g = parseInt(match[2], 10);
                        b = parseInt(match[3], 10);
                        const alpha = match[4] !== undefined ? parseFloat(match[4]) : 1;
                        a = Math.round(255 * (1 - alpha));
                    }
                } else if (cssColor === 'transparent') {
                    a = 255;
                } else {
                    return defaultAss;
                }

                // Ensure valid ranges and formats
                if (isNaN(r) || isNaN(g) || isNaN(b) || isNaN(a)) return defaultAss;

                // ASS format: &H AABBGGRR &
                const aa = a.toString(16).padStart(2, '0').toUpperCase();
                const bb = b.toString(16).padStart(2, '0').toUpperCase();
                const gg = g.toString(16).padStart(2, '0').toUpperCase();
                const rr = r.toString(16).padStart(2, '0').toUpperCase();
                return `&H${aa}${bb}${gg}${rr}&`;
            } catch (e) {
                return defaultAss;
            }
        };

        const colorPrimary = toAssColor(style?.color, '&H00FFFFFF&');
        const bgColor = toAssColor(style?.backgroundColor, '&H80000000&');

        // Frontend transparent is 'transparent', causing bgColor to be &HFFFFFFFF&
        const isTransparentBox = bgColor.startsWith('&HFF') || bgColor === '&H00000000&';

        // CSS text-shadow: 1px 1px 3px rgba(0,0,0,0.8);
        const shadowDepth = 3;
        const shadowColor = '&H33000000&'; // &H33 mapping to roughly 0.8 opacity

        // Use BorderStyle 4 (Uniform Background Box) to match the CSS frontend's rectangular shape.
        // BorderStyle 4 natively treats the entire text block as a single unified bounding box, solving 
        // the transparent overlapping artifacts between multiline text that occurs in BorderStyle=3.
        const marginLR = isTransparentBox ? 10 : 25;

        // 3. Correct MarginV: Frontend uses 20% padding-bottom + translateY offset
        // In 1920 height, 20% is 384. Subtract positionY pixel offset.
        const baseMarginBottom = 384;
        const offsetY = style?.positionY || 0;
        const marginV = Math.max(10, baseMarginBottom - offsetY);

        const transparentColor = '&HFFFFFFFF&';

        let ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes
WrapStyle: 1

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: BgLayer,${fontName},${fontSize},${transparentColor},${transparentColor},${transparentColor},${bgColor},-1,0,0,0,100,100,0,0,4,20,0,2,${marginLR},${marginLR},${marginV.toFixed(0)},1
Style: TextLayer,${fontName},${fontSize},${colorPrimary},&H000000FF&,${transparentColor},${shadowColor},-1,0,0,0,100,100,0,0,1,0,${shadowDepth},2,10,10,${marginV.toFixed(0)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

        for (const sub of subtitles) {
            const start = this.formatAssTime(sub.startTime);
            const end = this.formatAssTime(sub.endTime);
            const text = sub.text.replace(/\n/g, '\\N');

            if (!isTransparentBox) {
                // Layer 0: Uniform background box (BorderStyle 4) that automatically surrounds multiline text
                ass += `Dialogue: 0,${start},${end},BgLayer,,0,0,0,,${text}\n`;
            }
            // Layer 1: Text directly on top
            ass += `Dialogue: 1,${start},${end},TextLayer,,0,0,0,,${text}\n`;
        }

        return ass;
    }

    private formatAssTime(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }

    private async persistAndEmitProgress(
        jobId: string,
        progress$: Subject<ExportProgressEvent> | undefined,
        event: ExportProgressEvent,
    ): Promise<void> {
        await this.jobService.updateProgress(jobId, event.progress, event.message);
        this.emitProgress(progress$, event);
    }

    private emitProgress(
        progress$: Subject<ExportProgressEvent> | undefined,
        event: ExportProgressEvent,
    ): void {
        if (progress$) {
            progress$.next(event);
        }
    }
}
