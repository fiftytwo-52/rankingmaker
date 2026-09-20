# Working Memory

## Current status
functional version complete with live preview and word-by-word title coloring

## Decisions made
- **Python Virtual Environment:** Created `.venv` to comply with Python 3.12 PEP 668 package isolation standards while managing FastAPI, uvicorn, pydantic, and yt-dlp.
- **Per-step Git Commits:** Maintained granular git history across all phases and steps (Phases 0 through 7, plus post-phase 7 features).
- **Word-by-Word Title Coloring via ASS Subtitles:** Implemented per-word color tags `{\c&HBBGGRR&}` using Advanced SubStation Alpha format via FFmpeg `ass` filter. This allows pixel-perfect, multi-color titles in both intro and item top title banners without complicated text metric calculations.
- **Interactive Live Preview Screen:** Built real-time canvas/DOM preview screen mirroring 16:9 / 9:16 aspect ratios, Intro Screen view, and Item Clip Screen view (clip box, banner, and bottom rank label) as the user types and picks colors.
- **Bundled Typography:** Bundled Liberation Sans Bold at `data/fonts/default.ttf` to eliminate external font dependencies. Using temporary UTF-8 text files (`textfile=...`) for all FFmpeg `drawtext` operations ensures zero shell escaping hazards across OS environments.
- **Fast Lossless Demuxer Concatenation:** Standardized all segment outputs (`seg_intro.mp4`, `seg_{idx}.mp4`) to identical parameters (H.264, `yuv420p`, 30 fps, AAC 44.1kHz stereo). Concat demuxer with `-c copy` combines segments in sub-seconds with zero re-encoding artifacts or stutter.
- **Subprocess Cancellation:** Implemented `run_subprocess_with_cancel` using non-blocking process polling every 50ms against `cancel_flag`. Aborts active FFmpeg or yt-dlp child processes within ~100ms and cleans up cleanly.
- **yt-dlp Environment Prioritization:** Prioritized current Python environment (`sys.executable -m yt_dlp`) to ensure modern extractors and format support, with graceful fallback to system yt-dlp and direct HTTP streaming for direct media links.
- **State Persistence:** Form parameters, volume settings, word colors, and dynamic item rows persist automatically across browser refreshes via `localStorage` (`ranking_video_form_state`).
- **Intermediate File Lifecycle:** The intermediate `work/` directory is automatically pruned upon successful render completion, retaining only `output.mp4` and `job.json`.

## Environment
- **OS:** Linux (Ubuntu 24.04 LTS / 6.8 kernel, x86_64)
- **Python version:** Python 3.12.3
- **FFmpeg version:** 6.1.1-3ubuntu5
- **FFprobe version:** 6.1.1-3ubuntu5
- **yt-dlp version:** 2026.8.19 (in .venv) and 2024.04.09 (system fallback)
- **Server command:** `.venv/bin/uvicorn app.main:app --reload --port 8000`
- **Application URL:** `http://127.0.0.1:8000`

## Gotchas/lessons learned
- **FFmpeg Concat Requirements:** FFmpeg concat demuxer (`-c copy`) requires identical audio sample rates, channel layouts, and video timebases across all input segments. Generating silence with explicit 44.1kHz stereo audio for clips lacking audio streams avoids demuxer sync dropouts.
- **YouTube Extractors & JS Runtime:** Modern YouTube formats are split into adaptive video-only and audio-only streams; downloading with format `bv*[height<=1080]+ba/b` and `--merge-output-format mp4` properly muxes video and audio.
- **Uvicorn Daemon Reload:** When testing subprocess execution in background daemon tasks, running uvicorn with `--reload` ensures changes to the underlying engine modules take effect immediately without requiring process termination.

## Known issues / limitations
- **Intentionally Unstyled UI:** The web interface is strictly functional with plain semantic HTML per the project constraints (no CSS framework, animations, or styling applied yet).
- **Public Video Platform Bot Detection:** Downloading from certain video platforms without cookies may occasionally encounter rate limits or bot verification challenges; uploading local clips directly avoids this.
- **Variable Frame Rate Source Clips:** Source clips with irregular VFR timestamps may experience minor duration discrepancies; input seeking (`-ss` before `-i`) and `-r 30` normalization mitigate this for almost all common media containers.

## Open questions
- None. Ready for subsequent polish and styling phases.
