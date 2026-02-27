import { signal } from '@lit-labs/preact-signals';
import type { SubtitlePreset, CreateSubtitlePresetDto } from '@youtube-shorter/shared';
import { presetService } from '../services/preset.service';

/**
 * Global state for subtitle component presets.
 * Powered by Lit Signals for automatic reactive updates without prop-drilling.
 */
class PresetState {
    // The raw list of presets fetched from the server.
    presets = signal<SubtitlePreset[]>([]);
    // Indicates if the presets are currently being loaded.
    isLoading = signal<boolean>(false);
    // Any errors encountered while talking to the API.
    error = signal<string | null>(null);

    /**
     * Fetch all presets from the backend and update state.
     */
    async loadPresets() {
        try {
            this.isLoading.value = true;
            this.error.value = null;
            const data = await presetService.getPresets();
            this.presets.value = data;
        } catch (err: any) {
            this.error.value = err.message || 'Failed to load presets';
            console.error(err);
        } finally {
            this.isLoading.value = false;
        }
    }

    /**
     * Save a new preset to the backend and append it to our state.
     */
    async savePreset(dto: CreateSubtitlePresetDto) {
        try {
            this.error.value = null;
            const newPreset = await presetService.createPreset(dto);
            // We can append to the signals `.value`
            this.presets.value = [newPreset, ...this.presets.value];
        } catch (err: any) {
            this.error.value = err.message || 'Failed to save preset';
            console.error(err);
            throw err; // Re-throw so the UI can show a toast or error message
        }
    }

    /**
     * Delete a preset from the backend and remove it from the state.
     */
    async deletePreset(id: string) {
        try {
            this.error.value = null;
            await presetService.deletePreset(id);
            this.presets.value = this.presets.value.filter((p: SubtitlePreset) => p.id !== id);
        } catch (err: any) {
            this.error.value = err.message || 'Failed to delete preset';
            console.error(err);
            throw err;
        }
    }
}

// Export a singleton instance for shared usage across components.
export const presetState = new PresetState();
