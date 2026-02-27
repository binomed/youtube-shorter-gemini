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

export interface SubtitleStyle {
    font?: string;
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
    positionX?: number;
    positionY?: number;
}
