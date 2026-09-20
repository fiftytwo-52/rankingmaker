# Privacy Policy

**Rankings Maker** is a fully self-hosted, local application. This policy explains what happens to your data when you use it.

## What data is collected?

**Nothing is collected by this project.**

Rankings Maker runs entirely on your own machine. There is no telemetry, no analytics, no crash reporting, and no external data transmission — unless you explicitly configure a third-party integration (see below).

## Your media files

- Video clips, audio files, and images you upload are stored **locally** in `data/uploads/` on your machine.
- Pre-downloaded source videos are cached in `data/downloads/` and can be cleared from the app at any time via **"Clean Source Cache"**.
- Exported videos are saved to `data/downloads/` and can be deleted from the **Recent Exports** panel.

## Third-party integrations

If you choose to use the optional **Vecteezy stock art** feature:
- A search query is sent to the Vecteezy API (`api.vecteezy.com`) using your own API key.
- Vecteezy's own [Privacy Policy](https://www.vecteezy.com/privacy-policy) applies to those requests.
- Your API key is stored only in your local `.env` file or browser session — it is never sent to any server controlled by this project.

## Cookies & localStorage

This application uses the browser's `localStorage` API to save your studio settings (title, font, color choices, etc.) so you don't have to re-enter them on refresh. This data is stored only in your browser and never leaves your device.

## Changes

This privacy policy may be updated. Changes will be reflected in this file in the repository.

## Contact

Open an issue on GitHub if you have any privacy-related questions.
