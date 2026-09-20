"""
Integration test verifying end-to-end job creation and rendering with word-by-word title colors.
"""

import json
import subprocess
import time
import urllib.request
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"

def main():
    scratch = Path("tests/scratch_e2e_words")
    scratch.mkdir(parents=True, exist_ok=True)
    clip_path = scratch / "sample_clip.mp4"
    subprocess.run(
        f'ffmpeg -y -f lavfi -i "testsrc=size=640x360:rate=30:duration=3" -f lavfi -i "sine=frequency=440:sample_rate=44100:duration=3" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "{clip_path}"',
        shell=True,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )

    # Upload clip
    boundary = "----WebKitFormBoundaryE2EWords"
    with open(clip_path, "rb") as f:
        file_bytes = f.read()

    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="sample_clip.mp4"\r\n'
        f"Content-Type: video/mp4\r\n\r\n"
    ).encode("utf-8") + file_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

    req = urllib.request.Request(
        f"{BASE_URL}/api/upload",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        upload_data = json.loads(resp.read().decode("utf-8"))
        clip_id = upload_data["id"]

    # Submit job with title_words
    payload = {
        "title": "TOP 3 LEGENDS",
        "title_words": [
            {"word": "TOP", "color": "gold"},
            {"word": "3", "color": "red"},
            {"word": "LEGENDS", "color": "white"}
        ],
        "width": 1920,
        "height": 1080,
        "accent": "gold",
        "bg_color": "0x141414",
        "intro_seconds": 1.5,
        "items": [
            {"rank": 2, "title": "Second Legend", "source": clip_id, "start": 0.0, "end": 2.0},
            {"rank": 1, "title": "First Legend", "source": clip_id, "start": 0.0, "end": 2.0}
        ]
    }

    req = urllib.request.Request(
        f"{BASE_URL}/api/jobs",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        job_data = json.loads(resp.read().decode("utf-8"))
        job_id = job_data["job_id"]
        print(f"Submitted word-colored title job: {job_id}")

    # Poll status
    while True:
        with urllib.request.urlopen(f"{BASE_URL}/api/jobs/{job_id}") as resp:
            status = json.loads(resp.read().decode("utf-8"))
            if status["status"] == "done":
                print("Job finished successfully with word-by-word colored titles!")
                break
            elif status["status"] in ("failed", "cancelled"):
                raise RuntimeError(f"Job failed: {status.get('error')}")
        time.sleep(0.5)

    # Download output
    dest = scratch / "output_words.mp4"
    urllib.request.urlretrieve(f"{BASE_URL}/api/jobs/{job_id}/download", dest)
    assert dest.exists() and dest.stat().st_size > 10000

    # Probe duration: 1.5 (intro) + 2.0 + 2.0 = 5.5s
    probe = subprocess.check_output(
        f'ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "{dest}"',
        shell=True
    ).decode("utf-8").strip()
    duration = float(probe)
    print(f"Output video duration: {duration:.2f}s (expected ~5.5s)")
    assert abs(duration - 5.5) < 0.5

    # Cleanup
    import shutil
    shutil.rmtree(scratch, ignore_errors=True)
    print("\nSUCCESS: E2E word colors job test passed!")

if __name__ == "__main__":
    main()
