import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { SubtitleStyle } from '@youtube-shorter/shared';

/**
 * Entity representing a saved preset for subtitle styles.
 * Uses Data Mapper pattern - business logic stays in services.
 */
@Entity('subtitle_presets')
export class SubtitlePreset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  // Store the style configuration as a JSON string in SQLite
  @Column({ type: 'simple-json' })
  style: SubtitleStyle;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: string; // ISO 8601 string

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime' })
  updatedAt: string;
}
