import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs/promises';
import { Short } from '../../entities/short.entity';
import { Project } from '../../entities/project.entity';
import { FFmpegService } from '../../workers/ffmpeg.service';
import { JobService } from './job.service';
import { JobProgressService } from './job-progress.service';
import { ExportShortDto } from '@youtube-shorter/shared';
import type {
  SubtitleResponse,
  SubtitleStyle,
  VideoSegment,
} from '@youtube-shorter/shared';

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
    private readonly jobProgressService: JobProgressService,
  ) {}

  /**
   * Run high-quality export for a specific Short.
   * Uses SQL-Queue for job processing and emits SSE progress.
   */
  async exportShort(
    projectId: string,
    dto: ExportShortDto,
    jobId: string,
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

    const tempDir = '/tmp/yts-processing';
    await fs.mkdir(tempDir, { recursive: true }).catch(() => {});

    // Unique ID for this export run
    const exportId = `export-${Date.now()}-${short.id}`;
    const outputPath = path.join(
      process.cwd(),
      'uploads',
      'exports',
      `${exportId}.mp4`,
    );
    const assPath = path.join(tempDir, `${exportId}.ass`);

    // Create exports directory if missing
    await fs
      .mkdir(path.dirname(outputPath), { recursive: true })
      .catch(() => {});

    const tempSegmentsToClean: string[] = [];

    try {
      await this.jobProgressService.emit(jobId, {
        phase: 'extracting',
        progress: 10,
        message: 'Segmenting video...',
        shortId: short.id,
      });

      // 1. Resolve and Flatten segments into atomic blocks
      const segmentsToProcess: Array<{ startTime: number; endTime: number }> =
        [];
      const layoutData: Array<{
        layoutMode: 'fill' | 'fullscreen';
        centerX: number;
      }> = [];

      const rawSegments: VideoSegment[] = short.segments?.length
        ? short.segments
        : [
            {
              startTime: short.startTime,
              endTime: short.endTime,
              layoutMode: 'fill',
              centerX: 0.5,
            } as VideoSegment,
          ];

      for (const seg of rawSegments) {
        if (!seg.layoutTimeline || seg.layoutTimeline.length === 0) {
          segmentsToProcess.push({
            startTime: seg.startTime,
            endTime: seg.endTime,
          });
          layoutData.push({
            layoutMode: seg.layoutMode || 'fill',
            centerX: seg.centerX ?? 0.5,
          });
        } else {
          // Sort events by timestamp ascending
          const events = [...seg.layoutTimeline].sort(
            (a, b) => a.timestamp - b.timestamp,
          );

          let lastTime = seg.startTime;
          let activeMode: 'fill' | 'fullscreen' = seg.layoutMode || 'fill';
          let activeCenter = seg.centerX ?? 0.5;

          for (const ev of events) {
            // Check if the current event is actually inside the segment bounds
            if (ev.timestamp > lastTime && ev.timestamp <= seg.endTime) {
              // Create a block from the previous time up to this new keyframe's time,
              // using the PREVIOUSLY active layout properties
              segmentsToProcess.push({
                startTime: lastTime,
                endTime: ev.timestamp,
              });
              layoutData.push({
                layoutMode: activeMode,
                centerX: activeCenter,
              });
              lastTime = ev.timestamp;
            }

            // NOW, update the active properties for the *next* block
            // However, ignore events that happen before the segment starts
            if (ev.timestamp >= seg.startTime) {
              activeMode = ev.layoutMode;
              activeCenter = ev.centerX;
            } else {
              // If an event occurs before the startTime, it becomes the baseline for the first block
              activeMode = ev.layoutMode;
              activeCenter = ev.centerX;
            }
          }

          // Final block from last event (or segment start) to segment end
          if (lastTime < seg.endTime) {
            segmentsToProcess.push({
              startTime: lastTime,
              endTime: seg.endTime,
            });
            layoutData.push({ layoutMode: activeMode, centerX: activeCenter });
          }
        }
      }

      const segmentPaths: string[] = [];
      for (let i = 0; i < segmentsToProcess.length; i++) {
        const seg = segmentsToProcess[i];
        const segPath = path.join(tempDir, `export-seg-${exportId}-${i}.mp4`);
        await this.ffmpegService.extractSegment(
          project.videoPath,
          segPath,
          seg.startTime,
          seg.endTime,
        );
        segmentPaths.push(segPath);
        tempSegmentsToClean.push(segPath);

        const p = Math.round(((i + 1) / segmentsToProcess.length) * 100);
        await this.jobProgressService.emit(jobId, {
          phase: 'processing',
          progress: 10 + Math.floor(p * 0.4), // 10% to 50%
          message: `Extracting segments: ${p}%`,
          shortId: short.id,
        });
      }

      // 2. Adjust Subtitle timestamps for concatenated segments
      const adjustedSubs: SubtitleResponse[] = [];
      let currentOffset = 0;

      for (const seg of segmentsToProcess) {
        const segDuration = seg.endTime - seg.startTime;
        const subsInSeg = (short.subtitles || []).filter(
          (s) => s.startTime < seg.endTime && s.endTime > seg.startTime,
        );

        for (const s of subsInSeg) {
          const subStart = Math.max(s.startTime, seg.startTime);
          const subEnd = Math.min(s.endTime, seg.endTime);
          const newStart = currentOffset + (subStart - seg.startTime);
          const newEnd = currentOffset + (subEnd - seg.startTime);
          adjustedSubs.push({
            ...s,
            startTime: newStart,
            endTime: newEnd,
            shortId: s.shortId,
          } as SubtitleResponse);
        }
        currentOffset += segDuration;
      }

      await this.jobProgressService.emit(jobId, {
        phase: 'rendering',
        progress: 60,
        message: 'Preparing captions...',
        shortId: short.id,
      });

      const assContent = this.generateAssFile(
        adjustedSubs,
        (dto.style || short.subtitleStyle) as SubtitleStyle,
      );
      await fs.writeFile(assPath, assContent);

      const absoluteAssPath = await fs.realpath(assPath);
      this.logger.log(`ASS generated (real path): ${absoluteAssPath}`);
      this.logger.log(
        `ASS Content Sample: ${assContent.split('Dialogue:')[1]?.substring(0, 100)}`,
      );
      tempSegmentsToClean.push(absoluteAssPath);

      // 3. Concatenate and Render
      await this.jobProgressService.emit(jobId, {
        phase: 'rendering',
        progress: 70,
        message: 'Mixing and rendering vertical...',
        shortId: short.id,
      });

      const options = {
        subtitleAssPath: absoluteAssPath,
        vocalsPath: dto.includeVocals
          ? (short.vocalsPath ?? undefined)
          : undefined,
        musicPath: dto.includeMusic
          ? (short.accompanimentPath ?? undefined)
          : undefined,
        layoutData: layoutData,
        onProgress: (p: number, msg: string) => {
          const pg = 70 + Math.floor(p * 0.25); // 70-95%
          void this.jobProgressService.emit(jobId, {
            phase: 'rendering',
            progress: pg,
            message: msg,
            shortId: short.id,
          });
        },
      };

      await this.ffmpegService.concatenateAndRenderVertical(
        segmentPaths,
        outputPath,
        options,
      );

      await this.jobProgressService.emit(jobId, {
        phase: 'complete',
        progress: 100,
        message: 'Export ready!',
        shortId: short.id,
      });

      // Mark Job as COMPLETED in DB
      await this.jobProgressService.complete(jobId);

      return `${exportId}.mp4`;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Export failed: ${errorMessage}`);
      await this.jobProgressService.fail(jobId, errorMessage);
      await fs.unlink(outputPath).catch(() => {});
      throw error;
    } finally {
      // Cleanup all temp files
      for (const p of tempSegmentsToClean) {
        await fs.unlink(p).catch(() => {});
      }
    }
  }

  private generateAssFile(
    subtitles: SubtitleResponse[],
    style?: SubtitleStyle,
  ): string {
    // 1. Sanitize Font Name: Extract exact TTF font name for ffmpeg fontsdir matching
    const rawFontName = style?.font || 'inherit';
    let fontName = 'Roboto-Bold'; // Default fallback mapped to our TTF

    if (rawFontName.includes('Montserrat')) fontName = 'Montserrat';
    else if (rawFontName.includes('Oswald')) fontName = 'Oswald';
    else if (rawFontName.includes('Impact')) fontName = 'Impact';
    else if (rawFontName.includes('Roboto')) fontName = 'Roboto';

    // 2. Resolution Scaling: Scale font size from UI Design Pixels (Reference Height 1000px) to Export (1920px)
    // If user sets 40px in UI, that's 4% of 1000px height. In 1920p, 4% is ~77px.
    const uiReferenceHeight = 1000;
    const exportHeight = 1920;
    const scaleFactor = exportHeight / uiReferenceHeight;
    const fontSize = Math.round((style?.fontSize || 40) * scaleFactor);

    // 3. Color Conversion Helper: Handles #RGB, #RRGGBB, #RRGGBBAA, and rgba()
    const toAssColor = (
      cssColor: string | undefined,
      defaultAss: string,
    ): string => {
      if (!cssColor) return defaultAss;

      try {
        let r = 255,
          g = 255,
          b = 255,
          a = 0; // ASS alpha is 0 (opaque) to 255 (transparent)

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
          const match = cssColor.match(
            /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/,
          );
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
      } catch {
        return defaultAss;
      }
    };

    const colorPrimary = toAssColor(style?.color, '&H00FFFFFF&');
    const bgColor = toAssColor(style?.backgroundColor, '&H80000000&');
    const borderColor = toAssColor(style?.borderColor, '&H00000000&');

    // 4. Alignment mapping: ASS Alignment (v4+)
    let alignment = 2; // Default centered
    if (style?.textAlign === 'left') alignment = 1;
    else if (style?.textAlign === 'right') alignment = 3;

    // 5. Border (Outline) mapping
    const borderEnabled = style?.borderEnabled ?? false;
    const borderWidth = borderEnabled
      ? Math.round((style?.borderWidth || 3) * scaleFactor)
      : 0;
    const assOutlineColor = borderEnabled ? borderColor : '&HFFFFFFFF&';

    // 6. Shadow mapping
    const shadowEnabled = style?.textShadow ?? true;
    const shadowDepth = shadowEnabled ? Math.round(3 * scaleFactor) : 0;
    const shadowColor = '&H33000000&'; // &H33 mapping to roughly 0.8 opacity

    // 7. Margin Parity: Match the frontend's 90% max-width (5% gap on each side)
    // 5% of 1080 horizontal res = 54px.
    const marginLR = 54;

    // Correct MarginV: Frontend uses 20% padding-bottom + translateY offset
    // 20% of 1920 height = 384px.
    const baseMarginBottom = 384;
    const offsetY = Math.round((style?.positionY || 0) * scaleFactor);
    const marginV = Math.max(10, baseMarginBottom - offsetY);

    const transparentColor = '&HFFFFFFFF&';

    // const textOutline = style?.textOutline || false;
    const isTransparentBox =
      style?.backgroundColor === 'transparent' ||
      style?.backgroundColor === 'rgba(0,0,0,0)' ||
      style?.backgroundColor === '#00000000';

    let ass = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes
WrapStyle: 1

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: BgLayer,${fontName},${fontSize},${transparentColor},${transparentColor},${transparentColor},${bgColor},-1,0,0,0,100,100,0,0,4,${Math.round(20 * scaleFactor)},0,${alignment},${marginLR},${marginLR},${marginV.toFixed(0)},1
Style: TextLayer,${fontName},${fontSize},${colorPrimary},&H000000FF&,${assOutlineColor},${shadowColor},-1,0,0,0,100,100,0,0,1,${borderWidth},${shadowDepth},${alignment},${marginLR},${marginLR},${marginV.toFixed(0)},1

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
}
