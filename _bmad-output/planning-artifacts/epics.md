---
stepsCompleted: [1, 2, 3]
inputDocuments: ['_bmad-output/planning-artifacts/prd.md', '_bmad-output/planning-artifacts/architecture.md', '_bmad-output/planning-artifacts/ux-design-specification.md']
---

# youtube-shorter-gemini - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for youtube-shorter-gemini, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Importation de fichiers vidéo locaux (MP4, MOV).
FR2: Organisation et nommage des projets de Shorts.
FR3: Information utilisateur obligatoire sur la politique de suppression des données à l'import.
FR4: Détection et suggestion de segments viraux via analyse multimodale (Gemini). L'utilisateur peut capturer manuellement des segments via un mécanisme In-Out pendant la lecture.
FR5: Recalage précis des timestamps (timing fin) basé sur l'audio et le texte pour éviter les mots tronqués.
FR6: Ré-analyse manuelle d'un segment ou d'une zone temporelle sur demande utilisateur.
FR7: Séparation des pistes voix/musique (Stems).
FR8: Application de fondus audio (Crossfades) automatiques.
FR9: Visualisation et édition manuelle de la transcription/sous-titres.
FR10: Rendu vidéo local gérant la concaténation de segments multiples. Supporte le feedback immédiat (visualisation du jump-cut dès la fin de la capture) et les transitions par défaut en jump-cut avec un mécanisme de micro-effets ajustables par cut.
FR11: Suivi de progression en temps réel (analyse et export).
FR12: Affichage de tutoriels contextuels en cas d'échec de la détection automatique.
FR13: Gestion du consentement pour l'apprentissage IA.
FR14: Composition de Shorts à partir d'un nombre illimité de séquences non-contigues (capture In-Out) originaires de la vidéo source.
FR15: Exportation du Short finalisé vers un fichier local (MP4) avec sous-titres incrustés et audio optimisé.

### NonFunctional Requirements

NFR1: Rendu d'un segment de 60s produit en < 60s (machine locale).
NFR2: UI Latency < 200ms pour les interactions sémantiques.
NFR3: Analyse < 30s d'attente initiale pour une vidéo source de 10 minutes.
NFR4: Étanchéité totale des fichiers temporaires entre les sessions.
NFR5: Standard WCAG 2.1 AA (navigation clavier, contrastes, lecteurs d'écran).
NFR6: Minimalisme : Interface focalisée sur le contenu média (zero-distraction).
NFR7: Efficacité : Utilisation de raccourcis clavier pour les tâches à haute fréquence.

### Additional Requirements

- **Starter Template:** Turborepo + npm workspaces (Architecture).
- **Backend:** NestJS (Node.js) with SQLite/TypeORM (Architecture).
- **Frontend:** LitElement + Lit Signals with Atomic Design. Styled with **Tailwind CSS 4.x** (Layout/Utilities) and **Shoelace** (UI Components) (Architecture).
- **Media Processing:** FFmpeg via child_process.spawn with JobService orchestration (Architecture).
- **Communication:** REST API + SSE for real-time progress (Architecture).
- **Navigation:** Vertical Reel scroller (UX).
- **Interaction Model:** "Creative Supervisor" (IA proposal, User validation/exception) (UX).
- **Editing:** Direct floating text editing on video (UX).
- **Multi-segment Workflow:** "Capture & Adjustment" (Mark In/Out) (UX).
- **Shortcuts:** Space, J, K, L, I, O, Backspace (UX).
- **Accessibility:** WCAG 2.1 AA compliance (UX).
- **Feedback:** Instant auto-save for all adjustments (UX).

### FR Coverage Map

FR1: Epic 1 - Projects
FR2: Epic 1 - Projects
FR3: Epic 1 - Projects
FR4: Epic 2 - Gemini Discovery
FR5: Epic 3 - Enrichment
FR6: Epic 2 - Gemini Discovery
FR7: Epic 3 - Enrichment
FR8: Epic 3 - Enrichment
FR9: Epic 3 - Enrichment
FR10: Epic 4 - Editor
FR11: Epic 4 - Editor
FR12: Epic 1 & 2 - Support
FR13: Epic 1 - Privacy
FR14: Epic 4 - Editor
FR15: Epic 5 - Export

## Epic List

### Epic 0: Technical Foundation & Project Scaffolding
Establish the structural and quality baseline of the project.
**Goal:** A working Monorepo with NestJS, Lit, automated tests, and Accessibility CI.
**FRs covered:** N/A (Technical infra)

### Epic 1: Workspace & Media Induction
Enable users to create projects and import videos securely.
**Goal:** Functional project management and privacy-compliant media ingestion.
**FRs covered:** FR1, FR2, FR3, FR13

### Epic 2: Gemini-Powered Magic Moments
Automate viral potential discovery using AI.
**Goal:** Gemini-driven segment suggestions.
**FRs covered:** FR4, FR6, FR12

### Epic 3: Advanced Media Enrichment (Audio & Subtitles)
Elevate technical quality with stems and dynamic subtitles.
**Goal:** Clean transcription, voice isolation, and fluid transitions.
**FRs covered:** FR5, FR7, FR8, FR9

### Epic 4: Multi-Segment Editor & Real-time Render
Provide a reactive video editing experience.
**Goal:** Multi-segment assembly with immediate jump-cut feedback.
**FRs covered:** FR10, FR11, FR14

### Epic 5: Final Production & Export
Convert work into an exploitable video file.
**Goal:** High-quality MP4 file export ready for publication.
**FRs covered:** FR15

### Epic 6: App Configuration Settings
Allow users to tweak the analysis & generation parameters.
**Goal:** A settings tab/modal to change AI models, frame intervals, etc.
**FRs covered:** N/A (Enhancement)

---

## Epic 0: Technical Foundation & Project Scaffolding

Establish the monorepo structure, core frameworks, and quality enforcement tools.

### Story 0.1: Monorepo Scaffolding
As a Developer,
I want to initialize a Turborepo with apps for Back (NestJS) and Front (Lit),
So that I have a clean, shared workspace.

**Acceptance Criteria:**
**Given** a clean project directory
**When** I run the initialization script
**Then** I have a monorepo with `apps/back`, `apps/front`, and `packages/shared`.
**And** build commands work across all packages.

### Story 0.2: Quality Gates & Testing Setup
As a Developer,
I want automated Jest/Vitest testing and Axe-core accessibility auditing,
So that I can maintain high quality and accessibility from the start.

**Acceptance Criteria:**
**Given** the monorepo structure
**When** I commit code
**Then** automated tests (Unit & Integration) run.
**And** an accessibility audit (CI) checks the Lit components.

> [!IMPORTANT]
> **Story 0.2 provides BASIC accessibility validation only** (happy-dom checks). A future story in Epic 1 or Epic 2 MUST implement **comprehensive WCAG 2.1 AA testing** using:
> - **Playwright** for real browser environment
> - **@axe-core/playwright** for complete accessibility audits
> - **Keyboard navigation testing** (Tab, Enter, Escape, Arrow keys)
> - **Screen reader compatibility** validation
> - **Color contrast** and **focus management** checks
> 
> The current `basic-accessibility-checks` CI job is intentionally limited and serves as a foundation only.

---

## Epic 1: Workspace & Media Induction

### Story 1.1: Project Creation & Video Ingestion
As a creator,
I want to name my project and upload a local video file (MP4/MOV),
So that I can start the creation process.

**Acceptance Criteria:**
**Given** the application home page
**When** I enter a project name and select a valid video file
**Then** the project is created in the database.
**And** the video occupies the central workspace.

### Story 1.2: Privacy Awareness & Consent
As a privacy-conscious user,
I want to be informed about the data deletion policy and give my consent for AI learning,
So that I feel secure about my files.

**Acceptance Criteria:**
**Given** the ingestion process
**When** I upload a video
**Then** a mandatory notice about file deletion is displayed.
**And** an explicit opt-in for AI learning is presented.

---

## Epic 2: Gemini-Powered Magic Moments

### Story 2.1: Automated Viral Analysis
As a creator,
I want the IA to analyze my video and suggest 3-5 segments with high potential,
So that I don't waste time searching for key moments.

**Acceptance Criteria:**
**Given** an uploaded video
**When** I trigger the IA analysis
**Then** Gemini identifies and returns a list of suggested segments with titles and timestamps.
**And** these segments appear as thumbnails in the sidebar.

---

## Epic 3: Advanced Media Enrichment (Audio & Subtitles)

### Story 3.1: Audio Stem Separation
As a producer,
I want the system to isolate voice from background music,
So that transitions and cuts don't sound abrupt.

**Acceptance Criteria:**
**Given** a selected segment
**When** processing starts
**Then** separate audio stems (voice/music) are generated.
**And** audio crossfades are applied between cuts.

### Story 3.2: Dynamic Subtitle Interaction
As a creator,
I want to edit the transcription directly on the video preview,
So that I can quickly fix spelling errors.

**Acceptance Criteria:**
**Given** a video preview with subtitles
**When** I click on a word or a sentence
**Then** a floating editor appears.
**And** my changes are auto-saved and reflected in the video preview immediately.

---

## Epic 4: Multi-Segment Editor & Real-time Render

### Story 4.1: Multi-Segment Composition (Jump-Cuts)
As a perfectionist,
I want to capture multiple non-contiguous moments and see the jump-cut immediately,
So that I can verify the flow of my Short.

**Acceptance Criteria:**
**Given** the source video
**When** I use Mark In/Out (I/O) repeatedly
**Then** multiple segments are added to the current Short.
**And** the player previews the sequence with jump-cuts instantly.

### Story 4.2: Real-time Progress Tracking
As an impatient user,
I want to see the progress of analysis and rendering,
So that I know how long I have to wait.

**Acceptance Criteria:**
**Given** a long-running process (IA analysis or Render)
**When** the task is running in the background
**Then** a real-time progress bar (via SSE) is visible in the UI.

---

## Epic 5: Final Production & Export

### Story 5.1: High-Quality Local Export
As a creator,
I want to export my finalized Short as an MP4 file,
So that I can publish it on social media.

**Acceptance Criteria:**
**Given** a finalized Short
**When** I click on "Export"
**Then** FFmpeg processes the render locally.
**And** a 9:16 vertical MP4 file with burned-in subtitles is saved to my machine.

---

## Epic 6: App Configuration Settings

### Story 6.1: Global Settings Interface
As a power user,
I want to be able to configure AI and video processing parameters (e.g. Gemini model choice, frame extraction interval),
So that I can fine-tune the performance and quality of the analysis to my specific needs.

**Acceptance Criteria:**
**Given** the application home page or navigation menu
**When** I navigate to the "Settings" or "Configuration" section
**Then** I see options to modify key parameters (e.g., "Frame Extraction Interval (seconds)", "Gemini Model").
**And** changes I make are saved persistently and applied to all future video analyses.
