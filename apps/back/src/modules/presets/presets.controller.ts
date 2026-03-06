import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PresetsService } from './presets.service';
import { CreatePresetDto } from './dto/create-preset.dto';
import { UpdatePresetDto } from './dto/update-preset.dto';

/**
 * Handles endpoints for subtitle preset CRUD.
 * Endpoints return standard API envelope format.
 */
@ApiTags('presets')
@Controller('api/presets')
export class PresetsController {
  constructor(private readonly presetsService: PresetsService) {}

  /**
   * Create a new subtitle preset.
   */
  @Post()
  @ApiOperation({ summary: 'Save a new style preset' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Preset created successfully',
  })
  async createPreset(@Body() dto: CreatePresetDto) {
    const preset = await this.presetsService.create(dto);

    return {
      success: true,
      data: preset,
    };
  }

  /**
   * Get all subtitle presets.
   */
  @Get()
  @ApiOperation({ summary: 'List all saved style presets' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Presets fetched successfully',
  })
  async findAll() {
    const presets = await this.presetsService.findAll();

    return {
      success: true,
      data: presets,
    };
  }

  /**
   * Update an existing subtitle preset by ID.
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update a saved style preset' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Preset updated successfully',
  })
  async update(@Param('id') id: string, @Body() dto: UpdatePresetDto) {
    const preset = await this.presetsService.update(id, dto);

    return {
      success: true,
      data: preset,
    };
  }

  /**
   * Delete a subtitle preset by ID.
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a saved style preset' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Preset deleted successfully',
  })
  async remove(@Param('id') id: string) {
    await this.presetsService.remove(id);

    return {
      success: true,
      message: 'Preset deleted successfully',
    };
  }
}
