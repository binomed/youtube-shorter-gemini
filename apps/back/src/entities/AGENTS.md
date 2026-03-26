# 🗄️ Database Entity Rules

Scope strictly `apps/back/src/entities/`.

## 📂 Responsibilities
- Defining and maintaining the SQLite schema via TypeORM entities.
- Ensuring strict naming conventions and robust relations between domain models.
- Managing database migrations for all schema changes.

## 📜 Technical Rules
1. **Consistency**: All entities must inherit from or follow the base PK and timestamp patterns (UUID, `createdAt`, `updatedAt`).
2. **Explicit Relations**: Always define the inverse side of relations to ensure bidirectional traversal when needed. Use explicit cascades for data integrity.
3. **SQLite Awareness**: Be mindful of SQLite limitations regarding concurrent writes and column modifications.
4. **DTO Alignment**: Ensure that entity property names match or map cleanly to the shared DTOs in `packages/shared/src/dtos`.
