# About Rankings Maker

## What is this?

Rankings Maker is an open-source, self-hosted video studio purpose-built for creating **ranking countdown videos** — the viral format popularized on YouTube Shorts, TikTok, and Instagram Reels where a numbered list is revealed clip-by-clip.

It was built out of frustration with:
- Expensive SaaS tools that watermark your output
- Generic video editors that require hours of manual timeline work for each countdown
- Cloud tools that upload your personal footage to third-party servers

## Design Philosophy

### 1. Everything local
Your videos never leave your machine (unless you choose to publish them). The render pipeline is pure FFmpeg running on your hardware.

### 2. Real-time feedback
The live preview updates as you type — you can see your title colors, framing, rank ladder, color grading, and overlay elements update without waiting for a render.

### 3. Zero framework bloat
The entire frontend is vanilla HTML, CSS, and JavaScript. No React, no Vue, no 300 MB `node_modules`. The UI loads instantly and works offline.

### 4. Creator-first defaults
Common creator needs — blind-ranking reveals, clip name styling, per-clip volume, background music, color grading — are first-class features, not afterthoughts.

## Tech Decisions

| Choice | Reason |
|---|---|
| FastAPI | Async-capable Python server; clean auto-docs at `/docs` |
| FFmpeg | Industry-standard; handles every codec, format, and filter imaginable |
| Vanilla JS | No build step; instant edits reflect in browser without a dev server |
| localStorage | Simple, reliable settings persistence without a database |
| Container queries | Sidebar layout adapts to available space, not just screen width |

## Roadmap Ideas

- [ ] GPU-accelerated FFmpeg encoding (NVENC / VideoToolbox)
- [ ] Template presets (save and load full studio configurations)
- [ ] Auto-generated thumbnail from first frame
- [ ] Subtitle / caption track export (SRT)
- [ ] WebSocket live progress stream

## Contributing

See [README.md](README.md#contributing) for contribution guidelines. All PRs welcome!
