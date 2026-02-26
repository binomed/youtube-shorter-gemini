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

### Epic 1: Workspace & Technical Induction
Establish the project foundation and enable video ingestion.
**Goal:** Functional monorepo with project management and privacy-compliant media induction.
**FRs covered:** FR1, FR2, FR3, FR13

### Epic 2: Gemini-Powered Magic Moments
Automate viral potential discovery using AI and provide guidance.
**Goal:** Gemini-driven segment suggestions and user fallback/tutorial support.
**FRs covered:** FR4, FR6, FR12

### Epic 3: Advanced Media Enrichment (Audio & Subtitles)
Elevate technical quality with stems and customizable dynamic subtitles.
**Goal:** Clean transcription, voice isolation, and stylized interactive text overlays.
**FRs covered:** FR5, FR7, FR8, FR9

### Epic 4: Multi-Segment Editor & Real-time Render
Provide a reactive video editing experience.
**Goal:** Multi-segment assembly with immediate jump-cut feedback.
**FRs covered:** FR10, FR11, FR14

### Epic 5: Final Production & Export
Convert work into an exploitable video file.
**Goal:** High-quality MP4 file export ready for publication.
**FRs covered:** FR15

---

## Epic 1: Workspace & Technical Induction

### Story 1.1: Project Scaffolding & CI Setup
As a Developer,
I want to initialize the Turborepo (NestJS/Lit) with quality gates and Playwright accessibility tests,
So that I have a solid, accessible foundation for development.

**Acceptance Criteria:**
- **Given** a new project directory
- **When** the bootstrap script is run
- **Then** a monorepo is created with `apps/back`, `apps/front`, and `packages/shared`.
- **And** CI runs automated unit tests and Axe-core accessibility audits (Playwright).

### Story 1.2: Project Creation & Video Ingestion
As a creator,
I want to name my project and upload a local video file (MP4/MOV),
So that I can start the creation process.

**Acceptance Criteria:**
- **Given** the application dashboard
- **When** I enter a project name and select a valid video file
- **Then** a project is created and the video is ingested into the workspace.

### Story 1.3: Privacy Awareness & Consent
As a privacy-conscious user,
I want to be informed about the data deletion policy and give my consent for AI learning,
So that I feel secure about my files.

**Acceptance Criteria:**
- **Given** the ingestion process
- **When** I upload a video
- **Then** a mandatory notice about file deletion is displayed.
- **And** an explicit opt-in for AI learning is presented.

---

## Epic 2: Gemini-Powered Magic Moments

### Story 2.1: Automated Viral Analysis
As a creator,
I want the IA to analyze my video and suggest 3-5 segments with high potential,
So that I don't waste time searching for key moments.

**Acceptance Criteria:**
- **Given** an uploaded video
- **When** I trigger the IA analysis
- **Then** Gemini returns a list of suggested segments with titles and timestamps.
- **And** these segments appear as thumbnails in the sidebar.

### Story 2.2: Survival Guide (Fallback UI)
As a creator,
I want to receive advice if the IA fails to detect any viral segments,
So that I am not left without a solution.

**Acceptance Criteria:**
- **Given** an analysis return with 0 segments
- **When** the user is on the results page
- **Then** a "Survival Guide" is displayed with tips for manual editing and filming advice.

---

## Epic 3: Advanced Media Enrichment (Audio & Subtitles)

### Story 3.1: Audio Stem Separation & Transitions
As a producer,
I want to isolate voice from background music and apply automatic crossfades,
So that transitions sounding professional and fluid.

**Acceptance Criteria:**
- **Given** an analysis process
- **When** the system generates stems
- **Then** separate tracks are available in the editor.
- **And** progress bars show the status of separation for each stem.
- **And** crossfades are automatically generated between jump-cuts.

### Story 3.2: Dynamic Subtitle Editor & Styling
As a creator,
I want to edit subtitles directly on the video and customize their appearance (font, size, position),
So that my Shorts have a unique and professional brand.

**Acceptance Criteria:**
- **Given** a video preview with subtitles
- **When** I click a subtitle, the video pauses and a floating text editor appears.
- **And** the `Subtitle` entity is correctly updated in the database on blur/save.
- **And** I can adjust font profile, size, and XY position via a dedicated style panel.
- **And** styling changes are persisted at the Short level.

---

## Epic 4: Multi-Segment Editor & Real-time Render

### Story 4.1: Manual Segment Capture (In/Out)
As a creator,
I want to capture my own segments using hotkeys (I/O) during playback,
So that I have full control over the narrative flow.

**Acceptance Criteria:**
- **Given** a playing video
- **When** I press 'I' then 'O'
- **Then** a new segment is added to the selection.
- **And** the segment is immediately visible in the multi-timeline.

### Story 4.2: Real-time Jump-Cut Preview
As a creator,
I want to see the sequence of my segments with jump-cuts immediately,
So that I can verify the edit without waiting for a full render.

**Acceptance Criteria:**
- **Given** multiple segments in a Short
- **When** the player reaches the end of a segment
- **Then** it jumps immediately to the start of the next one.
- **And** SSE events provide real-time feedback on background processing stages.

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
