"""
End-to-end test with 5 items (mix of URLs and uploaded clips), background image, and BGM.
Phase 7 - Step 7.1
"""

import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.parse
from pathlib import Path

BASE_URL = "http://127.0.0.1:8000"

def run(cmd):
    subprocess.run(cmd, shell=True, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

def upload_file(filepath: Path, content_type: str = "application/octet-stream") -> str:
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    filename = filepath.name
    with open(filepath, "rb") as f:
        file_bytes = f.read()

    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: {content_type}\r\n\r\n"
    ).encode("utf-8") + file_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

    req = urllib.request.Request(
        f"{BASE_URL}/api/upload",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        print(f"Uploaded {filename} -> {data['id']}")
        return data["id"]

def main():
    scratch_dir = Path("tests/scratch_e2e")
    scratch_dir.mkdir(parents=True, exist_ok=True)

    print("=== Step 1: Creating test media assets ===")
    bg_img = scratch_dir / "bg_image.png"
    bgm_audio = scratch_dir / "bgm_music.aac"
    clip_1 = scratch_dir / "clip_1.mp4"
    clip_3 = scratch_dir / "clip_3_noaudio.mp4"
    clip_5 = scratch_dir / "clip_5.mp4"

    # 1. Background image (1920x1080 gradient/pattern)
    run(f'ffmpeg -y -f lavfi -i "mandelbrot=s=1920x1080:rate=1" -vframes 1 "{bg_img}"')
    
    # 2. Background music (40 seconds music tone)
    run(f'ffmpeg -y -f lavfi -i "sine=frequency=330:sample_rate=44100:duration=40" -c:a aac -b:a 128k "{bgm_audio}"')

    # 3. Clip 1 (4 seconds, with 500Hz audio tone)
    run(f'ffmpeg -y -f lavfi -i "testsrc=size=640x360:rate=30:duration=4" -f lavfi -i "sine=frequency=500:sample_rate=44100:duration=4" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "{clip_1}"')

    # 4. Clip 3 (4 seconds, video only, no audio track)
    run(f'ffmpeg -y -f lavfi -i "testsrc=size=640x360:rate=30:duration=4" -c:v libx264 -pix_fmt yuv420p "{clip_3}"')

    # 5. Clip 5 (4 seconds, with 600Hz audio tone)
    run(f'ffmpeg -y -f lavfi -i "testsrc=size=640x360:rate=30:duration=4" -f lavfi -i "sine=frequency=600:sample_rate=44100:duration=4" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "{clip_5}"')

    print("=== Step 2: Uploading assets via API ===")
    bg_img_id = upload_file(bg_img, "image/png")
    bgm_id = upload_file(bgm_audio, "audio/aac")
    clip1_id = upload_file(clip_1, "video/mp4")
    clip3_id = upload_file(clip_3, "video/mp4")
    clip5_id = upload_file(clip_5, "video/mp4")

    # Real public video URLs for items 4 and 2
    url_item_4 = "https://www.youtube.com/watch?v=aqz-KE-bpKQ"
    url_item_2 = "https://www.youtube.com/watch?v=jNQXAC9IVRw"

    print("=== Step 3: Submitting 5-item Video Job ===")
    payload = {
        "title": "TOP 5 GREATEST MOMENTS",
        "width": 1920,
        "height": 1080,
        "intro_seconds": 3.0,
        "clip_seconds": 4.0,
        "accent": "gold",
        "bg_color": "0x1a1a2e",
        "bg_image": bg_img_id,
        "bgm": bgm_id,
        "bgm_volume": 0.2,
        "clip_volume": 0.8,
        "items": [
            {
                "rank": 5,
                "title": "Rising Star Debut",
                "source": clip5_id,
                "start": 0.0,
                "end": 3.5
            },
            {
                "rank": 4,
                "title": "Blazing Speed Record",
                "source": url_item_4,
                "start": 1.0,
                "end": 4.5
            },
            {
                "rank": 3,
                "title": "Silent Masterclass",
                "source": clip3_id,
                "start": 0.0,
                "end": 3.5
            },
            {
                "rank": 2,
                "title": "The Great Escape",
                "source": url_item_2,
                "start": 0.5,
                "end": 4.0
            },
            {
                "rank": 1,
                "title": "Championship Winner",
                "source": clip1_id,
                "start": 0.0,
                "end": 4.0
            }
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
        job_id = job_data.get("job_id") or job_data.get("id")
        print(f"Job created: {job_id}")

    print("=== Step 4: Polling Job Status ===")
    start_time = time.time()
    last_prog = -1
    while True:
        with urllib.request.urlopen(f"{BASE_URL}/api/jobs/{job_id}") as resp:
            status_data = json.loads(resp.read().decode("utf-8"))
            st = status_data["status"]
            prog = status_data["progress"]
            msg = status_data["message"]
            if prog != last_prog:
                print(f"[{time.time()-start_time:.1f}s] Status: {st} | Progress: {prog}% | Message: {msg}")
                last_prog = prog
            if st == "done":
                print("Job finished successfully!")
                break
            elif st in ("failed", "cancelled"):
                raise RuntimeError(f"Job ended with status: {st}, error: {status_data.get('error')}")
        time.sleep(0.8)

    print("=== Step 5: Downloading Output Video ===")
    download_url = f"{BASE_URL}/api/jobs/{job_id}/download"
    dest_video = scratch_dir / "final_top5_output.mp4"
    urllib.request.urlretrieve(download_url, dest_video)
    print(f"Downloaded video to {dest_video} (size: {dest_video.stat().st_size} bytes)")

    print("=== Step 6: Verifying Video Properties ===")
    probe_cmd = f'ffprobe -v error -show_entries format=duration,size,bit_rate:stream=codec_type,codec_name,width,height,sample_rate,channels -of json "{dest_video}"'
    probe_out = subprocess.check_output(probe_cmd, shell=True).decode("utf-8")
    probe = json.loads(probe_out)
    
    duration = float(probe["format"]["duration"])
    streams = probe["streams"]
    video_stream = next(s for s in streams if s["codec_type"] == "video")
    audio_stream = next(s for s in streams if s["codec_type"] == "audio")

    print(f"Detected Duration: {duration:.2f}s")
    print(f"Video Stream: {video_stream['codec_name']} {video_stream['width']}x{video_stream['height']}")
    print(f"Audio Stream: {audio_stream['codec_name']} {audio_stream['sample_rate']}Hz {audio_stream['channels']}ch")

    # Expected duration:
    # Intro: 3.0s
    # Item 5: 3.5s
    # Item 4: 3.5s
    # Item 3: 3.5s
    # Item 2: 3.5s
    # Item 1: 4.0s
    # Total expected: 3.0 + 3.5 + 3.5 + 3.5 + 3.5 + 4.0 = 21.0s
    assert abs(duration - 21.0) < 1.0, f"Expected duration ~21.0s, got {duration}"
    assert video_stream["width"] == 1920
    assert video_stream["height"] == 1080
    assert int(audio_stream["channels"]) == 2
    assert int(audio_stream["sample_rate"]) == 44100

    print("=== Step 7: Verifying Intermediate File Cleanup ===")
    job_dir = Path(f"jobs/{job_id}")
    files_in_job = list(job_dir.iterdir())
    print("Files remaining in job dir:", [f.name for f in files_in_job])
    assert (job_dir / "work").exists() is False, "work directory should have been cleaned up!"
    assert (job_dir / "output.mp4").exists(), "output.mp4 must exist!"
    assert (job_dir / "job.json").exists(), "job.json must exist!"

    print("\n=======================================================")
    print("SUCCESS: 5-item E2E test passed all verification checks!")
    print("=======================================================\n")

if __name__ == "__main__":
    main()
