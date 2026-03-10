// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsOrder } from 'typeorm';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { Short } from '../../entities/short.entity';
import { Subtitle } from '../../entities/subtitle.entity';
import { Project } from '../../entities/project.entity';
import {
  UpdateSubtitleStyleDto,
  UpdateSubtitleTextDto,
} from './dto/update-subtitle.dto';
import { GeminiService } from './gemini.service';
import { WhisperService } from './whisper.service';
import { StemService } from './stem.service';
import { JobProgressService } from '../processing/job-progress.service';
import { parseSrt } from './utils/srt-parser.util';
import { FFmpegService } from '../../workers/ffmpeg.service';
import {
  AnalysisProgressEvent,
  DetectedSegment,
  UpdateShortSegmentsDto,
  ShortResponse,
} from '@youtube-shorter/shared';

export type { AnalysisProgressEvent };

export interface AnalysisResponse {
  projectId: string;
  count: number;
  shorts: ShortResponse[];
  jobId: string;
}

/**
 * Orchestrates the full analysis pipeline:
 * 1. Extract frames from video (FFmpeg)
 * 2. Send frames to Gemini for viral detection
 * 3. Save detected Shorts to database
 *
 * Emits SSE progress events through an observable.
 */
@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    @InjectRepository(Short)
    private readonly shortRepository: Repository<Short>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Subtitle)
    private readonly subtitleRepository: Repository<Subtitle>,
    private readonly geminiService: GeminiService,
    private readonly ffmpegService: FFmpegService,
    private readonly whisperService: WhisperService,
    private readonly stemService: StemService,
    private readonly jobProgressService: JobProgressService,
  ) {}

  /**
   * Run full analysis pipeline for a project.
   * Emits progress events via JobProgressService for SSE streaming.
   *
   * @param projectId - UUID of the project to analyze
   * @param jobId - Unified JobId for progress tracking
   * @returns Array of created Short entities
   */
  async analyzeProject(projectId: string, jobId: string): Promise<Short[]> {
    // 1. Validate project exists
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    try {
      // Phase 1: Extract frames
      await this.jobProgressService.emit(jobId, {
        phase: 'extracting_frames',
        progress: 10,
        message: 'Extracting video frames...',
      });

      const metadata = await this.ffmpegService.extractMetadata(
        project.videoPath,
      );
      const duration = metadata?.duration || 60;

      // Extract 1 frame every 3 seconds for detailed visual tracking without overloading Gemini
      const maxFrames = Math.floor(duration / 3);
      const frames = await this.extractFramesForAnalysis(
        project.videoPath,
        duration,
        maxFrames,
      );
      this.logger.log(
        `[Analysis] Extracted ${frames.length} frames. Duration: ${duration}s.`,
      );

      await this.jobProgressService.emit(jobId, {
        phase: 'extracting_frames',
        progress: 30,
        message: `Extracted ${frames.length} frames for analysis`,
      });

      // Phase 2: Audio Transcription
      await this.jobProgressService.emit(jobId, {
        phase: 'transcribing',
        progress: 40,
        message: 'Extracting audio and generating subtitles...',
      });

      const audioPath = path.join(os.tmpdir(), `yts-audio-${Date.now()}.mp3`);
      let transcript = '';

      try {
        // Extract audio
        await this.ffmpegService.extractAudio(project.videoPath, audioPath);

        const useGeminiForSubtitles =
          process.env.USE_GEMINI_SUBTITLES === 'true';

        if (useGeminiForSubtitles) {
          // Read audio buffer
          const audioBuffer = await fs.readFile(audioPath);
          transcript = await this.geminiService.generateSubtitles(audioBuffer);
        } else {
          // Generate subtitles using local WhisperX instead of Gemini
          transcript = await this.whisperService.generateSubtitles(audioPath);
        }

        // Save transcript to project
        if (transcript) {
          project.transcript = transcript;
          await this.projectRepository.save(project);
          this.logger.log(
            `[Analysis] Transcript saved for project ${projectId} (${transcript.length} chars). Preview: ${transcript.substring(0, 50)}...`,
          );
        }

        // Cleanup audio file
        await fs.unlink(audioPath).catch(() => {});
      } catch (error) {
        this.logger.warn(`Transcription failed: ${(error as Error).message}`);
        // Continue without transcript
      }

      // Phase 3: Gemini analysis (Viral Detection)
      await this.jobProgressService.emit(jobId, {
        phase: 'analyzing',
        progress: 60,
        message: 'Analyzing video content (visuals + audio)...',
      });

      let detected: DetectedSegment[] = [];
      try {
        detected = await this.geminiService.detectShortsCandidates(
          frames,
          duration,
          transcript,
        );
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'GeminiParseError') {
          await this.jobProgressService.emit(jobId, {
            phase: 'error',
            progress: 80,
            message: `AI error: failed to understand the video structure. Please try again.`,
          });
        }
        throw error;
      }

      this.logger.log(
        `[Analysis] Gemini detected ${detected.length} potential Shorts.`,
      );
      await this.jobProgressService.emit(jobId, {
        phase: 'analyzing',
        progress: 80,
        message: `Gemini detected ${detected.length} potential Shorts`,
      });

      // Phase 4: Save results
      await this.jobProgressService.emit(jobId, {
        phase: 'saving',
        progress: 90,
        message: 'Saving Shorts to database...',
      });

      // Delete existing shorts for this project (re-analysis)
      await this.shortRepository.delete({ projectId });

      const shorts = await this.saveDetectedShorts(
        projectId,
        project.videoPath,
        transcript,
        detected,
      );

      await this.jobProgressService.emit(jobId, {
        phase: 'complete',
        progress: 100,
        message: `Analysis complete! ${shorts.length} Shorts detected.`,
      });

      // Mark Job as COMPLETED in DB
      await this.jobProgressService.complete(jobId);

      return shorts;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`Viral detection failed: ${errorMessage}`);
      await this.jobProgressService.fail(jobId, errorMessage);
      throw error;
    }
  }

  /**
   * Get all shorts for a project, ordered by confidence (highest first).
   */
  async getShortsByProject(projectId: string): Promise<Short[]> {
    return this.shortRepository.find({
      where: { projectId },
      order: { orderIndex: 'ASC' },
      relations: ['subtitles'],
    });
  }

  /**
   * Get the thumbnail path for a specific short
   */
  async getThumbnailPath(projectId: string, shortId: string): Promise<string> {
    const short = await this.shortRepository.findOne({
      where: { id: shortId, projectId },
    });

    if (!short) {
      throw new NotFoundException(
        `Short ${shortId} not found in project ${projectId}`,
      );
    }

    if (!short.thumbnailPath) {
      throw new NotFoundException(`Thumbnail not found for short ${shortId}`);
    }

    return short.thumbnailPath;
  }

  /**
   * Extract frames at regular intervals using FFmpeg for AI analysis.
   * Follows the Gemini skill's frame sampling strategy.
   */
  private async extractFramesForAnalysis(
    videoPath: string,
    duration: number,
    maxFrames: number,
  ): Promise<string[]> {
    const interval = Math.max(1, Math.floor(duration / maxFrames));
    const frames: string[] = [];
    const tmpDir = path.join(os.tmpdir(), `yts-frames-${Date.now()}`);

    await fs.mkdir(tmpDir, { recursive: true });

    try {
      for (let i = 0; i < maxFrames && i * interval < duration; i++) {
        const timestamp = i * interval;
        const outputPath = path.join(tmpDir, `frame-${i}.jpg`);

        await this.ffmpegService.extractThumbnail(
          videoPath,
          outputPath,
          timestamp,
          512,
        );

        const frameBuffer = await fs.readFile(outputPath);
        frames.push(frameBuffer.toString('base64'));
      }
    } finally {
      // Cleanup temp directory
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }

    this.logger.log(`Extracted ${frames.length} frames from video`);
    return frames;
  }

  /**
   * Save detected segments as Short entities in the database.
   */
  private async saveDetectedShorts(
    projectId: string,
    videoPath: string,
    transcript: string | undefined,
    detected: DetectedSegment[],
  ): Promise<Short[]> {
    // Create thumbnails directory if not exists
    const thumbnailsDir = path.join(process.cwd(), 'uploads', 'thumbnails');
    await fs.mkdir(thumbnailsDir, { recursive: true });

    // Parse transcript once if available
    const allSubtitles = transcript ? parseSrt(transcript) : [];

    // Sort by confidence (highest first) and assign order
    const sorted = [...detected].sort((a, b) => b.confidence - a.confidence);

    const shorts: Short[] = [];
    for (let i = 0; i < sorted.length; i++) {
      const seg = sorted[i];

      // Create short first to get ID
      let short = this.shortRepository.create({
        projectId,
        title: `Viral Moment ${i + 1}`,
        description: seg.reason,
        startTime: seg.startTime,
        endTime: seg.endTime,
        confidence: seg.confidence,
        smartCropData: seg.smartCropData,
        orderIndex: i,
      });
      short = await this.shortRepository.save(short);

      // Save corresponding subtitles
      if (allSubtitles.length > 0) {
        const segmentSubtitles = allSubtitles.filter(
          (sub) =>
            sub.startTime <= short.endTime && sub.endTime >= short.startTime,
        );

        if (segmentSubtitles.length > 0) {
          const subtitleEntities = segmentSubtitles.map((sub, index) => {
            // Check if we already created this subtitle for a previous short
            // Though to truly share the entity between shorts, TypeORM requires a ManyToMany relationship,
            // but the current schema uses ManyToOne (a subtitle belongs to strictly ONE short).
            // To fix this without schema migrations, we will duplicate the row but ensure it's
            // tied explicitly to the precise Short bounds to prevent orphaned references.
            return this.subtitleRepository.create({
              shortId: short.id,
              startTime: sub.startTime,
              endTime: sub.endTime,
              text: sub.text,
              orderIndex: index,
            });
          });
          await this.subtitleRepository.save(subtitleEntities);
        }
      }

      // Generate thumbnail at midpoint
      try {
        const segTyped = seg;
        const midpoint = (segTyped.startTime + segTyped.endTime) / 2;
        const filename = `${short.id}.jpg`;
        const thumbnailPath = path.join(thumbnailsDir, filename);

        await this.ffmpegService.extractThumbnail(
          videoPath,
          thumbnailPath,
          midpoint,
        );

        short.thumbnailPath = thumbnailPath;
        short = await this.shortRepository.save(short);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Thumbnail generation failed for short ${short.id}: ${errorMessage}`,
        );
      }

      shorts.push(short);
    }

    this.logger.log(`Saved ${shorts.length} shorts for project ${projectId}`);
    return shorts;
  }

  async updateSubtitleStyle(
    projectId: string,
    shortId: string,
    styleDto: UpdateSubtitleStyleDto,
  ): Promise<void> {
    const short = await this.shortRepository.findOne({
      where: { id: shortId, projectId },
    });
    if (!short) {
      throw new NotFoundException(`Short ${shortId} not found`);
    }

    short.subtitleStyle = {
      ...((short.subtitleStyle as Record<string, unknown>) || {}),
      ...styleDto,
    };
    await this.shortRepository.save(short);
  }

  async updateSubtitleText(
    projectId: string,
    shortId: string,
    subtitleId: string,
    textDto: UpdateSubtitleTextDto,
  ): Promise<void> {
    const subtitle = await this.subtitleRepository.findOne({
      where: { id: subtitleId, short: { id: shortId, projectId } },
      relations: ['short'],
    });
    if (!subtitle) {
      throw new NotFoundException(`Subtitle ${subtitleId} not found`);
    }

    subtitle.text = textDto.text;
    await this.subtitleRepository.save(subtitle);
  }

  /**
   * Update segments for a short manually (Epic 4.1).
   * Also invalidates stems as the cuts have changed.
   */
  async updateShortSegments(
    projectId: string,
    shortId: string,
    updateDto: UpdateShortSegmentsDto,
  ): Promise<Short> {
    const short = await this.shortRepository.findOne({
      where: { id: shortId, projectId },
    });
    if (!short) {
      throw new NotFoundException(`Short ${shortId} not found`);
    }

    // 1. Update basic boundaries
    short.segments = updateDto.segments;
    if (updateDto.segments.length > 0) {
      short.startTime = Math.min(...updateDto.segments.map((s) => s.startTime));
      short.endTime = Math.max(...updateDto.segments.map((s) => s.endTime));
    }
    await this.shortRepository.save(short);

    // 2. Sync Subtitles from master transcript
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (project && project.transcript) {
      this.logger.log(
        `Re-syncing subtitles for short ${shortId} from project transcript`,
      );

      // Clear existing subtitles for this short
      await this.subtitleRepository.delete({ shortId });

      // Parse and filter new subtitles
      const allSubtitles = parseSrt(project.transcript);
      const segmentSubtitles = allSubtitles.filter(
        (sub) =>
          sub.startTime <= short.endTime && sub.endTime >= short.startTime,
      );

      if (segmentSubtitles.length > 0) {
        const subtitleEntities = segmentSubtitles.map((sub, index) => {
          return this.subtitleRepository.create({
            shortId: short.id,
            startTime: sub.startTime,
            endTime: sub.endTime,
            text: sub.text,
            orderIndex: index,
          });
        });
        await this.subtitleRepository.save(subtitleEntities);
        this.logger.debug(
          `Saved ${subtitleEntities.length} new subtitles for short ${shortId}`,
        );
      }
    }

    // 3. Invalidate stems when segments change
    await this.stemService.invalidateStems(shortId);

    // 4. Return the updated short with its new subtitles
    const updatedShort = await this.shortRepository.findOne({
      where: { id: shortId },
      relations: { subtitles: true },
      order: { subtitles: { startTime: 'ASC' } } as FindOptionsOrder<Short>,
    });

    if (!updatedShort) {
      throw new NotFoundException(`Short ${shortId} not found after update`);
    }

    this.logger.debug(
      `Returning short ${shortId} with ${updatedShort.subtitles?.length || 0} subtitles`,
    );

    return updatedShort;
  }
}
