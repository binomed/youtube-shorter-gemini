// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class VideoSegmentDto {
    startTime!: number;
    endTime!: number;
}

/**
 * DTO for updating the segments of a Short (manual capture)
 */
export class UpdateShortSegmentsDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => VideoSegmentDto)
    segments!: VideoSegmentDto[];
}
