import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddIsExportedToProjects1771507333500 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn('projects', new TableColumn({
            name: 'isExported',
            type: 'boolean',
            default: false
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('projects', 'isExported');
    }

}
