// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
  JoinColumn,
} from 'typeorm';
import { Project } from './project.entity';
import { Subtitle } from './subtitle.entity';

/**
 * Short entity representing a suggested viral segment detected by Gemini AI.
 *
 * Each Short belongs to a Project and represents a clip that could make
 * a great YouTube Short. Shorts are initially suggested by AI analysis,
 * and can later be composed of multiple segments (Epic 4).
 *
 * @entity
 */
@Entity('shorts')
export class Short {
  /**
   * Unique identifier for the short (UUID v4)
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Reference to the parent project
   */
  @Column({ type: 'varchar' })
  @Index()
  projectId: string;

  /**
   * Parent project association
   */
  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  /**
   * AI-generated title/hook for the Short
   * @example "Unexpected camera reveal"
   */
  @Column({ type: 'varchar', length: 255 })
  title: string;

  /**
   * AI-generated description explaining why this moment is viral
   * @example "Strong visual hook with surprising reveal and emotional reaction"
   */
  @Column({ type: 'text', nullable: true })
  description?: string;

  /**
   * Smart crop coordinates for 9:16 vertical video
   * JSON structure: { centerX: number, width: number }
   * @example { "centerX": 0.5, "width": 0.5625 }
   */
  @Column({
    type: 'text',
    nullable: true,
    transformer: {
      to: (value: Record<string, unknown> | null | undefined) =>
        JSON.stringify(value),
      from: (value: string) =>
        value ? (JSON.parse(value) as Record<string, unknown>) : null,
    },
  })
  smartCropData?: Record<string, unknown>;

  /**
   * Start timestamp in seconds (from source video)
   * @example 45.5
   */
  @Column({ type: 'float' })
  startTime: number;

  /**
   * End timestamp in seconds (from source video)
   * @example 78.2
   */
  @Column({ type: 'float' })
  endTime: number;

  /**
   * AI confidence score (0-100) for viral potential
   * @example 85
   */
  @Column({ type: 'integer', default: 50 })
  confidence: number;

  /**
   * Path to the generated thumbnail image
   */
  @Column({ type: 'varchar', nullable: true })
  thumbnailPath?: string;

  /**
   * Display order in the sidebar list
   */
  @Column({ type: 'integer', default: 0 })
  orderIndex: number;

  /**
   * Path to the separated vocals audio stem file
   */
  @Column({ type: 'varchar', nullable: true })
  vocalsPath?: string;

  /**
   * Path to the separated accompaniment (music) audio stem file
   */
  @Column({ type: 'varchar', nullable: true })
  accompanimentPath?: string;

  /**
   * Subtitles associated with this Short
   */
  @OneToMany(() => Subtitle, (subtitle) => subtitle.short, { cascade: true })
  subtitles: Subtitle[];

  /**
   * Subtitle style preferences for this Short
   * JSON structure matching SubtitleStyle interface
   */
  @Column({
    type: 'text',
    nullable: true,
    transformer: {
      to: (value: Record<string, unknown> | null | undefined) =>
        JSON.stringify(value),
      from: (value: string) =>
        value ? (JSON.parse(value) as Record<string, unknown>) : null,
    },
  })
  subtitleStyle?: Record<string, unknown>;

  /**
   * List of segments (jump cuts) that compose this short.
   * JSON structure: Array<{ startTime: number, endTime: number }>
   */
  @Column({
    type: 'text',
    nullable: true,
    transformer: {
      to: (value: any[] | null | undefined) => JSON.stringify(value),
      from: (value: string) => (value ? (JSON.parse(value) as any[]) : null),
    },
  })
  segments?: any[];

  /**
   * Timestamp when the short was created/detected
   */
  @CreateDateColumn()
  createdAt: Date;
}
