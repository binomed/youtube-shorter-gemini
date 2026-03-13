/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */

// Configuration
export * from './config/constants';

import 'reflect-metadata';

// DTOs
export { CreateProjectDto } from './dtos/create-project.dto';
export { UpdateShortSegmentsDto } from './dtos/update-short.dto';
export { ExportShortDto } from './dtos/export.dto';

// Utils
export * from './utils/word-reconciler.util';

// Types
export { ProjectResponse } from './types/project.types';
export { ShortResponse, AnalysisResponse, AnalysisProgressEvent, DetectedSegment, StemProgressEvent, ExportProgressEvent, SubtitleResponse, VideoSegment, SubtitleStyle, LayoutEvent, WordTiming } from './types/short.types';
export { SubtitlePreset, CreateSubtitlePresetDto } from './types/subtitle-preset.types';
export { ErrorResponse, ValidationErrorResponse, ValidationError } from './types/error.types';
