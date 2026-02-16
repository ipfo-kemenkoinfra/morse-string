# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Morse String is a static single-page web app with two main features:
1. **Translator** — Bidirectional text↔morse conversion (A-Z, 0-9, spaces; max 140 chars) with audio playback and MP3 download
2. **Audio Decoder** — Upload morse audio files (MP3/WAV/OGG/M4A) and decode them back to text using Goertzel frequency detection

No build step or bundler — just open `index.html` in a browser.

## Architecture

- **index.html** — Page structure: tab bar (Translator / Audio Decoder), two synced textareas, decoder upload/controls/canvas
- **app.js** — All application logic in a single vanilla JS file:
  - `MORSE_MAP` / `REVERSE_MORSE_MAP` — bidirectional character↔morse lookup
  - Input validation (`validateAndConvert`), conversion (`textToMorse`, `morseToText`)
  - Bidirectional textarea sync with `isUpdating` guard to prevent loops
  - Tab switching logic
  - Timing engine (`getTimings`, `buildSchedule`) using standard PARIS timing (dot = 1200ms / WPM)
  - Web Audio API playback — schedules oscillators with gain envelopes for real-time morse audio
  - PCM generation (`generatePCM`) + MP3 encoding via lamejs for download
  - Goertzel algorithm (`goertzelMagnitude`, `analyzeAudio`) — single-frequency detection with configurable target frequency (default 700Hz) and 10ms analysis windows
  - Segment classification (`classifySegments`) — converts Goertzel magnitudes to dit/dah/gaps using PARIS timing thresholds
  - Canvas visualization (`drawVisualization`) — amplitude bars with threshold line, HiDPI-aware
- **style.css** — Telegraph/vintage theme using CSS custom properties (brass/copper palette, monospace fonts)
- **lame.min.js** — Self-hosted lamejs v1.2.1 for client-side MP3 encoding (avoids CDN tracking prevention issues)
- **.nojekyll** — Tells GitHub Pages to skip Jekyll processing

## Dependencies

- **lamejs v1.2.1** (`lame.min.js`, self-hosted) — client-side MP3 encoding for the download feature

## Development

No build tools, package manager, or test framework. To develop, serve the directory with any static HTTP server (e.g., `python3 -m http.server`) or open `index.html` directly. Audio features require a browser context with Web Audio API support.

Cache-busting: `index.html` references `style.css?v=N` and `app.js?v=N`. Bump the version parameter after changes to ensure GitHub Pages visitors get fresh files.
