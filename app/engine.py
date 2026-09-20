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
