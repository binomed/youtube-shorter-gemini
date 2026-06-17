# YouTube Shorter Gemini - User Guide

Welcome to the **YouTube Shorter Gemini** User Guide. This guide will walk you through importing videos, configuring settings, and using the editor to create high-quality vertical Shorts.

---

## Table of Contents
1. [Home (Dashboard)](#1-home-dashboard)
2. [Configuration (Settings)](#2-configuration-settings)
3. [Edition Page](#3-edition-page)
   - [Subtitle Styling](#subtitle-styling)
   - [Subtitle Editing](#subtitle-editing)
   - [Audio Track & Stems Selection](#audio-track--stems-selection)
   - [Bounds & Timeline Markers](#bounds--timeline-markers)

---

## 1. Home (Dashboard)

The **Dashboard** is your central hub. Here, you can start a new video processing project or access previously created ones.

![Dashboard Home](assets/home.png)

### Key Features:
- **Upload File / Enter URL**: Paste a YouTube video URL or upload a local video file (MP4/WebM) to start.
- **Project Name**: Give your project a clear, recognizable name.
- **Advanced Options**: Define constraints like minimum and maximum duration for the generated clips, or provide custom AI prompts to guide the highlight extraction.
- **Projects List**: View, reopen, or delete existing projects.

---

## 2. Configuration (Settings)

Access the **Settings** panel by clicking the **Settings** tab in the header. Here, you define the core AI and timing settings.

![Settings Panel](assets/configuration.png)

### Configuration Options:
- **Gemini API Key**: Your credentials for using Google Gemini AI models.
- **Gemini Model**: Select the model for analysis (e.g., `gemini-2.5-flash`).
- **Frame Interval (seconds)**: Set how often the video frames are sampled for visual AI analysis.
- **Default Prompts**: Customize the instructions sent to Gemini for discovering highlight moments.
- **Clips Durations**: Specify the default minimum and maximum lengths for extracted vertical shorts.

---

## 3. Edition Page

Once a video is processed, you are redirected to the **Editor Page**. Here you can preview and fine-tune your vertical reels.

![General Editor Layout](assets/edition_general.png)

The editor page includes a video preview on the left showing a real-time representation of the vertical crop, and editing tabs on the right.

### Subtitle Styling
Manage how captions look on your vertical video using the **Style** tab.

![Subtitle Style Configuration](assets/edition_styles.png)

- **Font Family**: Pick a modern font for your text overlays.
- **Font Size & Color**: Adjust legibility and style.
- **Stroke (Outline)**: Choose outline colors and thickness to make subtitles pop on any background.
- **Position (Alignments & Margins)**: Align text to the top, center, or bottom of the vertical crop.
- **Presets**: Save your custom styles as templates to reuse them on other clips.

### Subtitle Editing
Edit transcription text and timings using the **Captions** tab.

![Subtitle Editing](assets/edition_subtitle_edit.png)

- **Interactive Timestamps**: Click any subtitle block to jump directly to that timestamp in the video player.
- **Text Correction**: Double-click or select a segment to modify the text directly.
- **Timing Shifts**: Adjust the start and end times of specific captions.

### Audio Track & Stems Selection
Use the **Audio** tab to separate and balance audio streams.

![Audio Track Selection](assets/edition_audio.png)

- **Vocal & Accompaniment Separation**: Split the speaker's voice from background music.
- **Volume Sliders**: Independently adjust the volume of the vocals or background tracks.
- **Background Music**: Select and blend an external soundtrack if desired.

### Bounds & Timeline Markers
Adjust the vertical framing and clip length directly on the interactive timeline.

![Bounds and Timeline Markers](assets/edition_bounds.png)

- **Interactive Handles**: Drag the green **IN** marker and red **OUT** marker on the player timeline to trim the short's duration.
- **Crop Adjustments**: Shift the focus area horizontally to keep the subject centered in the `9:16` vertical frame.
