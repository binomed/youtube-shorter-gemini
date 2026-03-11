import { SubtitleStyle } from './short.types';

export interface SubtitlePreset {
    id: string;
    name: string;
    style: SubtitleStyle;
    createdAt: string;
    updatedAt?: string;
}

export interface CreateSubtitlePresetDto {
    name: string;
    style: SubtitleStyle;
}
