---
name: TypeORM & SQLite Data Layer
description: Data modeling rules, relations, and SQLite-specific constraints for the YouTube Shorter project.
trigger: glob
globs:
  - "apps/back/src/entities/**"
  - "apps/back/src/migrations/**"
---

# 🗄️ TypeORM & SQLite Data Layer Skill

## Overview
This project uses **TypeORM** with **SQLite** for metadata and job persistence. 

## 🏗️ Entity Standards
All entities MUST follow these naming and decorator conventions:

- **Primary Keys**: Use `@PrimaryGeneratedColumn('uuid')`.
- **Timestamps**: Always include `@CreateDateColumn()` and `@UpdateDateColumn()`.
- **Filesystem Paths**: Store relative paths to media files.
- **JSON**: Use `simple-json` for complex metadata (SQLite does not have a native JSON type).

```typescript
@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Short, (short) => short.project, { cascade: true })
  shorts: Short[];
}
```

---

## 🔗 Relations & Cascades
- **Strict Cleanup**: Use `{ cascade: true, onDelete: 'CASCADE' }` for parent-child relations (e.g., Project -> Short -> Subtitles).
- **Lazy Loading**: Avoid lazy loading. Prefer explicit `relations` in `find` options.

---

## ⚠️ SQLite Limitations
SQLite is powerful but has constraints:
1. **Migrations**: SQLite supports limited `ALTER TABLE`. If you need to drop columns or change types, you often need to recreate the table. Use the `typeorm migration:generate` tool carefully.
2. **Enums**: Native `ENUM` is not supported. Use `@Column({ type: 'varchar' })` and type it in TypeScript.
3. **Storage**: Video/Audio files are NOT stored in SQLite. Only metadata and paths.

---

## 🚀 Migrations
- Never use `synchronize: true` in production environment.
- Any change to `entities/` MUST be accompanied by a manual or generated migration in `apps/back/src/migrations/`.
- Name migrations descriptively: `npm run migration:generate -- -n AddThumbnailUrlToShort`.

---

## 🛠️ Repository Pattern
- Use the standard `Repository<Entity>` injected via `@InjectRepository()`.
- Complex queries involving multiple joins or filters should be encapsulated in the Service layer or a custom repository.
