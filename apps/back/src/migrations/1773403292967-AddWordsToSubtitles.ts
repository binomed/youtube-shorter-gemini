import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWordsToSubtitles1773403292967 implements MigrationInterface {
  name = 'AddWordsToSubtitles1773403292967';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_988c93cb73f570f7f5492479d3"`);
    await queryRunner.query(
      `CREATE TABLE "temporary_subtitles" ("id" varchar PRIMARY KEY NOT NULL, "shortId" varchar NOT NULL, "startTime" float NOT NULL, "endTime" float NOT NULL, "text" text NOT NULL, "orderIndex" integer NOT NULL DEFAULT (0), "words" text, CONSTRAINT "FK_988c93cb73f570f7f5492479d3d" FOREIGN KEY ("shortId") REFERENCES "shorts" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "temporary_subtitles"("id", "shortId", "startTime", "endTime", "text", "orderIndex") SELECT "id", "shortId", "startTime", "endTime", "text", "orderIndex" FROM "subtitles"`,
    );
    await queryRunner.query(`DROP TABLE "subtitles"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_subtitles" RENAME TO "subtitles"`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_988c93cb73f570f7f5492479d3" ON "subtitles" ("shortId") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_988c93cb73f570f7f5492479d3"`);
    await queryRunner.query(
      `ALTER TABLE "subtitles" RENAME TO "temporary_subtitles"`,
    );
    await queryRunner.query(
      `CREATE TABLE "subtitles" ("id" varchar PRIMARY KEY NOT NULL, "shortId" varchar NOT NULL, "startTime" float NOT NULL, "endTime" float NOT NULL, "text" text NOT NULL, "orderIndex" integer NOT NULL DEFAULT (0), CONSTRAINT "FK_988c93cb73f570f7f5492479d3d" FOREIGN KEY ("shortId") REFERENCES "shorts" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
    );
    await queryRunner.query(
      `INSERT INTO "subtitles"("id", "shortId", "startTime", "endTime", "text", "orderIndex") SELECT "id", "shortId", "startTime", "endTime", "text", "orderIndex" FROM "temporary_subtitles"`,
    );
    await queryRunner.query(`DROP TABLE "temporary_subtitles"`);
    await queryRunner.query(
      `CREATE INDEX "IDX_988c93cb73f570f7f5492479d3" ON "subtitles" ("shortId") `,
    );
  }
}
