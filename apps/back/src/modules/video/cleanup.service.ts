// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Project } from '../../entities/project.entity';

/**
 * CleanupService handles file and data cleanup for privacy compliance (FR-03)
 * 
 * Story 1.1 Scope (Desktop Local Files):
 * - Deletes project records from SQLite database via TypeORM
 * - DOES NOT delete original video files (user's own files on disk)
 * - Original files remain owned and managed by user
 * 
 * Future (Epic 2+: YouTube Downloads):
 * - Will delete downloaded YouTube videos from temporary storage
 * - Will implement session-based cleanup (delete after X hours inactivity)
 * - Will clean up rendered output files
 * 
 * Design Rationale:
 * For desktop local use case (Story 1.1), the app references user's original video files
 * without copying them. Deleting these files would cause data loss. The app only
 * manages metadata and project records in the database.
 * 
 * @service
 */
@Injectable()
export class CleanupService {
    private readonly logger = new Logger(CleanupService.name);

    constructor(
        @InjectRepository(Project)
        private readonly projectRepository: Repository<Project>,
    ) { }

    /**
     * Delete project and associated data
     * 
     * Story 1.1: Deletes database record via TypeORM
     * - Removes project from SQLite database
     * - Does NOT delete original video file (user's file)
     * 
     * Future Epics: Will also delete:
     * - Downloaded YouTube videos (temporary storage)
     * - Rendered output files
     * - Extracted clips
     * 
     * @param projectId - Project ID to delete
     * @returns Promise<void>
     */
    async deleteProject(projectId: string): Promise<void> {
        this.logger.log(`Deleting project: ${projectId}`);

        // Delete from database
        const result = await this.projectRepository.delete(projectId);

        if (result.affected === 0) {
            this.logger.warn(`Project not found: ${projectId}`);
        } else {
            this.logger.log(`Project deleted from database: ${projectId}`);
        }

        // Important: Do NOT delete original video file for desktop local files
        // The video belongs to the user and is outside our app's management scope
    }

    /**
     * Delete all projects and clean up application data
     * 
     * Used when user wants to completely remove all data (privacy compliance).
     * 
     * @returns Promise<number> - Number of projects deleted
     */
    async deleteAllProjects(): Promise<number> {
        this.logger.log('Deleting all projects');

        // Delete all from database
        const result = await this.projectRepository.delete({});

        this.logger.log(`All projects deleted: ${result.affected} records`);

        return result.affected || 0;
    }

    /**
     * Clean up old/inactive projects
     * 
     * Deletes projects older than specified age.
     * Useful for privacy compliance and storage management.
     * 
     * @param maxAgeHours - Maximum age in hours before deletion
     * @returns Promise<number> - Number of projects deleted
     */
    async cleanupInactive(maxAgeHours: number): Promise<number> {
        this.logger.log(`Cleaning up projects older than ${maxAgeHours} hours`);

        const cutoffDate = new Date();
        cutoffDate.setHours(cutoffDate.getHours() - maxAgeHours);

        const result = await this.projectRepository.delete({
            createdAt: LessThan(cutoffDate),
        });

        this.logger.log(`Cleaned up ${result.affected} inactive projects`);

        return result.affected || 0;
    }
}
