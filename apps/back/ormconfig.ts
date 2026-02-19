import { DataSource } from 'typeorm';
import { Project } from './src/entities/project.entity';
import { Short } from './src/entities/short.entity';

export const AppDataSource = new DataSource({
    type: 'sqlite',
    database: 'data/youtube-shorter.db',
    entities: [Project, Short],
    migrations: ['src/migrations/*.ts'],
    synchronize: false, // We want to run migrations
});
