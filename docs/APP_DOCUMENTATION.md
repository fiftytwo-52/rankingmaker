# Application Documentation: Ranking Video Maker

## 1. Architecture Overview

Ranking Video Maker is a lightweight, local web application designed to generate "Top N" countdown and ranking videos with no manual video editing required.

```
┌──────────────────────────────────────────────────────────────┐
│                    Web Frontend (Vanilla JS)                 │
│   • Minimal, unstyled semantic HTML UI                       │
│   • Dynamic item ranking (auto descending N ... 1)           │
│   • Direct file upload hooks (/api/upload)                   │
│   • Job polling (1s interval) & interactive preview player   │
│   • Form state persistence via browser localStorage          │
└──────────────────────────────┬───────────────────────────────┘
                               │ HTTP / JSON
┌──────────────────────────────▼───────────────────────────────┐
│                    FastAPI Backend (app/main.py)             │
│   • Pydantic validation for VideoConfig and ItemConfig       │
│   • Static file serving (index.html, app.js)                 │
│   • REST endpoints for health, upload, jobs, cancel, delete  │
└──────────────┬───────────────────────────────┬───────────────┘
               │                               │
┌──────────────▼──────────────┐ ┌──────────────▼───────────────┐
│   Job Manager (app/jobs.py) │ │ System Tools (app/deps.py)   │
│ • Background worker threads │ │ • FFmpeg & FFprobe detection │
│ • Atomic job.json tracking  │ │ • yt-dlp version check       │
│ • Graceful subprocess abort │ └──────────────────────────────┘
└──────────────┬──────────────┘
               │
┌──────────────▼───────────────────────────────────────────────┐
│                Video Rendering Engine (app/engine.py)        │
│   1. Source Resolution & Caching (yt-dlp MD5 cache / uploads)│
│   2. Media Probing (ffprobe duration, audio stream detection)│
│   3. Intro Segment (seg_intro.mp4 - centered title + silence)│
│   4. Item Segments (seg_{idx}.mp4 - 80%x60% box, banner, rank│
│      label, audio normalize/silent fill)                     │
│   5. Concat Demuxer (-c copy lossless concatenation)         │
│   6. BGM Mixing (amix=inputs=2:duration=first:normalize=0)   │
│   7. Cleanup (automatic deletion of intermediate work files) │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                        Local Storage                         │
│ • data/fonts/       : Bundled LiberationSans-Bold.ttf        │
│ • data/uploads/     : User uploaded clips, images, music     │
│ • data/downloads/   : MD5-cached yt-dlp video downloads      │
│ • jobs/<id>/        : job.json and final output.mp4          │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Folder Structure

```
shortsmaker/
├── README.md               # Quickstart, installation, usage, troubleshooting
├── progress.md             # Detailed chronological progress log
├── memory.md               # Key architectural decisions, environment, status
├── requirements.txt        # Python dependencies (FastAPI, uvicorn, pydantic, yt-dlp)
├── docs/
│   └── APP_DOCUMENTATION.md# Full technical design and API specification
├── app/
│   ├── __init__.py
│   ├── main.py             # FastAPI entrypoint, routing, upload & job endpoints
│   ├── models.py           # Pydantic schemas (VideoConfig, ItemConfig, JobState)
│   ├── engine.py           # Pure video generation functions (FFmpeg & yt-dlp)
│   ├── jobs.py             # Job state manager, threading, cancellation
│   ├── deps.py             # CLI dependency verifiers (ffmpeg, ffprobe, yt-dlp)
│   └── static/
│       ├── index.html      # Minimal unstyled functional user interface
│       └── app.js          # Dynamic form handling, API polling, localStorage
├── data/
│   ├── uploads/            # Files uploaded via POST /api/upload
│   ├── downloads/          # Cached video downloads keyed by MD5 hash
│   └── fonts/              # Bundled default font (LiberationSans-Bold.ttf)
├── jobs/                   # One directory per render job:
│   └── <job_id>/
│       ├── job.json        # Persistent job status, progress, and metadata
│       └── output.mp4      # Final rendered countdown video
└── tests/                  # Integration tests and automated verification scripts
    ├── run_sample.py       # Engine-level sample test
    ├── sample_config.json  # Reference configuration
    └── test_e2e_5items.py  # Full 5-item E2E API integration test
```

---

## 3. Configuration & Data Schema

The request payload for rendering videos is validated using Pydantic models in `app/models.py`.

```json
{
  "title": "TOP 5 GREATEST MOMENTS",
  "width": 1920,
  "height": 1080,
  "accent": "gold",
  "bg_color": "0x141414",
  "bg_image": "bf0e71648ccb.png",
  "bgm": "5ee90e84b522.aac",
  "bgm_volume": 0.25,
  "clip_volume": 1.0,
  "intro_seconds": 3.0,
  "clip_seconds": 8.0,
  "font": null,
  "items": [
    {
      "rank": 5,
      "title": "Rising Star Debut",
      "source": "47630549d6d7.mp4",
      "start": 0.0,
      "end": 3.5
    },
    {
      "rank": 4,
      "title": "Blazing Speed Record",
      "source": "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
      "start": 1.0,
      "end": 4.5
    }
  ]
}
```

### Validation Rules
- `title`: Non-empty string. Whitespace is stripped.
- `width`, `height`: Positive integers (presets: `1920x1080` landscape, `1080x1920` portrait/shorts).
- `accent`: Hex color string (e.g. `yellow`, `gold`, `0xFFD700`, `#FFD700`).
- `bg_color`: Hex color string for background fallback.
- `bg_image`: Optional filename/UUID in `data/uploads/` or URL.
- `bgm`: Optional filename/UUID in `data/uploads/` or URL.
- `bgm_volume`: Float between `0.0` and `2.0` (default: `0.25`).
- `clip_volume`: Float between `0.0` and `2.0` (default: `1.0`).
- `intro_seconds`: Positive float (default: `3.0`).
- `clip_seconds`: Default duration per clip when `end` is omitted (default: `8.0`).
- `items`: Minimum 1 item required. Ranks must be positive, unique integers.
- `start` / `end`: `start >= 0.0`. If `end` is specified, `end > start`.

---

## 4. API Endpoints

### 4.1 GET /api/health
Checks whether `ffmpeg`, `ffprobe`, and `yt-dlp` are installed and available on system PATH.

**Response (200 OK):**
```json
{
  "healthy": true,
  "tools": {
    "ffmpeg": {
      "available": true,
      "version": "ffmpeg version 6.1.1-3ubuntu5 Copyright (c) 2000-2023 the FFmpeg developers",
      "error": null
    },
    "ffprobe": {
      "available": true,
      "version": "ffprobe version 6.1.1-3ubuntu5 Copyright (c) 2007-2023 the FFmpeg developers",
      "error": null
    },
    "yt_dlp": {
      "available": true,
      "version": "2026.8.19",
      "error": null
    }
  }
}
```

### 4.2 POST /api/upload
Uploads a media file (clip, background image, music track, or custom font) to `data/uploads/`.

**Request:** `multipart/form-data` with key `file`.

**Response (200 OK):**
```json
{
  "id": "e832dfa941ab.mp4",
  "filename": "my_video_clip.mp4"
}
```

### 4.3 POST /api/jobs
Submits a video generation job to be rendered asynchronously in a background worker thread.

**Request:** `application/json` (`VideoConfig` payload).

**Response (200 OK):**
```json
{
  "job_id": "71e8d4508720"
}
```

### 4.4 GET /api/jobs/{id}
Polls the current status and rendering progress of a submitted job.

**Response (200 OK):**
```json
{
  "id": "71e8d4508720",
  "status": "running",
  "progress": 45,
  "message": "Building segment for #2 (Curious Cat)...",
  "error": null,
  "output_file": null
}
```
*When completed:*
```json
{
  "id": "71e8d4508720",
  "status": "done",
  "progress": 100,
  "message": "Completed",
  "error": null,
  "output_file": "/path/to/jobs/71e8d4508720/output.mp4"
}
```

### 4.5 POST /api/jobs/{id}/cancel
Immediately halts rendering, terminates active FFmpeg / yt-dlp subprocesses, and sets job status to `cancelled`.

**Response (200 OK):**
```json
{
  "message": "Job cancelled",
  "status": "cancelled"
}
```

### 4.6 GET /api/jobs/{id}/download
Streams the completed MP4 video file.

**Response:** `200 OK`, `Content-Type: video/mp4`, `Content-Disposition: attachment; filename="ranking_{id}.mp4"`.

### 4.7 DELETE /api/jobs/{id}
Deletes a completed or failed job and completely removes its folder (`jobs/<id>/`) from the server filesystem.

**Response (200 OK):**
```json
{
  "message": "Job deleted",
  "status": "deleted"
}
```

### 4.8 GET /
Serves the web application user interface (`app/static/index.html`).

---

## 5. Video Processing Pipeline

The video processing engine (`app/engine.py`) is implemented using pure Python functions calling FFmpeg and yt-dlp via `subprocess`. Every segment is encoded identically (`H.264`, `yuv420p`, 30 fps, AAC 44100 Hz stereo) to enable fast, lossless concatenation via the FFmpeg concat demuxer (`-c copy`).

### 5.1 Asset Resolution & Download Cache
- **Function:** `get_source(source, downloads_dir, uploads_dir, cancel_flag)`
- **URL Handling:** Computes an MD5 hash of the URL. If `<downloads_dir>/<hash>.*` exists, the cached file is returned immediately. If not cached, `yt-dlp` (`sys.executable -m yt_dlp`) downloads the best video (height <= 1080) and best audio into an MP4 container. Direct HTTP media links have an automated fallback using standard browser headers.
- **Local Files:** Resolves files located in `data/uploads/` or direct filesystem paths.

### 5.2 Audio & Duration Probing
- **Functions:** `has_audio(path)`, `probe_duration(path)`
- **Stream Detection:** Uses `ffprobe -select_streams a` to determine whether an audio stream exists.
- **Duration:** Uses `ffprobe -show_entries format=duration` (with stream-level fallback) to determine exact duration in seconds.

### 5.3 Intro Segment Generation
- **Function:** `build_intro(cfg, work_dir, base_data_dir)`
- **Visuals:** Scales/crops background image (if provided) or generates a solid color canvas using `color=c={bg_color}:s={w}x{h}:r=30`.
- **Text:** Copies font into `work_dir/font.ttf`, writes the title into `intro_title.txt`, and applies `drawtext=fontfile=font.ttf:textfile=intro_title.txt` centered horizontally and vertically in the configured accent color.
- **Audio:** Synthesizes silent stereo 44.1kHz audio (`anullsrc`) matched to `intro_seconds`.
- **Output:** `seg_intro.mp4`.

### 5.4 Item Segment Generation
- **Function:** `build_item(cfg, item, idx, work_dir, base_data_dir)`
- **Trimming:** Uses input seeking (`-ss {start} -t {duration} -i {clip}`) for maximum speed.
- **Layout:**
  - Video canvas: Configured width x height (e.g. 1920x1080 or 1080x1920).
  - Top header: Main video title in accent color at 4% top margin (`item_top_title_{idx}.txt`).
  - Clip box: Scaled with aspect ratio preserved to fit within 80% width x 60% height box, centered horizontally and positioned in the upper-middle area.
  - Bottom label: `#<rank>  <title>` in large white text with black border, centered in the bottom region below the clip.
- **Audio & Volume:** Scales clip audio with `volume={clip_volume}` and formats to 44.1kHz stereo. If clip lacks audio, generates synchronized silent audio via `anullsrc`.
- **Output:** `seg_{idx}.mp4`.

### 5.5 Segment Concatenation
- **Function:** `concat_segments(segments, work_dir)`
- **Demuxer:** Writes a list of segment paths into `concat_list.txt`.
- **Stream Copy:** Runs `ffmpeg -f concat -safe 0 -i concat_list.txt -c copy joined.mp4`. Because all segments share identical codecs, pixel formats, framerates, and audio layouts, concatenation executes with zero re-encoding and zero stutter or glitches.
- **Output:** `joined.mp4`.

### 5.6 Background Music Mixing
- **Function:** `add_bgm(joined, bgm, volume, output)`
- **Looped Mix:** Loops the background music infinitely with `-stream_loop -1 -i <bgm>`.
- **Audio Mix:** Blends video audio and scaled BGM using `amix=inputs=2:duration=first:normalize=0`.
- **Duration Lock:** Enforces `-t {video_duration}` so audio terminates synchronously with video frames.
- **Output:** Final `output.mp4`.

### 5.7 Automated Cleanup
- Once `output.mp4` is successfully generated, the intermediate `work/` directory containing all per-segment video files, concatenated intermediate files, and temporary text files is immediately deleted.
- Only the final `output.mp4` and `job.json` are retained in `jobs/<id>/`.

---

## 6. Reliability & State Persistence

### 6.1 Subprocess Termination
When a user clicks **Cancel** or requests `POST /api/jobs/{id}/cancel`, active FFmpeg and yt-dlp child processes are terminated within ~100ms via `run_subprocess_with_cancel()`, freeing system CPU and memory.

### 6.2 Error Diagnostics
Error messages returned in `job.json` and displayed in the frontend include:
- Missing system binaries (`ffmpeg`, `ffprobe`, `yt-dlp`).
- Download failures with clear URL error messages.
- Invalid timestamp ranges (`end <= start`).
- FFmpeg syntax or filter failures showing the trimmed last lines of FFmpeg stderr.

### 6.3 Browser State Persistence
All user inputs in the frontend are automatically saved to `localStorage` under the key `ranking_video_form_state` whenever any form field or item row is modified. Refreshing or reopening the browser instantly restores all titles, options, uploaded asset IDs, and item lists.

---

## 7. Extension & Customization Guide

### 7.1 Adding New Resolution Presets
To add new presets (e.g. 1:1 Square 1080x1080):
1. In `app/static/index.html`, add `<option value="1080x1080">1:1 Square (1080x1080)</option>`.
2. The backend dynamically calculates dimensions based on `cfg.width` and `cfg.height`, automatically adapting the 80%x60% clip bounding box.

### 7.2 Custom Fonts
Place any TrueType font (`.ttf`) in `data/fonts/custom.ttf` and specify `"font": "custom.ttf"` in the configuration. The engine will automatically reference it in FFmpeg `drawtext`.

### 7.3 Sound Effects on Rank Reveals
To add transition swooshes or chimes when ranks change, insert an audio snippet during segment creation in `build_item` using FFmpeg `amix` or concatenate short transition clips between items.
