# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Morse String is a static single-page web app with two main features:
1. **Translator** — Bidirectional text↔morse conversion (A-Z, 0-9, spaces; max 140 chars) with copy-to-clipboard, audio playback, and MP3 download
2. **Audio Decoder** — Upload morse audio files (MP3/WAV/OGG/M4A) and decode them back to text using Goertzel frequency detection

No build step, bundler, or package manager — just open `index.html` in a browser.

## Development

Serve with any static HTTP server (e.g., `python3 -m http.server`) or open `index.html` directly. Audio features and clipboard API require a secure context (HTTPS or localhost).

**Cache-busting:** `index.html` references `style.css?v=N` and `app.js?v=N`. Bump the version parameter in both `<link>` and `<script>` tags after changes.

No test framework — verify changes manually in the browser.

## Architecture

Four files, no framework:

- **index.html** — Tab-based layout (Translator / Audio Decoder). Translator has two synced textareas (text ↔ morse) with copy buttons, playback controls, and WPM slider. Decoder has file upload, frequency/threshold/WPM sliders, canvas visualization, and output textareas.
- **app.js** — All logic in one vanilla JS file, organized in labeled sections:
  - **Bidirectional sync** — `textInput` and `morseInput` textareas update each other via input listeners guarded by an `isUpdating` flag to prevent infinite loops
  - **PARIS timing** — `getTimings(wpm)` derives all durations from `dot = 1200ms / WPM`; used by both playback and decoder
  - **Audio playback** — `buildSchedule()` creates timed oscillator events; Web Audio API schedules them with gain envelopes for click-free tones
  - **MP3 export** — `generatePCM()` renders morse to samples; lamejs encodes to MP3 for download
  - **Goertzel decoder** — `analyzeAudio()` runs single-frequency detection in 10ms windows; `classifySegments()` converts magnitude arrays to morse using PARIS timing thresholds
  - **Clipboard** — `copyToClipboard()` uses `navigator.clipboard.writeText()` with brief "COPIED!" button feedback
- **style.css** — Telegraph/vintage theme via CSS custom properties (`--brass`, `--copper`, `--paper`, etc.). Monospace fonts (Share Tech Mono, Special Elite).
- **lame.min.js** — Self-hosted lamejs v1.2.1 for client-side MP3 encoding (avoids CDN tracking prevention issues)

## Key Patterns

- **Single-file JS** — All state and logic lives in `app.js`. No modules, no imports (except lamejs via script tag). Keep it that way.
- **DOM element references** — Cached at the top of `app.js` in labeled sections (Translator, Tabs, Decoder).
- **Button state management** — `updateButtonStates()` enables/disables play/download based on valid morse content.
- **Decoder re-render** — Changing the threshold slider re-draws the canvas visualization without re-running Goertzel analysis (cached in `lastMagnitudes`).
