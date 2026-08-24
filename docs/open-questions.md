# Open Questions & Design Decisions — Personal Data OS

This document tracks open design questions, architectural trade-offs, and future considerations for **Personal Data OS**. These items represent unresolved questions rather than committed decisions.

---

## 1. Single-User vs. Multi-User Tenancy

- **Current State**: Designed as a self-hosted, single-user system. Queries do not enforce a `user_id` partition column.
- **Open Question**: Should future milestones introduce a `user_id` column across all tables to support multi-tenant hosting, or should multi-user deployment be handled via separate application instances per user?
- **Trade-Off**: Adding `user_id` increases schema complexity and index sizes; keeping it single-user preserves ultra-clean queries and zero tenant-isolation risk.

---

## 2. Generic Metric Schema vs. Domain-Specific Relational Tables

- **Current State**: Domain-specific relational schemas (e.g. `sleep_logs`, `books`, `workouts`, `exercise_sets`).
- **Open Question**: Should future ad-hoc metrics (e.g. weight, blood pressure, caffeine intake) use a generic key-value time-series table (e.g. `metric_entries(date, metric_name, value, unit)`), or should every metric receive a dedicated table?
- **Trade-Off**: Generic tables allow instant custom tracker creation without migrations, but sacrifice strong type checking, foreign keys, and tailored constraint validation.

---

## 3. External Collector & Plugin Architecture

- **Current State**: Hardcoded service collectors (e.g. GitHub API client in `api/internal/github`).
- **Open Question**: Should external sync collectors (e.g. Wakatime, Strava, Oura, Spotify) follow a standardized internal Go interface (e.g. `Collector` with `Sync(ctx) error` and `Schedule`), or be standalone cron CLI binaries?
- **Trade-Off**: An internal plugin interface keeps everything in the single binary, while standalone scripts decouple external API failure boundaries.

---

## 4. Authentication & Security Strategy

- **Current State**: No authentication layer; intended for local development (`localhost`) or private home network / VPN (e.g. Tailscale / WireGuard).
- **Open Question**: When deployed to a public VPS, should authentication be handled via a lightweight session cookie / API Key middleware in Go, or offloaded to reverse proxy authentication (e.g. Authelia / Cloudflare Access)?

---

## 5. Local Backup & Export Standard

- **Current State**: Database persistence through Docker volume `postgres_data`.
- **Open Question**: What format should the unified data export endpoint support (`GET /api/v1/export`)? (e.g. Full JSON bundle, SQLite export, or CSV archive for individual trackers).
