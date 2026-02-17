// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { IsNotEmpty, MaxLength } from 'class-validator';

/**
 * Project entity representing a video editing project in the youtube-shorter-gemini system.
 * 
 * Each project contains a reference to an uploaded video file and its extracted metadata.
 * Projects are the top-level container for video processing workflows.
 * 
 * @entity
 */
@Entity('projects')
export class Project {
    /**
     * Unique identifier for the project (UUID v4)
     */
    @PrimaryGeneratedColumn('uuid')
    id: string;

    /**
     * User-provided project name
     * @example "My Awesome Shorts Project"
     */
    @Column({ type: 'varchar', length: 255 })
    @IsNotEmpty({ message: 'Project name is required' })
    @MaxLength(255, { message: 'Project name cannot exceed 255 characters' })
    name: string;

    /**
     * Path to the uploaded video file in temporary storage
     * @example "/tmp/youtube-shorter/uploads/abc123-def456/video.mp4"
     */
    @Column({ type: 'varchar', length: 500 })
    videoPath: string;

    /**
     * Video duration in seconds (extracted by FFmpeg)
     * @example 125.5
     */
    @Column({ type: 'float', nullable: true })
    duration?: number;

    /**
     * Video resolution (width x height)
     * @example "1920x1080"
     */
    @Column({ type: 'varchar', length: 50, nullable: true })
    resolution?: string;

    /**
     * Video codec name
     * @example "h264"
     */
    @Column({ type: 'varchar', length: 50, nullable: true })
    codec?: string;

    /**
     * Timestamp when the project was created
     */
    @CreateDateColumn()
    createdAt: Date;

    /**
     * Timestamp when the project was last updated
     */
    @UpdateDateColumn()
    updatedAt: Date;
}
