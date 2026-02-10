---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments: ['_bmad-output/planning-artifacts/prd.md']
workflowType: 'architecture'
lastStep: 8
status: 'complete'
completedAt: '2026-02-08'
project_name: 'youtube-shorter-gemini'
author: 'jef'
date: '2026-02-07'
---

# Architecture Decisions - youtube-shorter-gemini

This document records the architectural decisions for the youtube-shorter-gemini project, ensuring consistency and preventing implementation conflicts.

## Executive Summary

[TBD: Architectural vision and core technical strategy]

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
Le système doit permettre l'ingestion de vidéos locales, leur analyse sémantique via Gemini, le recalage précis (Timing IA), la séparation audio et le rendu final vertical, le tout piloté par une interface SPA minimaliste. L'accessibilité (WCAG 2.1 AA) est un pré-requis fonctionnel majeur.

**Non-Functional Requirements:**
- **Performance :** Rendu local < 60s pour un segment de 60s. Temps réel pour les retours d'état.
- **Confidentialité :** Zero-persistence et traitement local des médias.
- **Qualité de Code :** SOLID, KISS, tests unitaires (classes), typage fort (Typescript). Style orienté objet (classes) privilégié.
- **Documentation :** JSDoc, ADRs, Guide de contribution (CONTRIBUTING.md), Agent docs.

## Implementation Patterns & Consistency Rules

### Naming Patterns
- **Backend (TS) :** `camelCase` pour méthodes/variables, `PascalCase` pour Classes/Types. Fichiers : `nom-domaine.service.ts`.
- **Frontend (Lit) :** `camelCase` pour props/méthodes. Fichiers : `mon-composant.element.ts`.
- **Base de Données :** `snake_case` pour tables/colonnes (SQL). Mappage `camelCase` dans les entités TypeORM.
- **API REST :** Kebab-case pluriel (ex: `/api/video-segments`).

### Structure Patterns
- **Co-location :** Fichiers de tests (`*.spec.ts`) à côté du code source.
- **Frontend :** Organisation **Atomic Design** (`atoms/`, `molecules/`, `organisms/`, `templates/`).
- **Shared Package :** Un package `shared` centralise les DTOs, interfaces de validation et types communs pour garantir la cohérence Back/Front.

### Format Patterns
- **API Enveloping :** Toutes les réponses REST suivent `{ success: boolean, data: T, error?: string }`.
- **Temporal :** Dates au format **ISO 8601** (strings).
- **Errors :** Utilisation systématique des exceptions NestJS (`HttpException`).

### Process Patterns
- **Documentation :** **JSDoc** obligatoire pour toute logique métier et APIs publiques.
- **Commits :** **Conventional Commits** (`feat:`, `fix:`, `docs:`, `refactor:`).
- **Licence :** En-tête de licence Apache 2.0 présent dans chaque fichier source.

## System Layout & Boundaries

### monorepo Structure (Turborepo + npm workspaces)

```text
youtube-shorter-gemini/
├── apps/
│   ├── back/                # Backend NestJS
│   │   ├── src/
│   │   │   ├── modules/     # Logic by domain (Video, IA, Project)
│   │   │   ├── entities/    # TypeORM Classes
│   │   │   └── workers/     # BullMQ Jobs (FFmpeg)
│   │   └── test/            # Jest Unit/Integration
│   └── front/               # Frontend Lit
│       ├── src/
│       │   ├── components/  # Atomic Design (Atoms, Molecules...)
│       │   ├── state/       # Lit Signals (Global state)
│       │   └── services/    # API Client (REST/SSE)
│       └── vite.config.ts
├── packages/
│   ├── shared/              # Shared logic
│   │   ├── dto/             # API request/response classes
│   │   ├── types/           # Common Interfaces
│   │   └── validation/      # Class-validator schemas
│   └── config/              # Shared build config (ESLint, Prettier)
├── docker/                  # Optional: Local LLM (Ollama) helpers
├── package.json             # Root package.json with npm workspaces
├── turbo.json               # Monorepo orchestration
└── .env.sample              # Configuration template
```

### Architectural Boundaries & Integration

**1. API Boundary (REST/SSE):**
- Le Frontend ne manipule jamais directement le système de fichiers ou les modèles IA.
- Toute interaction passe par le service `back` via des endpoints typés.
- Les notifications de progression de rendu (FFmpeg) sont poussées via **SSE**.

**2. Data Boundary (Local SQLite):**
- Seul le Backend a accès à l'instance SQLite.
- Les données sont isolées par projet. Aucun stockage média binaire en base.

**3. Media Boundary (FFmpeg):**
- Orchestration via un **JobService (TypeORM + SQLite)**. Les tâches longues (FFmpeg, IA) sont enregistrées en base pour persistence.
- Exécution via `child_process.spawn` dans des services isolés pour ne pas bloquer l'Event Loop.
- État de progression mis à jour en base et diffusé via **SSE**.

### Mapping des fonctionnalités (Requirements to Code)
- **Ingestion (FR-01) :** `apps/back/modules/ingestion`
- **IA Detection (FR-04) :** `apps/back/modules/analysis` (Gemini API / Ollama)
- **Timing IA (FR-05) :** `apps/back/modules/processing/timing`
- **Rendu (FR-12) :** `apps/back/modules/processing/render` (FFmpeg Wrapper gérant la concaténation de segments multiples + JobService)
- **UI (FR-15) :** `apps/front/components/organisms/shorts-editor`

### Technical Constraints & Dependencies
- **Monorepo :** Séparation claire mais gestion unifiée du code.
- **Backend :** API REST avec **NestJS**. Orchestration CPU-intensive (FFmpeg) via une file d'attente (**JobService (TypeORM + SQLite)** pour la persistance et la simplicité).
- **Frontend :** SPA avec **LitElement** et **Lit Signals** (native). Build via **Vite**.
- **Data :** **SQLite** pour les métadonnées de projet. Pas de stockage média persistant.
- **IA :** Hybride (Gemini Cloud + Ollama Local).
- **Standards :** Prettier, Convention de Commit, Licence Apache 2.0.
- **Accessibilité :** Priorité aux standards WCAG dès la conception.

### Cross-Cutting Concerns
- **Orchestration Multimédia :** Gestion asynchrone des tâches FFmpeg pour éviter de bloquer le thread principal.
- **Real-time Feedback :** Utilisation de **SSE** pour notifier le frontend de l'avancement des traitements backend.
- **Traçabilité Décisionnelle :** Mise en place d'ADRs dès le démarrage.

## Core Architectural Decisions

### Data Architecture
- **Database :** SQLite (moteur de stockage local, fichier unique).
- **ORM :** **TypeORM v0.3.x** (Data Mapper pattern). Permet une séparation nette entre entités DB et logique métier, facilitant **SOLID**.
- **Migrations :** Gérées via TypeORM CLI pour assurer la traçabilité des évolutions du schéma.

### Security & Secret Management
- **Authentification :** Aucune (usage local uniquement).
- **Secrets :** Usage de fichiers `.env` ignorés par Git. Un fichier `.env.sample` sera fourni pour configurer les clés Gemini/Ollama.
- **Middlewares :** **Helmet** pour la sécurité de base de l'API NestJS.
- **Validation :** Validation stricte des entrées via **class-validator** et les Pipes NestJS.

### API & Communication Patterns
- **API REST :** Standard pour toutes les interactions synchrones (gestion de projet, CRUD segments).
- **SSE (Server-Sent Events) :** Utilisé pour le streaming d'état lors des tâches asynchrones (découpage FFmpeg, analyse IA).
- **Contrat d'Interface :** DTOs partagés (TypeScript) dans le package `shared` du monorepo.

### Frontend Architecture
- **State Management :** **Lit Signals** (natif) pour une réactivité fine sans surpoids.
- **Routing :** **@vaadin/router** (léger et standard-compliant).
- **Atomic Design :** Composants organisés par atomes/molécules, utilisant du **CSS pur** (Shadow DOM) avec Tailwind pour le layout global.

### Mécanisme de SQL-Queue (Réactif)

Pour garantir la légèreté (KISS) et la résilience, nous utilisons une file d'attente pilotée par événements :

1.  **Réception (Front -> Back) :** Le Frontend envoie une requête de traitement. Le Backend enregistre immédiatement le job en base (`jobs` table) avec `status: 'PENDING'`.
2.  **Activation Réactive :** Au lieu de "poller" (interroger) la base, le Backend déclenche immédiatement le traitement via un `EventEmitter` (ou appel direct au `ProcessorService`) dès l'insertion.
3.  **Exécution FFmpeg :** Le Worker lance `child_process.spawn`. NestJS écoute les flux `stdout/stderr` de FFmpeg.
4.  **Mise à jour en flux tendu :** À chaque progression détectée dans la sortie FFmpeg, le Backend met à jour la ligne en base **ET** émet un message via le flux **SSE** ouvert par le client.
5.  **Rétablissement (Auto-Guetteur) :** Un service de fond léger ne vérifie la base **qu'au démarrage** ou en cas de crash pour relancer les jobs qui seraient restés bloqués en `PROCESSING`. En régime de croisière, tout est évènementiel.

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
- L'empilement **Turborepo + NestJS + Lit** est parfaitement cohérent pour un projet TypeScript Full-Stack en 2026.
- **TypeORM + SQLite** est la solution la plus stable pour une gestion de base de données locale typée par classes.
- L'approche **SSE + SQL-Queue réactive** élimine les dépendances lourdes (Redis) tout en assurant la persistance.

**Pattern Consistency:**
- Les patterns de nommage (camelCase/snake_case) et la structure **Atomic Design** soutiennent directement l'objectif de code propre (SOLID).

### Requirements Coverage Validation ✅

**Functional Requirements Coverage:**
- **Ingestion/Projets :** Couverts par `apps/back/modules/ingestion` et TypeORM.
- **Analyse IA :** Couverts par `apps/back/modules/analysis` (Gemini API).
- **Processing/Render :** Couverts par le `JobService` réactif et FFmpeg dans `apps/back/modules/processing`.
- **UI :** Couvert par Lit et Lit Signals dans `apps/front`.

**Non-Functional Requirements Coverage:**
- **Performance :** L'usage de `spawn` asynchrone garantit que l'Event Loop NestJS n'est jamais bloqué.
- **Local-first :** Suppression de Redis pour un déploiement "Zero-Config" via SQLite/FFmpeg.

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION
**Confidence Level:** HIGH

**AI Agent Guidelines:**
- Utiliser `apps/back` et `apps/front` comme racines.
- Partager les DTOs via `packages/shared`.
- Respecter le pattern de Job SQL réactif pour toute tâche > 2s.

---
*Created as part of the youtube-shorter-gemini architecture definition.*

## Starter Template Evaluation

### Primary Technology Domain
**Full-Stack Monorepo** (Local + Cloud Hybrid) basé sur l'écosystème TypeScript.

### Starter Options Considered

1.  **Nx :** Très puissant, excellent support NestJS/Vite, mais peut être trop complexe (Over-engineering) pour un projet individuel "KISS".
2.  **NestJS Native Monorepo :** Simple pour le backend, mais moins outillé pour gérer un frontend Lit/Vite au sein du même repo de manière fluide.
3.  **Turborepo + npm workspaces :** **SÉLECTIONNÉ**. Offre le meilleur équilibre entre simplicité de configuration (KISS) et performance.

### Selected Starter: Turborepo (via npm workspaces)

**Rationale for Selection:**
Turborepo permet une séparation nette entre `apps/api` (NestJS) et `apps/web` (Lit/Vite) tout en facilitant le partage de code (DTOs, Types) via des librairies locales. Sa configuration est minimale (`turbo.json`) et son exécution est extrêmement rapide.

**Initialization Command:**

```bash
pnpm create turbo@latest ./ --example kitchen-sink (adapté pour Nest/Vite)
# Ou initialisation manuelle pour un contrôle total SOLID/KISS
```

### Architectural Decisions Provided by Starter

**Language & Runtime:**
- **TypeScript 5.x** configuré via des `tsconfig` partagés à la racine.
- **npm workspaces** pour la gestion des dépendances et du linking local.

**Styling Solution:**
- **Tailwind CSS 4.x** intégré via Vite pour le frontend.
- **CSS Pure** pour les composants Lit (Atomic Design).

**Build Tooling:**
- **Vite 6.x** pour le frontend (HMR ultra-rapide).
- **Nest CLI** pour le backend.
- **Turbo** pour orchestrer les builds, lint et tests en parallèle.

**Testing Framework:**
- **Vitest** (Frontend) et **Jest** (Backend/NestJS) pour une couverture complète des classes.

**Code Organization:**
- `apps/api` : Backend NestJS.
- `apps/web` : Frontend Lit.
- `packages/shared` : Contrat d'interface (DTOs), constantes et types partagés.
