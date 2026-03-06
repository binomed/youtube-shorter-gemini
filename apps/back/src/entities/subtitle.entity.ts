// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { Short } from './short.entity';

/**
 * Subtitle entity representing a single spoken segment within a Short.
 *
 * Each Subtitle belongs to a Short and is associated with specific start and end
 * timings. These are generated from AI transcription and can be manually edited.
 *
 * @entity
 */
@Entity('subtitles')
export class Subtitle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  @Index()
  shortId: string;

  @ManyToOne(() => Short, (short) => short.subtitles, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shortId' })
  short: Short;

  @Column({ type: 'float' })
  startTime: number;

  @Column({ type: 'float' })
  endTime: number;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'integer', default: 0 })
  orderIndex: number;
}
