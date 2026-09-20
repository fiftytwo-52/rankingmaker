"""
Test word-by-word title coloring and ASS subtitle rendering.
"""

import subprocess
from pathlib import Path
from app.engine import color_to_ass, build_title_ass_content, build_intro, build_item
from app.models import VideoConfig, TitleWord, ItemConfig

def main():
    print("=== 1. Testing color_to_ass ===")
    assert color_to_ass("yellow") == "&H00FFFF&"
    assert color_to_ass("red") == "&H0000FF&"
    assert color_to_ass("white") == "&HFFFFFF&"
    assert color_to_ass("#00FF00") == "&H00FF00&"
    assert color_to_ass("#FFD700") == "&H00D7FF&"
    print("All color_to_ass assertions passed!")

    print("=== 2. Testing build_title_ass_content ===")
    words = [
        {"word": "TOP", "color": "#FFD700"},
        {"word": "5", "color": "#FF0000"},
        {"word": "GREATEST", "color": "#FFFFFF"},
        {"word": "GOALS", "color": "cyan"},
    ]
    ass_text = build_title_ass_content("TOP 5 GREATEST GOALS", words, "yellow", 1920, 1080, 72, 3, "center")
    assert r"{\c&H00D7FF&}TOP" in ass_text
    assert r"{\c&H0000FF&}5" in ass_text
    assert r"{\c&HFFFFFF&}GREATEST" in ass_text
    assert r"{\c&HFFFF00&}GOALS" in ass_text
    print("ASS content correctly formatted!")

    print("=== 3. Testing build_intro with word-by-word title colors ===")
    work_dir = Path("tests/scratch_word_colors")
    work_dir.mkdir(parents=True, exist_ok=True)
    cfg = VideoConfig(
        title="TOP 5 GREATEST GOALS",
        title_words=[
            TitleWord(word="TOP", color="#FFD700"),
            TitleWord(word="5", color="#FF0000"),
            TitleWord(word="GREATEST", color="#FFFFFF"),
            TitleWord(word="GOALS", color="cyan"),
        ],
        width=1920,
        height=1080,
        intro_seconds=1.5,
        items=[ItemConfig(rank=1, title="Test", source="dummy")]
    )

    intro_file = build_intro(cfg, work_dir, base_data_dir="data")
    assert intro_file.exists()
    assert intro_file.stat().st_size > 5000
    print(f"Intro rendered successfully ({intro_file.stat().st_size} bytes)")

    print("=== 4. Testing build_item with word-by-word title banner ===")
    # Create tiny 2-second test clip
    test_clip = work_dir / "sample_clip.mp4"
    subprocess.run(
        f'ffmpeg -y -f lavfi -i "testsrc=size=640x360:rate=30:duration=2" -f lavfi -i "sine=frequency=440:sample_rate=44100:duration=2" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "{test_clip}"',
        shell=True,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    item = {
        "rank": 5,
        "title": "Bicycle Kick",
        "source": str(test_clip),
        "start": 0.0,
        "end": 1.5
    }

    item_file = build_item(cfg, item, 0, work_dir, base_data_dir="data")
    assert item_file.exists()
    assert item_file.stat().st_size > 5000
    print(f"Item segment rendered successfully ({item_file.stat().st_size} bytes)")

    # Cleanup scratch dir
    import shutil
    shutil.rmtree(work_dir, ignore_errors=True)
    print("\nSUCCESS: All word color tests passed!")

if __name__ == "__main__":
    main()
