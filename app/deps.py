import shutil
import subprocess
import sys
from typing import Any, Dict


def get_yt_dlp_command() -> list[str]:
    """
    Returns the yt-dlp command this app actually runs.

    The interpreter running the app wins (`<python> -m yt_dlp`), because yt-dlp is a pinned
    dependency in requirements.txt and the copy inside `.venv` is nearly always far newer than
    a distro package sitting on PATH (Ubuntu 24.04 ships 2024.04.09, whose YouTube extractor
    fails with "unable to extract" errors). A PATH executable is only used when the module
    cannot be imported at all.
    """
    try:
        import yt_dlp  # noqa: F401  (presence check only, invoked as a subprocess)

        return [sys.executable, "-m", "yt_dlp"]
    except ImportError:
        if shutil.which("yt-dlp"):
            return ["yt-dlp"]
        # Nothing usable found: keep an explicit command so the error stays readable.
        return [sys.executable, "-m", "yt_dlp"]


def describe_yt_dlp_command(cmd: list[str]) -> str:
    """Human-readable note about which yt-dlp `get_yt_dlp_command()` resolved to."""
    if cmd[:3] == [sys.executable, "-m", "yt_dlp"]:
        return f"app interpreter: {sys.executable} -m yt_dlp"
    return f"PATH executable: {shutil.which(cmd[0]) or cmd[0]}"


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

    # Check yt-dlp with the exact command the render engine uses, so this report can never
    # disagree with what "Download source" actually does at render time.
    yt_dlp_cmd = get_yt_dlp_command()
    yt_ok, yt_ver, yt_err = get_tool_version(yt_dlp_cmd + ["--version"])

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
            "source": describe_yt_dlp_command(yt_dlp_cmd),
            "error": yt_err,
        },
    }

    healthy = ffmpeg_ok and ffprobe_ok and yt_ok
    return {
        "healthy": healthy,
        "tools": tools,
    }
