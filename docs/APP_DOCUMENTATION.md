# Application Documentation: Ranking Video Maker

## 1. Architecture Overview

## 2. Folder Structure

## 3. Configuration & Data Schema

The request payload for rendering videos is validated using Pydantic models in `app/models.py`.

```json
{
  "title": "TOP 5 FUNNIEST CAT FAILS",
  "width": 1920,
  "height": 1080,
  "accent": "yellow",
  "bg_color": "0x141414",
  "bg_image": null,
  "bgm": null,
  "bgm_volume": 0.25,
  "clip_volume": 1.0,
  "intro_seconds": 3,
  "clip_seconds": 8,
  "font": null,
  "items": [
    { "rank": 5, "title": "Cucumber scare", "source": "https://www.youtube.com/watch?v=xyz", "start": 12, "end": 20 },
    { "rank": 4, "title": "Missed jump", "source": "upload_file_id.mp4", "start": 0, "duration": 6 }
  ]
}
```

### Validation Rules
- `title`: Non-empty string.
- `width`, `height`: Positive integers (default: 1920x1080).
- `items`: Minimum 1 item required. Ranks must be unique integers.
- `start` / `end`: `start >= 0`. If `end` is specified, `end > start`.

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

**Request:** `application/json` (VideoConfig payload)

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

### 4.7 GET /
Serves the web application user interface (`app/static/index.html`).

## 5. Video Processing Pipeline

The video processing engine (`app/engine.py`) is implemented using pure Python functions calling FFmpeg and yt-dlp via `subprocess`. Every segment is encoded identically (`H.264`, `yuv420p`, 30 fps, AAC 44100 Hz stereo) to enable fast, lossless concatenation via the FFmpeg concat demuxer (`-c copy`).

### 5.1 Asset Resolution & Download Cache
- **Function:** `get_source(source, downloads_dir, uploads_dir)`
- **URL Handling:** Computes an MD5 hash of the URL. If `<downloads_dir>/<hash>.*` exists, the cached file is returned immediately. If not cached, `yt-dlp` downloads the best video (height <= 1080) and best audio into an MP4 container.
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

## 6. Extension & Customization Guide
