import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubtitlePreset } from '../../entities/subtitle-preset.entity';
import { CreatePresetDto } from './dto/create-preset.dto';
import { UpdatePresetDto } from './dto/update-preset.dto';

/**
 * Service handling subtitle preset logic.
 * Orchestrates DB persistence for subtitle styles using Data Mapper pattern.
 */
@Injectable()
export class PresetsService {
  private readonly logger = new Logger(PresetsService.name);

  constructor(
    @InjectRepository(SubtitlePreset)
    private readonly presetRepository: Repository<SubtitlePreset>,
  ) {}

  /**
   * Create and save a new preset to the database.
   *
   * @param dto - Preset metadata and styling
   * @returns Created preset entity
   */
  async create(dto: CreatePresetDto): Promise<SubtitlePreset> {
    this.logger.log(`Creating new preset: ${dto.name}`);

    const preset = this.presetRepository.create({
      name: dto.name,
      style: dto.style,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const savedPreset = await this.presetRepository.save(preset);
    this.logger.log(`Preset created with ID: ${savedPreset.id}`);

    return savedPreset;
  }

  /**
   * Retrieves all saved subtitle presets.
   *
   * @returns Array of preset entities
   */
  async findAll(): Promise<SubtitlePreset[]> {
    return this.presetRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  /**
   * Updates an existing preset by ID.
   *
   * @param id - ID of the preset to update
   * @param dto - Partial update payload
   * @returns Updated preset entity
   */
  async update(id: string, dto: UpdatePresetDto): Promise<SubtitlePreset> {
    const preset = await this.presetRepository.findOne({ where: { id } });

    if (!preset) {
      throw new NotFoundException(`Preset with ID ${id} not found`);
    }

    const updatedPreset = this.presetRepository.merge(preset, dto);
    updatedPreset.updatedAt = new Date().toISOString();

    return this.presetRepository.save(updatedPreset);
  }

  /**
   * Deletes a given preset by ID.
   *
   * @param id - ID of the preset to remove
   */
  async remove(id: string): Promise<void> {
    const preset = await this.presetRepository.findOne({ where: { id } });

    if (!preset) {
      throw new NotFoundException(`Preset with ID ${id} not found`);
    }

    await this.presetRepository.remove(preset);
    this.logger.log(`Preset deleted: ${id}`);
  }
}
