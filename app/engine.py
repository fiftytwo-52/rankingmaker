import glob
import hashlib
from pathlib import Path
import shutil
import subprocess
import sys
import time
from typing import Any
import urllib
import urllib.parse
import urllib.request

from app.deps import get_yt_dlp_command


class JobCancelledException(Exception):
    """Raised when a job is cancelled by the user or cancel flag."""
    pass


def is_cancelled(cancel_flag) -> bool:
    if cancel_flag is None:
        return False
    if callable(cancel_flag):
        return bool(cancel_flag())
    if hasattr(cancel_flag, "is_set"):
        return bool(cancel_flag.is_set())
    return bool(cancel_flag)


def format_ffmpeg_error(stderr: str, max_lines: int = 10) -> str:
    """Extracts the last non-empty lines from FFmpeg/yt-dlp stderr for readability."""
    lines = [line.strip() for line in (stderr or "").strip().split("\n") if line.strip()]
    return "\n".join(lines[-max_lines:]) if lines else "No stderr output available"


def run_subprocess_with_cancel(cmd: list[str], cwd: str | None = None, cancel_flag=None, **kwargs) -> subprocess.CompletedProcess:
    """
    Executes a subprocess command while monitoring cancel_flag.
    If cancel_flag becomes set, terminates the subprocess immediately.
    """
    if is_cancelled(cancel_flag):
        raise JobCancelledException("Job was cancelled before command execution")

    proc = subprocess.Popen(
        cmd,
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        **kwargs,
    )

    while proc.poll() is None:
        if is_cancelled(cancel_flag):
            proc.terminate()
            try:
                proc.wait(timeout=1.5)
            except subprocess.TimeoutExpired:
                proc.kill()
            raise JobCancelledException("Subprocess terminated due to cancellation")
        time.sleep(0.05)

    stdout, stderr = proc.communicate()
    return subprocess.CompletedProcess(cmd, proc.returncode, stdout, stderr)



def get_source(
    source: str,
    downloads_dir: Path | str,
    uploads_dir: Path | str,
    cancel_flag=None,
) -> Path:
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

        # Check if already cached (must be non-empty and not a partial file)
        pattern = str(downloads_dir / f"{url_hash}.*")
        matches = [
            Path(p) for p in glob.glob(pattern)
            if not p.endswith(".part") and not p.endswith(".ytdl") and Path(p).is_file() and Path(p).stat().st_size > 0
        ]
        if matches:
            return matches[0]

        # Download via yt-dlp. The command is always resolved through the app interpreter
        # (app.deps.get_yt_dlp_command) so a stale distro binary on PATH is never used.
        yt_dlp_base = get_yt_dlp_command()
        output_template = str(downloads_dir / f"{url_hash}.%(ext)s")

        extra_flags = [
            "--no-playlist",
            "--socket-timeout", "30",
        ]
        # Browser impersonation via curl_cffi handles TikTok, Instagram, etc.
        try:
            import curl_cffi  # noqa: F401
            extra_flags.extend(["--impersonate", "chrome"])
        except ImportError:
            pass

        # JS runtime for YouTube signature challenges
        node_path = shutil.which("node") or shutil.which("nodejs")
        if node_path:
            extra_flags.extend(["--js-runtimes", f"node:{node_path}"])

        cmd = yt_dlp_base + [
            "-f", "bv*[height<=1080]+ba/b[height<=1080]/best",
            "--merge-output-format", "mp4",
            "-o", output_template,
        ] + extra_flags + [source_str]
        res = run_subprocess_with_cancel(cmd, cancel_flag=cancel_flag)
        if res.returncode != 0:
            # Retry with the same tool but a looser format selector: dropping the 1080p cap on
            # the plain-stream fallback covers videos that only expose one progressive stream.
            fallback_cmd = yt_dlp_base + [
                "-f", "bv*[height<=1080]+ba/b/best",
                "--merge-output-format", "mp4",
                "-o", output_template,
            ] + extra_flags + [source_str]
            res2 = run_subprocess_with_cancel(fallback_cmd, cancel_flag=cancel_flag)
            if res2.returncode != 0:
                # If both yt-dlp calls fail, check if it's a direct file download
                direct_ext = Path(urllib.parse.urlparse(source_str).path).suffix.lower()
                if direct_ext in [".mp4", ".mov", ".mkv", ".webm", ".avi", ".ts"]:
                    try:
                        direct_dest = downloads_dir / f"{url_hash}{direct_ext}"
                        req = urllib.request.Request(
                            source_str,
                            headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
                        )
                        with urllib.request.urlopen(req, timeout=30) as resp, open(direct_dest, "wb") as out_f:
                            shutil.copyfileobj(resp, out_f)
                    except Exception as e:
                        clean_err = format_ffmpeg_error(res.stderr or res2.stderr)
                        raise RuntimeError(f"Failed to download URL '{source_str}':\n{clean_err}\nDirect download error: {e}")
                else:
                    clean_err = format_ffmpeg_error(res.stderr or res2.stderr)
                    raise RuntimeError(f"yt-dlp failed to download URL '{source_str}':\n{clean_err}")

        matches = [
            Path(p) for p in glob.glob(pattern)
            if not p.endswith(".part") and not p.endswith(".ytdl") and Path(p).is_file() and Path(p).stat().st_size > 0
        ]
        if not matches:
            raise FileNotFoundError(f"Downloaded file for URL not found at {pattern}")
        return matches[0]

    # Check local uploads, downloads, or direct paths
    direct_path = Path(source_str)
    if direct_path.is_file():
        return direct_path.resolve()

    clean_name = source_str.lstrip("/")
    if clean_name.startswith("data/"):
        clean_name = clean_name[len("data/"):]
    if clean_name.startswith("uploads/"):
        clean_name = clean_name[len("uploads/"):]
    elif clean_name.startswith("downloads/"):
        clean_name = clean_name[len("downloads/"):]

    for base_folder in [downloads_dir, uploads_dir]:
        in_folder = base_folder / clean_name
        if in_folder.is_file():
            return in_folder.resolve()
        elem_in_folder = base_folder / "elements" / Path(clean_name).name
        if elem_in_folder.is_file():
            return elem_in_folder.resolve()
        matches = list(base_folder.glob(f"{clean_name}.*"))
        if matches and matches[0].is_file():
            return matches[0].resolve()

    raise FileNotFoundError(f"Source file or upload ID not found: '{source_str}'")


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


def color_to_ass(c: str) -> str:
    """Converts a CSS color name or hex code (#RRGGBB / 0xRRGGBB) to ASS &HBBGGRR& format."""
    NAMED = {
        "white": "FFFFFF", "black": "000000", "red": "0000FF",
        "green": "008000", "lime": "00FF00", "blue": "FF0000",
        "yellow": "00FFFF", "cyan": "FFFF00", "magenta": "FF00FF",
        "gold": "00D7FF", "orange": "00A5FF", "pink": "CBC0FF",
        "purple": "800080", "silver": "C0C0C0", "gray": "808080"
    }
    c_str = str(c or "white").strip()
    if c_str.lower() in NAMED:
        return f"&H{NAMED[c_str.lower()]}&"
    hex_val = c_str.lstrip("#")
    if hex_val.lower().startswith("0x"):
        hex_val = hex_val[2:]
    if len(hex_val) == 3:
        hex_val = "".join([ch * 2 for ch in hex_val])
    if len(hex_val) == 6:
        r, g, b = hex_val[0:2], hex_val[2:4], hex_val[4:6]
        return f"&H{b}{g}{r}&".upper()
    return "&HFFFFFF&"


def build_title_ass_content(
    title: str,
    title_words: list | None,
    default_accent: str,
    width: int,
    height: int,
    font_size: int,
    border_w: int,
    position: str = "center",
    duration: float = 3600.0,
    font_name: str = "Liberation Sans",
    bg_style: str = "none",
    shadow: bool = True,
) -> str:
    """
    Builds an ASS subtitle script string where title words have individual colors,
    supporting multiline titles (\\N), selectable font names, background styles, and shadow toggles.
    """
    if position == "center":
        alignment = 5  # middle-center
        margin_v = 20
    else:
        alignment = 8  # top-center
        margin_v = max(10, int(height * 0.04))

    # Construct dialogue text with ASS per-word color tags and multiline handling
    if title_words and len(title_words) > 0:
        parts = []
        for tw in title_words:
            w_text = tw.get("word", "") if isinstance(tw, dict) else getattr(tw, "word", "")
            w_color = tw.get("color", default_accent) if isinstance(tw, dict) else getattr(tw, "color", default_accent)
            clean_word = (
                str(w_text)
                .replace("{", "")
                .replace("}", "")
                .replace("\\", "")
                .replace("\r\n", "\\N")
                .replace("\n", "\\N")
            )
            ass_col = color_to_ass(w_color)
            parts.append(f"{{\\c{ass_col}}}{clean_word}")
        dialogue_text = " ".join(parts)
    else:
        ass_col = color_to_ass(default_accent)
        clean_title = (
            str(title)
            .replace("{", "")
            .replace("}", "")
            .replace("\\", "")
            .replace("\r\n", "\\N")
            .replace("\n", "\\N")
        )
        dialogue_text = f"{{\\c{ass_col}}}{clean_title}"

    font_family = font_name if font_name else "Liberation Sans"
    animated_dialogue = f"{{\\fad(250,200)}}{dialogue_text}"

    bg_s = str(bg_style or "none").lower().strip()
    if bg_s in ["dark", "solid", "accent"]:
        border_style = 3  # Opaque box
        outline_val = max(4, int(font_size * 0.15))
        shadow_val = 0
        if bg_s == "solid":
            back_col = "&H00000000"
        elif bg_s == "accent":
            hex_acc = color_to_ass(default_accent).replace("&H", "").replace("&", "")
            back_col = f"&H40{hex_acc}"
        else:  # "dark"
            back_col = "&H66000000"
    else:
        border_style = 1
        outline_val = border_w if shadow else 0
        shadow_val = 2 if shadow else 0
        back_col = "&H80000000"

    return f"""[Script Info]
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: TitleStyle,{font_family},{font_size},&H00FFFFFF,&H000000FF,&H00000000,{back_col},-1,0,0,0,100,100,0,0,{border_style},{outline_val},{shadow_val},{alignment},20,20,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:59:59.00,TitleStyle,,0,0,0,,{animated_dialogue}
"""


def build_color_grading_filters(cfg: dict) -> str:
    """
    Constructs an FFmpeg filter string for color grading presets and fine-tuning sliders.
    Alters the visual fingerprint of footage for anti-copyright uniqueness and aesthetic styling.
    """
    preset = str(cfg.get("color_grading_preset", "none")).lower().strip()
    c_mult = float(cfg.get("color_contrast", 1.0))
    s_mult = float(cfg.get("color_saturation", 1.0))
    b_off = float(cfg.get("color_brightness", 0.0))
    w_off = float(cfg.get("color_warmth", 0.0))

    presets = {
        "none": {"contrast": 1.0, "saturation": 1.0, "brightness": 0.0, "warmth": 0.0, "cinematic": False},
        "vibrant": {"contrast": 1.12, "saturation": 1.35, "brightness": 0.02, "warmth": 0.04, "cinematic": False},
        "cinematic": {"contrast": 1.18, "saturation": 1.12, "brightness": -0.02, "warmth": 0.12, "cinematic": True},
        "warm_vintage": {"contrast": 1.06, "saturation": 1.10, "brightness": 0.03, "warmth": 0.28, "cinematic": False},
        "cool_noir": {"contrast": 1.20, "saturation": 0.85, "brightness": -0.03, "warmth": -0.22, "cinematic": False},
        "neon_punch": {"contrast": 1.25, "saturation": 1.50, "brightness": 0.0, "warmth": -0.08, "cinematic": False},
        "film_matte": {"contrast": 0.95, "saturation": 0.92, "brightness": 0.04, "warmth": 0.06, "cinematic": False},
    }

    p = presets.get(preset, presets["none"])
    final_contrast = max(0.4, min(2.5, p["contrast"] * c_mult))
    final_saturation = max(0.0, min(3.0, p["saturation"] * s_mult))
    final_brightness = max(-0.4, min(0.4, p["brightness"] + b_off))
    final_warmth = max(-1.0, min(1.0, p["warmth"] + w_off))

    filters = []
    if abs(final_contrast - 1.0) > 0.01 or abs(final_saturation - 1.0) > 0.01 or abs(final_brightness) > 0.005:
        filters.append(f"eq=contrast={final_contrast:.2f}:brightness={final_brightness:.2f}:saturation={final_saturation:.2f}")

    if p["cinematic"]:
        filters.append("colorbalance=rs=-0.05:gs=0.01:bs=0.08:rh=0.08:gh=0.02:bh=-0.06")
    elif abs(final_warmth) > 0.02:
        rw = final_warmth * 0.08
        bw = -final_warmth * 0.08
        filters.append(f"colorbalance=rs={rw:.3f}:bs={bw:.3f}:rm={rw*0.75:.3f}:bm={bw*0.75:.3f}:rh={rw*0.6:.3f}:bh={bw*0.6:.3f}")

    return ",".join(filters)


def build_rank_ladder_ass(
    cfg: dict,
    items: list,
    current_idx: int | None,
    width: int,
    height: int,
    duration: float,
    font_name: str = "Liberation Sans",
    position: str = "left",
) -> str:
    """
    Generates an ASS subtitle file that renders a persistent vertical ladder
    of ranking numbers (1, 2, 3, 4, 5...) on the screen edge.
    If a rank has been revealed in sequence, displays its title.
    If it is the currently active rank, adds an accent highlight.
    """
    if not items:
        return ""

    # Sort ranks in ascending order (1, 2, 3, 4, 5...)
    all_ranks = sorted(list(set(int(it.get("rank", i + 1) if isinstance(it, dict) else it.rank) for i, it in enumerate(items))))
    
    # Map rank to item
    rank_to_item = {}
    for it in items:
        r = int(it.get("rank", 1) if isinstance(it, dict) else it.rank)
        rank_to_item[r] = it

    revealed_ranks = set()
    current_rank = None
    if current_idx is not None and 0 <= current_idx < len(items):
        for i in range(current_idx + 1):
            it = items[i]
            r = int(it.get("rank", 1) if isinstance(it, dict) else it.rank)
            revealed_ranks.add(r)
        active_item = items[current_idx]
        current_rank = int(active_item.get("rank", 1) if isinstance(active_item, dict) else active_item.rank)

    pos_str = str(position or "left").lower().strip()
    is_right = pos_str == "right"
    x_coord = int(width * 0.94) if is_right else int(width * 0.06)
    align_code = 6 if is_right else 4  # middle-right or middle-left

    start_y = int(height * 0.28)
    spacing = min(int(height * 0.08), int((height * 0.48) / max(len(all_ranks), 1)))
    font_size = max(24, int(spacing * 0.50))
    outline_val = max(3, int(font_size * 0.12))
    shadow_val = 3

    def fmt_ass_time(sec: float) -> str:
        s = max(0.0, float(sec))
        h = int(s // 3600)
        m = int((s % 3600) // 60)
        sec_rem = s % 60
        return f"{h}:{m:02d}:{sec_rem:05.2f}"

    time_start = "0:00:00.00"
    time_end = fmt_ass_time(duration)

    ass_lines = [
        "[Script Info]",
        "ScriptType: v4.00+",
        f"PlayResX: {width}",
        f"PlayResY: {height}",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: LadderDefault,{font_name},{font_size},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,{outline_val},{shadow_val},{align_code},10,10,10,1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]

    for idx_r, r in enumerate(all_ranks):
        y_coord = start_y + (idx_r * spacing)
        
        # Color styling for rank number
        if r == 1:
            num_color = "&H00FFFF&"  # Gold/Yellow
        elif r == 2:
            num_color = "&HE0E0E0&"  # Silver
        elif r == 3:
            num_color = "&H3090FF&"  # Bronze / Warm Amber
        else:
            num_color = "&HFFFFFF&"  # Crisp White

        is_active = (r == current_rank)
        is_revealed = (r in revealed_ranks)

        if is_active:
            num_tag = f"{{\\c{num_color}}}{{\\fscx115\\fscy115}}{r}{{\\rLadderDefault}}"
        else:
            num_tag = f"{{\\c{num_color}}}{r}{{\\rLadderDefault}}"

        if is_revealed and r in rank_to_item:
            it = rank_to_item[r]
            raw_title = str(it.get("title", "") if isinstance(it, dict) else getattr(it, "title", ""))
            clean_title = (
                raw_title.replace("{", "").replace("}", "").replace("\\", "").replace("\n", " ").strip()
            )
            if len(clean_title) > 28:
                clean_title = clean_title[:26] + ".."
            
            if is_active:
                title_part = f"  {{\\c&H00FFFF&}}{{\\b1}}{clean_title}{{\\b0}}"
            else:
                title_part = f"  {{\\c&HFFFFFF&}}{clean_title}"
            
            if is_right:
                line_text = f"{title_part}  {num_tag}"
            else:
                line_text = f"{num_tag}  {title_part}"
        else:
            line_text = f"{num_tag}"

        dialogue_event = (
            f"Dialogue: 1,{time_start},{time_end},LadderDefault,,0,0,0,,"
            f"{{\\pos({x_coord},{y_coord})}}{line_text}"
        )
        ass_lines.append(dialogue_event)

    return "\n".join(ass_lines) + "\n"


def apply_elements_to_filter_chains(
    elements: list[dict | Any],
    segment_type: str,
    segment_idx: int | None,
    duration: float,
    width: int,
    height: int,
    work_dir: Path,
    uploads_dir: Path,
    downloads_dir: Path,
    input_args: list[str],
    filter_chains: list[str],
    current_v_label: str,
    seg_global_start: float = 0.0,
    item_rank: int | None = None,
    item_orig_idx: int | None = None,
    cancel_flag=None,
) -> str:
    """
    Applies timed text, image, sticker, and emoji overlay elements to filter_chains.
    Correctly computes local timestamps for global timeline elements.
    Returns the updated output video label.
    """
    if not elements:
        return current_v_label

    elem_idx = 0
    for elem in elements:
        if hasattr(elem, "model_dump"):
            elem = elem.model_dump()
        elif hasattr(elem, "dict"):
            elem = elem.dict()
        else:
            elem = dict(elem)

        e_target = str(elem.get("target", "clip")).lower().strip()
        e_clip_idx = elem.get("clip_index")

        # Check target matching
        if segment_type == "intro":
            if e_target not in ["intro", "global"]:
                continue
        elif segment_type == "clip":
            if e_target == "intro":
                continue
            if e_target == "clip":
                # If specific clip targeted, check matching against segment_idx, item_rank, or item_orig_idx
                if e_clip_idx is not None and str(e_clip_idx).strip() not in ["", "null", "none"]:
                    try:
                        target_num = int(e_clip_idx)
                        matches = (
                            (segment_idx is not None and target_num == segment_idx)
                            or (item_rank is not None and target_num == item_rank)
                            or (item_orig_idx is not None and target_num == item_orig_idx)
                        )
                        if not matches:
                            continue
                    except (ValueError, TypeError):
                        pass

        # Compute active timing window inside this segment
        raw_start = elem.get("start_time")
        raw_end = elem.get("end_time")

        if e_target == "global":
            elem_start = max(0.0, float(raw_start) if raw_start is not None else 0.0)
            elem_end = float(raw_end) if raw_end is not None else (duration + seg_global_start)
            t_start = max(0.0, elem_start - seg_global_start)
            t_end = min(duration, elem_end - seg_global_start)
            if t_end <= t_start or t_start >= duration or t_end <= 0.0:
                continue
        else:
            elem_start = max(0.0, float(raw_start) if raw_start is not None else 0.0)
            elem_end = float(raw_end) if raw_end is not None else duration
            t_start = max(0.0, elem_start)
            t_end = min(duration, elem_end)
            if t_end <= t_start or t_start >= duration:
                continue

        e_type = str(elem.get("type", "text")).lower()
        content = str(elem.get("content", "")).strip()
        if not content:
            continue

        elem_idx += 1
        next_v_label = f"v_elem_{segment_type}_{segment_idx or 0}_{elem_idx}"
        pos_x_ratio = max(0.0, min(1.0, float(elem.get("pos_x", 50.0)) / 100.0))
        pos_y_ratio = max(0.0, min(1.0, float(elem.get("pos_y", 50.0)) / 100.0))

        if e_type == "text":
            txt_file = work_dir / f"elem_txt_{segment_type}_{segment_idx or 0}_{elem_idx}.txt"
            txt_file.write_text(content, encoding="utf-8")
            custom_font = elem.get("font_size")
            font_sz = int(custom_font) if custom_font else max(24, int(height * 0.045 * float(elem.get("scale", 1.0))))
            color = str(elem.get("color", "white")).strip() or "white"
            bg_box = ""
            if elem.get("bg_color"):
                bg_box = f":box=1:boxcolor={elem.get('bg_color')}@0.75:boxborderw=10"
            filter_chains.append(
                f"[{current_v_label}]drawtext=fontfile=font.ttf:textfile={txt_file.name}:"
                f"fontsize={font_sz}:fontcolor={color}:borderw=3:bordercolor=black:"
                f"shadowx=2:shadowy=2:shadowcolor=black@0.75{bg_box}:"
                f"x=(w-text_w)*{pos_x_ratio}:y=(h-text_h)*{pos_y_ratio}:"
                f"enable='between(t,{t_start:.2f},{t_end:.2f})'[{next_v_label}]"
            )
            current_v_label = next_v_label

        elif e_type in ["image", "sticker", "emoji"]:
            resolved_img = None
            if content.startswith("http://") or content.startswith("https://"):
                try:
                    resolved_img = get_source(content, downloads_dir, uploads_dir, cancel_flag=cancel_flag)
                except Exception:
                    resolved_img = None
            else:
                clean_path = content.lstrip("/")
                if clean_path.startswith("data/"):
                    clean_path = clean_path[len("data/"):]
                if clean_path.startswith("uploads/"):
                    clean_path = clean_path[len("uploads/"):]
                elif clean_path.startswith("downloads/"):
                    clean_path = clean_path[len("downloads/"):]
                candidates = [
                    uploads_dir / clean_path,
                    uploads_dir / "elements" / Path(clean_path).name,
                    uploads_dir / Path(clean_path).name,
                    downloads_dir / clean_path,
                    downloads_dir / Path(clean_path).name,
                    work_dir / clean_path,
                    Path(content).resolve() if Path(content).is_file() else None,
                ]
                for cand in candidates:
                    if cand and cand.is_file():
                        resolved_img = cand
                        break

            if resolved_img and resolved_img.is_file():
                inp_idx = input_args.count("-i")
                input_args.extend(["-loop", "1", "-i", str(resolved_img)])
                scale_val = float(elem.get("scale", 1.0))
                target_w = max(32, int(width * 0.28 * scale_val))
                scaled_elem_label = f"elem_scale_{segment_type}_{segment_idx or 0}_{elem_idx}"
                filter_chains.append(
                    f"[{inp_idx}:v]scale={target_w}:-2:force_original_aspect_ratio=decrease,format=rgba[{scaled_elem_label}]"
                )
                filter_chains.append(
                    f"[{current_v_label}][{scaled_elem_label}]overlay="
                    f"x=(W-w)*{pos_x_ratio}:y=(H-h)*{pos_y_ratio}:"
                    f"enable='between(t,{t_start:.2f},{t_end:.2f})':shortest=0:eof_action=pass[{next_v_label}]"
                )
                current_v_label = next_v_label
            else:
                txt_file = work_dir / f"elem_emoji_{segment_type}_{segment_idx or 0}_{elem_idx}.txt"
                txt_file.write_text(content, encoding="utf-8")
                font_sz = max(28, int(height * 0.07 * float(elem.get("scale", 1.0))))
                filter_chains.append(
                    f"[{current_v_label}]drawtext=fontfile=font.ttf:textfile={txt_file.name}:"
                    f"fontsize={font_sz}:fontcolor=white:borderw=2:bordercolor=black:"
                    f"x=(w-text_w)*{pos_x_ratio}:y=(h-text_h)*{pos_y_ratio}:"
                    f"enable='between(t,{t_start:.2f},{t_end:.2f})'[{next_v_label}]"
                )
                current_v_label = next_v_label

    return current_v_label


def build_intro(
    cfg: dict | Any,
    work_dir: Path | str,
    base_data_dir: Path | str = "data",
    cancel_flag=None,
) -> Path:
    """
    Produces seg_intro.mp4 in work_dir with background and centered title.
    """
    if hasattr(cfg, "model_dump"):
        cfg = cfg.model_dump()
    elif hasattr(cfg, "dict"):
        cfg = cfg.dict()
    else:
        cfg = dict(cfg)

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
    title_words = cfg.get("title_words")

    # Write title to text file to avoid escaping bugs
    title_txt = work_dir / "intro_title.txt"
    title_txt.write_text(title, encoding="utf-8")

    out_file = work_dir / "seg_intro.mp4"
    bg_image_id = cfg.get("bg_image")

    custom_title_font_size = cfg.get("title_font_size")
    font_size = int(custom_title_font_size) if custom_title_font_size else max(24, int(min(width, height) / 14))
    border_w = max(2, int(font_size / 20))
    title_bg_style = str(cfg.get("title_bg_style", "none")).lower().strip()
    title_shadow = bool(cfg.get("title_shadow", True))

    if title_words and len(title_words) > 0:
        ass_content = build_title_ass_content(
            title=title,
            title_words=title_words,
            default_accent=accent,
            width=width,
            height=height,
            font_size=font_size,
            border_w=border_w,
            position="center",
            duration=intro_seconds + 2.0,
            font_name=str(cfg.get("font") or "Liberation Sans"),
            bg_style=title_bg_style,
            shadow=title_shadow,
        )
        ass_file = work_dir / "intro_title.ass"
        ass_file.write_text(ass_content, encoding="utf-8")
        title_filter = f"ass={ass_file.name}:fontsdir=."
    else:
        box_param = ""
        if title_bg_style in ["dark", "solid", "accent"]:
            box_color = "black@0.6" if title_bg_style == "dark" else ("black" if title_bg_style == "solid" else f"{accent}@0.5")
            box_param = f":box=1:boxcolor={box_color}:boxborderw=10"
        shadow_param = ":shadowx=2:shadowy=2:shadowcolor=black@0.8" if title_shadow else ""
        border_param = f":borderw={border_w}:bordercolor=black" if title_shadow else ":borderw=0"
        title_filter = (
            f"drawtext=fontfile=font.ttf:textfile=intro_title.txt:"
            f"fontsize={font_size}:fontcolor={accent}{border_param}{shadow_param}{box_param}:"
            f"x=(w-text_w)/2:y=(h-text_h)/2"
        )

    show_rank_ladder = bool(cfg.get("show_rank_ladder", False))
    ladder_filter = ""
    if show_rank_ladder:
        ladder_ass_content = build_rank_ladder_ass(
            cfg=cfg,
            items=cfg.get("items", []),
            current_idx=None,
            width=width,
            height=height,
            duration=intro_seconds + 2.0,
            font_name=str(cfg.get("font") or "Liberation Sans"),
            position=str(cfg.get("rank_ladder_position", "left")),
        )
        ladder_ass_file = work_dir / "intro_ladder.ass"
        ladder_ass_file.write_text(ladder_ass_content, encoding="utf-8")
        ladder_filter = f",ass={ladder_ass_file.name}:fontsdir=."

    filter_chains = []
    input_args = []
    if bg_image_id:
        bg_path = get_source(bg_image_id, downloads_dir, uploads_dir, cancel_flag=cancel_flag)
        input_args.extend(["-loop", "1", "-i", str(bg_path)])
        filter_chains.append(
            f"[0:v]scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},setsar=1,{title_filter}{ladder_filter}[v_base]"
        )
    else:
        input_args.extend(["-f", "lavfi", "-i", f"color=c={bg_color}:s={width}x{height}:r=30"])
        filter_chains.append(f"[0:v]{title_filter}{ladder_filter}[v_base]")

    silent_idx = input_args.count("-i")
    input_args.extend(["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"])
    filter_chains.append(f"[{silent_idx}:a]aformat=sample_rates=44100:channel_layouts=stereo[a_intro]")

    final_v = apply_elements_to_filter_chains(
        elements=cfg.get("elements", []),
        segment_type="intro",
        segment_idx=None,
        duration=intro_seconds,
        width=width,
        height=height,
        work_dir=work_dir,
        uploads_dir=uploads_dir,
        downloads_dir=downloads_dir,
        input_args=input_args,
        filter_chains=filter_chains,
        current_v_label="v_base",
        cancel_flag=cancel_flag,
        seg_global_start=0.0,
    )

    cmd = [
        "ffmpeg", "-y",
        *input_args,
        "-filter_complex", ";".join(filter_chains),
        "-map", f"[{final_v}]",
        "-map", "[a_intro]",
        "-t", str(intro_seconds),
        "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "high", "-level", "4.1", "-pix_fmt", "yuv420p", "-r", "30",
        "-c:a", "aac", "-ar", "44100", "-ac", "2",
        "-movflags", "+faststart",
        str(out_file),
    ]

    res = run_subprocess_with_cancel(cmd, cwd=str(work_dir), cancel_flag=cancel_flag)
    if res.returncode != 0:
        raise RuntimeError(f"FFmpeg build_intro failed:\n{format_ffmpeg_error(res.stderr)}")

    if not out_file.exists():
        raise FileNotFoundError(f"build_intro did not produce {out_file}")

    return out_file


def build_item(
    cfg: dict | Any,
    item: dict | Any,
    idx: int,
    work_dir: Path | str,
    base_data_dir: Path | str = "data",
    cancel_flag=None,
    seg_global_start: float = 0.0,
    orig_idx: int | None = None,
) -> Path:
    """
    Produces seg_{idx}.mp4 for one ranked item according to layout specs.
    """
    if hasattr(cfg, "model_dump"):
        cfg = cfg.model_dump()
    elif hasattr(cfg, "dict"):
        cfg = cfg.dict()
    else:
        cfg = dict(cfg)

    if hasattr(item, "model_dump"):
        item = item.model_dump()
    elif hasattr(item, "dict"):
        item = item.dict()
    else:
        item = dict(item)

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
    clip_path = get_source(clip_source, downloads_dir, uploads_dir, cancel_flag=cancel_flag)
    clip_has_audio = has_audio(clip_path)

    out_file = work_dir / f"seg_{idx}.mp4"

    # Layout sizing (Full width clip with no horizontal outer padding)
    box_w = width
    box_h = int(height * 0.76)
    box_y = int(height * 0.10)

    custom_title_font_size = cfg.get("title_font_size")
    top_font_size = int(custom_title_font_size * 0.8) if custom_title_font_size else max(20, int(min(width, height) / 18))
    top_border_w = max(2, int(top_font_size / 18))
    title_bg_style = str(cfg.get("title_bg_style", "none")).lower().strip()
    title_shadow = bool(cfg.get("title_shadow", True))

    custom_item_font_size = cfg.get("item_font_size")
    label_font_size = int(custom_item_font_size) if custom_item_font_size else max(24, int(min(width, height) / 14))
    label_border_w = max(3, int(label_font_size / 16))
    item_bg_style = str(cfg.get("item_bg_style", "dark")).lower().strip()
    item_shadow = bool(cfg.get("item_shadow", True))

    filter_chains = []
    bg_image_id = cfg.get("bg_image")

    # Background
    if bg_image_id:
        bg_path = get_source(bg_image_id, downloads_dir, uploads_dir, cancel_flag=cancel_flag)
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

    # Scaled clip with color grading and framing mode (fit, fill, stretch, blur, card)
    color_filter_str = build_color_grading_filters(cfg)
    if color_filter_str:
        filter_chains.append(f"[1:v]{color_filter_str}[graded_clip]")
        clip_v_in = "[graded_clip]"
    else:
        clip_v_in = "[1:v]"

    clip_fit = str(cfg.get("clip_fit", "fit")).lower().strip()
    if clip_fit == "fill":
        filter_chains.append(
            f"{clip_v_in}scale={box_w}:{box_h}:force_original_aspect_ratio=increase,crop={box_w}:{box_h},setsar=1[scaled_clip]"
        )
    elif clip_fit == "stretch":
        filter_chains.append(
            f"{clip_v_in}scale={box_w}:{box_h},setsar=1[scaled_clip]"
        )
    elif clip_fit == "blur":
        filter_chains.append(
            f"{clip_v_in}split=2[v_bg][v_fg];"
            f"[v_bg]scale={box_w}:{box_h}:force_original_aspect_ratio=increase,crop={box_w}:{box_h},boxblur=24:6,setsar=1[v_blurred];"
            f"[v_fg]scale={box_w}:{box_h}:force_original_aspect_ratio=decrease,setsar=1[v_sharp];"
            f"[v_blurred][v_sharp]overlay=x=(W-w)/2:y=(H-h)/2[scaled_clip]"
        )
    elif clip_fit == "card":
        card_w = int(box_w * 0.88)
        card_h = int(box_h * 0.88)
        border_pad = 10
        filter_chains.append(
            f"{clip_v_in}scale={card_w}:{card_h}:force_original_aspect_ratio=decrease,setsar=1,"
            f"pad=w={card_w + border_pad * 2}:h={card_h + border_pad * 2}:x={border_pad}:y={border_pad}:color=white@0.35[scaled_clip]"
        )
    else:  # default 'fit' (contain)
        filter_chains.append(
            f"{clip_v_in}scale={box_w}:{box_h}:force_original_aspect_ratio=decrease,setsar=1[scaled_clip]"
        )

    # 1. Overlay scaled clip onto background canvas
    enable_transitions = bool(cfg.get("transitions", True))
    if enable_transitions and duration >= 1.0:
        filter_chains.append(
            f"[bg_base][scaled_clip]overlay=x=(W-w)/2:y={box_y}+(({box_h}-h)/2),fade=t=in:st=0:d=0.25[comp_clip]"
        )
    else:
        filter_chains.append(
            f"[bg_base][scaled_clip]overlay=x=(W-w)/2:y={box_y}+(({box_h}-h)/2)[comp_clip]"
        )

    # 2. Main video title overlay (placed ON TOP of clip composite so it is never occluded)
    title_words = cfg.get("title_words")
    if title_words and len(title_words) > 0:
        top_ass_content = build_title_ass_content(
            title=top_title,
            title_words=title_words,
            default_accent=accent,
            width=width,
            height=height,
            font_size=top_font_size,
            border_w=top_border_w,
            position="top",
            duration=duration + 2.0,
            font_name=str(cfg.get("font") or "Liberation Sans"),
            bg_style=title_bg_style,
            shadow=title_shadow,
        )
        top_ass_file = work_dir / f"top_title_{idx}.ass"
        top_ass_file.write_text(top_ass_content, encoding="utf-8")
        top_filter = f"ass={top_ass_file.name}:fontsdir=."
    else:
        top_box = ""
        if title_bg_style in ["dark", "solid", "accent"]:
            top_box_col = "black@0.6" if title_bg_style == "dark" else ("black" if title_bg_style == "solid" else f"{accent}@0.5")
            top_box = f":box=1:boxcolor={top_box_col}:boxborderw=8"
        top_shadow = ":shadowx=2:shadowy=2:shadowcolor=black@0.8" if title_shadow else ""
        top_border = f":borderw={top_border_w}:bordercolor=black" if title_shadow else ":borderw=0"
        top_filter = (
            f"drawtext=fontfile=font.ttf:textfile={top_title_txt.name}:"
            f"fontsize={top_font_size}:fontcolor={accent}{top_border}{top_shadow}{top_box}:"
            f"x=(w-text_w)/2:y=(h*0.04)"
        )

    if top_title.strip():
        filter_chains.append(f"[comp_clip]{top_filter}[comp_with_top]")
        current_layer = "comp_with_top"
    else:
        current_layer = "comp_clip"

    # 3. Item label placement or rank ladder overlay
    label_pos = str(cfg.get("item_label_position", "bottom")).lower().strip()
    if label_pos == "left":
        label_x_expr = "w*0.04"
        label_y_expr = "(h-text_h)/2"
    elif label_pos == "right":
        label_x_expr = "w-text_w-(w*0.04)"
        label_y_expr = "(h-text_h)/2"
    else:  # default 'bottom'
        label_x_expr = "(w-text_w)/2"
        label_y_expr = f"{box_y + box_h}+((h-({box_y + box_h})-text_h)/2)"

    item_box = ""
    if item_bg_style in ["dark", "solid", "accent"]:
        item_box_col = "black@0.65" if item_bg_style == "dark" else ("black" if item_bg_style == "solid" else f"{accent}@0.6")
        item_box = f":box=1:boxcolor={item_box_col}:boxborderw=8"
    item_shadow_p = ":shadowx=2:shadowy=2:shadowcolor=black@0.8" if item_shadow else ""
    item_border_p = f":borderw={label_border_w}:bordercolor=black" if item_shadow else ":borderw=0"

    show_rank_ladder = bool(cfg.get("show_rank_ladder", False))
    if show_rank_ladder:
        ladder_ass_content = build_rank_ladder_ass(
            cfg=cfg,
            items=cfg.get("items", []),
            current_idx=idx,
            width=width,
            height=height,
            duration=duration + 2.0,
            font_name=str(cfg.get("font") or "Liberation Sans"),
            position=str(cfg.get("rank_ladder_position", "left")),
        )
        ladder_ass_file = work_dir / f"ladder_{idx}.ass"
        ladder_ass_file.write_text(ladder_ass_content, encoding="utf-8")

        # When rank ladder is enabled, do NOT burn the separate clip name drawtext since it is already in the ladder
        filter_chains.append(f"[{current_layer}]ass={ladder_ass_file.name}:fontsdir=.[v_pre_elements]")
    else:
        filter_chains.append(
            f"[{current_layer}]drawtext=fontfile=font.ttf:textfile={label_txt.name}:"
            f"fontsize={label_font_size}:fontcolor=white{item_border_p}{item_shadow_p}{item_box}:"
            f"x={label_x_expr}:y={label_y_expr}[v_pre_elements]"
        )

    # 4. Apply timed overlay elements (stickers, emojis, custom text, Vecteezy elements)
    final_v = apply_elements_to_filter_chains(
        elements=cfg.get("elements", []),
        segment_type="clip",
        segment_idx=idx,
        duration=duration,
        width=width,
        height=height,
        work_dir=work_dir,
        uploads_dir=uploads_dir,
        downloads_dir=downloads_dir,
        input_args=input_args,
        filter_chains=filter_chains,
        current_v_label="v_pre_elements",
        cancel_flag=cancel_flag,
        seg_global_start=seg_global_start,
        item_rank=rank,
        item_orig_idx=orig_idx,
    )

    # 5. Audio handling: individual clip volume override (defaults to global clip_volume)
    item_volume_val = item.get("volume")
    active_clip_volume = float(item_volume_val) if item_volume_val is not None else float(cfg.get("clip_volume", 1.0))

    if clip_has_audio:
        filter_chains.append(f"[1:a]volume={active_clip_volume},aformat=sample_rates=44100:channel_layouts=stereo[a]")
        audio_map = ["[a]"]
    else:
        # Dynamically determine the index for anullsrc
        silent_idx = input_args.count("-i")
        input_args.extend(["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"])
        filter_chains.append(f"[{silent_idx}:a]aformat=sample_rates=44100:channel_layouts=stereo[a]")
        audio_map = ["[a]"]

    filter_complex = ";".join(filter_chains)

    cmd = [
        "ffmpeg", "-y",
        *input_args,
        "-filter_complex", filter_complex,
        "-map", f"[{final_v}]",
        "-map", audio_map[0],
        "-t", str(duration),
        "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "high", "-level", "4.1", "-pix_fmt", "yuv420p", "-r", "30",
        "-c:a", "aac", "-ar", "44100", "-ac", "2",
        "-movflags", "+faststart",
        str(out_file),
    ]

    res = run_subprocess_with_cancel(cmd, cwd=str(work_dir), cancel_flag=cancel_flag)
    if res.returncode != 0:
        raise RuntimeError(f"FFmpeg build_item failed for item #{rank}:\n{format_ffmpeg_error(res.stderr)}")

    if not out_file.exists():
        raise FileNotFoundError(f"build_item did not produce {out_file}")

    return out_file


def concat_segments(
    segments: list[Path | str],
    work_dir: Path | str,
    cancel_flag=None,
) -> Path:
    """
    Joins multiple identically encoded segments using the FFmpeg concat demuxer with stream copy (-c copy).
    """
    work_dir = Path(work_dir).resolve()
    work_dir.mkdir(parents=True, exist_ok=True)

    if not segments:
        raise ValueError("No segments provided to concatenate")

    list_file = work_dir / "concat_list.txt"
    with open(list_file, "w", encoding="utf-8") as f:
        for seg in segments:
            seg_path = Path(seg).resolve()
            try:
                rel_path = seg_path.relative_to(work_dir)
                f.write(f"file '{rel_path.as_posix()}'\n")
            except ValueError:
                f.write(f"file '{seg_path.as_posix()}'\n")

    out_file = work_dir / "joined.mp4"
    cmd = [
        "ffmpeg", "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", list_file.name,
        "-c:v", "copy",
        "-c:a", "aac", "-ar", "44100", "-ac", "2",
        "-avoid_negative_ts", "make_zero",
        "-movflags", "+faststart",
        str(out_file.name),
    ]

    res = run_subprocess_with_cancel(cmd, cwd=str(work_dir), cancel_flag=cancel_flag)
    if res.returncode != 0:
        raise RuntimeError(f"FFmpeg concat_segments failed:\n{format_ffmpeg_error(res.stderr)}")

    if not out_file.exists():
        raise FileNotFoundError(f"concat_segments did not produce {out_file}")

    return out_file


def add_bgm(
    joined: Path | str,
    bgm: Path | str | None,
    volume: float,
    output: Path | str,
    cancel_flag=None,
) -> Path:
    """
    Mixes looped background music under the joined video at specified volume,
    trimmed precisely to the video duration. If bgm is None, copies joined to output.
    """
    joined_path = Path(joined).resolve()
    output_path = Path(output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if not bgm:
        cmd = [
            "ffmpeg", "-y",
            "-i", str(joined_path),
            "-c", "copy",
            "-avoid_negative_ts", "make_zero",
            "-movflags", "+faststart",
            str(output_path),
        ]
        res = run_subprocess_with_cancel(cmd, cancel_flag=cancel_flag)
        if res.returncode != 0:
            import shutil
            shutil.copyfile(joined_path, output_path)
        return output_path

    bgm_path = Path(bgm).resolve()
    if not bgm_path.is_file():
        raise FileNotFoundError(f"BGM file not found: {bgm_path}")

    video_duration = probe_duration(joined_path)
    volume_val = max(0.0, float(volume))

    # Looped BGM mixed with joined audio
    cmd = [
        "ffmpeg", "-y",
        "-i", str(joined_path),
        "-stream_loop", "-1", "-i", str(bgm_path),
        "-filter_complex",
        f"[1:a]volume={volume_val},aformat=sample_rates=44100:channel_layouts=stereo[bgma];"
        f"[0:a][bgma]amix=inputs=2:duration=first:normalize=0[aout]",
        "-map", "0:v",
        "-map", "[aout]",
        "-c:v", "copy",
        "-c:a", "aac", "-ar", "44100", "-ac", "2",
        "-avoid_negative_ts", "make_zero",
        "-movflags", "+faststart",
        "-t", str(video_duration),
        str(output_path),
    ]

    res = run_subprocess_with_cancel(cmd, cancel_flag=cancel_flag)
    if res.returncode != 0:
        # Fallback if normalize=0 fails on an older ffmpeg build
        fallback_cmd = [
            "ffmpeg", "-y",
            "-i", str(joined_path),
            "-stream_loop", "-1", "-i", str(bgm_path),
            "-filter_complex",
            f"[1:a]volume={volume_val},aformat=sample_rates=44100:channel_layouts=stereo[bgma];"
            f"[0:a][bgma]amix=inputs=2:duration=first[aout]",
            "-map", "0:v",
            "-map", "[aout]",
            "-c:v", "copy",
            "-c:a", "aac", "-ar", "44100", "-ac", "2",
            "-avoid_negative_ts", "make_zero",
            "-movflags", "+faststart",
            "-t", str(video_duration),
            str(output_path),
        ]
        res_fb = run_subprocess_with_cancel(fallback_cmd, cancel_flag=cancel_flag)
        if res_fb.returncode != 0:
            clean_err = format_ffmpeg_error(res_fb.stderr or res.stderr)
            raise RuntimeError(f"FFmpeg add_bgm failed:\n{clean_err}")

    if not output_path.exists():
        raise FileNotFoundError(f"add_bgm did not produce {output_path}")

    return output_path


def render(
    cfg: dict | Any,
    job_dir: Path | str,
    progress_callback=None,
    cancel_flag=None,
    base_data_dir: Path | str = "data",
) -> Path:
    """
    Orchestrates the entire video rendering pipeline:
    1. Sorts items in countdown order (highest rank first, #1 last).
    2. Builds intro segment.
    3. Builds each item segment.
    4. Concat demuxes segments.
    5. Mixes background music and writes output.mp4.
    Checks cancel_flag between stages and updates progress_callback.
    """
    if hasattr(cfg, "model_dump"):
        cfg_dict = cfg.model_dump()
    elif hasattr(cfg, "dict"):
        cfg_dict = cfg.dict()
    else:
        cfg_dict = dict(cfg)

    def report(pct: int, msg: str):
        if progress_callback:
            progress_callback(pct, msg)

    if is_cancelled(cancel_flag):
        raise JobCancelledException("Job was cancelled before starting")

    job_path = Path(job_dir).resolve()
    job_path.mkdir(parents=True, exist_ok=True)
    work_dir = job_path / "work"
    work_dir.mkdir(parents=True, exist_ok=True)

    base_data_dir = Path(base_data_dir).resolve()
    downloads_dir = base_data_dir / "downloads"
    uploads_dir = base_data_dir / "uploads"

    report(5, "Preparing job assets...")

    if is_cancelled(cancel_flag):
        raise JobCancelledException("Job cancelled during asset preparation")

    # Sort items in countdown order (descending by rank: 5, 4, 3, 2, 1)
    raw_items = cfg_dict.get("items", [])
    if not raw_items:
        raise ValueError("Cannot render video with zero items")
    sorted_items = sorted(raw_items, key=lambda x: int(x.get("rank", 0)), reverse=True)

    # 1. Intro segment
    report(10, "Building intro segment...")
    intro_seg = build_intro(cfg_dict, work_dir, base_data_dir=base_data_dir, cancel_flag=cancel_flag)

    if is_cancelled(cancel_flag):
        raise JobCancelledException("Job cancelled after intro generation")

    # 2. Item segments
    num_items = len(sorted_items)
    item_segments: list[Path] = []
    current_global_time = float(cfg_dict.get("intro_seconds", 3.0))
    for idx, item in enumerate(sorted_items):
        if is_cancelled(cancel_flag):
            raise JobCancelledException(f"Job cancelled before item #{item.get('rank')}")

        pct = 15 + int((idx / num_items) * 60)
        report(pct, f"Building segment for #{item.get('rank')} ({item.get('title')})...")

        orig_idx = None
        try:
            orig_idx = raw_items.index(item)
        except Exception:
            pass

        seg = build_item(
            cfg_dict,
            item,
            idx,
            work_dir,
            base_data_dir=base_data_dir,
            cancel_flag=cancel_flag,
            seg_global_start=current_global_time,
            orig_idx=orig_idx,
        )
        item_segments.append(seg)

        if item.get("end") is not None and item.get("start") is not None:
            dur = max(0.5, float(item["end"]) - float(item["start"]))
        elif item.get("duration") is not None:
            dur = max(0.5, float(item["duration"]))
        else:
            dur = max(0.5, float(cfg_dict.get("clip_seconds", 8)))
        current_global_time += dur

    if is_cancelled(cancel_flag):
        raise JobCancelledException("Job cancelled after items generation")

    # 3. Concatenate all segments
    report(80, "Joining all video segments...")
    all_segments = [intro_seg] + item_segments
    joined_video = concat_segments(all_segments, work_dir, cancel_flag=cancel_flag)

    if is_cancelled(cancel_flag):
        raise JobCancelledException("Job cancelled after segment concatenation")

    # 4. Background music & final output
    report(90, "Finalizing audio and background music...")
    bgm_id = cfg_dict.get("bgm")
    bgm_path = None
    if bgm_id:
        bgm_path = get_source(bgm_id, downloads_dir, uploads_dir, cancel_flag=cancel_flag)

    final_output = job_path / "output.mp4"
    bgm_volume = float(cfg_dict.get("bgm_volume", 0.25))
    add_bgm(joined_video, bgm_path, bgm_volume, final_output, cancel_flag=cancel_flag)

    # Clean up intermediate work files after success
    try:
        import shutil
        if work_dir.exists():
            shutil.rmtree(work_dir, ignore_errors=True)
    except Exception:
        pass

    report(100, "Render completed successfully!")
    return final_output






