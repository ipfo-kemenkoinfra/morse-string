# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Morse String is a static single-page web app that converts text input (A-Z, 0-9, spaces; max 140 chars) into morse code with audio playback and MP3 download. No build step or bundler — just open `index.html` in a browser.

## Architecture

- **index.html** — Page structure: text input, morse output display, WPM speed slider, play/stop/download controls
- **app.js** — All application logic in a single vanilla JS file:
  - `MORSE_MAP` — character-to-morse lookup
  - Input validation (`validateAndConvert`) and conversion (`textToMorse`)
  - Timing engine (`getTimings`, `buildSchedule`) using standard PARIS timing (dot = 1200ms / WPM)
  - Web Audio API playback — schedules oscillators with gain envelopes for real-time morse audio
  - PCM generation (`generatePCM`) + MP3 encoding via lamejs CDN for download
- **style.css** — Telegraph/vintage theme using CSS custom properties (brass/copper palette, monospace fonts)

## External Dependencies

- **lamejs** (CDN: `cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js`) — client-side MP3 encoding for the download feature

## Development

No build tools, package manager, or test framework. To develop, serve the directory with any static HTTP server (e.g., `python3 -m http.server`) or open `index.html` directly. Audio features require a browser context with Web Audio API support.
