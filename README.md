# Ranking Video Maker

A local web application that automatically generates "Top N" countdown/ranking videos with zero manual editing. Users enter a title and ranked items (from URLs or uploaded video clips), specify start/end timestamps, optionally add background visuals and music, and generate a polished, synchronized countdown MP4.

## Requirements & Tested Environment
- **OS:** Linux (Ubuntu 24.04 LTS / 6.8 kernel, x86_64)
- **Python:** 3.10+ (tested with Python 3.12.3)
- **FFmpeg & FFprobe:** Installed and available on system PATH (tested with FFmpeg 6.1.1-3ubuntu5)
- **yt-dlp:** Included in Python dependencies or system PATH (tested with 2026.8.19)

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

1. Enter your main video title (e.g. "TOP 5 GOALS OF THE SEASON").
2. Choose a resolution preset (1920x1080 landscape or 1080x1920 vertical).
3. Select an accent color for titles and highlights.
4. Add ranked items:
   - Enter rank numbers (ordered descending).
   - Enter item title.
   - Provide a video URL (YouTube, etc.) or upload a local video clip.
   - Set start and end timestamps (or duration).
5. (Optional) Upload a background image or background music track.
6. Click **Generate** and monitor the real-time progress bar.
7. Preview and download the rendered MP4 file.

## Folder Layout

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

## Troubleshooting

- **FFmpeg not found:** Ensure FFmpeg and FFprobe are installed (`sudo apt install ffmpeg` on Ubuntu/Debian) and added to your system PATH.
- **yt-dlp download failure:** Check internet connection and verify the video is publicly accessible.
