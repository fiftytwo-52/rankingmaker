# Application Documentation: Ranking Video Maker

## 1. Architecture Overview

## 2. Folder Structure

## 3. Configuration & Data Schema

## 4. API Endpoints
### 4.1 GET /api/health
### 4.2 POST /api/upload
### 4.3 POST /api/jobs
### 4.4 GET /api/jobs/{id}
### 4.5 POST /api/jobs/{id}/cancel
### 4.6 GET /api/jobs/{id}/download
### 4.7 GET /

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
