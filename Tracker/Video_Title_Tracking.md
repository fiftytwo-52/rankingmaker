# 🎬 Video Title Tracker

> **Companion to `Video_Tracker.xlsx`** — the sheet is the data, this file is the rulebook.
> Every short this studio produces (Ranking, Story, Football Myths, Failed Moments) gets one row in the
> spreadsheet and, when it is worth remembering, one line in the [mirror table](#-markdown-mirror-table) below.

---

## 📂 Folder purpose (read this first)

| Item | What it is |
|---|---|
| `Video_Tracker.xlsx` | Live upload tracker — one row per short. Open in Excel / LibreOffice / Google Sheets. |
| `Video_Title_Tracking.md` | This document: column meanings, group definitions, status lifecycle, title conventions. |

**This folder is local-only and blank.** Only the empty template was ever pushed (so the structure exists in
git history); it was then untracked (`git rm -r --cached Tracker`) and added to `.gitignore`. That means:

- Editing the workbook never creates a change that can be pushed — your upload list stays private.
- The copy on GitHub is the **empty template only** — no video rows exist anywhere except your own machine.
- Re-cloning the repo will **not** bring this folder back. Back it up yourself (cloud drive / external disk).

---

## 📊 Sheet layout — `Video Tracker`

Headers live in **row 1**, data validation and status colours are applied down to **row 201**.
Filters are enabled (`Data ▸ AutoFilter`) and row 1 stays frozen while you scroll.

| Col | Column | Type | Notes |
|---|---|---|---|
| A | **Video SN** | Number | Serial number of the short. Drives the filename prefix (`SN001_...`). Fill down as you add rows. |
| B | **Group** | Dropdown | `Ranking`, `Story`, `Football Myths`, `Failed Moments`, `Other`. |
| C | **Video Title** | Text | The **published** title as it appears on YouTube (see conventions below). |
| D | **Created Date** | Date `YYYY-MM-DD` | Day the short was rendered by Rankings Maker (the day the MP4 finished). |
| E | **Video Status** | Dropdown | `Idea` → `Created - Not Uploaded` → `Scheduled` → `Posted` (+ `Private`, `Archived`). Colour-coded automatically. |
| F | **Posted / Scheduled Date** | Date `YYYY-MM-DD` | Publish date if already live, otherwise the planned upload date. Blank while still in the `Idea` / `Created - Not Uploaded` stages. |
| G | **Platform** | Dropdown | `YouTube Shorts`, `TikTok`, `Instagram Reels`, `Facebook Reels`, `Other`. |
| H | **Notes** | Text | Performance observations, hook used, music, anything for future-you. |

The second sheet, **Groups & Statuses**, is a built-in legend for every dropdown value — reference only,
the tracker is never edited there.

---

## 🗂️ Group definitions

| Group | Format | What must be true before it is "done" |
|---|---|---|
| **Ranking** | Countdown / top-N list revealed clip by clip (rank ladder overlay). | Title states the count explicitly (`Top 10`, `Top 5`); a blind-ranking finale, if used, is recorded in Notes. |
| **Story** | One narrative told start to finish, no rank numbers. | Clear hook in the first 3 words, single subject, facts checked before render. |
| **Football Myths** | Myth stated, then busted with evidence. | The myth **and** the correction both appear on screen; sources checked (no invented stats). |
| **Failed Moments** | Misses, own goals, bloopers, epic fails. | Clip quality verified (no blurry re-upload), nobody humiliated who did not sign up for it. |
| **Other** | Anything that does not fit yet. | Move it into a real group as soon as one fits, so reporting stays clean. |

---

## 🔄 Status lifecycle

```
Idea  →  Created - Not Uploaded  →  Scheduled  →  Posted
                 ↓                                     ↓
              Private (hold / rework)              Archived (retired)
```

| Status | Meaning | Columns that must be filled |
|---|---|---|
| `Idea` | Topic captured, nothing rendered yet. | A (SN), B (Group), C (working title), D (Created Date) |
| `Created - Not Uploaded` | MP4 rendered locally, not uploaded anywhere. | A–E |
| `Scheduled` | Queued on the platform with a future publish date. | A–F, **F = future date** |
| `Posted` | Publicly live. | A–G, **F = actual publish date** |
| `Private` | Uploaded but unlisted / on hold. | A–G + reason in Notes |
| `Archived` | Deleted or retired. | A–H, reason in Notes |

**Daily rhythm that keeps this accurate:** render a short → add the row the same day (`Created - Not Uploaded`) →
when you queue it on YouTube flip the status to `Scheduled` and set F → the morning after it goes live flip it to `Posted`.

---

## 🏷️ Title conventions (the "title tracking" part)

The `Video Title` column stores the **exact published title**, so a title can be reused, compared and A/B tested
later. Use these templates so every short is instantly recognisable by group — **none of the "pattern" column
is a video we have actually made**, the real titles are typed into the workbook only:

| Group | Title template | Pattern to fill in (nothing made yet) |
|---|---|---|
| Ranking | `Top N <Superlative> in <Competition/Scope> <Timeframe>` | `Top 10 <Best/Worst> <Thing> in <Competition> History` |
| Story | `The <Person/Club> Who <Twist>` | `The <Club> That <Shocking Outcome>` |
| Football Myths | `Myth: <Widely Believed Claim>` | `Myth: <Claim That Can Be Falsified>` |
| Failed Moments | `Top N <Fail Type> in Football History` | `Top 5 <Miss / Own Goal / Blooper> in <Competition>` |

House rules:

1. **Under 60 characters** where possible — Shorts truncates long titles in the feed.
2. Front-load the keyword / emotion in the **first 3 words**; that is what the viewer reads before deciding.
3. Numbers are digits (`10`, not `ten`) so counts never wrap onto a second line.
4. Title Case for Rankings and Failed Moments, sentence-style for Myths and Stories.
5. Keep the title here identical to the workbook — the sheet is the data, this file is the changelog.

---

## 📁 Filename / SN convention

Match the exported MP4 to the sheet so any file on disk maps back to a row:

```
SN<3-digit SN>_<group-slug>_<short-slug>.mp4
```

| Workbook row | Rendered file (pattern) |
|---|---|
| `SN 1`, Ranking | `SN001_ranking_<short-slug>.mp4` |
| `SN 2`, Football Myths | `SN002_myth_<short-slug>.mp4` |
| `SN 3`, Failed Moments | `SN003_fails_<short-slug>.mp4` |

Group slugs: `ranking`, `story`, `myth`, `fails`, `other`. Keep slugs lowercase with dashes — safest on every OS.

---

## ✅ How to log a new video

1. Open `Video_Tracker.xlsx` → **Video Tracker** sheet.
2. Go to row 2 (the first empty row) and put `1` in **Video SN**; the next video you log gets `2`, and so on.
3. Pick the **Group** and **Platform** from the dropdowns, then type the final title in **Video Title**.
4. Set **Created Date** to the render day and **Video Status** to `Created - Not Uploaded`.
5. When it goes live, update the status, fill **Posted / Scheduled Date**, and note views / lesson in **Notes**.
6. Add one line to the mirror table below when the title is worth remembering.

---

## 📋 Markdown mirror table

**Empty — no videos have been made yet.** Add a row here only after it also exists in the workbook.
Keep this table short (purpose, hook, what you learned); the workbook holds the full history.

| SN | Group | Video Title | Created | Status | Posted / Scheduled | Platform |
|---|---|---|---|---|---|---|
| — | — | _No videos logged yet_ | — | — | — | — |

---

## ⚠️ Ground rules

- **Never commit this folder** — `.gitignore` excludes `Tracker/` and the blank template was force-added
  (`git add -f`) exactly once. If you see it staged, run `git check-ignore -v Tracker/Video_Tracker.xlsx`.
- **Back it up** outside the repo (cloud drive is fine) — untracked files are not in any remote.
- **No API keys or account details** in the Notes column; this file may end up in a shared drive or a screenshot.
