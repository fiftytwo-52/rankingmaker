"""
Test backend video generation with transitions enabled and custom intro_seconds.
"""

import shutil
from pathlib import Path
from app.models import VideoConfig, ItemConfig
from app.engine import render

def test_transitions_and_intro():
    scratch_dir = Path("tests/scratch_transitions")
    if scratch_dir.exists():
        shutil.rmtree(scratch_dir)
    scratch_dir.mkdir(parents=True, exist_ok=True)

    # Generate small dummy clip
    clip_path = scratch_dir / "sample_clip.mp4"
    import subprocess
    subprocess.run(
        f'ffmpeg -y -f lavfi -i "testsrc=size=640x360:rate=30:duration=3" -f lavfi -i "sine=frequency=440:sample_rate=44100:duration=3" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "{clip_path}"',
        shell=True,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    cfg = VideoConfig(
        title="ANIMATED\nRANKING",
        width=1080,
        height=1920,
        clip_fit="fit",
        accent="gold",
        bg_color="0x141414",
        intro_seconds=1.5,
        transitions=True,
        items=[
            ItemConfig(rank=2, title="Second Best", source=str(clip_path), start=0, end=1.5),
            ItemConfig(rank=1, title="Number One", source=str(clip_path), start=0, end=1.5)
        ]
    )

    job_work_dir = scratch_dir / "job_run"
    job_work_dir.mkdir(parents=True, exist_ok=True)

    print("Rendering video with transitions=True and intro_seconds=1.5...")
    out_file = render(cfg, job_work_dir)

    assert out_file.exists(), "Output video was not created!"
    assert out_file.stat().st_size > 10000, "Output video is empty or too small!"
    print(f"✓ Video created successfully! File size: {out_file.stat().st_size} bytes")

if __name__ == "__main__":
    test_transitions_and_intro()
    print("SUCCESS: Backend transitions & intro seconds test passed!")
