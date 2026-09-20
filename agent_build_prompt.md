# Build Prompt: Ranking Video Maker (local web app)

You are a coding agent. Build a **local web app** that automatically produces "Top N" ranking/countdown videos with no manual editing. The user enters a main title and a list of ranked items (each with a video URL or uploaded clip, plus start/end times), optionally uploads a background image and background music, clicks **Generate**, and downloads the finished MP4.

**Priority for this build: FUNCTIONAL FIRST.** Plain, unstyled-but-usable UI is fine. Do NOT spend time on beautification, animations, themes, or extra features. Polish comes in a later, separate task.

---

## 1. Working rules (read carefully, follow throughout)

1. **Work in small steps.** The plan below is split into phases, and each phase into small numbered steps. Do exactly one step at a time. Do not start the next step until the current step's **Done when** check passes (actually run it; don't assume).
2. **Keep four tracking files at the project root and keep them current:**
   - `progress.md`: a checklist of every phase/step from this prompt. Mark each `[ ]` → `[x]` only after its check passes. Under each finished step add one line: date/time, what was done, files touched. If a step is blocked or changed, write why.
   - `memory.md`: your working memory so a brand-new session can resume with zero context. Keep sections: **Current status** (which step is next), **Decisions made** (and why), **Environment** (OS, Python version, ffmpeg version, run commands), **Gotchas/lessons learned**, **Open questions**. Update it at the end of every step.
   - `README.md`: for humans. What the app is, requirements (Python, FFmpeg, yt-dlp), install steps, how to run, how to use, folder layout, troubleshooting. Create it in Phase 0 and refine at the end.
   - `docs/APP_DOCUMENTATION.md`: the single documentation file about how the app works: architecture, folder structure, config/data schema, API endpoints (request/response examples), the video pipeline (how each segment is built), and how to extend it. Create it early and update it whenever the code changes.
3. **At the start of every session:** read `memory.md` and `progress.md` first, then continue from the next unchecked step.
4. **After every step:** update `progress.md` and `memory.md`, and if you use git, make one small commit per step with a clear message.
5. If something in this prompt is ambiguous, pick the simplest option, record the decision in `memory.md`, and continue. Do not stop to ask unless you are truly blocked.
6. Do not add features that aren't listed. Put ideas in a `## Later / polish ideas` section at the bottom of `progress.md`.

---

## 2. Tech stack (fixed, do not change)

- **Backend:** Python 3.10+ with **FastAPI** + **uvicorn**. Use **pydantic** for validation.
- **Video processing:** **FFmpeg / ffprobe** called via `subprocess` (not MoviePy).
- **Downloading:** **yt-dlp** called via `subprocess`.
- **Frontend:** a single static HTML page + vanilla JavaScript served by FastAPI (no React, no build step, no npm).
- **Jobs:** in-process background thread (no Redis/Celery). Job state kept in memory and mirrored to `jobs/<job_id>/job.json`.
- Runs **locally only** (`http://localhost:8000`). No auth, no database.

## 3. Target folder structure

```
ranking-video-app/
├── README.md
├── progress.md
├── memory.md
├── requirements.txt
├── docs/
│   └── APP_DOCUMENTATION.md
├── app/
│   ├── main.py            # FastAPI app, routes
│   ├── models.py          # pydantic models (config, job)
│   ├── engine.py          # video pipeline (pure functions)
│   ├── jobs.py            # job manager (thread, status, progress)
│   ├── deps.py            # checks for ffmpeg/ffprobe/yt-dlp
│   └── static/
│       ├── index.html
│       └── app.js
├── data/
│   ├── uploads/           # user-uploaded clips, bg images, music, fonts
│   ├── downloads/         # yt-dlp cache (keyed by hash of URL)
│   └── fonts/             # bundled default font (.ttf)
├── jobs/                  # one folder per job: work files + output.mp4 + job.json
└── tests/
    └── sample_config.json
```

---

## 4. The video design (what the pipeline must produce)

Output: one MP4, default **1920x1080, 30 fps, H.264 + AAC**. (Width/height configurable in the request; also allow 1080x1920 for vertical.)

Video = **intro segment + one segment per item**, joined in **countdown order** (highest rank number first, `#1` last).

- **Intro segment** (default 3 s): background + the main title, large, centered, in the accent color.
- **Item segment** (duration from `start`/`end`, or `duration`, or a default of 8 s):
  - Background (image scaled/cropped to fill, or a solid color if none).
  - The clip, scaled to fit inside a box ~80% of width × ~60% of height, centered horizontally, positioned near the top-middle, aspect ratio preserved.
  - The main title across the top (accent color).
  - A label under the clip: `#<rank>  <item title>` in large white text with black outline.
  - Clip audio kept at `clip_volume`. If a clip has no audio, use silent audio instead.
- **Background music (optional):** looped, mixed under the whole video at `bgm_volume` (default 0.25), trimmed to the video length.

### Technical rules that avoid known problems (follow these)

- Encode **every segment identically** (same codec, pixel format `yuv420p`, fps, audio 44100 Hz stereo) so joining with the concat demuxer and `-c copy` works.
- Run ffmpeg with `cwd` set to the job's work folder and give `drawtext` a **relative** font path (copy the chosen `.ttf` into the work folder as `font.ttf`). This avoids Windows drive-letter (`C:`) escaping problems.
- Put text into `.txt` files and use drawtext's `textfile=` option. Do NOT put user text directly in the filter string (quotes, colons, and apostrophes break it).
- Detect audio with `ffprobe -select_streams a`; when there is none, add an `anullsrc` input and map that.
- Use input seeking (`-ss` and `-t` before `-i`) for trimming.
- For BGM mixing use `amix=inputs=2:duration=first:normalize=0` (needs FFmpeg 5+; if unsupported, fall back to `amix` with adjusted `volume`).
- Cache downloads by an md5 hash of the URL so repeated runs don't re-download.
- Download with: `yt-dlp -f "bv*[height<=1080]+ba/b" --merge-output-format mp4 -o <cache>/<hash>.%(ext)s <url>`.

## 5. Data model (request config)

```json
{
  "title": "TOP 5 FUNNIEST CAT FAILS",
  "width": 1920,
  "height": 1080,
  "accent": "yellow",
  "bg_color": "0x141414",
  "bg_image": "<uploaded file id or null>",
  "bgm": "<uploaded file id or null>",
  "bgm_volume": 0.25,
  "clip_volume": 1.0,
  "intro_seconds": 3,
  "clip_seconds": 8,
  "font": "<uploaded font id or null → default bundled font>",
  "items": [
    { "rank": 5, "title": "Cucumber scare", "source": "https://...", "start": 12, "end": 20 },
    { "rank": 4, "title": "Missed jump", "source": "<uploaded clip id>", "start": 0, "duration": 6 }
  ]
}
```

`source` is either a URL (starts with `http`) or an uploaded file id. Validate: at least 1 item, unique ranks, `end > start`, numeric ranges sane.

## 6. API (target)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Reports whether ffmpeg, ffprobe, yt-dlp are found + versions |
| POST | `/api/upload` | Upload a file (clip / bg image / bgm / font); returns `{id, filename}` |
| POST | `/api/jobs` | Body = config; starts a job; returns `{job_id}` |
| GET | `/api/jobs/{id}` | Returns `{status, progress, message, error}`; status ∈ queued/running/done/failed/cancelled |
| POST | `/api/jobs/{id}/cancel` | Cancels a running job |
| GET | `/api/jobs/{id}/download` | Streams the finished MP4 |
| GET | `/` | Serves the web page |

---

## 7. Build plan

### Phase 0: Project setup and tracking files
- **0.1** Create the folder structure from section 3 (empty placeholder files are fine), plus `requirements.txt` (`fastapi`, `uvicorn[standard]`, `python-multipart`, `pydantic`, `yt-dlp`).
  **Done when:** folders exist and `pip install -r requirements.txt` succeeds.
- **0.2** Create `progress.md` with every step of this plan as an unchecked checklist, and `memory.md` with the section headings from rule 2.
  **Done when:** both files exist and list all phases/steps.
- **0.3** Create `README.md` (draft) and `docs/APP_DOCUMENTATION.md` (skeleton with headings only).
  **Done when:** both exist.
- **0.4** Put a free bold `.ttf` font (e.g. DejaVu Sans Bold or Roboto Bold) in `data/fonts/default.ttf`. If you cannot download one, record in `memory.md` that the user must supply a font, and make the app fall back to a font path found on the system.
  **Done when:** a usable font path is recorded in `memory.md`.

### Phase 1: Server skeleton and dependency check
- **1.1** `app/main.py`: FastAPI app with `GET /` serving a placeholder `index.html` ("Ranking Video Maker").
  **Done when:** `uvicorn app.main:app --reload` runs and the page loads at `localhost:8000`.
- **1.2** `app/deps.py` + `GET /api/health`: detect `ffmpeg`, `ffprobe`, `yt-dlp` on PATH and return versions (or a clear "missing" message).
  **Done when:** `/api/health` returns correct info, and a missing tool shows a clear message.
- **1.3** Record the run command and environment info in `README.md` and `memory.md`.

### Phase 2: Video engine (no web involved yet)
Build `app/engine.py` as plain functions. Test each with a command-line snippet or a small script in `tests/`.
- **2.1** `get_source(source, downloads_dir, uploads_dir)`: returns a local file path for a URL (download via yt-dlp with hash cache) or an uploaded file id.
  **Done when:** a URL downloads once and a second call reuses the cache; a local file resolves.
- **2.2** `has_audio(path)` and `probe_duration(path)` using ffprobe.
  **Done when:** correct results on a clip with audio and one without.
- **2.3** `build_intro(cfg, work_dir)`: produces `seg_intro.mp4`.
  **Done when:** playing the file shows the background and the centered title.
- **2.4** `build_item(cfg, item, idx, work_dir)`: produces one item segment per section 4.
  **Done when:** a test clip yields a segment with the correct layout, label text, and audio (also test a silent clip).
- **2.5** `concat_segments(segments, work_dir)`: joins them with the concat demuxer.
  **Done when:** joined video plays with no glitches between segments.
- **2.6** `add_bgm(joined, bgm, volume, output)`: mixes the looped music.
  **Done when:** the music plays under the whole video and stops at the end.
- **2.7** `render(cfg, job_dir, progress_callback, cancel_flag)`: orchestrates everything, sorts items in countdown order, calls `progress_callback(percent, message)` after each stage, and checks `cancel_flag` between stages.
  **Done when:** `python -m tests.run_sample` (or similar) builds a full video from `tests/sample_config.json` using at least 3 local test clips.
- **2.8** Update `docs/APP_DOCUMENTATION.md` with the pipeline section.

### Phase 3: Config validation
- **3.1** `app/models.py`: pydantic models for the config (section 5) with the validation rules.
  **Done when:** valid configs pass and invalid ones (duplicate ranks, end ≤ start, zero items) give clear errors.
- **3.2** Make `render()` accept the validated model.
  **Done when:** the sample run from 2.7 still works.

### Phase 4: Jobs and API
- **4.1** `app/jobs.py`: job manager that creates `jobs/<id>/`, runs `render()` in a background thread, tracks status/progress/error, and writes `job.json`.
  **Done when:** starting a job from a Python shell completes and produces `output.mp4`.
- **4.2** `POST /api/jobs` and `GET /api/jobs/{id}`.
  **Done when:** using curl or the FastAPI `/docs` page, you can start a job and watch progress reach 100%.
- **4.3** `GET /api/jobs/{id}/download`.
  **Done when:** the finished MP4 downloads and plays.
- **4.4** `POST /api/jobs/{id}/cancel`.
  **Done when:** cancelling stops ffmpeg/yt-dlp subprocesses and the status becomes `cancelled`.
- **4.5** `POST /api/upload` storing files in `data/uploads/` with a generated id.
  **Done when:** an uploaded clip can be used as an item `source`.
- **4.6** Update `docs/APP_DOCUMENTATION.md` with the API section (with example requests).

### Phase 5: Minimal frontend (functional only)
Use plain HTML elements with minimal CSS (readable spacing only).
- **5.1** The form for the main title, width/height preset (1920x1080 or 1080x1920), accent color, and a Generate button (not wired yet).
  **Done when:** the page renders the fields.
- **5.2** Item list: "Add item" and "Remove" buttons; each item has rank, title, source (URL text box or file upload button), start, and end (seconds). Rank auto-fills descending (N, N-1, …).
  **Done when:** you can add/remove items and read them back as a JS object.
- **5.3** Upload controls for background image and background music, with a volume input for the music. Each upload calls `/api/upload` and shows the filename.
  **Done when:** uploaded ids are stored in the form state.
- **5.4** Wire the Generate button: build the config, `POST /api/jobs`, then poll `/api/jobs/{id}` every second and show status text + a `<progress>` bar.
  **Done when:** clicking Generate shows live progress.
- **5.5** On `done`, show a download link (and a `<video controls>` preview); on `failed`, show the error message; add a Cancel button.
  **Done when:** the full flow works in the browser from an empty form to a downloaded video.

### Phase 6: Reliability
- **6.1** Clear error messages for: missing tools, failed download (private/unavailable video), invalid start/end, unsupported file, ffmpeg failure (show the last lines of ffmpeg stderr in the job error).
  **Done when:** each case is triggered on purpose and shows a readable message in the UI.
- **6.2** Cleanup: remove a job's intermediate `seg_*.mp4` files after success; keep `output.mp4`. Add a simple "Delete job" button or endpoint.
  **Done when:** the job folder holds only what is needed after completion.
- **6.3** Save the last-used form values in the browser's `localStorage` so a refresh doesn't lose the form.
  **Done when:** refreshing the page keeps the entries (uploaded file ids may need re-upload, which is acceptable).

### Phase 7: Finish (still no beautification)
- **7.1** End-to-end manual test with 5 items (mix of URLs and uploaded clips), a background image, and BGM. Record results in `progress.md`.
- **7.2** Finalize `README.md` (install, run, use, troubleshooting) and `docs/APP_DOCUMENTATION.md`.
- **7.3** Final update of `memory.md`: current status = "functional version complete, ready for polish phase", plus a list of known issues.
  **Done when:** all boxes in `progress.md` are checked and the three docs are accurate.

---

## 8. Out of scope for this build (do NOT do these now)
Visual styling/themes, animated titles, transitions, sound effects, live layout preview, user accounts, cloud hosting, database, multi-user queueing, mobile layout. Record ideas under `## Later / polish ideas` in `progress.md` instead.

## 9. Final deliverable
A working local app where a person opens `http://localhost:8000`, fills in the title and ranked items, clicks Generate, and downloads a finished countdown MP4, plus `README.md`, `progress.md`, `memory.md`, and `docs/APP_DOCUMENTATION.md` all up to date.

Begin with **Phase 0, Step 0.1**. After each step, report briefly what you did and the result of its "Done when" check, then continue to the next step.
