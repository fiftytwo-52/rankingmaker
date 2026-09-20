"""
Tests for:
1. Pydantic models with color grading and rank ladder fields
2. Video engine build_color_grading_filters
3. Video engine build_rank_ladder_ass
4. FFmpeg rendering with cinematic color grading & rank ladder overlay
"""

import shutil
from pathlib import Path
from app.models import VideoConfig, ItemConfig
from app.engine import build_color_grading_filters, build_rank_ladder_ass, build_item, build_intro


def test_models():
    cfg = VideoConfig(
        title="RANKING OTTERS",
        color_grading_preset="cinematic",
        color_contrast=1.1,
        color_saturation=1.2,
        color_brightness=0.01,
        color_warmth=0.1,
        show_rank_ladder=True,
        rank_ladder_position="left",
        items=[
            ItemConfig(rank=5, title="Cute Splash", source="a.mp4"),
            ItemConfig(rank=4, title="Sleepy Otter", source="b.mp4"),
            ItemConfig(rank=3, title="Hand Holding", source="c.mp4"),
            ItemConfig(rank=2, title="Belly Rub", source="d.mp4"),
            ItemConfig(rank=1, title="Otter Hugs", source="e.mp4"),
        ]
    )
    assert cfg.color_grading_preset == "cinematic"
    assert cfg.show_rank_ladder is True
    assert cfg.rank_ladder_position == "left"
    print("✓ Model validation passed for color grading and rank ladder")


def test_color_filters_generator():
    cfg_none = {"color_grading_preset": "none"}
    assert build_color_grading_filters(cfg_none) == ""

    cfg_cinematic = {
        "color_grading_preset": "cinematic",
        "color_contrast": 1.0,
        "color_saturation": 1.0,
        "color_brightness": 0.0,
        "color_warmth": 0.0,
    }
    cinematic_filter = build_color_grading_filters(cfg_cinematic)
    assert "eq=contrast=" in cinematic_filter
    assert "colorbalance=" in cinematic_filter
    print(f"✓ Cinematic filter generated: {cinematic_filter}")

    cfg_custom = {
        "color_grading_preset": "none",
        "color_contrast": 1.3,
        "color_saturation": 1.5,
        "color_brightness": 0.05,
        "color_warmth": 0.3,
    }
    custom_filter = build_color_grading_filters(cfg_custom)
    assert "eq=contrast=1.30" in custom_filter
    assert "saturation=1.50" in custom_filter
    assert "colorbalance=" in custom_filter
    print(f"✓ Custom color grade filter generated: {custom_filter}")


def test_rank_ladder_ass_generator():
    items = [
        {"rank": 5, "title": "Cute Splash"},
        {"rank": 4, "title": "Sleepy Otter"},
        {"rank": 3, "title": "Hand Holding"},
        {"rank": 2, "title": "Belly Rub"},
        {"rank": 1, "title": "Otter Hugs"},
    ]
    # For clip 0 (Rank 5 is played first)
    ass_c0 = build_rank_ladder_ass(
        cfg={"items": items},
        items=items,
        current_idx=0,
        width=1080,
        height=1920,
        duration=5.0,
        position="left"
    )
    assert "LadderDefault" in ass_c0
    assert "Cute Splash" in ass_c0
    # Rank 1 is not revealed yet in clip 0, so "Otter Hugs" shouldn't appear
    assert "Otter Hugs" not in ass_c0
    print("✓ ASS Rank Ladder for clip 0 generated correctly (only rank 5 revealed)")

    # For clip 4 (Rank 1 finale)
    ass_c4 = build_rank_ladder_ass(
        cfg={"items": items},
        items=items,
        current_idx=4,
        width=1080,
        height=1920,
        duration=5.0,
        position="left"
    )
    assert "Otter Hugs" in ass_c4
    assert "Cute Splash" in ass_c4
    assert "Sleepy Otter" in ass_c4
    print("✓ ASS Rank Ladder for final clip generated correctly (all ranks revealed)")


def test_engine_rendering_with_ladder_and_color():
    import subprocess
    work_dir = Path("data/scratch/test_ladder_engine")
    if work_dir.exists():
        shutil.rmtree(work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)

    # Generate a 2-second test source video
    test_src = work_dir / "sample.mp4"
    gen_cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", "testsrc=duration=2:size=640x360:rate=30",
        "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-ar", "44100",
        str(test_src)
    ]
    subprocess.run(gen_cmd, check=True, capture_output=True)

    items = [
        {"rank": 2, "title": "Second Best", "source": str(test_src), "start": 0, "end": 1.5, "volume": 1.0},
        {"rank": 1, "title": "The Grand Winner", "source": str(test_src), "start": 0, "end": 1.5, "volume": 1.0}
    ]

    cfg = {
        "title": "TOP OTTER MOMENTS",
        "width": 720,
        "height": 1280,
        "accent": "yellow",
        "bg_color": "0x141414",
        "clip_volume": 1.0,
        "clip_fit": "blur",
        "show_rank_ladder": True,
        "rank_ladder_position": "left",
        "color_grading_preset": "cinematic",
        "color_contrast": 1.1,
        "color_saturation": 1.25,
        "color_warmth": 0.1,
        "items": items
    }

    # Render intro with ladder
    intro_mp4 = build_intro(cfg, work_dir, base_data_dir="data")
    assert intro_mp4.exists()
    assert intro_mp4.stat().st_size > 10000
    print(f"✓ Rendered intro with rank ladder overlay ({intro_mp4.stat().st_size} bytes)")

    # Render item 0 (Rank 2) with color grading, blur framing, and ladder
    item0_mp4 = build_item(cfg, items[0], idx=0, work_dir=work_dir, base_data_dir="data")
    assert item0_mp4.exists()
    assert item0_mp4.stat().st_size > 10000
    print(f"✓ Rendered item 0 with cinematic color grade + blur framing + ladder ({item0_mp4.stat().st_size} bytes)")

    # Render item 1 (Rank 1 Finale)
    item1_mp4 = build_item(cfg, items[1], idx=1, work_dir=work_dir, base_data_dir="data")
    assert item1_mp4.exists()
    assert item1_mp4.stat().st_size > 10000
    print(f"✓ Rendered item 1 (Finale) with ladder ({item1_mp4.stat().st_size} bytes)")

    shutil.rmtree(work_dir)


if __name__ == "__main__":
    print("=== Testing Models ===")
    test_models()
    print("=== Testing Color Filter Generator ===")
    test_color_filters_generator()
    print("=== Testing Rank Ladder ASS Generator ===")
    test_rank_ladder_ass_generator()
    print("=== Testing Engine Rendering with Ladder and Color Grading ===")
    test_engine_rendering_with_ladder_and_color()
    print("\n=======================================================")
    print("SUCCESS: All color grading & rank ladder engine tests passed!")
    print("=======================================================\n")
