---
name: Workers & Job Queues
description: Resilient background job processing using SQL-Queue reactive pattern for the YouTube-Shorter-Gemini project
---

# Workers & Job Queues Custom Skill

## When to Use This Skill

Use this skill when working on background job processing in `apps/back/src/workers/` or `apps/back/src/modules/jobs/`. This includes:
- FFmpeg rendering jobs (long-running, CPU-intensive)
- AI analysis tasks (Gemini API calls)
- Batch processing operations
- Any task > 2 seconds that should not block HTTP requests

## Core Principles

### 1. SQL-Queue Reactive Pattern (NO Redis/BullMQ)
Following the architecture's **KISS** principle:
- Use **SQLite + TypeORM** for job persistence (no external queue dependency)
- **Event-driven** job triggering (no polling)
- Auto-recovery for stuck jobs on startup
- Real-time progress via SSE

### 2. Non-Blocking Execution
- All long-running tasks run in separate processes (FFmpeg spawn)
- Main Node.js thread stays responsive for HTTP/SSE
- Progress updates via EventEmitter + Database

### 3. Resilience & Recovery
- Jobs survive app crashes (persisted in SQLite)
- Failed jobs can be retried
- Cleanup of orphaned temp files
- Graceful shutdown handling

## Mandatory Patterns & Rules

### Job Entity Definition

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Job entity for queue persistence.
 * Tracks status and progress of background tasks.
 */
@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  type: 'RENDER' | 'ANALYSIS' | 'EXTRACTION' | 'SPLIT';

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

  @Column({ type: 'text' })
  payload: string; // JSON stringified job data

  @Column({ type: 'integer', default: 0 })
  progress: number; // 0-100

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId?: string; // Optional: link to project for cleanup

  @Column({ name: 'created_at', type: 'datetime' })
  createdAt: string; // ISO 8601

  @Column({ name: 'updated_at', type: 'datetime' })
  updatedAt: string;

  @Column({ name: 'started_at', type: 'datetime', nullable: true })
  startedAt?: string;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt?: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'retry_count', type: 'integer', default: 0 })
  retryCount: number;
}
```

### Job Service (Queue Manager)

```typescript
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Job } from '../../entities/job.entity';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Subject, Observable } from 'rxjs';

/**
 * Central job queue service using SQL-backed reactive pattern.
 * No Redis/BullMQ required - everything persists in SQLite.
 */
@Injectable()
export class JobService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobService.name);
  
  // SSE progress streams mapped by job ID
  private progressStreams = new Map<string, Subject<JobProgress>>();
  
  // Track active jobs for graceful shutdown
  private activeJobs = new Set<string>();

  private isShuttingDown = false;

  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * On startup, recover any jobs stuck in PROCESSING state.
   * This handles crash recovery automatically.
   */
  async onModuleInit() {
    this.logger.log('Initializing job service...');

    const stuckJobs = await this.jobRepository.find({
      where: { status: 'PROCESSING' },
    });

    if (stuckJobs.length > 0) {
      this.logger.warn(`Found ${stuckJobs.length} stuck jobs, re-queueing...`);
      
      for (const job of stuckJobs) {
        // Reset to PENDING and trigger processing
        await this.jobRepository.update(job.id, {
          status: 'PENDING',
          updatedAt: new Date().toISOString(),
        });

        this.eventEmitter.emit('job.process', job);
      }
    }

    // Cleanup old completed jobs (older than 7 days)
    await this.cleanupOldJobs();

    this.logger.log('Job service initialized');
  }

  /**
   * Graceful shutdown: wait for active jobs to complete.
   */
  async onModuleDestroy() {
    this.isShuttingDown = true;
    this.logger.log('Shutting down job service...');

    if (this.activeJobs.size > 0) {
      this.logger.log(`Waiting for ${this.activeJobs.size} active jobs to complete...`);
      
      // Wait up to 30 seconds for jobs to finish
      const timeout = 30000;
      const start = Date.now();

      while (this.activeJobs.size > 0 && (Date.now() - start < timeout)) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (this.activeJobs.size > 0) {
        this.logger.warn(`Forced shutdown with ${this.activeJobs.size} jobs still active`);
      }
    }

    this.logger.log('Job service shut down');
  }

  /**
   * Create a new job and trigger immediate processing (reactive).
   * No polling - event-driven execution.
   */
  async createJob(
    type: Job['type'],
    payload: any,
    projectId?: string,
  ): Promise<Job> {
    if (this.isShuttingDown) {
      throw new Error('Cannot create jobs during shutdown');
    }

    const job = this.jobRepository.create({
      type,
      status: 'PENDING',
      payload: JSON.stringify(payload),
      progress: 0,
      projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      retryCount: 0,
    });

    const savedJob = await this.jobRepository.save(job);
    
    this.logger.log(`Created ${type} job ${savedJob.id}`);

    // Immediately trigger processing (event-driven, no polling)
    this.eventEmitter.emit('job.process', savedJob);

    return savedJob;
  }

  /**
   * Central job processing dispatcher.
   * Routes to specific processors based on job type.
   */
  @OnEvent('job.process')
  async handleJobProcess(job: Job) {
    if (this.isShuttingDown) {
      this.logger.warn(`Ignoring job ${job.id} - shutting down`);
      return;
    }

    this.logger.log(`Processing job ${job.id} (type: ${job.type})`);
    this.activeJobs.add(job.id);

    // Update status to PROCESSING
    await this.jobRepository.update(job.id, {
      status: 'PROCESSING',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Emit to type-specific processor
    this.eventEmitter.emit(`job.process.${job.type.toLowerCase()}`, job);
  }

  /**
   * Update job progress (called by processors).
   * Updates DB and emits to SSE subscribers.
   */
  async updateProgress(
    jobId: string,
    progress: number,
    message?: string,
  ): Promise<void> {
    await this.jobRepository.update(jobId, {
      progress: Math.min(100, Math.max(0, progress)),
      updatedAt: new Date().toISOString(),
    });

    // Emit to SSE stream
    const stream = this.progressStreams.get(jobId);
    if (stream) {
      stream.next({
        jobId,
        progress,
        message: message || '',
        status: 'PROCESSING',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Mark job as completed.
   */
  async completeJob(jobId: string, result?: any): Promise<void> {
    await this.jobRepository.update(jobId, {
      status: 'COMPLETED',
      progress: 100,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.activeJobs.delete(jobId);

    // Final SSE notification
    const stream = this.progressStreams.get(jobId);
    if (stream) {
      stream.next({
        jobId,
        progress: 100,
        message: 'Completed',
        status: 'COMPLETED',
        timestamp: new Date().toISOString(),
        result,
      });
      stream.complete();
      this.progressStreams.delete(jobId);
    }

    this.logger.log(`Job ${jobId} completed`);
  }

  /**
   * Mark job as failed with error message.
   * Implements retry logic.
   */
  async failJob(jobId: string, error: string): Promise<void> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });

    if (!job) {
      this.logger.error(`Cannot fail job ${jobId} - not found`);
      return;
    }

    const maxRetries = 3;

    if (job.retryCount < maxRetries) {
      // Retry
      this.logger.warn(`Job ${jobId} failed, retrying (${job.retryCount + 1}/${maxRetries})`);
      
      await this.jobRepository.update(jobId, {
        status: 'PENDING',
        retryCount: job.retryCount + 1,
        errorMessage: error,
        updatedAt: new Date().toISOString(),
      });

      // Re-trigger processing after delay
      setTimeout(() => {
        this.eventEmitter.emit('job.process', { ...job, retryCount: job.retryCount + 1 });
      }, 5000 * (job.retryCount + 1)); // Exponential backoff

    } else {
      // Max retries exceeded
      await this.jobRepository.update(jobId, {
        status: 'FAILED',
        errorMessage: error,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      this.activeJobs.delete(jobId);

      const stream = this.progressStreams.get(jobId);
      if (stream) {
        stream.error(new Error(error));
        this.progressStreams.delete(jobId);
      }

      this.logger.error(`Job ${jobId} failed after ${maxRetries} retries: ${error}`);
    }
  }

  /**
   * Get observable stream for SSE endpoint.
   */
  getJobProgress(jobId: string): Observable<JobProgress> {
    if (!this.progressStreams.has(jobId)) {
      this.progressStreams.set(jobId, new Subject<JobProgress>());
    }
    return this.progressStreams.get(jobId)!.asObservable();
  }

  /**
   * Cancel a running job.
   */
  async cancelJob(jobId: string): Promise<void> {
    await this.jobRepository.update(jobId, {
      status: 'CANCELLED',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.activeJobs.delete(jobId);

    const stream = this.progressStreams.get(jobId);
    if (stream) {
      stream.complete();
      this.progressStreams.delete(jobId);
    }

    // TODO: Kill child process if running (FFmpeg, etc.)
    this.logger.log(`Job ${jobId} cancelled`);
  }

  /**
   * Cleanup completed jobs older than 7 days.
   */
  private async cleanupOldJobs(): Promise<void> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await this.jobRepository.delete({
      status: 'COMPLETED',
      completedAt: LessThan(sevenDaysAgo.toISOString()),
    });

    if (result.affected && result.affected > 0) {
      this.logger.log(`Cleaned up ${result.affected} old jobs`);
    }
  }
}

export interface JobProgress {
  jobId: string;
  progress: number;
  message: string;
  status: string;
  timestamp: string;
  result?: any;
}
```

### Job Processor Example (Render)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Job } from '../../entities/job.entity';
import { FfmpegService } from '../processing/ffmpeg.service';
import { JobService } from './job.service';
import * as fs from 'fs/promises';

/**
 * Processor for RENDER jobs.
 * Handles FFmpeg video concatenation and rendering.
 */
@Injectable()
export class RenderJobProcessor {
  private readonly logger = new Logger(RenderJobProcessor.name);

  constructor(
    private readonly ffmpegService: FfmpegService,
    private readonly jobService: JobService,
  ) {}

  /**
   * Listen for RENDER job events and execute.
   */
  @OnEvent('job.process.render')
  async handleRenderJob(job: Job) {
    this.logger.log(`Starting render job ${job.id}`);

    let outputPath: string | null = null;

    try {
      const payload = JSON.parse(job.payload);
      const { segmentPaths, projectId } = payload;
      
      outputPath = `/tmp/render-${job.id}.mp4`;

      // Execute FFmpeg rendering with progress callbacks
      await this.ffmpegService.concatenateAndRenderVertical(
        segmentPaths,
        outputPath,
        (percentage, message) => {
          // Update progress in real-time
          this.jobService.updateProgress(job.id, percentage, message);
        },
      );

      // Complete job with output file path
      await this.jobService.completeJob(job.id, {
        outputPath,
        fileSize: (await fs.stat(outputPath)).size,
      });

    } catch (error) {
      this.logger.error(`Render job ${job.id} failed: ${error.message}`);
      await this.jobService.failJob(job.id, error.message);

      // Cleanup partial output
      if (outputPath) {
        await fs.unlink(outputPath).catch(() => {});
      }
    }
  }
}
```

## Common Pitfalls

### ❌ DON'T: Poll the database
```typescript
// BAD: Wastes resources
setInterval(async () => {
  const jobs = await jobRepo.find({ status: 'PENDING' });
  for (const job of jobs) await processJob(job);
}, 1000);
```

### ✅ DO: Use event-driven triggers
```typescript
// GOOD: Reactive, no polling
eventEmitter.emit('job.process', job);
```

### ❌ DON'T: Block on long tasks
```typescript
// BAD: Blocks Node.js event loop
const result = execSync('ffmpeg ...');
```

### ✅ DO: Spawn async with callbacks
```typescript
// GOOD: Non-blocking with progress
const ffmpeg = spawn('ffmpeg', args);
ffmpeg.on('progress', (p) => updateProgress(p));
```

## Testing Job Processors

```typescript
describe('RenderJobProcessor', () => {
  it('should update progress during rendering', async () => {
    const mockJob = {
      id: 'job-123',
      type: 'RENDER',
      payload: JSON.stringify({ segmentPaths: [...] }),
    } as Job;

    const progressUpdates: number[] = [];

    jest.spyOn(jobService, 'updateProgress').mockImplementation(async (id, progress) => {
      progressUpdates.push(progress);
    });

    await processor.handleRenderJob(mockJob);

    expect(progressUpdates.length).toBeGreaterThan(5);
    expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
  });
});
```

## Checklist for Job Implementation

- [ ] Job entity persisted to SQLite
- [ ] Event-driven processing (no polling)
- [ ] Progress updates sent to SSE
- [ ] Retry logic for transient failures
- [ ] Graceful shutdown handling
- [ ] Temp file cleanup on success/failure
- [ ] Stuck job recovery on startup
- [ ] Old job cleanup scheduled
- [ ] Tests cover happy path + failures

## Resources

- [NestJS Events](https://docs.nestjs.com/techniques/events)
- [TypeORM Repository](https://typeorm.io/repository-api)
- Architecture: `_bmad-output/planning-artifacts/architecture.md` (SQL-Queue Reactive Pattern)
