# Progress Tracking

## Phase 0: Project setup and tracking files

- [X] **0.1** Create the folder structure from section 3 (empty placeholder files are fine), plus `requirements.txt` (`fastapi`, `uvicorn[standard]`, `python-multipart`, `pydantic`, `yt-dlp`).
  - *2026-09-20 14:58*: Created project directory layout, virtual environment (.venv), .gitignore, requirements.txt with pinned/standard packages, placeholder files, and installed dependencies successfully. Touched: `.gitignore`, `requirements.txt`, `app/main.py`, `app/models.py`, `app/engine.py`, `app/jobs.py`, `app/deps.py`, `app/static/index.html`, `app/static/app.js`, `tests/sample_config.json`.
- [X] **0.2** Create `progress.md` with every step of this plan as an unchecked checklist, and `memory.md` with the section headings from rule 2.
  - *2026-09-20 14:58*: Created progress.md with all phases/steps and memory.md with required sections. Touched: `progress.md`, `memory.md`.
- [X] **0.3** Create `README.md` (draft) and `docs/APP_DOCUMENTATION.md` (skeleton with headings only).
  - *2026-09-20 14:59*: Created README.md with overview, requirements, run steps, and docs/APP_DOCUMENTATION.md skeleton with all structural headings. Touched: `README.md`, `docs/APP_DOCUMENTATION.md`.
- [X] **0.4** Put a free bold `.ttf` font (e.g. DejaVu Sans Bold or Roboto Bold) in `data/fonts/default.ttf`. If you cannot download one, record in `memory.md` that the user must supply a font, and make the app fall back to a font path found on the system.
  - *2026-09-20 14:59*: Placed LiberationSans-Bold.ttf at `data/fonts/default.ttf` and documented system fallback path in `memory.md`. Touched: `data/fonts/default.ttf`, `memory.md`.

## Phase 1: Server skeleton and dependency check

- [X] **1.1** `app/main.py`: FastAPI app with `GET /` serving a placeholder `index.html` ("Ranking Video Maker").
  - *2026-09-20 15:00*: Configured FastAPI application with static files mount and FileResponse serving `index.html` at `GET /`. Verified server runs and returns 200 with page content. Touched: `app/main.py`.
- [X] **1.2** `app/deps.py` + `GET /api/health`: detect `ffmpeg`, `ffprobe`, `yt-dlp` on PATH and return versions (or a clear "missing" message).
  - *2026-09-20 15:00*: Implemented dependency checking in `app/deps.py` and exposed `GET /api/health`. Verified health detection for ffmpeg, ffprobe, yt-dlp and verified clear missing message handling. Touched: `app/deps.py`, `app/main.py`.
- [X] **1.3** Record the run command and environment info in `README.md` and `memory.md`.
  - *2026-09-20 15:01*: Verified and recorded verified OS, Python, FFmpeg, FFprobe, and yt-dlp versions along with run commands in `README.md` and `memory.md`. Touched: `README.md`, `memory.md`.

## Phase 2: Video engine (no web involved yet)

- [X] **2.1** `get_source(source, downloads_dir, uploads_dir)`: returns a local file path for a URL (download via yt-dlp with hash cache) or an uploaded file id.
  - *2026-09-20 15:02*: Implemented `get_source` supporting URL download with MD5 hashing cache and local upload resolution. Tested downloading via HTTP and cache reuse. Touched: `app/engine.py`.
- [X] **2.2** `has_audio(path)` and `probe_duration(path)` using ffprobe.
  - *2026-09-20 15:03*: Implemented ffprobe-based `has_audio` and `probe_duration`. Tested with generated audio clip (detected audio=True, duration=3.0s) and silent clip (detected audio=False, duration=4.0s). Touched: `app/engine.py`.
- [X] **2.3** `build_intro(cfg, work_dir)`: produces `seg_intro.mp4`.
  - *2026-09-20 15:03*: Implemented `build_intro` with font management (`font.ttf` copy), title text file handling to avoid escaping issues, configurable resolution/accent/bg, and 44.1kHz silent stereo audio. Tested producing `seg_intro.mp4` with exact 3.0s duration and audio stream. Touched: `app/engine.py`.
- [X] **2.4** `build_item(cfg, item, idx, work_dir)`: produces one item segment per section 4.
  - *2026-09-20 15:04*: Implemented `build_item` with aspect-ratio-preserving clip scaling (80%x60% canvas box), top title banner, bottom rank/item title label, volume control, and automated silent audio insertion for clips without audio. Touched: `app/engine.py`.
- [X] **2.5** `concat_segments(segments, work_dir)`: joins them with the concat demuxer.
  - *2026-09-20 15:04*: Implemented `concat_segments` using FFmpeg concat demuxer with `-c copy`. Tested joining intro (2s) and 2 item segments (2s each) into a glitch-free 6.02s joined video. Touched: `app/engine.py`.
- [X] **2.6** `add_bgm(joined, bgm, volume, output)`: mixes the looped music.
  - *2026-09-20 15:05*: Implemented `add_bgm` with infinite stream looping, volume scaling, and `amix=inputs=2:duration=first:normalize=0` with exact video duration trimming. Tested looping a 1s audio track over a 3s video with perfect 3.0s boundary termination. Touched: `app/engine.py`.
- [X] **2.7** `render(cfg, job_dir, progress_callback, cancel_flag)`: orchestrates everything, sorts items in countdown order, calls `progress_callback(percent, message)` after each stage, and checks `cancel_flag` between stages.
  - *2026-09-20 15:06*: Implemented `render` orchestrator with cancellation support, progress reporting, and descending countdown order sorting. Verified end-to-end with `python -m tests.run_sample` building an 8.02s countdown video from 3 test clips. Touched: `app/engine.py`, `tests/run_sample.py`, `tests/sample_config.json`.
- [X] **2.8** Update `docs/APP_DOCUMENTATION.md` with the pipeline section.
  - *2026-09-20 15:07*: Documented the video processing pipeline in `docs/APP_DOCUMENTATION.md` covering asset caching, probing, intro, item layout, concatenation, and BGM mixing. Touched: `docs/APP_DOCUMENTATION.md`.

## Phase 3: Config validation

- [X] **3.1** `app/models.py`: pydantic models for the config (section 5) with the validation rules.
  - *2026-09-20 15:10*: Implemented `VideoConfig`, `ItemConfig`, and `JobState` Pydantic models. Verified validation rules for minimum 1 item, unique ranks, and end > start constraints. Touched: `app/models.py`.
- [X] **3.2** Make `render()` accept the validated model.
  - *2026-09-20 15:11*: Adapted `render`, `build_intro`, and `build_item` to directly accept either Pydantic models (`VideoConfig`, `ItemConfig`) or dicts. Verified with `python -m tests.run_sample` passing full validated model. Touched: `app/engine.py`, `tests/run_sample.py`.

## Phase 4: Jobs and API

- [X] **4.1** `app/jobs.py`: job manager that creates `jobs/<id>/`, runs `render()` in a background thread, tracks status/progress/error, and writes `job.json`.
  - *2026-09-20 15:13*: Implemented `Job` and `JobManager` with background threading, status tracking, JSON state persistence to `jobs/<id>/job.json`, and cancellation handling. Verified with automated job run reaching 100% and producing `output.mp4`. Touched: `app/jobs.py`.
- [X] **4.2** `POST /api/jobs` and `GET /api/jobs/{id}`.
  - *2026-09-20 15:14*: Added `POST /api/jobs` and `GET /api/jobs/{id}` endpoints. Verified via API client starting job, polling progress incrementally, and reaching 100% done. Touched: `app/main.py`.
- [X] **4.3** `GET /api/jobs/{id}/download`.
  - *2026-09-20 15:15*: Implemented `GET /api/jobs/{id}/download` returning FileResponse with `video/mp4`. Verified client downloading finished MP4 and validated duration and playable audio stream. Touched: `app/main.py`.
- [X] **4.4** `POST /api/jobs/{id}/cancel`.
  - *2026-09-20 15:17*: Implemented `POST /api/jobs/{id}/cancel` and integrated subprocess termination monitoring via `run_subprocess_with_cancel`. Tested cancelling active rendering job, immediately killing the FFmpeg process and setting status to `cancelled`. Touched: `app/main.py`, `app/engine.py`.
- [X] **4.5** `POST /api/upload` storing files in `data/uploads/` with a generated id.
  - *2026-09-20 15:19*: Implemented `POST /api/upload` storing uploaded files in `data/uploads/` with UUID-based IDs and preserving file extensions. Tested uploading a clip, referencing its returned ID as an item `source` in a job, and rendering successfully. Touched: `app/main.py`.
- [X] **4.6** Update `docs/APP_DOCUMENTATION.md` with the API section (with example requests).
  - *2026-09-20 15:19*: Updated `docs/APP_DOCUMENTATION.md` with configuration schema, validation rules, and comprehensive API documentation with request/response examples for all 7 endpoints. Touched: `docs/APP_DOCUMENTATION.md`.

## Phase 5: Minimal frontend (functional only)

- [X] **5.1** The form for the main title, width/height preset (1920x1080 or 1080x1920), accent color, and a Generate button (not wired yet).
  - *2026-09-20 15:20*: Built functional form in `app/static/index.html` with title, resolution preset options (1920x1080 and 1080x1920), accent color, and generate button with clean readable spacing. Touched: `app/static/index.html`.
- [X] **5.2** Item list: "Add item" and "Remove" buttons; each item has rank, title, source (URL text box or file upload button), start, and end (seconds). Rank auto-fills descending (N, N-1, …).
  - *2026-09-20 15:20*: Implemented dynamic item list in `index.html` and `app.js` with auto-filling descending ranks (N, N-1, ... 1), add/remove actions, clip file upload hooks, and `getItemsData()` serialization. Touched: `app/static/index.html`, `app/static/app.js`.
- [X] **5.3** Upload controls for background image and background music, with a volume input for the music. Each upload calls `/api/upload` and shows the filename.
  - *2026-09-20 15:21*: Added background image and background music upload buttons, volume sliders, and automated API upload wiring. Verified uploaded file IDs and volumes are captured in `getFormConfig()`. Touched: `app/static/index.html`, `app/static/app.js`.
- [x] **5.4** Wire the Generate button: build the config, `POST /api/jobs`, then poll `/api/jobs/{id}` every second and show status text + a `<progress>` bar.
  - *2026-09-20 15:24*: Wired Generate button in `app.js` with client validation, submission to `POST /api/jobs`, and 1s interval polling updating `<progress>` bar and live status badges. Touched: `app/static/app.js`, `app/static/index.html`.
- [x] **5.5** On `done`, show a download link (and a `<video controls>` preview); on `failed`, show the error message; add a Cancel button.
  - *2026-09-20 15:24*: Added interactive preview video player, direct MP4 download link, error alerts, and job cancellation button. Verified complete flow from form submission to progress tracking and downloaded video streaming. Touched: `app/static/app.js`, `app/static/index.html`.

## Phase 6: Reliability

- [x] **6.1** Clear error messages for: missing tools, failed download (private/unavailable video), invalid start/end, unsupported file, ffmpeg failure (show the last lines of ffmpeg stderr in the job error).
  - *2026-09-20 15:26*: Implemented formatted error messages with stderr line trimming for FFmpeg and yt-dlp, model validation for timestamps, and file resolution guards. Verified all 5 failure cases produce readable messages in API and UI. Touched: `app/engine.py`, `app/models.py`.
- [x] **6.2** Cleanup: remove a job's intermediate `seg_*.mp4` files after success; keep `output.mp4`. Add a simple "Delete job" button or endpoint.
  - *2026-09-20 15:27*: Automated post-render cleanup of intermediate files (`work/` directory containing segment videos and text files), keeping only `output.mp4` and `job.json`. Added `DELETE /api/jobs/{id}` and UI "Delete Job" button. Touched: `app/engine.py`, `app/jobs.py`, `app/main.py`, `app/static/index.html`, `app/static/app.js`.
- [X] **6.3** Save the last-used form values in the browser's `localStorage` so a refresh doesn't lose the form.
  - *2026-09-20 15:30*: Implemented `saveFormState()` and `loadFormState()` persisting title, preset resolution, accent/bg colors, bg image/music selections, volume sliders, and dynamic item list in `localStorage` under `ranking_video_form_state`. Automated test verified form restores identically across page loads. Touched: `app/static/app.js`.

## Phase 7: Finish (still no beautification)

- [X] **7.1** End-to-end manual test with 5 items (mix of URLs and uploaded clips), a background image, and BGM. Record results in `progress.md`.
  - *2026-09-20 15:35*: Executed automated end-to-end test (`tests/test_e2e_5items.py`) exercising complete workflow: uploaded background image and BGM audio via `/api/upload`, uploaded 3 local video clips (including an audio-less clip), provided 2 live YouTube video URLs (`aqz-KE-bpKQ` and `jNQXAC9IVRw`), submitted job via `POST /api/jobs`, and polled progress through completion. Verified generated MP4 stream properties: duration = 21.02s (matching intro 3.0s + 3.5s + 3.5s + 3.5s + 3.5s + 4.0s), resolution = 1920x1080 h264, audio = 44.1kHz stereo AAC with mixed BGM and clip audio. Verified intermediate `work/` files were automatically cleaned up leaving only `output.mp4` and `job.json`. Touched: `tests/test_e2e_5items.py`, `app/engine.py`.
- [X] **7.2** Finalize `README.md` (install, run, use, troubleshooting) and `docs/APP_DOCUMENTATION.md`.
  - *2026-09-20 15:37*: Finalized `README.md` with complete installation steps, virtual environment activation, command reference, testing instructions, API reference table, and troubleshooting solutions. Updated `docs/APP_DOCUMENTATION.md` with ASCII architectural diagram, directory breakdown, schema definitions, all 8 API endpoints, comprehensive pipeline walkthrough, and customization guide. Touched: `README.md`, `docs/APP_DOCUMENTATION.md`.
- [X] **7.3** Final update of `memory.md`: current status = "functional version complete, ready for polish phase", plus a list of known issues.
  - *2026-09-20 15:38*: Updated `memory.md` marking status as 'functional version complete, ready for polish phase', documented all architectural choices across phases 0 through 7, listed environment details, gotchas/lessons learned, and cataloged known issues. Verified all tasks across all phases are 100% completed. Touched: `memory.md`, `progress.md`.

## Post-Phase 7 Enhancements: Live Preview Screen & Word-by-Word Title Colors

- [X] **E.1** Pydantic `TitleWord` model and `title_words` support in `VideoConfig` (`app/models.py`).
  - *2026-09-20 15:40*: Added `TitleWord` schema and `title_words: Optional[List[TitleWord]] = None` to `VideoConfig`. Touched: `app/models.py`.
- [X] **E.2** ASS subtitle generation with exact per-word BGR color tags (`app/engine.py`).
  - *2026-09-20 15:41*: Added `color_to_ass` and `build_title_ass_content`, integrating ASS subtitle filter in `build_intro` and `build_item` for word-by-word colored titles. Touched: `app/engine.py`.
- [X] **E.3** Interactive Frontend Live Preview Screen & Word Color Chips (`app/static/index.html`, `app/static/app.js`, `app/main.py`).
  - *2026-09-20 15:44*: Added dynamic word chip generator with HTML5 color picker per word, reset button, and real-time live preview screen supporting 16:9 / 9:16 aspect ratios, Intro Screen view, Item Clip Screen view, background sync, and `localStorage` persistence. Touched: `app/static/index.html`, `app/static/app.js`, `app/main.py`.
- [X] **E.4** Automated test suite for word colors & preview screen (`tests/`).
  - *2026-09-20 15:45*: Created and ran `tests/test_word_colors.py` (engine unit test), `tests/test_frontend_preview.js` (DOM & storage unit test), and `tests/test_e2e_word_colors.py` (end-to-end API rendering test), all passing 100%. Touched: `tests/test_word_colors.py`, `tests/test_frontend_preview.js`, `tests/test_e2e_word_colors.py`.

## Later / polish ideas

- Visual styling and themes
- Animated title transitions
- Sound effects on countdown reveals
- Mobile-friendly responsive adjustments
