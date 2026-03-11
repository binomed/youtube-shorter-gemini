// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable, ReplaySubject } from 'rxjs';
import { JobService } from './job.service';
import { Job, JobType } from '../../entities/job.entity';

/**
 * JobProgressService — Unifie la gestion de la progression réactive (SSE)
 * et la persistance (JobService / SQLite).
 *
 * Mutualisation demandée par l'Audit Backend :
 * Remplace les multi-Maps de Subjects éparpillées dans les contrôleurs.
 */
@Injectable()
export class JobProgressService {
  private readonly logger = new Logger(JobProgressService.name);

  // Map de jobId -> Subject pour les flux SSE
  private subjects = new Map<string, ReplaySubject<any>>();

  constructor(private readonly jobService: JobService) {}

  /**
   * Récupère ou crée un flux de progression pour un Job spécifique.
   * Sera utilisé par les endpoints @Sse().
   */
  getStream<T>(jobId: string): Observable<T> {
    if (!this.subjects.has(jobId)) {
      this.subjects.set(jobId, new ReplaySubject<T>(1));
      this.logger.debug(`Flux SSE créé pour le job: ${jobId}`);
    }
    return (this.subjects.get(jobId) as ReplaySubject<T>).asObservable();
  }

  /**
   * Émet une mise à jour de progression.
   * Met à jour la base de données (JobService) ET pousse l'événement dans le flux SSE.
   */
  async emit<T extends { progress: number; message?: string }>(
    jobId: string,
    event: T,
  ): Promise<void> {
    // 1. Persistance SQL
    await this.jobService.updateProgress(jobId, event.progress, event.message);

    // 2. Diffusion Réactive (SSE)
    const subject = this.subjects.get(jobId);
    if (subject) {
      subject.next(event);

      // Si terminé ou en erreur, on ferme le flux après un léger délai
      const eventData = event as Record<string, unknown>;
      const isTerminal =
        eventData.phase === 'complete' ||
        eventData.phase === 'error' ||
        event.progress >= 100;
      if (isTerminal) {
        this.closeStream(jobId);
      }
    }
  }

  /**
   * Initialise un Job et retourne son ID.
   */
  async startJob(params: {
    type: JobType;
    projectId: string;
    shortId?: string;
  }): Promise<string> {
    const job = await this.jobService.create(params);
    return job.id;
  }

  /**
   * Marque un job comme réussi.
   */
  async complete(jobId: string): Promise<void> {
    await this.jobService.complete(jobId);
    this.closeStream(jobId);
  }

  /**
   * Marque un job comme échoué et notifie le flux.
   */
  async fail(jobId: string, error: string): Promise<void> {
    await this.jobService.fail(jobId, error);
    const subject = this.subjects.get(jobId);
    if (subject) {
      subject.next({
        progress: 0,
        message: `Error: ${error}`,
        phase: 'error',
      });
      this.closeStream(jobId);
    }
  }

  /**
   * Close the reactive stream and cleanup resources.
   * The 1000ms timeout ensures the final SSE packet (especially for completion/error)
   * is fully flushed and received by the browser before the connection is severed.
   */
  private closeStream(jobId: string): void {
    const subject = this.subjects.get(jobId);
    if (subject) {
      setTimeout(() => {
        subject.complete();
        this.subjects.delete(jobId);
        this.logger.debug(`Flux SSE fermé et nettoyé pour le job: ${jobId}`);
      }, 1000);
    }
  }

  /**
   * Find latest job ID for a project.
   */
  async getLatestJobIdByProject(
    projectId: string,
    type?: JobType,
  ): Promise<string | undefined> {
    const job = await this.jobService.findLatestByProject(projectId, type);
    return job?.id;
  }

  /**
   * Find latest job ID for a short.
   */
  async getLatestJobIdByShort(shortId: string): Promise<string | undefined> {
    const job = await this.jobService.findLatestByShort(shortId);
    return job?.id;
  }
}
