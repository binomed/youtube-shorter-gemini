// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  Matches,
  MaxLength,
  IsBoolean,
} from 'class-validator';

export class UpdateSubtitleStyleDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9\s,'"-]+$/, {
    message: 'Font name contains invalid characters',
  })
  @MaxLength(50)
  font?: string;

  @IsOptional()
  @IsNumber()
  @Min(8)
  @Max(120)
  fontSize?: number;

  @IsOptional()
  @IsString()
  @Matches(/^rgba?\(\d+,\s*\d+,\s*\d+(?:,\s*[\d.]+)?\)|#[0-9a-fA-F]{3,8}$/, {
    message: 'Color must be a valid hex or rgba string',
  })
  color?: string;

  @IsOptional()
  @IsString()
  @Matches(
    /^rgba?\(\d+,\s*\d+,\s*\d+(?:,\s*[\d.]+)?\)|#[0-9a-fA-F]{3,8}|transparent$/,
    {
      message:
        'Background color must be a valid hex, rgba string, or transparent',
    },
  )
  backgroundColor?: string;

  @IsOptional()
  @IsNumber()
  @Min(-2000)
  @Max(2000)
  positionY?: number;

  @IsOptional()
  @IsNumber()
  @Min(-2000)
  @Max(2000)
  positionX?: number;

  @IsOptional()
  @IsString()
  textAlign?: string;

  @IsOptional()
  @IsBoolean()
  borderEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  borderWidth?: number;

  @IsOptional()
  @IsString()
  borderColor?: string;

  @IsOptional()
  @IsBoolean()
  textShadow?: boolean;

  @IsOptional()
  @IsBoolean()
  textOutline?: boolean;

  @IsOptional()
  @IsBoolean()
  highlightEnabled?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{3,8}$/, {
    message: 'Highlight color must be a valid hex string',
  })
  highlightColor?: string;

  @IsOptional()
  @IsNumber()
  @Min(100)
  @Max(200)
  highlightScale?: number;
}

export class UpdateSubtitleTextDto {
  @IsString()
  @MaxLength(500)
  text: string;
}
