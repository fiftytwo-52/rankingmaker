"""
Test multiline title ASS formatting, custom fonts, and clip framing options (fit/fill/stretch).
"""

from pathlib import Path
import tempfile
from app.engine import build_title_ass_content, build_intro, build_item

def test_multiline_and_fonts():
    print("=== Testing multiline title and font selection in ASS ===")
    
    # 1. Plain multiline title
    title_multi = "TOP 10\nEPIC FAILS\nOF 2026"
    ass_text = build_title_ass_content(
        title=title_multi,
        title_words=None,
        default_accent="yellow",
        width=1920,
        height=1080,
        font_size=60,
        border_w=4,
        font_name="Bebas Neue",
    )
    assert "Bebas Neue" in ass_text, "Font name Bebas Neue not found in ASS style"
    assert r"TOP 10\NEPIC FAILS\NOF 2026" in ass_text, f"Multiline \\N not formatted correctly in: {ass_text}"
    print("✓ Plain multiline title formatting with custom font passed!")

    # 2. Word-by-word with multiline title
    words_data = [
        {"word": "TOP", "color": "#ffff00"},
        {"word": "10", "color": "#ff0000"},
        {"word": "EPIC\nFAILS", "color": "#00ffff"},
    ]
    ass_words_text = build_title_ass_content(
        title=title_multi,
        title_words=words_data,
        default_accent="yellow",
        width=1920,
        height=1080,
        font_size=60,
        border_w=4,
        font_name="Montserrat",
    )
    assert "Montserrat" in ass_words_text, "Font name Montserrat not found in ASS style"
    assert r"\NEPIC\NFAILS" in ass_words_text or r"EPIC\NFAILS" in ass_words_text, "Newline inside word not converted to \\N"
    print("✓ Word-by-word multiline title formatting passed!")


def test_clip_framing_options():
    print("=== Testing clip framing options in build_item ===")
    with tempfile.TemporaryDirectory() as tmpdir:
        work_dir = Path(tmpdir)
        
        # Create a sample synthetic video clip first
        import subprocess
        sample_clip = work_dir / "test_clip.mp4"
        cmd = [
            "ffmpeg", "-y", "-f", "lavfi", "-i", "color=c=blue:s=640x360:r=30",
            "-f", "lavfi", "-i", "sine=f=440:r=44100",
            "-t", "1.5", "-c:v", "libx264", "-c:a", "aac", str(sample_clip)
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        for framing in ["fit", "fill", "stretch"]:
            cfg = {
                "title": "TOP 5\nCOUNTDOWN",
                "width": 640,
                "height": 360,
                "accent": "yellow",
                "bg_color": "0x141414",
                "clip_fit": framing,
                "font": "Impact",
            }
            item = {
                "rank": 1,
                "title": f"Framing {framing.upper()}",
                "source": str(sample_clip),
                "start": 0.0,
                "end": 1.0,
            }

            seg_path = build_item(cfg, item, 0, work_dir, cancel_flag=None)
            assert seg_path.is_file(), f"Segment not created for framing mode {framing}"
            assert seg_path.stat().st_size > 1000, f"Segment empty for framing mode {framing}"
            print(f"✓ Framing mode '{framing}' successfully rendered segment ({seg_path.stat().st_size} bytes)")


if __name__ == "__main__":
    test_multiline_and_fonts()
    test_clip_framing_options()
    print("\n=======================================================")
    print("SUCCESS: All multiline, font, and framing tests passed!")
    print("=======================================================")
