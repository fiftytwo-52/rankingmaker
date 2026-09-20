"""
Regression tests for yt-dlp command resolution.

Guards the bug where Ubuntu's apt yt-dlp (/usr/bin/yt-dlp 2024.04.09) shadowed the newer
yt-dlp pinned in requirements.txt: `app.deps.check_dependencies()` reported the stale PATH
binary as healthy, while `app.engine.get_source()` downloaded with the `.venv` module.

Rules enforced here:
1. `get_yt_dlp_command()` resolves to the app interpreter (`<python> -m yt_dlp`).
2. The resolved command actually runs and reports a version.
3. `/api/health` reports the exact version the engine uses (no more mismatch).
4. Both yt-dlp attempts inside `get_source()` (primary + looser-format retry) use that
   same resolved command instead of falling back to a bare `yt-dlp` from PATH.
"""

import os
import subprocess
import sys
import tempfile

from fastapi.testclient import TestClient

import app.engine as engine
from app.deps import check_dependencies, describe_yt_dlp_command, get_yt_dlp_command
from app.main import app

client = TestClient(app)


def _resolved_version() -> str:
    res = subprocess.run(
        get_yt_dlp_command() + ["--version"], capture_output=True, text=True, timeout=60
    )
    assert res.returncode == 0, f"resolved yt-dlp failed: {res.stderr.strip()}"
    return res.stdout.strip()


def test_resolver_prefers_app_interpreter():
    cmd = get_yt_dlp_command()
    assert cmd[:3] == [sys.executable, "-m", "yt_dlp"], f"unexpected resolution: {cmd}"
    assert describe_yt_dlp_command(cmd).startswith("app interpreter:"), describe_yt_dlp_command(cmd)
    print(f"✓ yt-dlp resolved through the app interpreter: {' '.join(cmd)}")


def test_resolved_command_reports_a_version():
    version = _resolved_version()
    assert version, "the resolved yt-dlp command reported no version"
    print(f"✓ resolved yt-dlp --version -> {version}")


def test_health_reports_the_same_yt_dlp_as_the_engine():
    yt = check_dependencies()["tools"]["yt_dlp"]
    assert yt["available"] is True, yt["error"]
    engine_version = _resolved_version()
    assert yt["version"] == engine_version, (
        f"/api/health reports {yt['version']} but the engine runs {engine_version}"
    )
    print(f"✓ health yt_dlp matches the engine: {yt['version']} ({yt['source']})")


def test_health_endpoint_payload():
    res = client.get("/api/health")
    assert res.status_code == 200
    yt = res.json()["tools"]["yt_dlp"]
    assert yt["available"] is True
    assert yt["source"], "health payload must say which yt-dlp was resolved"
    print(f"✓ GET /api/health -> yt_dlp {yt['version']} via {yt['source']}")


def test_engine_download_attempts_use_resolved_command():
    """get_source() must run both attempts with the resolved command and raise cleanly."""
    calls = []

    def fake_run(cmd, cwd=None, cancel_flag=None, **kwargs):
        calls.append(list(cmd))
        return subprocess.CompletedProcess(cmd, 1, "", "simulated yt-dlp failure")

    original = engine.run_subprocess_with_cancel
    engine.run_subprocess_with_cancel = fake_run
    try:
        with tempfile.TemporaryDirectory() as tmp:
            downloads = os.path.join(tmp, "downloads")
            uploads = os.path.join(tmp, "uploads")
            os.makedirs(downloads, exist_ok=True)
            os.makedirs(uploads, exist_ok=True)
            raised = False
            try:
                # No media extension in the path, so the direct-HTTP branch is skipped and
                # nothing touches the network.
                engine.get_source(
                    "https://example.invalid/no-such-video?ref=yt-dlp-resolution-test",
                    downloads,
                    uploads,
                )
            except RuntimeError:
                raised = True
            assert raised, "expected the simulated download failure to raise RuntimeError"
    finally:
        engine.run_subprocess_with_cancel = original

    assert len(calls) == 2, f"expected 2 yt-dlp attempts (primary + retry), got {len(calls)}"
    for cmd in calls:
        assert cmd[:3] == [sys.executable, "-m", "yt_dlp"], f"attempt used: {cmd[:3]}"
        assert "-f" in cmd and "--merge-output-format" in cmd, cmd
    print(f"✓ engine ran both attempts with the resolved command: {calls[0][4]} / {calls[1][4]}")


if __name__ == "__main__":
    print("=== yt-dlp resolution ===")
    test_resolver_prefers_app_interpreter()
    print("=== resolved command version ===")
    test_resolved_command_reports_a_version()
    print("=== health vs engine consistency ===")
    test_health_reports_the_same_yt_dlp_as_the_engine()
    print("=== GET /api/health payload ===")
    test_health_endpoint_payload()
    print("=== engine download attempts ===")
    test_engine_download_attempts_use_resolved_command()
    print("\n=======================================================")
    print("SUCCESS: yt-dlp resolution tests passed!")
    print("=======================================================")
