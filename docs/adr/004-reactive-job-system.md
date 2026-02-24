# ADR 004: Reactive Job System avec SQL-Queue

**Date:** 2026-02-24
**Status:** Accepted
**Context:** Story 3.1.5 - Consolidation Architecturale

---

## Contexte

Le projet utilise des traitements asynchrones lourds pour certaines fonctionnalités :
- **Analyse IA** : extraction de frames FFmpeg + appel API Gemini (20-120 secondes)
- **Séparation de pistes audio** : extraction audio FFmpeg + traitement Demucs ML (30-180 secondes)

Avant cette ADR, ces tâches étaient gérées par des `Subject<T>` et des `Map<string, Subject>` stockés en mémoire dans les contrôleurs NestJS. Cette approche présentait plusieurs problèmes :

1. **Perte de données** : Si le serveur NestJS redémarre pendant un traitement, la progression est perdue et le client ne peut plus suivre l'état.
2. **Scalabilité** : Impossible d'interroger l'état d'un job depuis plusieurs instances ou après reconnexion SSE.
3. **Observabilité** : Aucune traçabilité persistante des erreurs ou de l'historique des traitements.

---

## Options Considérées

1. **Redis + Bull/BullMQ** : File d'attente avec Redis. Puissant et scalable. Trop lourd pour un usage local desktop sans serveur Redis externe.
2. **In-memory Subject (existant)** : Simple mais sans persistance. Rejeté à cause des problèmes listés ci-dessus.
3. **SQL-Queue Pattern (SQLite)** : Entité `Job` persistée dans la base SQLite existante. Légère, sans dépendance externe, parfaitement adaptée à l'usage local.

---

## Décision

Nous adoptons le **pattern SQL-Queue** : une entité `Job` est créée en base de données SQLite (via TypeORM) au démarrage de chaque traitement asynchrone. La progression est mise à jour régulièrement dans cette entité.

### Entité Job

```typescript
@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() type: 'stem_separation' | 'analysis';
  @Column() status: 'pending' | 'running' | 'completed' | 'failed';
  @Column() projectId: string;
  @Column({ nullable: true }) shortId?: string;
  @Column({ type: 'float', default: 0 }) progress: number;
  @Column({ nullable: true }) error?: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

### Flux SSE

Le endpoint SSE (`/stems/progress`, `/analyze/progress`) interroge la DB en polling toutes les 500ms via un `interval` RxJS et émet les événements au client.

---

## Conséquences

### Positives
- ✅ **Résilience** : L'état d'un job survit aux redémarrages du serveur.
- ✅ **Historique** : Les jobs passés sont consultables pour du debugging.
- ✅ **Testabilité** : `JobService` peut être mocké facilement dans les tests unitaires.
- ✅ **Pas de dépendance externe** : SQLite est déjà utilisé dans le projet.

### Négatives
- ⚠️ **Polling DB** : Le polling toutes les 500ms sur la DB SQLite locale est acceptable pour un usage desktop, mais ne serait pas viable pour un usage concurrentiel élevé.
- ⚠️ **Nettoyage** : Il faut prévoir une purge périodique des jobs terminés (ex: `CleanupService`).

---

## Références

- [Workers & Job Queues Skill](.agent/skills/workers_job_queues/SKILL.md)
- [Story 3.1.5](_bmad-output/implementation-artifacts/3-1-5-consolidation-architecturale.md)
- [Architecture](_bmad-output/planning-artifacts/architecture.md)
