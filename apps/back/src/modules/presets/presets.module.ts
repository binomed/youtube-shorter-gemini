import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubtitlePreset } from '../../entities/subtitle-preset.entity';
import { PresetsService } from './presets.service';
import { PresetsController } from './presets.controller';

@Module({
    imports: [TypeOrmModule.forFeature([SubtitlePreset])],
    controllers: [PresetsController],
    providers: [PresetsService],
    exports: [PresetsService],
})
export class PresetsModule { }
