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
import { parseSrt, stringifySrt, formatSrtTime } from './utils/srt-parser.util';
import { FFmpegService } from '../../workers/ffmpeg.service';
import { SettingsService } from '../settings/settings.service';
import {
  AnalysisProgressEvent,
  DetectedSegment,
  UpdateShortSegmentsDto,
  ShortResponse,
  WordTiming,
  reconcileWords,
  distributeWordsUniformly,
} from '@youtube-shorter/shared';
import { WhisperChunk } from './whisper.service';

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
    private readonly settingsService: SettingsService,
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

      // Extract frames based on user settings
      const settings = await this.settingsService.getSettings();
      const interval = settings.frameInterval || 3.0;
      const maxFrames = Math.floor(duration / interval);
      const frames = await this.extractFramesForAnalysis(
        project.videoPath,
        duration,
        maxFrames,
        interval,
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
      let transcriptChunks: WhisperChunk[] = [];

      try {
        try {
          // Extract audio
          await this.ffmpegService.extractAudio(project.videoPath, audioPath);

          const useGeminiForSubtitles =
            process.env.USE_GEMINI_SUBTITLES === 'true';

          if (useGeminiForSubtitles) {
            // Read audio buffer
            const audioBuffer = await fs.readFile(audioPath);
            const srt = await this.geminiService.generateSubtitles(audioBuffer);
            // Convert Gemini SRT to Chunks for consistency
            transcriptChunks = parseSrt(srt).map((s) => ({
              startTime: s.startTime,
              endTime: s.endTime,
              text: s.text,
              words: distributeWordsUniformly(s.text, s.startTime, s.endTime),
            }));
          } else {
            // Generate subtitles using local WhisperX instead of Gemini
            transcriptChunks =
              await this.whisperService.generateSubtitlesWithWords(audioPath);
          }

          // Re-generate raw SRT for project transcript storage (backward compatibility)
          const transcript = transcriptChunks
            .map(
              (c, i) =>
                `${i + 1}\n${formatSrtTime(c.startTime)} --> ${formatSrtTime(c.endTime)}\n${c.text}\n`,
            )
            .join('\n');

          // Save transcript to project
          if (transcript) {
            project.transcript = transcript;
            await this.projectRepository.save(project);
            this.logger.log(
              `[Analysis] Transcript saved for project ${projectId} (${transcript.length} chars).`,
            );
          }
        } finally {
          // Cleanup audio file immediately after transcription attempt
          await fs.unlink(audioPath).catch(() => {});
        }
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
        // Read audio buffer if available for multimodal analysis
        let audioBuffer: Buffer | undefined;
        try {
          if (
            await fs
              .stat(audioPath)
              .then(() => true)
              .catch(() => false)
          ) {
            audioBuffer = await fs.readFile(audioPath);
          }
        } catch (e) {
          this.logger.warn(
            `Could not read audio for analysis: ${(e as Error).message}`,
          );
        }

        detected = await this.geminiService.detectShortsCandidates(
          frames,
          duration,
          project.transcript,
          audioBuffer,
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
        transcriptChunks,
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
    interval: number,
  ): Promise<string[]> {
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
    allSubtitles: WhisperChunk[],
    detected: DetectedSegment[],
  ): Promise<Short[]> {
    // Create thumbnails directory if not exists
    const thumbnailsDir = path.join(process.cwd(), 'uploads', 'thumbnails');
    await fs.mkdir(thumbnailsDir, { recursive: true });

    // (transcript is now passed as WhisperChunk[])

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
          // Check if we already created this subtitle for a previous short
          // Though to truly share the entity between shorts, TypeORM requires a ManyToMany relationship,
          // but the current schema uses ManyToOne (a subtitle belongs to strictly ONE short).
          // To fix this without schema migrations, we will duplicate the row but ensure it's
          // tied explicitly to the precise Short bounds to prevent orphaned references.
        );

        if (segmentSubtitles.length > 0) {
          const subtitleEntities = segmentSubtitles.map((sub, index) => {
            return this.subtitleRepository.create({
              shortId: short.id,
              startTime: sub.startTime,
              endTime: sub.endTime,
              text: sub.text,
              words: sub.words,
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
  ): Promise<Subtitle> {
    const subtitle = await this.subtitleRepository.findOne({
      where: { id: subtitleId, short: { id: shortId, projectId } },
      relations: ['short'],
    });
    if (!subtitle) {
      throw new NotFoundException(`Subtitle ${subtitleId} not found`);
    }

    // Smart reconciliation of word timings
    if (subtitle.words && (subtitle.words as any[]).length > 0) {
      subtitle.words = reconcileWords(
        subtitle.words as WordTiming[],
        textDto.text,
        subtitle.startTime,
        subtitle.endTime,
      );
    } else {
      // Fallback for uniform distribution if no words existed
      subtitle.words = distributeWordsUniformly(
        textDto.text,
        subtitle.startTime,
        subtitle.endTime,
      );
    }

    subtitle.text = textDto.text;
    const savedSubtitle = await this.subtitleRepository.save(subtitle);

    // 2. Persist change back to Project transcript so it's not lost on segment updates
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (project && project.transcript) {
      const allSubtitles = parseSrt(project.transcript);
      // Find matching subtitle in master transcript by original timing
      // Using a small epsilon for float comparison
      const EPSILON = 0.001;
      const masterSub = allSubtitles.find(
        (s) =>
          Math.abs(s.startTime - subtitle.startTime) < EPSILON &&
          Math.abs(s.endTime - subtitle.endTime) < EPSILON,
      );

      if (masterSub) {
        masterSub.text = textDto.text;
        project.transcript = stringifySrt(allSubtitles);
        await this.projectRepository.save(project);
        this.logger.debug(
          `Persisted subtitle correction to master transcript for project ${projectId}`,
        );
      }
    }

    return savedSubtitle;
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
      const allSubtitles = project.transcript
        ? parseSrt(project.transcript)
        : [];
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
            words: distributeWordsUniformly(
              sub.text,
              sub.startTime,
              sub.endTime,
            ),
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

  /**
   * Manually create a custom Short instantly.
   * Extracts subtitles from the master transcript for the chosen timeframe,
   * generates a thumbnail image from the video, and populates default vertical smart crop.
   */
  async createShort(
    projectId: string,
    createDto?: { title?: string; startTime?: number; endTime?: number },
  ): Promise<Short> {
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    // Determine the next order index
    const existingShorts = await this.shortRepository.find({
      where: { projectId },
      order: { orderIndex: 'DESC' },
    });
    const orderIndex =
      existingShorts.length > 0 ? existingShorts[0].orderIndex + 1 : 0;

    const title = createDto?.title || `Custom Short ${orderIndex + 1}`;
    const startTime =
      createDto?.startTime !== undefined ? createDto.startTime : 0.0;

    // Fetch duration from metadata, fallback to 30.0
    const metadata = await this.ffmpegService
      .extractMetadata(project.videoPath)
      .catch(() => null);
    const duration = metadata?.duration || 30.0;
    const endTime =
      createDto?.endTime !== undefined
        ? createDto.endTime
        : Math.min(30.0, duration);

    // Create the Short entity with default vertical crop and segments
    let short = this.shortRepository.create({
      projectId,
      title,
      description: 'Manually created short',
      startTime,
      endTime,
      confidence: 100,
      smartCropData: { centerX: 0.5, width: 0.5625 },
      orderIndex,
      segments: [
        {
          startTime,
          endTime,
          layoutTimeline: [],
        },
      ],
    });
    short = await this.shortRepository.save(short);

    // Sync subtitles from master project transcript
    if (project.transcript) {
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
            words: distributeWordsUniformly(
              sub.text,
              sub.startTime,
              sub.endTime,
            ),
            orderIndex: index,
          });
        });
        await this.subtitleRepository.save(subtitleEntities);
      }
    }

    // Generate thumbnail at midpoint using FFmpeg Service
    try {
      const thumbnailsDir = path.join(process.cwd(), 'uploads', 'thumbnails');
      await fs.mkdir(thumbnailsDir, { recursive: true });

      const midpoint = (short.startTime + short.endTime) / 2;
      const filename = `${short.id}.jpg`;
      const thumbnailPath = path.join(thumbnailsDir, filename);

      await this.ffmpegService.extractThumbnail(
        project.videoPath,
        thumbnailPath,
        midpoint,
      );

      short.thumbnailPath = thumbnailPath;
      short = await this.shortRepository.save(short);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Thumbnail generation failed for custom short ${short.id}: ${errorMessage}`,
      );
    }

    // Retrieve and return the saved short with its subtitles
    const savedShort = await this.shortRepository.findOne({
      where: { id: short.id },
      relations: ['subtitles'],
      order: { subtitles: { startTime: 'ASC' } } as FindOptionsOrder<Short>,
    });

    if (!savedShort) {
      throw new NotFoundException(`Short ${short.id} not found after creation`);
    }

    return savedShort;
  }
}
