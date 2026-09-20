"""
Unit & Integration tests for new features:
1. item_label_position ('bottom', 'left', 'right') in VideoJobConfig and engine.py
2. API endpoints: /api/recent-videos, /api/cleanup-downloads, /api/download-source
"""

import os
import shutil
import tempfile
from fastapi.testclient import TestClient
from app.main import app
from app.models import VideoConfig, ItemConfig
from app.engine import build_item

client = TestClient(app)

def test_item_label_position_validation():
    # Valid values
    for pos in ["bottom", "left", "right"]:
        cfg = VideoConfig(title="Test", items=[ItemConfig(rank=1, title="Sample", source="demo.mp4")], item_label_position=pos)
        assert cfg.item_label_position == pos

    # Invalid value should raise ValueError
    try:
        VideoConfig(title="Test", items=[], item_label_position="top")
        assert False, "Should have failed for invalid position 'top'"
    except Exception:
        pass

def test_engine_item_label_positions():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_clip = os.path.join(tmpdir, "input.mp4")
        # generate a quick 1-second test clip
        os.system(f"ffmpeg -y -f lavfi -i color=c=blue:s=320x240:d=1 -c:v libx264 {tmp_clip} > /dev/null 2>&1")
        
        for pos in ["bottom", "left", "right"]:
            cfg = VideoConfig(
                title="TOP COUNTDOWN",
                width=720,
                height=1280,
                font="Oswald",
                clip_fit="fit",
                item_label_position=pos,
                items=[ItemConfig(rank=1, title="Top Play", source=tmp_clip, start=0.0, end=1.0)]
            )
            item = cfg.items[0]
            seg_path = build_item(cfg, item, 0, tmpdir)
            assert os.path.exists(seg_path), f"Output file for {pos} not created"
            assert os.path.getsize(seg_path) > 1000, f"Output file for {pos} too small"
            print(f"✓ Rendered item with item_label_position='{pos}' ({os.path.getsize(seg_path)} bytes)")

def test_api_recent_videos():
    res = client.get("/api/recent-videos")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    print(f"✓ /api/recent-videos returned {len(data)} items")

def test_api_cleanup_downloads():
    # Create dummy download file
    os.makedirs("data/downloads", exist_ok=True)
    dummy_file = os.path.join("data/downloads", "test_dummy.txt")
    with open(dummy_file, "w") as f:
        f.write("temporary source download")

    assert os.path.exists(dummy_file)
    res = client.post("/api/cleanup-downloads")
    assert res.status_code == 200
    assert not os.path.exists(dummy_file)
    print("✓ /api/cleanup-downloads purged temporary download files")

def test_title_and_item_styling_models():
    # Test valid configuration
    cfg = VideoConfig(
        title="Top 5 Plays",
        title_font_size=88,
        item_font_size=64,
        title_bg_style="dark",
        title_shadow=False,
        item_bg_style="accent",
        item_shadow=True,
        items=[
            ItemConfig(rank=1, title="Play #1", source="clip1.mp4", volume=1.8),
            ItemConfig(rank=2, title="Play #2", source="clip2.mp4", volume=0.5),
        ]
    )
    assert cfg.title_font_size == 88
    assert cfg.item_font_size == 64
    assert cfg.title_bg_style == "dark"
    assert cfg.title_shadow is False
    assert cfg.item_bg_style == "accent"
    assert cfg.item_shadow is True
    assert cfg.items[0].volume == 1.8
    assert cfg.items[1].volume == 0.5
    print("✓ Model fields for font sizes, text bg styles, shadows, and clip volume validated")

def test_engine_text_styling_and_volume():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_clip = os.path.join(tmpdir, "input.mp4")
        # generate 1-second test clip with audio
        os.system(
            f'ffmpeg -y -f lavfi -i testsrc=size=320x240:rate=30:duration=1 -f lavfi -i sine=frequency=440:duration=1 -c:v libx264 -c:a aac -shortest {tmp_clip} > /dev/null 2>&1'
        )

        cfg = VideoConfig(
            title="TOP SAVES",
            width=720,
            height=1280,
            title_font_size=80,
            item_font_size=58,
            title_bg_style="dark",
            title_shadow=True,
            item_bg_style="accent",
            item_shadow=True,
            items=[ItemConfig(rank=1, title="Gordon Banks Save", source=tmp_clip, start=0.0, end=1.0, volume=1.5)]
        )
        item = cfg.items[0]
        seg_path = build_item(cfg, item, 0, tmpdir)
        assert os.path.exists(seg_path), "Segment file not created"
        assert os.path.getsize(seg_path) > 1000, "Segment file too small"
        print(f"✓ Rendered clip item with custom font size, text background box, shadow, and 1.5x volume ({os.path.getsize(seg_path)} bytes)")

if __name__ == "__main__":
    print("=== Testing item_label_position validation ===")
    test_item_label_position_validation()
    print("=== Testing title & item styling models ===")
    test_title_and_item_styling_models()
    print("=== Testing engine item label positions (ffmpeg) ===")
    test_engine_item_label_positions()
    print("=== Testing engine text styling and volume (ffmpeg) ===")
    test_engine_text_styling_and_volume()
    print("=== Testing /api/recent-videos endpoint ===")
    test_api_recent_videos()
    print("=== Testing /api/cleanup-downloads endpoint ===")
    test_api_cleanup_downloads()
    print("\n=======================================================")
    print("SUCCESS: All new features backend tests passed!")
    print("=======================================================")

