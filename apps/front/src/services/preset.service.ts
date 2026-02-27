import type { SubtitlePreset, CreateSubtitlePresetDto } from '@youtube-shorter/shared';

const API_BASE = '/api/presets';

class PresetService {
    /**
     * Fetches all presets from the backend.
     */
    async getPresets(): Promise<SubtitlePreset[]> {
        const response = await fetch(API_BASE);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error?.message || 'Failed to fetch presets');
        }

        return result.data as SubtitlePreset[];
    }

    /**
     * Creates a new preset.
     */
    async createPreset(dto: CreateSubtitlePresetDto): Promise<SubtitlePreset> {
        const response = await fetch(API_BASE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dto),
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error?.message || 'Failed to create preset');
        }

        return result.data as SubtitlePreset;
    }

    /**
     * Updates an existing preset by ID.
     */
    async updatePreset(id: string, dto: Partial<CreateSubtitlePresetDto>): Promise<SubtitlePreset> {
        const response = await fetch(`${API_BASE}/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dto),
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error?.message || 'Failed to update preset');
        }

        return result.data as SubtitlePreset;
    }

    /**
     * Deletes a preset by ID.
     */
    async deletePreset(id: string): Promise<void> {
        const response = await fetch(`${API_BASE}/${id}`, {
            method: 'DELETE',
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error?.message || 'Failed to delete preset');
        }
    }
}

export const presetService = new PresetService();
