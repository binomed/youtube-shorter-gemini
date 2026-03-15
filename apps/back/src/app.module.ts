/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { VideoModule } from './modules/video/video.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { ProcessingModule } from './modules/processing/processing.module';
import { Project } from './entities/project.entity';
import { Short } from './entities/short.entity';
import { Job } from './entities/job.entity';
import { Subtitle } from './entities/subtitle.entity';
import { SubtitlePreset } from './entities/subtitle-preset.entity';
import { AppSetting } from './modules/settings/entities/app-setting.entity';
import { PresetsModule } from './modules/presets/presets.module';
import { SettingsModule } from './modules/settings/settings.module';

/**
 * Root application module for YouTube Shorter Gemini backend
 *
 * Configures:
 * - Environment variables (ConfigModule)
 * - SQLite database with TypeORM (synchronize: true for dev)
 * - Video upload and processing (VideoModule)
 */
@Module({
  imports: [
    // Environment configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),

    // TypeORM SQLite database
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'data/youtube-shorter.db', // Stored in apps/back/data/
      entities: [Project, Short, Job, Subtitle, SubtitlePreset, AppSetting],
      // CRITICAL: synchronize MUST be false in production to prevent data loss
      // Schema changes require migrations in production
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV !== 'production',
    }),

    // Feature modules (refactored from AiModule — Story 3.1.5, ADR-001)
    VideoModule,
    AnalysisModule,
    ProcessingModule,
    PresetsModule,
    SettingsModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
