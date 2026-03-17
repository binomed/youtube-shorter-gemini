"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
const typeorm_1 = require("typeorm");
const project_entity_1 = require("./src/entities/project.entity");
const short_entity_1 = require("./src/entities/short.entity");
const job_entity_1 = require("./src/entities/job.entity");
const subtitle_entity_1 = require("./src/entities/subtitle.entity");
const subtitle_preset_entity_1 = require("./src/entities/subtitle-preset.entity");
exports.AppDataSource = new typeorm_1.DataSource({
    type: 'sqlite',
    database: 'data/youtube-shorter.db',
    entities: [project_entity_1.Project, short_entity_1.Short, job_entity_1.Job, subtitle_entity_1.Subtitle, subtitle_preset_entity_1.SubtitlePreset],
    migrations: ['src/migrations/*.ts'],
    synchronize: false,
});
//# sourceMappingURL=ormconfig.js.map