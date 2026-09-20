# Ranking Video Maker

A local web application that automatically generates "Top N" countdown/ranking videos with zero manual editing. Users enter a title and ranked items (from URLs or uploaded video clips), specify start/end timestamps, optionally add background visuals and music, and generate a polished, synchronized countdown MP4.

## Requirements & Tested Environment
- **OS:** Linux (tested on Ubuntu 24.04 LTS / 6.8 kernel, x86_64; compatible with macOS and Windows with FFmpeg installed)
- **Python:** 3.10+ (tested with Python 3.12.3)
- **FFmpeg & FFprobe:** Installed and available on system PATH (tested with FFmpeg 6.1.1-3ubuntu5)
- **yt-dlp:** Installed in virtual environment or system PATH (tested with 2026.8.19)

## Installation

1. Clone or navigate to the project directory:
   ```bash
   cd shortsmaker
   ```

2. Create and activate a Python virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

## How to Run

1. Activate your virtual environment:
   ```bash
   source .venv/bin/activate
   ```

2. Start the local server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

3. Open your browser and navigate to:
   [http://localhost:8000](http://localhost:8000)

## How to Use

1. Enter your main video title (e.g., `TOP 5 GREATEST GOALS`).
2. Customize colors **word-by-word**: Click any word's color picker below the title to set distinct colors for individual words (e.g., `TOP` in gold, `5` in red, `GREATEST` in white).
3. Choose a resolution preset:
   - `1920x1080` (Landscape / YouTube standard)
   - `1080x1920` (Vertical / Shorts / TikTok / Reels)
4. Use the **Live Preview Screen** to inspect how your title, colors, background, and clip layout look in real-time. Switch between **Intro Screen** and **Item Clip Screen** views.
5. Add ranked items:
   - Items auto-number in descending order (e.g., 5 down to 1).
   - Enter item title.
   - Provide a video URL (YouTube, public media link) or click **Upload Clip** to select a local video.
   - Set start and end timestamps in seconds.
6. (Optional) Visuals & Audio:
   - Upload a custom background image (falls back to solid dark background).
   - Upload a background music track (loops continuously with customizable volume).
   - Adjust clip audio volume slider.
7. Click **Generate Video** and monitor real-time progress.
8. Once finished, preview the video directly in the web player, download the MP4, or delete the job when done.

## Running Automated Tests

Run the full end-to-end integration test (exercising URLs, local uploads, background image, BGM, and cleanup):
```bash
python -m tests.test_e2e_5items
```

Run the lightweight sample engine test:
```bash
python -m tests.run_sample
```

## Folder Layout

```
shortsmaker/
├── README.md               # Quickstart, installation, usage, troubleshooting
├── progress.md             # Detailed chronological progress log
├── memory.md               # Key architectural decisions, environment, status
├── requirements.txt        # Python dependencies (FastAPI, uvicorn, pydantic, yt-dlp)
├── docs/
│   └── APP_DOCUMENTATION.md# Full technical design and API specification
├── app/
│   ├── main.py             # FastAPI app, routes, endpoints
│   ├── models.py           # Pydantic schemas (VideoConfig, ItemConfig, JobState)
│   ├── engine.py           # Pure video generation pipeline (FFmpeg & yt-dlp)
│   ├── jobs.py             # Background thread job manager and cancellation
│   ├── deps.py             # System tool detection (ffmpeg, ffprobe, yt-dlp)
│   └── static/
│       ├── index.html      # Minimal unstyled user interface
│       └── app.js          # Dynamic item management, API polling, localStorage
├── data/
│   ├── uploads/            # Uploaded clips, background images, audio tracks
│   ├── downloads/          # Cached video downloads keyed by MD5 URL hash
│   └── fonts/              # Bundled default font (LiberationSans-Bold.ttf)
├── jobs/                   # Job directories containing output.mp4 and job.json
└── tests/                  # Integration tests and reference configs
    ├── run_sample.py
    ├── sample_config.json
    └── test_e2e_5items.py
```

## API Quick Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Web frontend UI |
| `GET` | `/api/health` | System tool readiness check (`ffmpeg`, `ffprobe`, `yt-dlp`) |
| `POST` | `/api/upload` | Upload media file (multipart form data) |
| `POST` | `/api/jobs` | Submit new video rendering job |
| `GET` | `/api/jobs/{id}` | Poll job status, progress percentage, and error messages |
| `POST` | `/api/jobs/{id}/cancel` | Immediately cancel rendering and terminate child processes |
| `GET` | `/api/jobs/{id}/download` | Stream/download rendered MP4 video |
| `DELETE` | `/api/jobs/{id}` | Delete job folder and rendered files |

## Troubleshooting

- **FFmpeg / FFprobe not found:**
  - Ubuntu/Debian: `sudo apt update && sudo apt install -y ffmpeg`
  - macOS (Homebrew): `brew install ffmpeg`
  - Verify installation: `ffmpeg -version` and `ffprobe -version`
- **yt-dlp download failure:**
  - Ensure internet access is active.
  - Test the URL directly in terminal: `.venv/bin/python -m yt_dlp "<URL>"`.
  - YouTube periodically updates video serving formats; upgrade yt-dlp if needed: `.venv/bin/pip install --upgrade yt-dlp`.
- **Audio missing in clips:**
  - If a source clip has no audio track, the engine automatically generates synchronized silence so concatenation remains stable.
- **Form lost on browser refresh:**
  - Form state is automatically saved to `localStorage`. If you clear browsing data, default values will be restored.
