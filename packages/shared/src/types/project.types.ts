// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

/**
 * Response DTO for project creation and retrieval
 */
export interface ProjectResponse {
    /** Unique project identifier (UUID) */
    id: string;

    /** Project name */
    name: string;

    /** Path to video file */
    videoPath: string;

    /** Project creation timestamp (ISO 8601) */
    createdAt: string;

    /** Video duration in seconds (optional, extracted from metadata) */
    duration?: number;

    /** Video resolution (optional, e.g. "1920x1080") */
    resolution?: string;

    /** Video codec (optional, e.g. "h264") */
    codec?: string;

    /** User has acknowledged data deletion policy */
    deletionPolicyAcknowledged?: boolean;

    /** User consent for AI learning */
    aiLearningConsent?: boolean;

    /** Project has been exported */
    isExported?: boolean;

    /** Project has been analyzed (has transcript) */
    isAnalyzed?: boolean;

    /** Associated shorts (viral segments) */
    shorts?: ShortResponse[];
}
