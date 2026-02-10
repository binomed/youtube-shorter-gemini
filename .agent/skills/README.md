# Custom Skills for YouTube-Shorter-Gemini

Ce répertoire contient les **skills spécialisées** pour guider Antigravity et les agents IA dans le développement du projet.

## 📂 Structure

Selon le [format Antigravity](https://antigravity.google/docs/skills), chaque skill est un répertoire **snake_case** contenant un fichier `SKILL.md`.

```
.agent/skills/
├── lit_web_components/
│   └── SKILL.md
├── nestjs_backend/
│   └── SKILL.md
├── ffmpeg_media_processing/
│   └── SKILL.md
├── gemini_ai_integration/
│   └── SKILL.md
├── workers_job_queues/
│   └── SKILL.md
├── testing_strategy/
│   └── SKILL.md
├── security_privacy/
│   └── SKILL.md
├── accessibility_wcag/
│   └── SKILL.md
└── performance_optimization/
    └── SKILL.md
```

## 🎯 Skills Disponibles

### Frontend

- **[lit_web_components](./lit_web_components/SKILL.md)** - Composants Lit 3.x + Lit Signals
- **[accessibility_wcag](./accessibility_wcag/SKILL.md)** - WCAG 2.1 AA compliance

### Backend

- **[nestjs_backend](./nestjs_backend/SKILL.md)** - Architecture NestJS SOLID
- **[workers_job_queues](./workers_job_queues/SKILL.md)** -SQL-Queue réactif (sans Redis)

### Cross-Cutting

- **[ffmpeg_media_processing](./ffmpeg_media_processing/SKILL.md)** - Traitement vidéo non-bloquant
- **[gemini_ai_integration](./gemini_ai_integration/SKILL.md)** - Analyse multimodale avec Gemini
- **[testing_strategy](./testing_strategy/SKILL.md)** - Vitest/Jest/Playwright
- **[security_privacy](./security_privacy/SKILL.md)** - Zero-persistence et data privacy
- **[performance_optimization](./performance_optimization/SKILL.md)** - Optimisations SSE/DB/rendering

## 🤖 Utilisation par Antigravity

Antigravity détecte automatiquement les skills depuis `.agent/skills/` (cross-platform) ou `.gemini/skills/` (Gemini-specific).

Les skills sont chargées automatiquement selon :
1. **Contexte de fichier** : Édition dans `apps/front/src/components/*.ts` → `lit_web_components`
2. **Mots-clés** : Fichier contient `@customElement` → `lit_web_components`
3. **Référence explicite** : "Utilise la skill FFmpeg..."

## 📋 Format SKILL.md

Chaque `SKILL.md` contient :
- **Frontmatter YAML** : `name` et `description`
- **When to Use This Skill** : Quand l'appliquer
- **Core Principles** : Principes architecturaux
- **Mandatory Patterns & Rules** : Patterns obligatoires avec code
- **Common Pitfalls** : Erreurs à éviter
- **Testing Requirements** : Comment tester
- **Checklist** : Validation avant commit

## 🔗 Alignement Architecture

Toutes les skills respectent [`_bmad-output/planning-artifacts/architecture.md`](../../_bmad-output/planning-artifacts/architecture.md) :

- ✅ Zero-persistence média
- ✅ SQL-Queue réactif (pas Redis)
- ✅ Lit Signals natif
- ✅ WCAG 2.1 AA obligatoire
- ✅ TypeORM Data Mapper
- ✅ Hybrid Cloud/Local IA
- ✅ SSE pour temps réel

## 📝 Historique

- **2026-02-10** : Création des 9 skills fondamentales dans le format Antigravity
  - Structure: répertoires snake_case avec SKILL.md
  - Frontend: Lit Web Components, Accessibility WCAG
  - Backend: NestJS, Workers & Job Queues
  - Cross-cutting: FFmpeg, Gemini IA, Testing, Security, Performance

---

Built for [Antigravity](https://antigravity.google/) AI agents.
