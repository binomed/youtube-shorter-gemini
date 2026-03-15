// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type JobType =
  | 'project_creation'
  | 'stem_separation'
  | 'analysis'
  | 'export';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

/**
 * Job entity for SQL-Queue pattern.
 *
 * Persists long-running async tasks (Demucs, FFmpeg) to SQLite,
 * enabling resilient progress tracking that survives server restarts.
 *
 * @see ADR-004: Reactive Job System with SQL-Queue
 * @see Story 3.1.5 Task 2
 */
@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Type of job being processed */
  @Column({ type: 'varchar' })
  type: JobType;

  /** Current status of the job */
  @Column({ type: 'varchar', default: 'pending' })
  status: JobStatus;

  /** Associated project ID */
  @Column({ type: 'varchar' })
  projectId: string;

  /** Associated short ID (optional, for stem separation jobs) */
  @Column({ type: 'varchar', nullable: true })
  shortId?: string;

  /** Progress percentage (0-100) */
  @Column({ type: 'float', default: 0 })
  progress: number;

  /** Human-readable progress message */
  @Column({ type: 'text', nullable: true })
  message?: string;

  /** Error description if job failed */
  @Column({ type: 'text', nullable: true })
  error?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
