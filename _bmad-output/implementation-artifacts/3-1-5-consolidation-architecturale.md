# Story 3.1.5: Consolidation Architecturale, Lisibilité et Qualité

Status: in-progress

## Story

As a **développeur** du projet YouTube Shorter Gemini,
I want to consolidate the architecture, improve code readability, and reinforce test coverage,
so that the codebase is resilient, maintainable, and ready for future features (Dynamic Subtitles, Export).

---

## Acceptance Criteria

1. **[Backend - Architecture]** Le module `AiModule` est scindé en `AnalysisModule` (Gemini) et `ProcessingModule` (Demucs/FFmpeg), chacun avec une responsabilité unique (SRP). ✅
2. **[Backend - Job Queue]** `StemService` utilise le pattern SQL-Queue avec une entité `Job` persistée en SQLite, remplaçant les `Subject<T>` et `Map` in-memory actuels. ✅
3. **[Backend - Tests]** Le dossier `modules/ai` dispose de fichiers `.spec.ts` pour `analysis.service.ts`, `gemini.service.ts`, `stem.service.ts`, et `analysis.controller.ts`. ✅
4. **[Frontend - Composants]** Les composants dont le `render()` dépasse 80 lignes sont refactorisés : le `render()` principal orchestre des méthodes privées `renderXxx()` sémantiques. ✅
5. **[Frontend - State]** Les mises à jour de l'état global passent par des fonctions action explicites. ✅ (existant)
6. **[Frontend - Tests]** Des fichiers `.spec.ts` sont créés pour `dashboard-page.ts` et `editor-page.ts`. ✅ (partiel)
7. **[Code Mort]** Tous les `console.log('DEBUG: ...')` sont supprimés. ✅
8. **[CSS]** Convention `--yts-*` dans shadow DOM documentée. ⬜ (todo)
9. **[Nettoyage]** Scripts `clean:temp`, `clean:dist`, `clean` dans `package.json`. ✅
10. **[Documentation]** ADR 004 créé. ✅

---

## Tasks / Subtasks

### Tâche 1 – Refonte du Module Backend (AC: #1)
- [x] Créer `apps/back/src/modules/analysis/analysis.module.ts` avec `GeminiService`, `AnalysisService`, `AnalysisController`
- [x] Créer `apps/back/src/modules/processing/processing.module.ts` avec `StemService`, `FFmpegService`
- [ ] Supprimer `ai.module.ts` (obsolète — conservé pour compatibilité transitoire)
- [x] Vérifier que les entités (`Short`, `Project`) sont correctement partagées via `TypeOrmModule.forFeature()`

### Tâche 2 – Implémentation du Pattern SQL-Queue (AC: #2)
- [x] Créer l'entité `Job` (`id`, `type`, `status`, `projectId`, `shortId?`, `progress`, `error?`, `createdAt`, `updatedAt`)
- [x] Créer `JobService` avec méthodes : `create()`, `updateProgress()`, `complete()`, `fail()`, `findByProject()`, `purgeOld()`
- [x] Refactoriser `StemService` : persister la progression via `JobService` (dual-channel SSE + SQL)
- [x] Mettre à jour TypeORM pour inclure l'entité `Job` dans `AppModule`

### Tâche 3 – Tests Backend Module IA (AC: #3)
- [x] Créer `analysis.service.spec.ts`
- [x] Créer `gemini.service.spec.ts`
- [x] Créer `stem.service.spec.ts`
- [x] Créer `analysis.controller.spec.ts`

### Tâche 4 – Refactorisation Frontend : Décomposition des Composants (AC: #4)
- [x] **`yts-video-player.element.ts`** : Extraire `renderLoadingOverlay`, `renderErrorOverlay`, `renderSeekBar`, `renderControlRow`, `renderKeyboardHints`
- [x] **`editor-page.ts`** : Extraire `renderSegmentsSidebar`, `renderReelCenter`, `renderToolsPanel`, `renderAudioPanel`

### Tâche 5 – Signal State Discipline (AC: #5)
- [x] Audit : seules `setProject()` et `clearProject()` utilisées (confirmé, pas de `.set()` direct)

### Tâche 6 – Tests Frontend Pages (AC: #6)
- [x] Créer `dashboard-page.spec.ts`
- [x] Créer `editor-page.spec.ts`
- [ ] Créer `analysis-page.spec.ts` (optionnel)
- [ ] Créer `yts-app.element.spec.ts` (optionnel)

### Tâche 7 – Suppression Code Mort (AC: #7)
- [x] Supprimer `console.log('DEBUG: ...')` dans `project.service.ts`
- [x] Supprimer `console.log` inutiles dans `yts-app.element.ts`

### Tâche 8 – Convention CSS / Tailwind (AC: #8)
- [ ] Mettre à jour `.agent/skills/lit_web_components/SKILL.md` avec section CSS Guidelines

### Tâche 9 – Scripts NPM de Nettoyage (AC: #9)
- [x] Ajouter `rimraf` en devDependency
- [x] Ajouter `clean:temp`, `clean:dist`, `clean` dans `package.json` racine

### Tâche 10 – Documentation ADRs (AC: #10)
- [x] Créer `docs/adr/004-reactive-job-system.md` — SQL-Queue pattern

---

## Dev Notes

### Architecture & Patterns

- **Séparation de module** : NestJS impose une organisation par domaine. L'IA externe (API Gemini) et le traitement local (Demucs) sont des domaines distincts. Voir [Source: .agent/skills/nestjs_backend/SKILL.md].
- **SQL-Queue Pattern** : Le pattern réactif SQL-Queue est documenté dans [Source: .agent/skills/workers_job_queues/SKILL.md]. Toujours utiliser ce pattern pour les tâches CPU/IO-bound longues.
- **LitElement Rendering** : Les méthodes `renderXxx()` privées doivent retourner `TemplateResult` (importé de `lit`). Ne pas créer de sous-`@customElement` inutilement. Voir [Source: .agent/skills/lit_web_components/SKILL.md].

### Project Structure Notes

```
apps/back/src/
├── modules/
│   ├── analysis/          [NEW] Gemini + AnalysisService
│   │   ├── analysis.module.ts
│   │   ├── analysis.service.ts   (déplacé depuis /ai)
│   │   ├── analysis.service.spec.ts  [NEW]
│   │   ├── analysis.controller.ts (déplacé depuis /ai)
│   │   └── analysis.controller.spec.ts [NEW]
│   ├── processing/        [NEW] FFmpeg + Demucs
│   │   ├── processing.module.ts
│   │   ├── stem.service.ts       (déplacé depuis /ai)
│   │   ├── stem.service.spec.ts  [NEW]
│   │   └── ffmpeg.service.ts     (déplacé depuis /workers)
│   ├── ai/               [DELETE] Remplacé par analysis/ et processing/
│   └── video/             [existant]
├── entities/
│   ├── job.entity.ts      [NEW] Entité SQL-Queue
│   └── ...
apps/front/src/
├── components/organisms/
│   └── yts-video-player.element.ts  [MODIFY] décomposer render()
├── pages/
│   ├── dashboard-page.spec.ts        [NEW]
│   ├── analysis-page.spec.ts         [NEW]
│   └── editor-page.spec.ts           [NEW]
```

### Références

- [Source: audit_report.md] - Rapport d'audit complet des 10 axes
- [Source: .agent/skills/nestjs_backend/SKILL.md] - Patterns NestJS
- [Source: .agent/skills/workers_job_queues/SKILL.md] - Pattern SQL-Queue
- [Source: .agent/skills/lit_web_components/SKILL.md] - Conventions Lit
- [Source: .agent/skills/ffmpeg_media_processing/SKILL.md] - FFmpeg patterns
- [Source: .agent/skills/testing_strategy/SKILL.md] - Stratégie de test

---

## Dev Agent Record

### Agent Model Used

Gemini 2.5 Pro (2026-02-24)

### Debug Log References

*À remplir lors de l'implémentation.*

### Completion Notes List

*À remplir lors de l'implémentation.*

### File List

**Nouveaux fichiers :**
- `apps/back/src/modules/analysis/analysis.module.ts`
- `apps/back/src/modules/analysis/analysis.service.spec.ts`
- `apps/back/src/modules/analysis/analysis.controller.spec.ts`
- `apps/back/src/modules/processing/processing.module.ts`
- `apps/back/src/modules/processing/stem.service.spec.ts`
- `apps/back/src/entities/job.entity.ts`
- `apps/back/src/modules/analysis/gemini.service.spec.ts`
- `apps/front/src/pages/dashboard-page.spec.ts`
- `apps/front/src/pages/analysis-page.spec.ts`
- `apps/front/src/pages/editor-page.spec.ts`
- `apps/front/src/components/organisms/yts-app.element.spec.ts`
- `docs/adr/004-reactive-job-system.md`

**Fichiers modifiés :**
- `apps/back/src/app.module.ts`
- `apps/back/src/modules/ai/ai.module.ts` → supprimé après migration
- `apps/front/src/components/organisms/yts-video-player.element.ts`
- `apps/front/src/services/project.service.ts`
- `apps/front/src/components/organisms/yts-app.element.ts`
- `apps/front/src/state/project.state.ts`
- `.agent/skills/lit_web_components/SKILL.md`
- `docs/adr/001-monorepo-structure.md`
- `package.json` (racine)
