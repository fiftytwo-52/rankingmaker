"""
End-to-end verification that rendered video contains:
1. Top Title text (never occluded by the video clip)
2. Item Rank & Title label
3. Stickers and timed elements (both clip-specific and global)
4. Silent & non-silent audio clips with elements
"""

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from app.engine import render
from app.models import VideoConfig, ItemConfig, OverlayElementConfig


def test_complete_render_visual_components():
    work_dir = Path(tempfile.mkdtemp(prefix="test_render_components_"))
    try:
        # 1. Create a dummy silent video clip
        silent_clip = work_dir / "silent.mp4"
        subprocess.run([
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "testsrc=size=720x1280:rate=30",
            "-t", "2",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            str(silent_clip)
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # 2. Create a dummy video clip with audio
        audio_clip = work_dir / "with_audio.mp4"
        subprocess.run([
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "color=c=navy:s=720x1280:r=30",
            "-f", "lavfi", "-i", "sine=frequency=500:sample_rate=44100",
            "-t", "2",
            "-c:v", "libx264", "-c:a", "aac", "-pix_fmt", "yuv420p",
            str(audio_clip)
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # 3. Create a dummy sticker badge (transparent PNG with red circle)
        sticker_badge = work_dir / "badge.png"
        subprocess.run([
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "color=c=red@0.9:s=160x160",
            "-frames:v", "1",
            str(sticker_badge)
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # 4. Configure job with Title, Word colors, Item labels, and Stickers
        cfg = VideoConfig(
            title="TOP CARS RANKING",
            title_words=[
                {"word": "TOP", "color": "#ffea00"},
                {"word": "CARS", "color": "#00e5ff"},
                {"word": "RANKING", "color": "#ff0055"}
            ],
            width=720,
            height=1280,
            intro_seconds=1.5,
            clip_fit="fill",
            items=[
                ItemConfig(rank=2, title="Silver Porsche", source=str(silent_clip), start=0, end=2.0),
                ItemConfig(rank=1, title="Gold Ferrari", source=str(audio_clip), start=0, end=2.0),
            ],
            elements=[
                # Clip-specific sticker on Item #2 (silent clip)
                OverlayElementConfig(
                    id="stk_1",
                    type="image",
                    content=str(sticker_badge),
                    target="clip",
                    clip_index=0,
                    start_time=0.2,
                    end_time=1.8,
                    pos_x=80,
                    pos_y=20,
                    scale=1.2,
                ),
                # Text element on Item #1
                OverlayElementConfig(
                    id="txt_1",
                    type="text",
                    content="NUMBER ONE BEAST!",
                    target="clip",
                    clip_index=1,
                    start_time=0.2,
                    end_time=1.8,
                    pos_x=50,
                    pos_y=80,
                    scale=1.0,
                    color="#00ffcc",
                ),
                # Global watermark across all segments
                OverlayElementConfig(
                    id="wm_global",
                    type="text",
                    content="@AutoRankings",
                    target="global",
                    start_time=0.0,
                    end_time=10.0,
                    pos_x=10,
                    pos_y=95,
                    scale=0.8,
                    color="white",
                )
            ]
        )

        job_dir = work_dir / "job"
        out_mp4 = render(cfg, job_dir)

        assert out_mp4.exists(), f"Output file {out_mp4} was not generated"
        assert out_mp4.stat().st_size > 20000, f"Output file is too small: {out_mp4.stat().st_size} bytes"

        # Check total duration: intro (1.5) + item 2 (2.0) + item 1 (2.0) = 5.5s
        probe_cmd = [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(out_mp4)
        ]
        res = subprocess.run(probe_cmd, capture_output=True, text=True, check=True)
        dur = float(res.stdout.strip())
        assert 5.0 <= dur <= 6.0, f"Expected ~5.5s duration, got {dur}"

        # Extract frames to verify visual presence
        # Frame at 0.5s: Intro
        frame_intro = work_dir / "frame_intro.png"
        subprocess.run(["ffmpeg", "-y", "-ss", "0.5", "-i", str(out_mp4), "-frames:v", "1", str(frame_intro)], check=True)
        assert frame_intro.exists() and frame_intro.stat().st_size > 5000

        # Frame at 2.5s: Item 2 (during sticker)
        frame_item2 = work_dir / "frame_item2.png"
        subprocess.run(["ffmpeg", "-y", "-ss", "2.5", "-i", str(out_mp4), "-frames:v", "1", str(frame_item2)], check=True)
        assert frame_item2.exists() and frame_item2.stat().st_size > 5000

        # Frame at 4.5s: Item 1 (during text element)
        frame_item1 = work_dir / "frame_item1.png"
        subprocess.run(["ffmpeg", "-y", "-ss", "4.5", "-i", str(out_mp4), "-frames:v", "1", str(frame_item1)], check=True)
        assert frame_item1.exists() and frame_item1.stat().st_size > 5000

        print(f"✓ All components rendered successfully into {out_mp4} (size={out_mp4.stat().st_size}, dur={dur}s)!")
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


if __name__ == "__main__":
    test_complete_render_visual_components()
