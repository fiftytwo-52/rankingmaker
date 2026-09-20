# Working Memory

## Current status
- **Next step:** Phase 3, Step 3.2 (Make `render()` accept the validated model).

## Decisions made
- Initialized a virtual environment at `.venv` to comply with Python 3.12 PEP 668 package isolation standards while using the required FastAPI / uvicorn / yt-dlp stack.
- Initialized local git repository for granular per-step commit tracking.
- Selected Liberation Sans Bold (`/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf`) as the bundled default font and copied to `data/fonts/default.ttf`. System fallback path: `/usr/share/fonts/truetype/freefont/FreeSansBold.ttf`.

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
