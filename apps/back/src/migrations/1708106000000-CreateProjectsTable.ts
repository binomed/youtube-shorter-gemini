// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Migration to create the projects table
 * 
 * This table stores video editing projects with metadata extracted from uploaded videos.
 *  
 * @migration
 */
export class CreateProjectsTable1708106000000 implements MigrationInterface {
    /**
     * Execute the migration - create projects table
     */
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'projects',
                columns: [
                    {
                        name: 'id',
                        type: 'varchar',
                        length: '36',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                    },
                    {
                        name: 'name',
                        type: 'varchar',
                        length: '255',
                        isNullable: false,
                    },
                    {
                        name: 'video_path',
                        type: 'varchar',
                        length: '500',
                        isNullable: false,
                    },
                    {
                        name: 'duration',
                        type: 'real',
                        isNullable: true,
                    },
                    {
                        name: 'resolution',
                        type: 'varchar',
                        length: '50',
                        isNullable: true,
                    },
                    {
                        name: 'codec',
                        type: 'varchar',
                        length: '50',
                        isNullable: true,
                    },
                    {
                        name: 'created_at',
                        type: 'datetime',
                        default: "CURRENT_TIMESTAMP",
                    },
                    {
                        name: 'updated_at',
                        type: 'datetime',
                        default: "CURRENT_TIMESTAMP",
                    },
                ],
            }),
            true,
        );
    }

    /**
     * Rollback the migration - drop projects table
     */
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('projects');
    }
}
