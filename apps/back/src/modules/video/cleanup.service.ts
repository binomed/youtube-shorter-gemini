// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, DataSource, EntityManager } from 'typeorm';
import { Project } from '../../entities/project.entity';
import { Short } from '../../entities/short.entity';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * CleanupService handles file and data cleanup for privacy compliance (FR-03)
 *
 * Story 1.1 Scope (Desktop Local Files):
 * - Deletes project records from SQLite database via TypeORM
 * - DOES NOT delete original video files (user's own files on disk)
 * - Original files remain owned and managed by user
 *
 * BF-1.1 Scope (Bug Fix — Complete Filesystem Cleanup):
 * - Deletes Multer-uploaded temp copies in `./uploads/` on project deletion
 * - Deletes stem files using DB-stored paths (vocalsPath, accompanimentPath) as fallback
 * - All file system operations are fail-safe (file-not-found errors are silently logged)
 *
 * Design Rationale:
 * For desktop local use case (Story 1.1), the app COPIES the user's original video file
 * into ./uploads/ via Multer. This copy is app-managed and must be deleted on project
 * deletion. The original user file is NOT touched.
 *
 * @service
 */
@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);

  /**
   * Resolved absolute path to the Multer uploads directory.
   * Files within this directory are app-managed and safe to delete on cleanup.
   */
  private readonly uploadsDir = path.resolve(process.cwd(), 'uploads');

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Delete project and associated data
   *
   * BF-1.1: Also deletes:
   * - The Multer-uploaded video copy in ./uploads/ (if applicable)
   * - Stem audio files in uploads/stems/<shortId>/
   * - Thumbnail files referenced in DB
   *
   * Design: Original user files are NEVER deleted. Only app-managed files in
   * ./uploads/ are removed.
   *
   * @param projectId - Project ID to delete
   * @returns Promise<void>
   */
  async deleteProject(projectId: string): Promise<void> {
    this.logger.log(`Deleting project: ${projectId}`);

    let projectVideoPath: string | undefined;

    await this.dataSource.transaction(async (manager) => {
      const projectRepo = manager.getRepository(Project);

      // Find project first to ensure it exists
      const project = await projectRepo.findOne({ where: { id: projectId } });

      if (!project) {
        this.logger.warn(`Project not found: ${projectId}`);
        throw new NotFoundException(`Project with ID ${projectId} not found`);
      }

      // Store videoPath before deletion for post-transaction cleanup
      projectVideoPath = project.videoPath;

      // Clean up stem files and thumbnails before deleting DB records
      await this.cleanupStemFiles(projectId, manager);

      // Delete with cascade (will handle future foreign key constraints)
      await projectRepo.remove(project);

      this.logger.log(`Project DB record deleted: ${projectId}`);
    });

    // Post-transaction: Delete the Multer-uploaded video copy (if app-managed)
    // This runs AFTER the transaction to ensure DB integrity is preserved
    // even if the file deletion fails.
    if (projectVideoPath) {
      await this.deleteUploadedVideoFile(projectVideoPath);
    }

    this.logger.log(`Project deleted successfully: ${projectId}`);
  }

  /**
   * Delete the uploaded video file from disk if it is inside the app-managed ./uploads/ directory.
   *
   * SAFETY: Only deletes files located within `./uploads/`. User original files
   * (located anywhere else on disk) are NEVER touched.
   *
   * @param videoPath - Absolute path to the video file stored in the DB
   */
  private async deleteUploadedVideoFile(videoPath: string): Promise<void> {
    const resolvedVideoPath = path.resolve(videoPath);

    // Security check: only delete files inside the app's uploads directory
    const isAppManagedFile = resolvedVideoPath.startsWith(
      this.uploadsDir + path.sep,
    );

    if (!isAppManagedFile) {
      this.logger.debug(
        `Skipping video file deletion (user's original file): ${videoPath}`,
      );
      return;
    }

    try {
      await fs.unlink(resolvedVideoPath);
      this.logger.debug(
        `Deleted app-managed upload file: ${resolvedVideoPath}`,
      );
    } catch (error: unknown) {
      // Fail-safe: log the warning but do not throw (project is already deleted from DB)
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Could not delete uploaded video file ${resolvedVideoPath}: ${message}`,
      );
    }
  }

  /**
   * Clean up stem audio files and thumbnails from disk for all shorts in a project.
   *
   * Uses a two-pronged approach for robustness:
   * 1. Deletes the stems directory by convention: uploads/stems/<shortId>/
   * 2. Deletes DB-stored paths (vocalsPath, accompanimentPath) if they exist
   *    (handles edge cases where convention-based paths differ from actual paths)
   */
  private async cleanupStemFiles(
    projectId: string,
    manager: EntityManager,
  ): Promise<void> {
    const shortRepo = manager.getRepository(Short);
    const shorts = await shortRepo.find({ where: { projectId } });

    for (const short of shorts) {
      // Strategy 1: Delete stem directory by convention (covers all files atomically)
      const stemsDir = path.join(process.cwd(), 'uploads', 'stems', short.id);
      try {
        await fs.rm(stemsDir, { recursive: true, force: true });
        this.logger.debug(`Cleaned up stems directory for short ${short.id}`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Could not clean stems dir for short ${short.id}: ${message}`,
        );
      }

      // Strategy 2: Delete DB-stored individual stem file paths (fallback / belt-and-suspenders)
      if (short.vocalsPath) {
        try {
          await fs.unlink(short.vocalsPath);
          this.logger.debug(`Deleted vocalsPath for short ${short.id}`);
        } catch {
          // Fail-safe: file may not exist if already cleaned by strategy 1
        }
      }

      if (short.accompanimentPath) {
        try {
          await fs.unlink(short.accompanimentPath);
          this.logger.debug(`Deleted accompanimentPath for short ${short.id}`);
        } catch {
          // Fail-safe: file may not exist if already cleaned by strategy 1
        }
      }

      // Clean up thumbnail if exists (unchanged from original)
      if (short.thumbnailPath) {
        try {
          await fs.unlink(short.thumbnailPath);
          this.logger.debug(`Cleaned up thumbnail for short ${short.id}`);
        } catch {
          // Fail-safe: ignore if file doesn't exist
        }
      }
    }
  }

  /**
   * Delete all projects and clean up application data
   *
   * Used when user wants to completely remove all data (privacy compliance).
   *
   * @returns Promise<number> - Number of projects deleted
   */
  async deleteAllProjects(): Promise<number> {
    this.logger.log(
      'Deleting all projects - privacy compliance cleanup initiated',
    );

    // Delete all from database
    const result = await this.projectRepository.delete({});

    const deletedCount = result.affected || 0;
    this.logger.log(
      `All projects deleted successfully: ${deletedCount} projects removed`,
    );

    return deletedCount;
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
    this.logger.log(
      `Cleanup job started: removing projects older than ${maxAgeHours} hours`,
    );

    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - maxAgeHours);

    const result = await this.projectRepository.delete({
      createdAt: LessThan(cutoffDate),
    });

    const deletedCount = result.affected || 0;
    this.logger.log(
      `Cleanup job completed successfully: ${deletedCount} inactive projects removed`,
    );

    return deletedCount;
  }
}
