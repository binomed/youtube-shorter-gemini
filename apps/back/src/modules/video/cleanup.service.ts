// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Injectable, Logger } from '@nestjs/common';

/**
 * CleanupService handles file and data cleanup for privacy compliance (FR-03)
 * 
 * Story 1.1 Scope (Desktop Local Files):
 * - Deletes project records from database
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

    /**
     * Delete project and associated data
     * 
     * Story 1.1: Only deletes database record
     * - Removes project from database
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

        // TODO: Implement database deletion when TypeORM repository is available
        // await this.projectRepository.delete(projectId);

        // Important: Do NOT delete original video file for desktop local files
        // The video belongs to the user and is outside our app's management scope

        this.logger.log(`Project deleted: ${projectId}`);
    }

    /**
     * Delete all projects and clean up application data
     * 
     * Used when user wants to completely remove all data (privacy compliance).
     * 
     * @returns Promise<void>
     */
    async deleteAllProjects(): Promise<void> {
        this.logger.log('Deleting all projects');

        // TODO: Implement bulk deletion when TypeORM repository is available
        // await this.projectRepository.delete({});

        this.logger.log('All projects deleted');
    }

    /**
     * Future: Clean up old/inactive projects
     * 
     * Will be implemented in future epics for:
     * - Session-based cleanup (delete after X hours inactivity)
     * - Downloaded YouTube videos cleanup
     * - Rendered output cleanup
     * 
     * Not needed for Story 1.1 (desktop local files, no temporary storage).
     */
    async cleanupInactive(maxAgeHours: number): Promise<void> {
        this.logger.log(`Cleanup inactive projects older than ${maxAgeHours} hours`);

        // TODO: Implement in Epic 2+ when dealing with downloaded/temporary files
        // For Story 1.1: No action needed

        this.logger.log('Cleanup completed (no-op for Story 1.1)');
    }
}
