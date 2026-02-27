import { IsString, IsNotEmpty, IsObject, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import type { SubtitleStyle } from '@youtube-shorter/shared';

/**
 * DTO for creating a new subtitle preset.
 */
export class CreatePresetDto {
    @ApiProperty({
        description: 'Name of the preset',
        example: 'Big Yellow Text',
        maxLength: 255
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    name: string;

    @ApiProperty({
        description: 'The style configuration',
        example: { fontSize: 40, color: '#ffff00', backgroundColor: 'rgba(0,0,0,0.8)' }
    })
    @IsObject()
    @IsNotEmpty()
    style: SubtitleStyle;
}
