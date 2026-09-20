# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- Timed overlay elements: text callouts, emoji stickers, uploaded PNG images, Vecteezy stock art
- Pre-downloaded license-free sticker library (fire, trophy, star, lightning, crown, etc.)
- `/api/elements/list` endpoint for serving locally cached stickers
- Rank Ladder Overlay: all numbers visible from frame 1, clips revealed in sequence
- Per-clip volume control
- Color grading engine: 6 cinematic presets + manual contrast/saturation/brightness/warmth
- Responsive multicolumn settings sidebar (2-col at 660px+, 3-col at 1060px+)
- Live audio playback in preview (BGM + clip audio)
- Download/Downloading/Ready status badges per clip item
- Bulk-add modal: paste entire ranking list at once
- Randomize placements + Blind Ranking Finale (Rank #1 guaranteed last)

### Fixed
- Fatal JS SyntaxError from duplicate `let overlayElements` declaration that broke all UI interactions

## [1.0.0] - 2026-09

### Added
- Initial release: FastAPI backend + FFmpeg render pipeline
- Ranked countdown video generation (intro + N item clips)
- Word-by-word title color studio
- Multiple clip framing modes (fit, fill, stretch, blur-pad, card-frame)
- Background image and background music support
- Live preview with timeline scrubber
- Recent exports panel
- localStorage-based settings persistence
