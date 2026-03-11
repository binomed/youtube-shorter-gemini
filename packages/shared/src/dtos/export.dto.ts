import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { SubtitleStyle } from '../types/short.types';

export class ExportShortDto {
    /** Include original audio track (or vocals if stems are used) */
    @IsBoolean()
    @IsOptional()
    includeVocals?: boolean;
    
    /** Include accompaniment track if stems are used */
    @IsBoolean()
    @IsOptional()
    includeMusic?: boolean;

    /** Target short identifier to export */
    @IsString()
    shortId!: string;

    /** Subtitle style overrides */
    @IsOptional()
    style?: SubtitleStyle;
}
