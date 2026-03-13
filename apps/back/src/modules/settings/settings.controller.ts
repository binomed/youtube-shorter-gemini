import { Controller, Get, Post, Body } from '@nestjs/common';
import { SettingsService } from './settings.service';
import type { AppSettings } from '@youtube-shorter/shared';

@Controller('api/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings(): Promise<AppSettings> {
    return this.settingsService.getSettings();
  }

  @Post()
  async updateSettings(@Body() settings: Partial<AppSettings>): Promise<AppSettings> {
    return this.settingsService.updateSettings(settings);
  }
}
