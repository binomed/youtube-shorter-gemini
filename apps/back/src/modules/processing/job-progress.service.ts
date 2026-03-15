// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Injectable, Logger } from '@nestjs/common';
import { Observable, ReplaySubject } from 'rxjs';
import { JobService } from './job.service';
import { JobType } from '../../entities/job.entity';

/**
 * JobProgressService — Unifies management of reactive progress (SSE)
 * and persistence (JobService / SQLite).
 *
 * Consolidates multi-Maps of Subjects previously scattered in controllers,
 * as requested by the Backend Audit.
 */
@Injectable()
export class JobProgressService {
  private readonly logger = new Logger(JobProgressService.name);

  // Map of jobId -> Subject for SSE streams
  private subjects = new Map<string, ReplaySubject<any>>();

  constructor(private readonly jobService: JobService) {}

  /**
   * Retrieves or creates a progress stream for a specific Job.
   * Used by @Sse() endpoints.
   */
  getStream<T>(jobId: string): Observable<T> {
    if (!this.subjects.has(jobId)) {
      this.subjects.set(jobId, new ReplaySubject<T>(1));
      this.logger.debug(`SSE stream created for job: ${jobId}`);
    }
    return (this.subjects.get(jobId) as ReplaySubject<T>).asObservable();
  }

  /**
   * Emits a progress update.
   * Updates the database (JobService) AND pushes the event into the SSE stream.
   */
  async emit<T extends { progress: number; message?: string }>(
    jobId: string,
    event: T,
  ): Promise<void> {
    // 1. SQL Persistence
    await this.jobService.updateProgress(jobId, event.progress, event.message);

    // 2. Reactive Broadcast (SSE)
    const subject = this.subjects.get(jobId);
    if (subject) {
      subject.next(event);

      // If completed or in error, close the stream after a slight delay
      const eventData = event as Record<string, unknown>;
      const isTerminal =
        eventData.phase === 'complete' ||
        eventData.phase === 'error' ||
        event.progress >= 100;
      if (isTerminal) {
        this.closeStream(jobId);
      }
    }
  }

  /**
   * Initializes a Job and returns its ID.
   */
  async startJob(params: {
    type: JobType;
    projectId: string;
    shortId?: string;
  }): Promise<string> {
    const job = await this.jobService.create(params);
    return job.id;
  }

  /**
   * Marks a job as completed successfully.
   */
  async complete(jobId: string): Promise<void> {
    await this.jobService.complete(jobId);
    this.closeStream(jobId);
  }

  /**
   * Marks a job as failed and notifies the stream.
   */
  async fail(jobId: string, error: string): Promise<void> {
    await this.jobService.fail(jobId, error);
    const subject = this.subjects.get(jobId);
    if (subject) {
      subject.next({
        progress: 0,
        message: `Error: ${error}`,
        phase: 'error',
      });
      this.closeStream(jobId);
    }
  }

  /**
   * Close the reactive stream and cleanup resources.
   * The 1000ms timeout ensures the final SSE packet (especially for completion/error)
   * is fully flushed and received by the browser before the connection is severed.
   */
  private closeStream(jobId: string): void {
    const subject = this.subjects.get(jobId);
    if (subject) {
      setTimeout(() => {
        subject.complete();
        this.subjects.delete(jobId);
        this.logger.debug(`SSE stream closed and cleaned up for job: ${jobId}`);
      }, 1000);
    }
  }

  /**
   * Find latest job ID for a project.
   */
  async getLatestJobIdByProject(
    projectId: string,
    type?: JobType,
  ): Promise<string | undefined> {
    const job = await this.jobService.findLatestByProject(projectId, type);
    return job?.id;
  }

  /**
   * Find latest job ID for a short.
   */
  async getLatestJobIdByShort(shortId: string): Promise<string | undefined> {
    const job = await this.jobService.findLatestByShort(shortId);
    return job?.id;
  }
}
