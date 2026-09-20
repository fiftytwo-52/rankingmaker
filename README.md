# 🏆 Rankings Maker

> **A self-hosted, browser-based studio for creating viral ranking countdown videos — no subscriptions, no watermarks, full control.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/python-3.11%2B-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green.svg)](https://fastapi.tiangolo.com)
[![FFmpeg](https://img.shields.io/badge/FFmpeg-required-red.svg)](https://ffmpeg.org)

---

## ✨ Features

| Feature | Details |
|---|---|
| 🎬 **Live Preview** | Real-time 9:16 canvas with timeline scrubber — no render needed to see changes |
| 📊 **Ranked Items Deck** | Video clip list with per-clip trim, volume and download status |
| 🎨 **Word-by-Word Color Studio** | Click any title word to set its exact color |
| 🏅 **Rank Ladder Overlay** | All numbers visible from frame 1, clips revealed one by one |
| 🌈 **Color Grading** | 6 cinematic presets + manual sliders for contrast / saturation / brightness / warmth |
| ✏️ **Timed Elements** | Add text, emoji, uploaded PNG or Vecteezy stock art at exact timestamps |
| 📐 **Multiple Framing Modes** | Fit, Fill, Stretch, Blur-Pad, Card-Frame clip layout |
| 🔀 **Randomization** | Shuffle clips, randomize placements, or set Rank #1 as guaranteed finale |
| 📦 **Bulk Add** | Paste an entire ranked list and auto-generate all deck items |
| 💾 **Auto-save** | All settings saved to localStorage — nothing lost on refresh |
| 📤 **Export & History** | One-click MP4 export; recent exports panel with re-download |

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.11+**
- **FFmpeg** (must be on your `PATH`)

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt install ffmpeg

# Windows (Chocolatey)
choco install ffmpeg
```

### Installation

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/rankingsmaker.git
cd rankingsmaker

# 2. Create virtual environment
python3 -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. (Optional) Create .env for API keys
cp .env.example .env
# Edit .env and fill in your credentials

# 5. Start the server
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# 6. Open browser → http://127.0.0.1:8000
```

---

## 🗂️ Project Structure

```
rankingsmaker/
├── app/
│   ├── main.py          # FastAPI routes & API endpoints
│   ├── engine.py        # FFmpeg render pipeline
│   ├── models.py        # Pydantic config models
│   ├── jobs.py          # Background job queue
│   ├── deps.py          # Dependency checker
│   └── static/
│       ├── index.html   # Single-page studio UI
│       ├── app.js       # Frontend engine & live preview
│       └── style.css    # Design system & responsive grid
├── data/
│   ├── uploads/         # Uploaded media (gitignored)
│   └── downloads/       # Pre-downloaded source videos (gitignored)
├── jobs/                # Job state files (gitignored)
├── tests/               # Automated test suite
├── docs/                # Documentation
├── .env.example         # Example environment variables (no real keys)
├── LICENSE
├── PRIVACY.md
├── ABOUT.md
└── requirements.txt
```

---

## ⚙️ Configuration

Copy `.env.example` to `.env` and fill in your values. **Never commit `.env` to git.**

```ini
# .env
VECTEEZY_API_KEY=your_key_here
VECTEEZY_ACCOUNT_ID=your_account_id
```

---

## 🛠️ Tech Stack

- **Backend:** FastAPI + Uvicorn (Python)
- **Render Engine:** FFmpeg (subprocess filter-graph)
- **Frontend:** Vanilla HTML/CSS/JS (zero framework dependencies)
- **Storage:** Local filesystem (no database required)

---

## 📋 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/jobs` | Create a render job |
| `GET` | `/api/jobs/{id}` | Poll job progress |
| `DELETE` | `/api/jobs/{id}` | Cancel/delete a job |
| `POST` | `/api/upload` | Upload a media file |
| `POST` | `/api/download-source` | Pre-download a remote video URL |
| `GET` | `/api/vecteezy/search` | Search Vecteezy stock library |
| `POST` | `/api/vecteezy/download` | Download a Vecteezy asset locally |
| `GET` | `/api/elements/list` | List locally cached sticker assets |
| `GET` | `/api/recent-videos` | List recent exported videos |
| `GET` | `/api/health` | Dependency health check |

---

## 🤝 Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feature/my-feature`
3. Commit: `git commit -m 'Add my feature'`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

## 🔒 Privacy

See [PRIVACY.md](PRIVACY.md). All your data stays on your own machine.
