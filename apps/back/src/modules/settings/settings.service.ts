import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSetting } from './entities/app-setting.entity';
import type { AppSettings } from '@youtube-shorter/shared';

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly DEFAULT_SETTINGS: AppSettings = {
    geminiModel: 'gemini-1.5-flash',
    frameInterval: 3.0,
    customPrompt: '',
    minDuration: 15,
    maxDuration: 59,
  };

  constructor(
    @InjectRepository(AppSetting)
    private readonly settingsRepository: Repository<AppSetting>,
  ) {}

  async onModuleInit() {
    // Initialize default settings if not present
    for (const [key, value] of Object.entries(this.DEFAULT_SETTINGS)) {
      const existing = await this.settingsRepository.findOne({
        where: { key },
      });
      if (!existing) {
        await this.settingsRepository.save({
          key,
          value: JSON.stringify(value),
        });
      }
    }
  }

  async getSettings(): Promise<AppSettings> {
    const settings = { ...this.DEFAULT_SETTINGS };
    const dbSettings = await this.settingsRepository.find();

    for (const s of dbSettings) {
      const key = s.key as keyof AppSettings;
      if (key in settings) {
        try {
          const value = JSON.parse(s.value) as unknown;
          if (key === 'geminiModel') {
            settings.geminiModel = value as string;
          } else if (key === 'frameInterval') {
            settings.frameInterval = Number(value);
          } else if (key === 'customPrompt') {
            settings.customPrompt = value as string;
          } else if (key === 'minDuration') {
            settings.minDuration = Number(value);
          } else if (key === 'maxDuration') {
            settings.maxDuration = Number(value);
          }
        } catch {
          // Fallback to default if parse fails
        }
      }
    }

    return settings;
  }

  async updateSettings(
    newSettings: Partial<AppSettings>,
  ): Promise<AppSettings> {
    for (const [key, value] of Object.entries(newSettings)) {
      await this.settingsRepository.save({ key, value: JSON.stringify(value) });
    }
    return this.getSettings();
  }
}
