import hashlib
import glob
from pathlib import Path
import subprocess
import sys


def get_source(source: str, downloads_dir: Path | str, uploads_dir: Path | str) -> Path:
    """
    Resolves a source string (URL or uploaded file id / local path) to a local Path.
    URLs are cached by MD5 hash in downloads_dir using yt-dlp.
    """
    downloads_dir = Path(downloads_dir).resolve()
    uploads_dir = Path(uploads_dir).resolve()
    downloads_dir.mkdir(parents=True, exist_ok=True)
    uploads_dir.mkdir(parents=True, exist_ok=True)

    source_str = str(source).strip()

    if source_str.startswith("http://") or source_str.startswith("https://"):
        url_hash = hashlib.md5(source_str.encode("utf-8")).hexdigest()

        # Check if already cached
        pattern = str(downloads_dir / f"{url_hash}.*")
        matches = [Path(p) for p in glob.glob(pattern) if not p.endswith(".part")]
        if matches:
            return matches[0]

        # Download via yt-dlp
        output_template = str(downloads_dir / f"{url_hash}.%(ext)s")
        cmd = [
            "yt-dlp",
            "-f", "bv*[height<=1080]+ba/b",
            "--merge-output-format", "mp4",
            "-o", output_template,
            source_str,
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)
        if res.returncode != 0:
            # Try python -m yt_dlp fallback if direct executable failed
            fallback_cmd = [sys.executable, "-m", "yt_dlp", "-f", "bv*[height<=1080]+ba/b", "--merge-output-format", "mp4", "-o", output_template, source_str]
            res2 = subprocess.run(fallback_cmd, capture_output=True, text=True)
            if res2.returncode != 0:
                raise RuntimeError(f"yt-dlp failed to download URL '{source_str}': {res2.stderr.strip() or res.stderr.strip()}")

        matches = [Path(p) for p in glob.glob(pattern) if not p.endswith(".part")]
        if not matches:
            raise FileNotFoundError(f"Downloaded file for URL not found at {pattern}")
        return matches[0]

    # Check local uploads or paths
    direct_path = Path(source_str)
    if direct_path.is_file():
        return direct_path.resolve()

    in_uploads = uploads_dir / source_str
    if in_uploads.is_file():
        return in_uploads.resolve()

    # Try matching file id with any extension in uploads
    upload_matches = list(uploads_dir.glob(f"{source_str}.*"))
    if upload_matches:
        return upload_matches[0].resolve()

    raise FileNotFoundError(f"Source file or upload ID not found: {source_str}")


def has_audio(path: Path | str) -> bool:
    """
    Checks if a media file has at least one audio stream using ffprobe.
    """
    cmd = [
        "ffprobe",
        "-v", "error",
        "-select_streams", "a",
        "-show_entries", "stream=codec_type",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        return False
    return "audio" in res.stdout.lower()


def probe_duration(path: Path | str) -> float:
    """
    Returns the duration in seconds of a media file using ffprobe.
    """
    cmd = [
        "ffprobe",
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode == 0 and res.stdout.strip():
        try:
            return float(res.stdout.strip())
        except ValueError:
            pass

    # Fallback to stream duration
    cmd_stream = [
        "ffprobe",
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    res2 = subprocess.run(cmd_stream, capture_output=True, text=True)
    if res2.returncode == 0 and res2.stdout.strip():
        try:
            return float(res2.stdout.strip())
        except ValueError:
            pass

    return 0.0


def prepare_font(cfg: dict, work_dir: Path, fonts_dir: Path, uploads_dir: Path) -> Path:
    """
    Ensures font.ttf exists in work_dir. Copies specified font or default.ttf.
    """
    work_dir = Path(work_dir)
    dest_font = work_dir / "font.ttf"
    if dest_font.exists():
        return dest_font

    font_id = cfg.get("font")
    chosen_font_path: Path | None = None

    if font_id:
        custom_path = uploads_dir / str(font_id)
        if custom_path.is_file():
            chosen_font_path = custom_path
        else:
            matches = list(uploads_dir.glob(f"{font_id}.*"))
            if matches:
                chosen_font_path = matches[0]

    if not chosen_font_path or not chosen_font_path.is_file():
        default_font = fonts_dir / "default.ttf"
        if default_font.is_file():
            chosen_font_path = default_font
        else:
            # System font fallbacks
            for fallback in [
                "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
                "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
            ]:
                if Path(fallback).is_file():
                    chosen_font_path = Path(fallback)
                    break

    if not chosen_font_path or not chosen_font_path.is_file():
        raise FileNotFoundError("Could not locate a usable TTF font file")

    import shutil
    shutil.copyfile(chosen_font_path, dest_font)
    return dest_font


def build_intro(cfg: dict, work_dir: Path | str, base_data_dir: Path | str = "data") -> Path:
    """
    Produces seg_intro.mp4 in work_dir with background and centered title.
    """
    work_dir = Path(work_dir).resolve()
    work_dir.mkdir(parents=True, exist_ok=True)
    base_data_dir = Path(base_data_dir).resolve()
    fonts_dir = base_data_dir / "fonts"
    uploads_dir = base_data_dir / "uploads"
    downloads_dir = base_data_dir / "downloads"

    prepare_font(cfg, work_dir, fonts_dir, uploads_dir)

    width = int(cfg.get("width", 1920))
    height = int(cfg.get("height", 1080))
    intro_seconds = float(cfg.get("intro_seconds", 3))
    accent = str(cfg.get("accent", "yellow"))
    bg_color = str(cfg.get("bg_color", "0x141414"))
    title = str(cfg.get("title", "RANKING VIDEO"))

    # Write title to text file to avoid escaping bugs
    title_txt = work_dir / "intro_title.txt"
    title_txt.write_text(title, encoding="utf-8")

    out_file = work_dir / "seg_intro.mp4"
    bg_image_id = cfg.get("bg_image")

    font_size = max(24, int(min(width, height) / 14))
    border_w = max(2, int(font_size / 20))

    drawtext_filter = (
        f"drawtext=fontfile=font.ttf:textfile=intro_title.txt:"
        f"fontsize={font_size}:fontcolor={accent}:borderw={border_w}:bordercolor=black:"
        f"x=(w-text_w)/2:y=(h-text_h)/2"
    )

    if bg_image_id:
        bg_path = get_source(bg_image_id, downloads_dir, uploads_dir)
        cmd = [
            "ffmpeg", "-y",
            "-loop", "1", "-i", str(bg_path),
            "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
            "-filter_complex",
            f"[0:v]scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},setsar=1,{drawtext_filter}[v]",
            "-map", "[v]",
            "-map", "1:a",
            "-t", str(intro_seconds),
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30",
            "-c:a", "aac", "-ar", "44100", "-ac", "2",
            str(out_file),
        ]
    else:
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"color=c={bg_color}:s={width}x{height}:r=30",
            "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
            "-filter_complex",
            f"[0:v]{drawtext_filter}[v]",
            "-map", "[v]",
            "-map", "1:a",
            "-t", str(intro_seconds),
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30",
            "-c:a", "aac", "-ar", "44100", "-ac", "2",
            str(out_file),
        ]

    res = subprocess.run(cmd, cwd=str(work_dir), capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"FFmpeg build_intro failed: {res.stderr.strip()}")

    if not out_file.exists():
        raise FileNotFoundError(f"build_intro did not produce {out_file}")

    return out_file


def build_item(
    cfg: dict,
    item: dict,
    idx: int,
    work_dir: Path | str,
    base_data_dir: Path | str = "data",
) -> Path:
    """
    Produces seg_{idx}.mp4 for one ranked item according to layout specs.
    """
    work_dir = Path(work_dir).resolve()
    work_dir.mkdir(parents=True, exist_ok=True)
    base_data_dir = Path(base_data_dir).resolve()
    fonts_dir = base_data_dir / "fonts"
    uploads_dir = base_data_dir / "uploads"
    downloads_dir = base_data_dir / "downloads"

    prepare_font(cfg, work_dir, fonts_dir, uploads_dir)

    width = int(cfg.get("width", 1920))
    height = int(cfg.get("height", 1080))
    accent = str(cfg.get("accent", "yellow"))
    bg_color = str(cfg.get("bg_color", "0x141414"))
    clip_volume = float(cfg.get("clip_volume", 1.0))
    top_title = str(cfg.get("title", ""))

    start = float(item.get("start", 0))
    if item.get("end") is not None and item.get("start") is not None:
        duration = max(0.5, float(item["end"]) - float(item["start"]))
    elif item.get("duration") is not None:
        duration = max(0.5, float(item["duration"]))
    else:
        duration = max(0.5, float(cfg.get("clip_seconds", 8)))

    rank = item.get("rank", idx + 1)
    item_title = str(item.get("title", ""))
    label_text = f"#{rank}  {item_title}"

    # Write text files to avoid escaping bugs
    top_title_txt = work_dir / f"top_title_{idx}.txt"
    top_title_txt.write_text(top_title, encoding="utf-8")

    label_txt = work_dir / f"item_label_{idx}.txt"
    label_txt.write_text(label_text, encoding="utf-8")

    # Resolve clip source
    clip_source = item.get("source", "")
    clip_path = get_source(clip_source, downloads_dir, uploads_dir)
    clip_has_audio = has_audio(clip_path)

    out_file = work_dir / f"seg_{idx}.mp4"

    # Layout sizing
    box_w = int(width * 0.8)
    box_h = int(height * 0.6)
    box_y = int(height * 0.13)

    top_font_size = max(20, int(min(width, height) / 18))
    top_border_w = max(2, int(top_font_size / 18))

    label_font_size = max(24, int(min(width, height) / 14))
    label_border_w = max(3, int(label_font_size / 16))

    filter_chains = []
    bg_image_id = cfg.get("bg_image")

    # Background
    if bg_image_id:
        bg_path = get_source(bg_image_id, downloads_dir, uploads_dir)
        input_args = [
            "-loop", "1", "-i", str(bg_path),
            "-ss", str(start), "-t", str(duration), "-i", str(clip_path),
        ]
        filter_chains.append(f"[0:v]scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},setsar=1[bg_base]")
    else:
        input_args = [
            "-f", "lavfi", "-i", f"color=c={bg_color}:s={width}x{height}:r=30",
            "-ss", str(start), "-t", str(duration), "-i", str(clip_path),
        ]
        filter_chains.append("[0:v]setsar=1[bg_base]")

    # Top title over background
    filter_chains.append(
        f"[bg_base]drawtext=fontfile=font.ttf:textfile={top_title_txt.name}:"
        f"fontsize={top_font_size}:fontcolor={accent}:borderw={top_border_w}:bordercolor=black:"
        f"x=(w-text_w)/2:y=(h*0.04)[bg_with_top]"
    )

    # Scaled clip
    filter_chains.append(
        f"[1:v]scale={box_w}:{box_h}:force_original_aspect_ratio=decrease,setsar=1[scaled_clip]"
    )

    # Overlay clip on background
    filter_chains.append(
        f"[bg_with_top][scaled_clip]overlay=x=(W-w)/2:y={box_y}+(({box_h}-h)/2)[comp_clip]"
    )

    # Bottom label
    label_y_expr = f"{box_y + box_h}+((h-({box_y + box_h})-text_h)/2)"
    filter_chains.append(
        f"[comp_clip]drawtext=fontfile=font.ttf:textfile={label_txt.name}:"
        f"fontsize={label_font_size}:fontcolor=white:borderw={label_border_w}:bordercolor=black:"
        f"x=(w-text_w)/2:y={label_y_expr}[v]"
    )

    # Audio handling
    if clip_has_audio:
        filter_chains.append(f"[1:a]volume={clip_volume},aformat=sample_rates=44100:channel_layouts=stereo[a]")
        audio_map = ["[a]"]
    else:
        # Add silent audio generator
        input_args.extend(["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"])
        filter_chains.append("[2:a]aformat=sample_rates=44100:channel_layouts=stereo[a]")
        audio_map = ["[a]"]

    filter_complex = ";".join(filter_chains)

    cmd = [
        "ffmpeg", "-y",
        *input_args,
        "-filter_complex", filter_complex,
        "-map", "[v]",
        "-map", audio_map[0],
        "-t", str(duration),
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-r", "30",
        "-c:a", "aac", "-ar", "44100", "-ac", "2",
        str(out_file),
    ]

    res = subprocess.run(cmd, cwd=str(work_dir), capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"FFmpeg build_item failed for item #{rank}: {res.stderr.strip()}")

    if not out_file.exists():
        raise FileNotFoundError(f"build_item did not produce {out_file}")

    return out_file



