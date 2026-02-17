// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

/**
 * Progress event types
 */
export type ProgressType = 'received' | 'processing' | 'complete' | 'error';

/**
 * Progress event data
 */
export interface ProgressEvent {
    projectId: string;
    type: ProgressType;
    progress: number; // 0-100
    message: string;
    timestamp: Date;
}

/**
 * ProgressService manages real-time progress tracking for video processing
 * 
 * Architecture:
 * - Uses RxJS Subject for event streaming (hot observable)
 * - One Subject per project ID (lazy created, auto-cleanup)
 * - VideoService emits events during processing stages
 * - ProgressController streams these events to frontend via SSE
 * 
 * Lifecycle:
 * 1. VideoService calls emitProgress() during processing
 * 2. Event pushed to project's Subject
 * 3. SSE endpoint streams events to connected clients
 * 4. Auto-cleanup after 'complete' or 'error' event
 * 
 * @service
 */
@Injectable()
export class ProgressService {
    private readonly logger = new Logger(ProgressService.name);

    // Map of projectId -> Subject for event streaming
    private progressStreams = new Map<string, Subject<ProgressEvent>>();

    /**
     * Get or create progress stream for a project
     * 
     * Lazy creates Subject on first access, auto-cleanup on complete/error.
     */
    getProgressStream(projectId: string): Observable<ProgressEvent> {
        if (!this.progressStreams.has(projectId)) {
            this.progressStreams.set(projectId, new Subject<ProgressEvent>());
            this.logger.debug(`Created progress stream for project: ${projectId}`);
        }

        return this.progressStreams.get(projectId)!.asObservable();
    }

    /**
     * Emit progress event for a project
     * 
     * Called by VideoService during processing stages:
     * - 'received': File uploaded and received (25%)
     * - 'processing': Extracting metadata with FFmpeg (50-75%)
     * - 'complete': Project created successfully (100%)
     * - 'error': Processing failed
     * 
     * @param projectId - Unique project identifier
     * @param type - Progress type
     * @param progress - Completion percentage (0-100)
     * @param message - Human-readable status message
     */
    emitProgress(
        projectId: string,
        type: ProgressType,
        progress: number,
        message: string,
    ): void {
        const event: ProgressEvent = {
            projectId,
            type,
            progress: Math.min(Math.max(progress, 0), 100), // Clamp 0-100
            message,
            timestamp: new Date(),
        };

        this.logger.log(
            `[${projectId}] ${type} (${progress}%): ${message}`,
        );

        // Get or create stream
        if (!this.progressStreams.has(projectId)) {
            this.progressStreams.set(projectId, new Subject<ProgressEvent>());
        }

        const stream = this.progressStreams.get(projectId)!;

        // Emit event
        stream.next(event);

        // Auto-cleanup on terminal events
        if (type === 'complete' || type === 'error') {
            setTimeout(() => {
                stream.complete();
                this.progressStreams.delete(projectId);
                this.logger.debug(`Cleaned up progress stream for project: ${projectId}`);
            }, 1000); // 1s delay to ensure client receives final event
        }
    }

    /**
     * Emit error progress event
     * 
     * Convenience method for error handling.
     */
    emitError(projectId: string, errorMessage: string): void {
        this.emitProgress(projectId, 'error', 0, errorMessage);
    }

    /**
     * Check if a progress stream exists for a project
     */
    hasStream(projectId: string): boolean {
        return this.progressStreams.has(projectId);
    }

    /**
     * Get count of active progress streams
     */
    getActiveStreamCount(): number {
        return this.progressStreams.size;
    }
}
