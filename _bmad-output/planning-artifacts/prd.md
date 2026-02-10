---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish']
inputDocuments: []
workflowType: 'prd'
classification:
  projectType: 'web_app'
  domain: 'scientific/ai'
  complexity: 'medium'
  projectContext: 'greenfield'
lastEdited: '2026-02-10'
editHistory:
  - date: '2026-02-10'
    changes: 'Clarified multi-segment composition. Refined workflow: In-Out capture, immediate jump-cut feedback, and adjustable micro-effects between segments.'
---

# Product Requirements Document - youtube-shorter-gemini

**Author:** jef
**Date:** 2026-02-06

## Executive Summary

**Vision**
`youtube-shorter-gemini` est un outil de productivité simplifiant radicalement la création de YouTube Shorts à partir de vidéos longues. L'outil automatise la détection et l'assemblage de moments clés (multi-segments/jump-cuts), la séparation audio et le sous-titrage dynamique, permettant aux créateurs de se concentrer sur le contenu plutôt que sur le montage technique.

**Differentiateur Clé**
Fusion de l'analyse sémantique multimodale (Gemini) avec un traitement multimédia local (découpage/rendu) pour garantir confidentialité, réactivité et fluidité sonore (stem separation).

**Cible**
Créateurs de contenu indépendants (Alex) cherchant à maximiser leur présence multi-plateforme avec un effort minimal.

## Success Criteria

### User Success
*   **Interaction Manuelle :** < 5 minutes pour produire et affiner 3-5 Shorts (potentiellement multi-segments).
*   **Qualité IA :** >= 80% des moments clés suggérés sont pertinents et intégrés nativement dans les Shorts.

### Business Success
*   **Productivité :** Réduction de 80% du temps de production de Shorts par rapport à un montage manuel traditionnel.
*   **Engagement :** 100% des vidéos exportées incluent des sous-titres dynamiques optimisés pour la rétention.

### Technical Success
*   **Précision du Timing :** Zéro coupure au milieu d'un mot ou d'une phrase clé grâce au recalage transcription/audio.
*   **Performance :** Rendu d'un Short de 60s en < 60s sur machine locale.
*   **Audio :** Transitions fluides (fondus ou stems) sans artefacts perceptibles lors des coupes.

## User Journeys

### Alex - Le Créateur Efficace (Success Path)
Alex importe une vidéo de 15 minutes. L'IA analyse le contenu, sépare la musique de la voix, et propose 3 segments percutants. Alex valide, télécharge et publie. Temps total investi : minimal.

### Alex - Le Perfectionniste (Adjustment)
L'IA détecte plusieurs segments d'humour séparés par du "dead air". Alex utilise l'interface pour assembler ces moments non-contigus en un unique Short dynamique (jump-cut), ajuste finement les timestamps de chaque segment et corrige une faute dans les sous-titres.

### Alex - Le Créateur Guidé (Fallback Path)
Si l'IA ne détecte aucun segment probant, l'outil fournit un "Guide de survie" interactif avec des conseils de montage manuel (ex: tutoriels pour CapCut) et des astuces de tournage pour faciliter l'analyse future.

## Product Scope & Roadmap

### Phase 1: MVP (Focus Machine Locale)
*   **Ingestion :** Upload de fichiers locaux (MP4/MOV).
*   **IA Detection :** Analyse sémantique via Gemini Cloud pour identifier des segments clés.
*   **Structure Short :** Un Short peut regrouper plusieurs segments non-contigus (jump-cuts).
*   **Timing Fin :** Recalage automatique des coupes pour éviter les mots tronqués.
*   **Traitement Local :** Découpage, concaténation et rendu effectués sur la machine utilisateur.
*   **Édition :** Correction manuelle des sous-titres, du cadrage et du timing.
*   **Export :** Vidéo verticale (9:16) avec sous-titres incrustés.

### Phase 2: Growth (IA Hybride & Connectivité)
*   **LLM Hybride :** Choix entre LLM distant (Gemini Cloud) ou local (Chrome built-in APIs).
*   **Sources :** Import direct via URL YouTube.
*   **Styles :** Bibliothèque de templates visuels pour les sous-titres.

### Phase 3: Expansion (Distribution & Automatisation)
*   **Publication :** Exports directs vers APIs YouTube/TikTok/Instagram.
*   **Visuels+ :** Ajout automatique de B-Rolls illustratifs par IA.
*   **International :** Traduction multilingue (audio/texte).

## Domain-Specific & Innovation Requirements

### Privacy & Data Handling
*   **Zero-Persistence :** Suppression immédiate des fichiers sources et temporaires après téléchargement ou fin de session.
*   **Consentement IA :** Système d'Opt-in explicite avant tout stockage de corrections utilisateur pour l'entraînement futur.

### Innovative Patterns
*   **Audio Stem Separation :** Isolation des pistes voix/musique en amont pour garantir des transitions sonores parfaites, même lors de jump-cuts entre segments.
*   **Workflow "Zéro Timeline" :** Édition pilotée par le texte et les segments plutôt que par une timeline complexe, même pour des Shorts multi-segments.

## Project-Type Specific Requirements (Web App SPA)

*   **Frontend :** Architecture SPA basée sur **Angular** ou **Lit Element**.
*   **Interactivité :** Feedback temps réel (WebSockets/SSE) pour les barres de progression d'analyse et de rendu.
*   **Lecteur :** Visualisation native au format vertical **9:16**.
*   **Navigateurs :** Optimisation prioritaire pour Chrome (exploitation des APIs expertes type Gemini Nano).

## Functional Requirements (Capability Contract)

### 1. Gestion des Médias & Projets
- **FR-01 :** Importation de fichiers vidéo locaux (MP4, MOV).
- **FR-02 :** Organisation et nommage des projets de Shorts.
- **FR-03 :** Information utilisateur obligatoire sur la politique de suppression des données à l'import.

### 2. Analyse & Découpage IA
- **FR-04 :** Détection et suggestion de segments viraux via analyse multimodale (Gemini). L'utilisateur peut capturer manuellement des segments via un mécanisme **In-Out** pendant la lecture.
- **FR-05 :** Recalage précis des timestamps (timing fin) basé sur l'audio et le texte pour éviter les mots tronqués.
- **FR-06 :** Ré-analyse manuelle d'un segment ou d'une zone temporelle sur demande utilisateur.

### 3. Traitement Audio & Sous-titres
- **FR-07 :** Séparation des pistes voix/musique (Stems).
- **FR-08 :** Application de fondus audio (Crossfades) automatiques.
- **FR-09 :** Visualisation et édition manuelle de la transcription/sous-titres.

### 4. Rendu & Guidance
- **FR-10 :** Rendu vidéo local gérant la concaténation de segments multiples. Supporte le **feedback immédiat** (visualisation du jump-cut dès la fin de la capture) et les transitions par défaut en **jump-cut** avec un mécanisme de **micro-effets** ajustables par cut.
- **FR-11 :** Suivi de progression en temps réel (analyse et export).
- **FR-12 :** Affichage de tutoriels contextuels en cas d'échec de la détection automatique.
- **FR-13 :** Gestion du consentement pour l'apprentissage IA.
- **FR-14 :** Composition de Shorts à partir d'un nombre illimité de séquences non-contigues (capture In-Out) originaires de la vidéo source.

## Non-Functional Requirements (Quality Attributes)

### Performance
- **Rendu :** Segment de 60s produit en < 60s (machine locale).
- **UI Latency :** < 200ms pour les interactions sémantiques.
- **Analyse :** < 30s d'attente initiale pour une vidéo source de 10 minutes.

### Sécurité & Accessibilité
- **Isolation :** Étanchéité totale des fichiers temporaires entre les sessions.
- **Accessibilité :** Standard **WCAG 2.1 AA** (navigation clavier, contrastes, lecteurs d'écran).

### UX Design
- **Minimalisme :** Interface focalisée sur le contenu média (zero-distraction).
- **Efficacité :** Utilisation de raccourcis clavier pour les tâches à haute fréquence.
