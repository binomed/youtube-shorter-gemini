// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { IsArray, IsOptional, ValidateNested, IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class LayoutEventDto {
    @IsNumber()
    timestamp!: number;

    @IsString()
    layoutMode!: 'fill' | 'fullscreen';

    @IsNumber()
    centerX!: number;
}

export class VideoSegmentDto {
    @IsNumber()
    startTime!: number;

    @IsNumber()
    endTime!: number;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => LayoutEventDto)
    @IsOptional()
    layoutTimeline?: LayoutEventDto[];

    @IsOptional()
    @IsString()
    layoutMode?: 'fill' | 'fullscreen';

    @IsOptional()
    @IsNumber()
    centerX?: number;
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
