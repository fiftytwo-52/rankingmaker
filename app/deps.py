import shutil
import subprocess
import sys
from typing import Any, Dict


def get_tool_version(cmd: list[str]) -> tuple[bool, str | None, str | None]:
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        if res.returncode == 0:
            first_line = (res.stdout or res.stderr).strip().split("\n")[0].strip()
            return True, first_line, None
        return False, None, f"Command exited with code {res.returncode}: {res.stderr.strip()}"
    except FileNotFoundError:
        return False, None, f"Executable '{cmd[0]}' not found on system PATH"
    except Exception as e:
        return False, None, str(e)


def check_dependencies() -> Dict[str, Any]:
    # Check ffmpeg
    ffmpeg_ok, ffmpeg_ver, ffmpeg_err = get_tool_version(["ffmpeg", "-version"])

    # Check ffprobe
    ffprobe_ok, ffprobe_ver, ffprobe_err = get_tool_version(["ffprobe", "-version"])

    # Check yt-dlp (first try 'yt-dlp', then fallback to python module if installed in venv)
    yt_dlp_cmd = ["yt-dlp", "--version"] if shutil.which("yt-dlp") else [sys.executable, "-m", "yt_dlp", "--version"]
    yt_ok, yt_ver, yt_err = get_tool_version(yt_dlp_cmd)

    tools = {
        "ffmpeg": {
            "available": ffmpeg_ok,
            "version": ffmpeg_ver,
            "error": ffmpeg_err,
        },
        "ffprobe": {
            "available": ffprobe_ok,
            "version": ffprobe_ver,
            "error": ffprobe_err,
        },
        "yt_dlp": {
            "available": yt_ok,
            "version": yt_ver,
            "error": yt_err,
        },
    }

    healthy = ffmpeg_ok and ffprobe_ok and yt_ok
    return {
        "healthy": healthy,
        "tools": tools,
    }
