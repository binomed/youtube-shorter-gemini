// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { spawn } from 'child_process';
import { Subject } from 'rxjs';
import { Short } from '../../entities/short.entity';
import { Project } from '../../entities/project.entity';
import { FFmpegService } from '../../workers/ffmpeg.service';
import { JobService } from '../processing/job.service';
import type { StemProgressEvent } from '@youtube-shorter/shared';

import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * StemService handles audio stem separation for individual Shorts.
 *
 * Uses `demucs` (Facebook Research) as a CLI tool invoked via `child_process.spawn`.
 * The separation is triggered ON-DEMAND per Short (not the entire source video)
 * to save processing time.
 *
 * Pipeline:
 * 1. Extract the Short's audio segment from the source video (FFmpeg).
 * 2. Run `demucs` on the extracted audio to produce vocals + accompaniment stems.
 * 3. Store stem file paths on the Short entity.
 * 4. Persist progress via JobService (SQL-Queue) — survives server restarts.
 * 5. Emit SSE progress events for real-time UI updates.
 *
 * @see ADR-004: Reactive Job System avec SQL-Queue
 * @service
 */
@Injectable()
export class StemService {
  private readonly logger = new Logger(StemService.name);

  constructor(
    @InjectRepository(Short)
    private readonly shortRepository: Repository<Short>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly ffmpegService: FFmpegService,
    private readonly jobService: JobService,
  ) {}

  /**
   * Run stem separation for a specific Short.
   *
   * Creates a persistent Job in SQLite (SQL-Queue) for resilient progress tracking,
   * then emits real-time SSE events for immediate UI updates.
   *
   * @param projectId - UUID of the parent project
   * @param shortId - UUID of the short to process
   * @param progress$ - Optional SSE subject for real-time progress
   * @returns Updated Short entity with stem paths
   */
  async separateStems(
    projectId: string,
    shortId: string,
    progress$?: Subject<StemProgressEvent>,
  ): Promise<Short> {
    // Validate project exists
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    // Validate short exists
    const short = await this.shortRepository.findOneBy({
      id: shortId,
      projectId,
    });
    if (!short) {
      throw new NotFoundException(
        `Short ${shortId} not found in project ${projectId}`,
      );
    }

    // If stems already exist, skip
    if (short.vocalsPath && short.accompanimentPath) {
      this.logger.log(
        `Stems already exist for short ${shortId}, skipping separation.`,
      );
      this.emitProgress(progress$, {
        phase: 'complete',
        progress: 100,
        message: 'Stems already available.',
        shortId,
      });
      return short;
    }

    // Create a persistent Job record (SQL-Queue pattern)
    const job = await this.jobService.create({
      type: 'stem_separation',
      projectId,
      shortId,
    });

    const stemsDir = path.join(process.cwd(), 'uploads', 'stems', shortId);
    await fs.mkdir(stemsDir, { recursive: true });

    try {
      // Phase 1: Extract audio segment from source video
      await this.persistAndEmitProgress(job.id, progress$, {
        phase: 'extracting',
        progress: 10,
        message: 'Extracting audio segment from video...',
        shortId,
      });

      const segmentAudioPath = path.join(stemsDir, 'segment.wav');
      await this.extractSegmentAudio(
        project.videoPath,
        segmentAudioPath,
        short.startTime,
        short.endTime,
      );

      await this.persistAndEmitProgress(job.id, progress$, {
        phase: 'extracting',
        progress: 30,
        message: 'Audio segment extracted.',
        shortId,
      });

      // Phase 2: Run demucs for stem separation
      await this.persistAndEmitProgress(job.id, progress$, {
        phase: 'separating',
        progress: 40,
        message: 'Running AI stem separation (this may take a moment)...',
        shortId,
      });

      await this.runDemucs(segmentAudioPath, stemsDir);

      await this.persistAndEmitProgress(job.id, progress$, {
        phase: 'separating',
        progress: 80,
        message: 'Stem separation complete.',
        shortId,
      });

      // Phase 3: Locate output stems and update entity
      await this.persistAndEmitProgress(job.id, progress$, {
        phase: 'saving',
        progress: 90,
        message: 'Saving stem references...',
        shortId,
      });

      const { vocalsPath, accompanimentPath } =
        await this.locateDemucsOutputs(stemsDir);

      short.vocalsPath = vocalsPath;
      short.accompanimentPath = accompanimentPath;
      const saved = await this.shortRepository.save(short);

      // Cleanup the temporary segment audio (keep stems only)
      await fs.unlink(segmentAudioPath).catch(() => {});

      await this.jobService.complete(job.id);
      this.emitProgress(progress$, {
        phase: 'complete',
        progress: 100,
        message: 'Stem separation finished successfully!',
        shortId,
      });

      return saved;
    } catch (error) {
      const errorMessage = (error as Error).message;
      await this.jobService.fail(job.id, errorMessage);
      this.emitProgress(progress$, {
        phase: 'error',
        progress: 0,
        message: `Stem separation failed: ${errorMessage}`,
        shortId,
      });
      throw error;
    }
  }

  /**
   * Get the current job status for a short (for polling-based SSE reconnects).
   */
  async getJobStatus(shortId: string) {
    return this.jobService.findLatestByShort(shortId);
  }

  /**
   * Extract a specific time range of audio from the source video using FFmpeg.
   */
  private async extractSegmentAudio(
    videoPath: string,
    outputPath: string,
    startTime: number,
    endTime: number,
  ): Promise<void> {
    const duration = endTime - startTime;

    return new Promise<void>((resolve, reject) => {
      const proc = spawn('ffmpeg', [
        '-ss',
        startTime.toString(),
        '-i',
        videoPath,
        '-t',
        duration.toString(),
        '-vn', // no video
        '-acodec',
        'pcm_s16le', // WAV format for demucs compatibility
        '-ar',
        '44100', // 44.1kHz sample rate
        '-ac',
        '2', // stereo
        '-y',
        outputPath,
      ]);

      proc.on('close', (code) => {
        if (code === 0) resolve();
        else
          reject(
            new Error(`Audio segment extraction failed (exit code ${code})`),
          );
      });

      proc.on('error', (err) =>
        reject(new Error(`FFmpeg spawn error: ${err.message}`)),
      );
    });
  }

  /**
   * Run demucs CLI for 2-stem separation (vocals + accompaniment).
   *
   * Command: demucs --two-stems vocals -o <outputDir> <inputFile>
   */
  private async runDemucs(inputPath: string, outputDir: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const proc = spawn('demucs', [
        '--two-stems',
        'vocals',
        '-o',
        outputDir,
        inputPath,
      ]);

      let stderr = '';

      proc.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
        this.logger.debug(`[demucs] ${data.toString().trim()}`);
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          this.logger.error(`demucs failed (exit code ${code}): ${stderr}`);
          reject(
            new Error(
              `Stem separation failed (exit code ${code}). Ensure demucs is installed: pip install demucs`,
            ),
          );
        }
      });

      proc.on('error', (err) => {
        reject(
          new Error(
            `Could not run demucs: ${err.message}. Install with: pip install demucs`,
          ),
        );
      });
    });
  }

  /**
   * Locate demucs output files.
   *
   * Demucs outputs to: <outputDir>/htdemucs/<input_basename>/vocals.wav and no_vocals.wav
   */
  private async locateDemucsOutputs(
    stemsDir: string,
  ): Promise<{ vocalsPath: string; accompanimentPath: string }> {
    // Demucs creates a nested structure: <output>/htdemucs/<filename>/vocals.wav
    const htdemucsDir = path.join(stemsDir, 'htdemucs');

    let modelDir: string;
    try {
      const entries = await fs.readdir(htdemucsDir);
      const subDirs: string[] = [];
      for (const entry of entries) {
        const stat = await fs.stat(path.join(htdemucsDir, entry));
        if (stat.isDirectory()) {
          subDirs.push(entry);
        }
      }
      if (subDirs.length === 0) {
        throw new Error('No demucs output directory found');
      }
      modelDir = path.join(htdemucsDir, subDirs[0]);
    } catch {
      throw new Error(
        `Demucs output not found in ${htdemucsDir}. Check demucs installation.`,
      );
    }

    const vocalsPath = path.join(modelDir, 'vocals.wav');
    const accompanimentPath = path.join(modelDir, 'no_vocals.wav');

    // Verify files exist
    try {
      await fs.access(vocalsPath);
      await fs.access(accompanimentPath);
    } catch {
      throw new Error(
        `Expected stem files not found: vocals.wav / no_vocals.wav in ${modelDir}`,
      );
    }

    return { vocalsPath, accompanimentPath };
  }

  /**
   * Emit a progress event to the SSE subject AND persist to DB via JobService.
   * Dual-channel: real-time SSE for connected clients + persistent SQL for reconnects.
   */
  private async persistAndEmitProgress(
    jobId: string,
    progress$: Subject<StemProgressEvent> | undefined,
    event: StemProgressEvent,
  ): Promise<void> {
    await this.jobService.updateProgress(jobId, event.progress, event.message);
    this.emitProgress(progress$, event);
  }

  /**
   * Emit a progress event to the SSE subject (if provided).
   */
  private emitProgress(
    progress$: Subject<StemProgressEvent> | undefined,
    event: StemProgressEvent,
  ): void {
    this.logger.log(`[${event.phase}] ${event.progress}% - ${event.message}`);
    if (progress$) {
      progress$.next(event);
    }
  }
}
