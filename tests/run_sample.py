import json
from pathlib import Path
import subprocess
import sys
from app.engine import render, probe_duration, has_audio

def generate_test_clip(path: Path, text: str, has_aud: bool = True):
    if path.exists():
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    if has_aud:
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"testsrc=duration=2:size=640x360:rate=30",
            "-f", "lavfi", "-i", "sine=frequency=800:duration=2",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac",
            str(path)
        ]
    else:
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", f"testsrc=duration=2:size=640x360:rate=30",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an",
            str(path)
        ]
    subprocess.run(cmd, capture_output=True, check=True)

def main():
    base_dir = Path(__file__).resolve().parent.parent
    uploads_dir = base_dir / "data" / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)

    c1 = uploads_dir / "test_sample_1.mp4"
    c2 = uploads_dir / "test_sample_2.mp4"
    c3 = uploads_dir / "test_sample_3.mp4"
    generate_test_clip(c1, "Clip 1", has_aud=True)
    generate_test_clip(c2, "Clip 2", has_aud=False)
    generate_test_clip(c3, "Clip 3", has_aud=True)

    config_path = base_dir / "tests" / "sample_config.json"
    cfg = {
        "title": "TOP 3 ANIMAL HIGHLIGHTS",
        "width": 1920,
        "height": 1080,
        "accent": "yellow",
        "bg_color": "0x141414",
        "bg_image": None,
        "bgm": None,
        "bgm_volume": 0.25,
        "clip_volume": 1.0,
        "intro_seconds": 2,
        "clip_seconds": 2,
        "font": None,
        "items": [
            {"rank": 3, "title": "Playful Dog", "source": "test_sample_1.mp4", "start": 0, "end": 2},
            {"rank": 2, "title": "Curious Cat", "source": "test_sample_2.mp4", "start": 0, "end": 2},
            {"rank": 1, "title": "Flying Bird", "source": "test_sample_3.mp4", "start": 0, "end": 2}
        ]
    }
    with open(config_path, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)

    from app.models import VideoConfig
    validated_cfg = VideoConfig(**cfg)

    job_dir = base_dir / "jobs" / "sample_run"

    progress_log = []
    def on_progress(pct, msg):
        print(f"[{pct:3d}%] {msg}")
        progress_log.append((pct, msg))

    output = render(validated_cfg, job_dir=job_dir, progress_callback=on_progress, base_data_dir=base_dir / "data")
    print(f"Render completed: {output}")
    assert output.exists(), f"Output file does not exist at {output}"

    dur = probe_duration(output)
    print(f"Total video duration: {dur:.2f}s")
    assert 7.8 <= dur <= 8.3, f"Duration unexpected: {dur}"
    assert has_audio(output) is True, "Output video missing audio stream"
    assert len(progress_log) >= 5, "Progress callbacks missing"

    print("SUCCESS: Full video built from sample config using 3 clips!")

if __name__ == "__main__":
    main()
