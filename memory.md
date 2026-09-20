# Working Memory

## Current status
- **Next step:** Phase 0, Step 0.3 (Create README.md draft and docs/APP_DOCUMENTATION.md skeleton).

## Decisions made
- Initialized a virtual environment at `.venv` to comply with Python 3.12 PEP 668 package isolation standards while using the required FastAPI / uvicorn / yt-dlp stack.
- Initialized local git repository for granular per-step commit tracking.

## Environment
- **OS:** Linux (Ubuntu 24.04 LTS / 6.8 kernel, x86_64)
- **Python version:** Python 3.12.3
- **FFmpeg version:** 6.1.1-3ubuntu5
- **FFprobe version:** 6.1.1-3ubuntu5
- **yt-dlp version:** 2026.8.19 (in .venv) and /usr/bin/yt-dlp
- **Run command:** `.venv/bin/uvicorn app.main:app --reload --port 8000`

## Gotchas/lessons learned
- None yet.

## Open questions
- None.
