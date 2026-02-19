// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject } from 'rxjs';
import { Short } from '../../entities/short.entity';
import { Project } from '../../entities/project.entity';
import { GeminiService, DetectedSegment } from './gemini.service';
import { FFmpegService } from '../../workers/ffmpeg.service';
import type { AnalysisProgressEvent } from '@youtube-shorter/shared';

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
        private readonly geminiService: GeminiService,
        private readonly ffmpegService: FFmpegService,
    ) { }

    /**
     * Run full analysis pipeline for a project.
     * Emits progress events to the provided subject for SSE streaming.
     *
     * @param projectId - UUID of the project to analyze
     * @param progress$ - Subject to emit progress events to
     * @returns Array of created Short entities
     */
    async analyzeProject(
        projectId: string,
        progress$?: Subject<AnalysisProgressEvent>,
    ): Promise<Short[]> {
        // 1. Validate project exists
        const project = await this.projectRepository.findOneBy({ id: projectId });
        if (!project) {
            throw new NotFoundException(`Project ${projectId} not found`);
        }

        try {
            // Phase 1: Extract frames
            this.emitProgress(progress$, {
                phase: 'extracting_frames',
                progress: 10,
                message: 'Extracting video frames...',
            });

            const metadata = await this.ffmpegService.extractMetadata(project.videoPath);
            const duration = metadata?.duration || 60;

            const frames = await this.extractFramesForAnalysis(project.videoPath, duration, 25);

            this.emitProgress(progress$, {
                phase: 'extracting_frames',
                progress: 30,
                message: `Extracted ${frames.length} frames for analysis`,
            });

            // Phase 2: Audio Transcription (Parallel with frame processing ideally, but sequential for simplicity)
            this.emitProgress(progress$, {
                phase: 'transcribing',
                progress: 40,
                message: 'Extracting audio and generating subtitles...',
            });

            const fs = await import('fs/promises');
            const path = await import('path');
            const os = await import('os');

            const audioPath = path.join(os.tmpdir(), `yts-audio-${Date.now()}.mp3`);
            let transcript = '';

            try {
                // Extract audio
                await this.ffmpegService.extractAudio(project.videoPath, audioPath);

                // Read audio buffer
                const audioBuffer = await fs.readFile(audioPath);

                // Generate subtitles
                transcript = await this.geminiService.generateSubtitles(audioBuffer);

                // Save transcript to project
                if (transcript) {
                    project.transcript = transcript;
                    await this.projectRepository.save(project);
                    this.logger.log(`Transcript saved for project ${projectId} (${transcript.length} chars)`);
                }

                // Cleanup audio file
                await fs.unlink(audioPath).catch(() => { });
            } catch (error) {
                this.logger.warn(`Transcription failed: ${(error as Error).message}`);
                // Continue without transcript
            }

            // Phase 3: Gemini analysis (Viral Detection)
            this.emitProgress(progress$, {
                phase: 'analyzing',
                progress: 60,
                message: 'Analyzing video content (visuals + audio)...',
            });

            let detected: DetectedSegment[] = [];
            try {
                detected = await this.geminiService.detectShortsCandidates(frames, duration, transcript);
            } catch (error: any) {
                if (error.name === 'GeminiParseError') {
                    this.emitProgress(progress$, {
                        phase: 'error',
                        progress: 80,
                        message: `AI error: failed to understand the video structure. Please try again.`,
                    });
                }
                throw error;
            }

            this.emitProgress(progress$, {
                phase: 'analyzing',
                progress: 80,
                message: `Gemini detected ${detected.length} potential Shorts`,
            });

            // Phase 4: Save results
            this.emitProgress(progress$, {
                phase: 'saving',
                progress: 90,
                message: 'Saving Shorts to database...',
            });

            // Delete existing shorts for this project (re-analysis)
            await this.shortRepository.delete({ projectId });

            const shorts = await this.saveDetectedShorts(projectId, project.videoPath, detected);

            this.emitProgress(progress$, {
                phase: 'complete',
                progress: 100,
                message: `Analysis complete! ${shorts.length} Shorts detected.`,
            });

            return shorts;
        } catch (error) {
            this.emitProgress(progress$, {
                phase: 'error',
                progress: 0,
                message: `Analysis failed: ${(error as Error).message}`,
            });
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
            throw new NotFoundException(`Short ${shortId} not found in project ${projectId}`);
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
        const { spawn } = await import('child_process');
        const fs = await import('fs/promises');
        const path = await import('path');
        const os = await import('os');

        const interval = Math.max(1, Math.floor(duration / maxFrames));
        const frames: string[] = [];
        const tmpDir = path.join(os.tmpdir(), `yts-frames-${Date.now()}`);

        await fs.mkdir(tmpDir, { recursive: true });

        try {
            for (let i = 0; i < maxFrames && i * interval < duration; i++) {
                const timestamp = i * interval;
                const outputPath = path.join(tmpDir, `frame-${i}.jpg`);

                await new Promise<void>((resolve, reject) => {
                    const proc = spawn('ffmpeg', [
                        '-ss', timestamp.toString(),
                        '-i', videoPath,
                        '-vframes', '1',
                        '-q:v', '5',  // Good quality, smaller size
                        '-vf', 'scale=512:-1',  // Resize for API efficiency
                        '-y',
                        outputPath,
                    ]);

                    proc.on('close', (code) => {
                        if (code === 0) resolve();
                        else reject(new Error(`Frame extraction failed at ${timestamp}s (exit code ${code})`));
                    });

                    proc.on('error', reject);
                });

                const frameBuffer = await fs.readFile(outputPath);
                frames.push(frameBuffer.toString('base64'));
            }
        } finally {
            // Cleanup temp directory
            await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => { });
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
        detected: DetectedSegment[],
    ): Promise<Short[]> {
        const path = await import('path');
        const fs = await import('fs/promises');

        // Create thumbnails directory if not exists
        const thumbnailsDir = path.join(process.cwd(), 'uploads', 'thumbnails');
        await fs.mkdir(thumbnailsDir, { recursive: true });

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

            // Generate thumbnail at midpoint
            try {
                const midpoint = (seg.startTime + seg.endTime) / 2;
                const filename = `${short.id}.jpg`;
                const thumbnailPath = path.join(thumbnailsDir, filename);

                await this.ffmpegService.extractThumbnail(videoPath, thumbnailPath, midpoint);

                short.thumbnailPath = thumbnailPath;
                short = await this.shortRepository.save(short);
            } catch (error) {
                this.logger.warn(`Failed to generate thumbnail for short ${short.id}: ${error.message}`);
            }

            shorts.push(short);
        }

        this.logger.log(`Saved ${shorts.length} shorts for project ${projectId}`);
        return shorts;
    }

    /**
     * Emit a progress event to the SSE subject (if provided).
     */
    private emitProgress(
        progress$: Subject<AnalysisProgressEvent> | undefined,
        event: AnalysisProgressEvent,
    ): void {
        this.logger.log(`[${event.phase}] ${event.progress}% - ${event.message}`);
        if (progress$) {
            progress$.next(event);
        }
    }
}
