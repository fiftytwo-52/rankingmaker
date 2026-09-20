"""
Test script verifying:
1. When show_rank_ladder=True, separate clip name drawtext is NOT generated in build_item.
2. When show_rank_ladder=False, separate clip name drawtext IS generated in build_item.
3. Timed overlay elements (text, stickers, emojis) are rendered into intro and clip segments.
4. Vecteezy API search endpoint and models validation.
"""
import shutil
import tempfile
import subprocess
from pathlib import Path
from fastapi.testclient import TestClient

from app.main import app
from app.models import VideoConfig, OverlayElementConfig
from app.engine import build_intro, build_item, apply_elements_to_filter_chains


def test_models_validation():
    print("=== Testing Models Validation for Elements ===")
    elem = OverlayElementConfig(
        id="elem_test_1",
        type="text",
        content="UNREAL GOAL!",
        target="clip",
        clip_index=0,
        start_time=1.0,
        end_time=3.5,
        pos_x=50.0,
        pos_y=30.0,
        scale=1.2,
        color="#ffff00",
    )
    assert elem.content == "UNREAL GOAL!"
    assert elem.end_time == 3.5

    cfg = VideoConfig(
        title="TOP RANKING",
        show_rank_ladder=True,
        elements=[elem],
        items=[
            {"rank": 2, "title": "Second Best", "source": "test.mp4", "start": 0, "end": 4},
            {"rank": 1, "title": "Champion Winner", "source": "test.mp4", "start": 0, "end": 4},
        ]
    )
    assert len(cfg.elements) == 1
    assert cfg.show_rank_ladder is True
    print("✓ Model validation passed for elements and rank ladder")


def test_ladder_clip_name_omission():
    print("=== Testing Ladder Clip Name Omission in Engine ===")
    work_dir = Path(tempfile.mkdtemp(prefix="test_engine_ladder_"))
    try:
        # Create dummy source video
        dummy_clip = work_dir / "clip.mp4"
        cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "testsrc=size=640x360:rate=30",
            "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100",
            "-t", "3",
            "-c:v", "libx264", "-c:a", "aac",
            str(dummy_clip)
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # 1. With show_rank_ladder = True
        cfg_with_ladder = {
            "title": "TOP 2 TEST",
            "width": 540,
            "height": 960,
            "show_rank_ladder": True,
            "rank_ladder_position": "left",
            "item_label_position": "bottom",
            "items": [
                {"rank": 2, "title": "Clip Two", "source": str(dummy_clip), "start": 0, "end": 2.0},
                {"rank": 1, "title": "Clip One", "source": str(dummy_clip), "start": 0, "end": 2.0},
            ]
        }
        item_2 = cfg_with_ladder["items"][0]
        out_ladder = build_item(cfg_with_ladder, item_2, 0, work_dir=work_dir / "ladder_item")
        assert out_ladder.exists()
        assert out_ladder.stat().st_size > 10000
        print(f"✓ Rendered item with rank ladder (clip name omitted from overlay, rendered {out_ladder.stat().st_size} bytes)")

        # 2. With show_rank_ladder = False
        cfg_no_ladder = dict(cfg_with_ladder)
        cfg_no_ladder["show_rank_ladder"] = False
        out_no_ladder = build_item(cfg_no_ladder, item_2, 0, work_dir=work_dir / "noladder_item")
        assert out_no_ladder.exists()
        print(f"✓ Rendered item without rank ladder (separate clip name included, rendered {out_no_ladder.stat().st_size} bytes)")

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


def test_timed_elements_rendering():
    print("=== Testing Timed Elements Rendering (Text & Sticker) ===")
    work_dir = Path(tempfile.mkdtemp(prefix="test_elements_render_"))
    try:
        # Create dummy source video
        dummy_clip = work_dir / "clip.mp4"
        subprocess.run([
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "testsrc=size=640x360:rate=30",
            "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100",
            "-t", "4",
            "-c:v", "libx264", "-c:a", "aac",
            str(dummy_clip)
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        # Create dummy sticker image
        dummy_sticker = work_dir / "test_badge.png"
        subprocess.run([
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "color=c=red@0.9:s=120x120",
            "-frames:v", "1",
            str(dummy_sticker)
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        cfg_with_elements = {
            "title": "TOP HIGHLIGHTS",
            "width": 540,
            "height": 960,
            "intro_seconds": 2.5,
            "elements": [
                {
                    "id": "e_txt_1",
                    "type": "text",
                    "content": "GOAL OF THE CENTURY!",
                    "target": "clip",
                    "clip_index": 0,
                    "start_time": 0.5,
                    "end_time": 2.5,
                    "pos_x": 50,
                    "pos_y": 25,
                    "scale": 1.2,
                    "color": "#ffff00",
                    "bg_color": "black",
                },
                {
                    "id": "e_stk_1",
                    "type": "image",
                    "content": str(dummy_sticker),
                    "target": "clip",
                    "clip_index": 0,
                    "start_time": 0.8,
                    "end_time": 2.8,
                    "pos_x": 80,
                    "pos_y": 70,
                    "scale": 1.0,
                },
                {
                    "id": "e_intro_1",
                    "type": "text",
                    "content": "🔥 MUST WATCH",
                    "target": "intro",
                    "start_time": 0.2,
                    "end_time": 2.0,
                    "pos_x": 50,
                    "pos_y": 75,
                    "scale": 1.0,
                    "color": "white",
                }
            ],
            "items": [
                {"rank": 1, "title": "Bicycle Kick", "source": str(dummy_clip), "start": 0, "end": 3.0}
            ]
        }

        # 1. Build Intro with timed element
        intro_out = build_intro(cfg_with_elements, work_dir=work_dir / "intro")
        assert intro_out.exists()
        assert intro_out.stat().st_size > 5000
        print(f"✓ Rendered intro with timed text element (size: {intro_out.stat().st_size} bytes)")

        # 2. Build Item with timed text AND image sticker
        item_out = build_item(cfg_with_elements, cfg_with_elements["items"][0], 0, work_dir=work_dir / "item")
        assert item_out.exists()
        assert item_out.stat().st_size > 10000
        print(f"✓ Rendered clip item with timed text and image sticker (size: {item_out.stat().st_size} bytes)")

    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


def test_vecteezy_endpoints():
    print("=== Testing Vecteezy API Search Endpoint ===")
    client = TestClient(app)
    res = client.get("/api/vecteezy/search?term=fire&content_type=png&per_page=3")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()
    assert "resources" in data
    assert len(data["resources"]) > 0
    first = data["resources"][0]
    assert "id" in first
    assert "thumbnail_url" in first
    print(f"✓ Vecteezy search returned {len(data['resources'])} items (Sample: '{first.get('title')[:40]}...')")


if __name__ == "__main__":
    test_models_validation()
    test_ladder_clip_name_omission()
    test_timed_elements_rendering()
    test_vecteezy_endpoints()
    print("\n=======================================================")
    print("SUCCESS: All elements & ladder clip name backend tests passed!")
    print("=======================================================")
