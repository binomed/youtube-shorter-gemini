// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job, JobType } from '../../entities/job.entity';

/**
 * JobService manages the SQL-Queue lifecycle for long-running async tasks.
 *
 * Pattern: SQL-Queue — persists job state to SQLite so progress is
 * never lost on server restart (replaces in-memory Subject<T> approach).
 *
 * @see ADR-004: Reactive Job System with SQL-Queue
 * @see Story 3.1.5 Task 2
 */
@Injectable()
export class JobService {
  private readonly logger = new Logger(JobService.name);

  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
  ) {}

  /**
   * Create a new job in 'pending' state.
   */
  async create(params: {
    type: JobType;
    projectId: string;
    shortId?: string;
  }): Promise<Job> {
    const job = this.jobRepository.create({
      type: params.type,
      status: 'pending',
      projectId: params.projectId,
      shortId: params.shortId,
      progress: 0,
    });
    const saved = await this.jobRepository.save(job);
    this.logger.log(
      `Job created: [${saved.type}] ${saved.id} for project ${saved.projectId}`,
    );
    return saved;
  }

  /**
   * Update job status to 'running' and set progress/message.
   */
  async updateProgress(
    jobId: string,
    progress: number,
    message?: string,
  ): Promise<void> {
    await this.jobRepository.update(jobId, {
      status: 'running',
      progress: Math.min(100, Math.max(0, progress)),
      message,
    });
  }

  /**
   * Mark job as completed.
   */
  async complete(jobId: string): Promise<void> {
    await this.jobRepository.update(jobId, {
      status: 'completed',
      progress: 100,
    });
    this.logger.log(`Job completed: ${jobId}`);
  }

  /**
   * Mark job as failed with error description.
   */
  async fail(jobId: string, error: string): Promise<void> {
    await this.jobRepository.update(jobId, {
      status: 'failed',
      error,
    });
    this.logger.error(`Job failed: ${jobId} — ${error}`);
  }

  /**
   * Find the latest job for a project (most recent first).
   */
  async findLatestByProject(
    projectId: string,
    type?: JobType,
  ): Promise<Job | null> {
    return this.jobRepository.findOne({
      where: { projectId, ...(type && { type }) },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find the latest job for a specific short.
   */
  async findLatestByShort(shortId: string): Promise<Job | null> {
    return this.jobRepository.findOne({
      where: { shortId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find a job by ID.
   */
  async findById(jobId: string): Promise<Job> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
    return job;
  }

  /**
   * Purge completed/failed jobs older than a given number of hours.
   * Call this periodically via CleanupService.
   */
  async purgeOld(olderThanHours = 24): Promise<number> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - olderThanHours);

    const result = await this.jobRepository
      .createQueryBuilder()
      .delete()
      .where('status IN (:...statuses)', { statuses: ['completed', 'failed'] })
      .andWhere('updatedAt < :cutoff', { cutoff })
      .execute();

    const count = result.affected ?? 0;
    this.logger.log(`Purged ${count} old jobs`);
    return count;
  }
}
