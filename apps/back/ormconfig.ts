import { DataSource } from 'typeorm';
import { Project } from './src/entities/project.entity';
import { Short } from './src/entities/short.entity';
import { Job } from './src/entities/job.entity';
import { Subtitle } from './src/entities/subtitle.entity';
import { SubtitlePreset } from './src/entities/subtitle-preset.entity';

export const AppDataSource = new DataSource({
    type: 'sqlite',
    database: 'data/youtube-shorter.db',
    entities: [Project, Short, Job, Subtitle, SubtitlePreset],
    migrations: ['src/migrations/*.ts'],
    synchronize: false, // We want to run migrations
});
