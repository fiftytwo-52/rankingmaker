"""
Unit and integration test for:
1. Framing modes: "blur" (blurred video backdrop) and "card" (floating bordered frame)
2. Extended font sizes (title up to 350, item up to 250)
3. Model validation for all framing modes
"""

import os
import tempfile
from app.models import VideoConfig, ItemConfig
from app.engine import build_item, build_intro

def test_framing_model_validation():
    for fit in ["fit", "fill", "stretch", "blur", "card"]:
        cfg = VideoConfig(title="Test", items=[ItemConfig(rank=1, title="Play", source="dummy.mp4")], clip_fit=fit)
        assert cfg.clip_fit == fit
    print("✓ Model validation for fit, fill, stretch, blur, card passed")

def test_extended_font_sizes_model():
    cfg = VideoConfig(
        title="BIG TITLE",
        title_font_size=240,
        item_font_size=160,
        items=[ItemConfig(rank=1, title="Play", source="dummy.mp4")]
    )
    assert cfg.title_font_size == 240
    assert cfg.item_font_size == 160
    print("✓ Extended font sizes (240px title, 160px item) validated in model")

def test_engine_blur_and_card_framing():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_clip = os.path.join(tmpdir, "input.mp4")
        # 1-second test clip
        os.system(
            f'ffmpeg -y -f lavfi -i testsrc=size=320x240:rate=30:duration=1 -f lavfi -i sine=frequency=440:duration=1 -c:v libx264 -c:a aac -shortest {tmp_clip} > /dev/null 2>&1'
        )

        # Test blur framing
        cfg_blur = VideoConfig(
            title="TOP 10 GOALS",
            width=720,
            height=1280,
            clip_fit="blur",
            title_font_size=120,
            item_font_size=72,
            items=[ItemConfig(rank=1, title="Rocket Shot", source=tmp_clip, start=0.0, end=1.0)]
        )
        seg_blur = build_item(cfg_blur, cfg_blur.items[0], 0, tmpdir)
        assert os.path.exists(seg_blur), "Blur framing segment file not created"
        assert os.path.getsize(seg_blur) > 1000, "Blur framing output too small"
        print(f"✓ Rendered clip with 'blur' framing mode ({os.path.getsize(seg_blur)} bytes)")

        # Test card framing
        cfg_card = VideoConfig(
            title="TOP 10 GOALS",
            width=720,
            height=1280,
            clip_fit="card",
            title_font_size=140,
            item_font_size=80,
            items=[ItemConfig(rank=1, title="Solo Dribble", source=tmp_clip, start=0.0, end=1.0)]
        )
        seg_card = build_item(cfg_card, cfg_card.items[0], 0, tmpdir)
        assert os.path.exists(seg_card), "Card framing segment file not created"
        assert os.path.getsize(seg_card) > 1000, "Card framing output too small"
        print(f"✓ Rendered clip with 'card' framing mode ({os.path.getsize(seg_card)} bytes)")

if __name__ == "__main__":
    print("=== 1. Testing framing model validation ===")
    test_framing_model_validation()
    print("=== 2. Testing extended font sizes model ===")
    test_extended_font_sizes_model()
    print("=== 3. Testing engine rendering with blur & card framing ===")
    test_engine_blur_and_card_framing()
    print("\n=======================================================")
    print("SUCCESS: All framing and engine tests passed!")
    print("=======================================================\n")
