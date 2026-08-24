# Security Policy — Personal Data OS

## Supported Versions

Personal Data OS is currently in active early development (`v0.1.0-alpha`). Only the latest commit on `main` receives security patches.

| Version | Supported          |
| ------- | ------------------ |
| `main`  | :white_check_mark: |
| < 0.1.0 | :x:                |

---

## Reporting a Vulnerability

If you discover a security vulnerability in Personal Data OS, please **do NOT report it in public GitHub issues**.

- **GitHub Repository**: Once the repository is published on GitHub, use GitHub's **Private Vulnerability Reporting** under the repository's **Security** tab (if enabled).
- **Direct Contact**: If private reporting is not enabled, contact the repository maintainer privately before any public disclosure.

---

## Privacy & Personal Data Guidelines

- **Zero Secrets in Git**: Never commit `.env` files, API tokens, passwords, or authentication secrets.
- **No Real Personal Datasets**: Do NOT paste personal health data, sleep records, or financial history in public bug reports or pull requests. Use synthetic data examples only.
- **Local Self-Hosting Responsibility**: Because Personal Data OS is self-hosted, ensure that your deployment environment (e.g. VPS, home server) uses appropriate firewalling and reverse-proxy authentication if exposed to the public internet.
