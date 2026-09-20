# Progress Tracking

## Phase 0: Project setup and tracking files
- [x] **0.1** Create the folder structure from section 3 (empty placeholder files are fine), plus `requirements.txt` (`fastapi`, `uvicorn[standard]`, `python-multipart`, `pydantic`, `yt-dlp`).
  - *2026-09-20 14:58*: Created project directory layout, virtual environment (.venv), .gitignore, requirements.txt with pinned/standard packages, placeholder files, and installed dependencies successfully. Touched: `.gitignore`, `requirements.txt`, `app/main.py`, `app/models.py`, `app/engine.py`, `app/jobs.py`, `app/deps.py`, `app/static/index.html`, `app/static/app.js`, `tests/sample_config.json`.
- [x] **0.2** Create `progress.md` with every step of this plan as an unchecked checklist, and `memory.md` with the section headings from rule 2.
  - *2026-09-20 14:58*: Created progress.md with all phases/steps and memory.md with required sections. Touched: `progress.md`, `memory.md`.
- [x] **0.3** Create `README.md` (draft) and `docs/APP_DOCUMENTATION.md` (skeleton with headings only).
  - *2026-09-20 14:59*: Created README.md with overview, requirements, run steps, and docs/APP_DOCUMENTATION.md skeleton with all structural headings. Touched: `README.md`, `docs/APP_DOCUMENTATION.md`.
- [x] **0.4** Put a free bold `.ttf` font (e.g. DejaVu Sans Bold or Roboto Bold) in `data/fonts/default.ttf`. If you cannot download one, record in `memory.md` that the user must supply a font, and make the app fall back to a font path found on the system.
  - *2026-09-20 14:59*: Placed LiberationSans-Bold.ttf at `data/fonts/default.ttf` and documented system fallback path in `memory.md`. Touched: `data/fonts/default.ttf`, `memory.md`.

## Phase 1: Server skeleton and dependency check
- [x] **1.1** `app/main.py`: FastAPI app with `GET /` serving a placeholder `index.html` ("Ranking Video Maker").
  - *2026-09-20 15:00*: Configured FastAPI application with static files mount and FileResponse serving `index.html` at `GET /`. Verified server runs and returns 200 with page content. Touched: `app/main.py`.
- [x] **1.2** `app/deps.py` + `GET /api/health`: detect `ffmpeg`, `ffprobe`, `yt-dlp` on PATH and return versions (or a clear "missing" message).
  - *2026-09-20 15:00*: Implemented dependency checking in `app/deps.py` and exposed `GET /api/health`. Verified health detection for ffmpeg, ffprobe, yt-dlp and verified clear missing message handling. Touched: `app/deps.py`, `app/main.py`.
- [x] **1.3** Record the run command and environment info in `README.md` and `memory.md`.
  - *2026-09-20 15:01*: Verified and recorded verified OS, Python, FFmpeg, FFprobe, and yt-dlp versions along with run commands in `README.md` and `memory.md`. Touched: `README.md`, `memory.md`.

## Phase 2: Video engine (no web involved yet)
- [x] **2.1** `get_source(source, downloads_dir, uploads_dir)`: returns a local file path for a URL (download via yt-dlp with hash cache) or an uploaded file id.
  - *2026-09-20 15:02*: Implemented `get_source` supporting URL download with MD5 hashing cache and local upload resolution. Tested downloading via HTTP and cache reuse. Touched: `app/engine.py`.
- [x] **2.2** `has_audio(path)` and `probe_duration(path)` using ffprobe.
  - *2026-09-20 15:03*: Implemented ffprobe-based `has_audio` and `probe_duration`. Tested with generated audio clip (detected audio=True, duration=3.0s) and silent clip (detected audio=False, duration=4.0s). Touched: `app/engine.py`.
- [x] **2.3** `build_intro(cfg, work_dir)`: produces `seg_intro.mp4`.
  - *2026-09-20 15:03*: Implemented `build_intro` with font management (`font.ttf` copy), title text file handling to avoid escaping issues, configurable resolution/accent/bg, and 44.1kHz silent stereo audio. Tested producing `seg_intro.mp4` with exact 3.0s duration and audio stream. Touched: `app/engine.py`.
- [x] **2.4** `build_item(cfg, item, idx, work_dir)`: produces one item segment per section 4.
  - *2026-09-20 15:04*: Implemented `build_item` with aspect-ratio-preserving clip scaling (80%x60% canvas box), top title banner, bottom rank/item title label, volume control, and automated silent audio insertion for clips without audio. Touched: `app/engine.py`.
- [x] **2.5** `concat_segments(segments, work_dir)`: joins them with the concat demuxer.
  - *2026-09-20 15:04*: Implemented `concat_segments` using FFmpeg concat demuxer with `-c copy`. Tested joining intro (2s) and 2 item segments (2s each) into a glitch-free 6.02s joined video. Touched: `app/engine.py`.
- [x] **2.6** `add_bgm(joined, bgm, volume, output)`: mixes the looped music.
  - *2026-09-20 15:05*: Implemented `add_bgm` with infinite stream looping, volume scaling, and `amix=inputs=2:duration=first:normalize=0` with exact video duration trimming. Tested looping a 1s audio track over a 3s video with perfect 3.0s boundary termination. Touched: `app/engine.py`.
- [x] **2.7** `render(cfg, job_dir, progress_callback, cancel_flag)`: orchestrates everything, sorts items in countdown order, calls `progress_callback(percent, message)` after each stage, and checks `cancel_flag` between stages.
  - *2026-09-20 15:06*: Implemented `render` orchestrator with cancellation support, progress reporting, and descending countdown order sorting. Verified end-to-end with `python -m tests.run_sample` building an 8.02s countdown video from 3 test clips. Touched: `app/engine.py`, `tests/run_sample.py`, `tests/sample_config.json`.
- [x] **2.8** Update `docs/APP_DOCUMENTATION.md` with the pipeline section.
  - *2026-09-20 15:07*: Documented the video processing pipeline in `docs/APP_DOCUMENTATION.md` covering asset caching, probing, intro, item layout, concatenation, and BGM mixing. Touched: `docs/APP_DOCUMENTATION.md`.

## Phase 3: Config validation
- [x] **3.1** `app/models.py`: pydantic models for the config (section 5) with the validation rules.
  - *2026-09-20 15:10*: Implemented `VideoConfig`, `ItemConfig`, and `JobState` Pydantic models. Verified validation rules for minimum 1 item, unique ranks, and end > start constraints. Touched: `app/models.py`.
- [ ] **3.2** Make `render()` accept the validated model.

## Phase 4: Jobs and API
- [ ] **4.1** `app/jobs.py`: job manager that creates `jobs/<id>/`, runs `render()` in a background thread, tracks status/progress/error, and writes `job.json`.
- [ ] **4.2** `POST /api/jobs` and `GET /api/jobs/{id}`.
- [ ] **4.3** `GET /api/jobs/{id}/download`.
- [ ] **4.4** `POST /api/jobs/{id}/cancel`.
- [ ] **4.5** `POST /api/upload` storing files in `data/uploads/` with a generated id.
- [ ] **4.6** Update `docs/APP_DOCUMENTATION.md` with the API section (with example requests).

## Phase 5: Minimal frontend (functional only)
- [ ] **5.1** The form for the main title, width/height preset (1920x1080 or 1080x1920), accent color, and a Generate button (not wired yet).
- [ ] **5.2** Item list: "Add item" and "Remove" buttons; each item has rank, title, source (URL text box or file upload button), start, and end (seconds). Rank auto-fills descending (N, N-1, …).
- [ ] **5.3** Upload controls for background image and background music, with a volume input for the music. Each upload calls `/api/upload` and shows the filename.
- [ ] **5.4** Wire the Generate button: build the config, `POST /api/jobs`, then poll `/api/jobs/{id}` every second and show status text + a `<progress>` bar.
- [ ] **5.5** On `done`, show a download link (and a `<video controls>` preview); on `failed`, show the error message; add a Cancel button.

## Phase 6: Reliability
- [ ] **6.1** Clear error messages for: missing tools, failed download (private/unavailable video), invalid start/end, unsupported file, ffmpeg failure (show the last lines of ffmpeg stderr in the job error).
- [ ] **6.2** Cleanup: remove a job's intermediate `seg_*.mp4` files after success; keep `output.mp4`. Add a simple "Delete job" button or endpoint.
- [ ] **6.3** Save the last-used form values in the browser's `localStorage` so a refresh doesn't lose the form.

## Phase 7: Finish (still no beautification)
- [ ] **7.1** End-to-end manual test with 5 items (mix of URLs and uploaded clips), a background image, and BGM. Record results in `progress.md`.
- [ ] **7.2** Finalize `README.md` (install, run, use, troubleshooting) and `docs/APP_DOCUMENTATION.md`.
- [ ] **7.3** Final update of `memory.md`: current status = "functional version complete, ready for polish phase", plus a list of known issues.

## Later / polish ideas
- Visual styling and themes
- Animated title transitions
- Sound effects on countdown reveals
- Live layout preview in web canvas
- Mobile-friendly responsive adjustments
