# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| latest `main` | ✅ |

## Reporting a Vulnerability

If you discover a security vulnerability, please **do not open a public GitHub issue**.

Instead, email the maintainer directly (see GitHub profile) or open a [GitHub Security Advisory](https://github.com/YOUR_USERNAME/rankingsmaker/security/advisories/new) (private disclosure).

We aim to respond within 72 hours and will credit responsible disclosers.

## Security Notes

- This application is designed to run **locally** on `127.0.0.1`. Do not expose it directly to the internet without adding authentication middleware.
- API keys (Vecteezy etc.) must be stored in `.env` files, which are gitignored. Never hardcode credentials.
- Uploaded user media is stored in `data/uploads/`. Ensure your machine's filesystem permissions are appropriate.
