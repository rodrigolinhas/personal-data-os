# Product Roadmap — Personal Data OS

This roadmap outlines the planned milestones for **Personal Data OS**. Milestones represent sequential vertical slices designed to incrementally build a full personal quantified-self operating system.

---

## Milestone Overview

```text
  [M1: Foundation]        [M2: Sleep Tracker]      [M3: Reading & Books]
 ┌────────────────┐      ┌──────────────────┐     ┌─────────────────────┐
 │ • Go + Chi API │ ───► │ • sleep_logs DDL │ ──► │ • books & sessions  │
 │ • PostgreSQL   │      │ • Sleep REST API │     │ • Reading REST API  │
 │ • React + Vite │      │ • Sleep React UI │     │ • Bookshelf UI      │
 └────────────────┘      └──────────────────┘     └─────────────────────┘
                                                             │
 ┌───────────────────────────────────────────────────────────┘
 ▼
  [M4: Habits Tracker]     [M5: Workouts]           [M6: GitHub Telemetry]
 ┌────────────────────┐   ┌──────────────────────┐  ┌─────────────────────┐
 │ • habits & logs    │──►│ • workouts & sets    │─►│ • GitHub sync       │
 │ • Habits REST API  │   │ • Workouts REST API  │  │ • Commits & stats   │
 │ • Checklists UI    │   │ • Workout Logger UI  │  │ • Telemetry UI      │
 └────────────────────┘   └──────────────────────┘  └─────────────────────┘
                                                               │
 ┌─────────────────────────────────────────────────────────────┘
 ▼
  [M7: Unified Analytics Dashboard]
 ┌──────────────────────────────────┐
 │ • Aggregated /dashboard/summary  │
 │ • Period Selector (Today/W/M/Y)  │
 │ • Command Center UI with Trends  │
 └──────────────────────────────────┘
```

---

## Milestone 1: Engineering Foundation Setup *(Completed)*

- **Objective**: Establish the core engineering infrastructure, database pooling, configuration loading, HTTP routing, type-safe API client abstractions, CI pipeline, and automated test runners.
- **Deliverables**:
  - `api/`: Go API with `chi` router, `pgxpool` connection manager, `log/slog`, `config` package, `/health` endpoint.
  - `web/`: React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, React Hook Form, Zod, Vitest.
  - `docs/openapi/openapi.yaml`: Living OpenAPI 3.1 specification.
  - `.github/workflows/ci.yml`: Automated CI for backend (vet, race tests, govulncheck, build) and frontend (typecheck, lint, test, build).
  - Docker Compose configuration for PostgreSQL 16 with healthcheck.

---

## Milestone 2: Sleep Tracking *(Next Vertical Slice)*

- **Objective**: Provide comprehensive daily sleep tracking, duration calculation, and rolling consistency trends.
- **Deliverables**:
  - Database schema: `sleep_logs` with date uniqueness, bedtime, wake time, duration, quality score (1-10), notes.
  - Backend: REST endpoints (`GET /api/v1/sleep`, `POST /api/v1/sleep`, `GET /api/v1/sleep/stats`, `PUT`, `DELETE`).
  - Frontend: Daily sleep logger modal, 7d/30d moving average trends, and sleep history table.
  - Tests & Documentation: Go service/handler unit tests, Vitest UI tests, OpenAPI update.

---

## Milestone 3: Reading & Books Tracker

- **Objective**: Catalog books, log granular reading sessions, and calculate reading velocity.
- **Deliverables**:
  - Database schema: `books` and `reading_sessions` with foreign keys and cascade rules.
  - Backend: Book catalog CRUD, reading session logging, reading speed (pages/hour) computation.
  - Frontend: Bookshelf view with completion progress bars, quick session logger.

---

## Milestone 4: Habits & Discipline

- **Objective**: Daily and weekly habit completion tracking with streak indicators.
- **Deliverables**:
  - Database schema: `habits` and `habit_logs` with single log per habit/date constraint.
  - Backend: Habit definitions, completion toggle, numeric progress recording, streak algorithms.
  - Frontend: Daily habit checklist with instant completion toggles, progress bars, and streak flames.

---

## Milestone 5: Workouts & Strength

- **Objective**: Relational exercise logging (Workouts ➔ Exercises ➔ Sets with reps, weight, RPE).
- **Deliverables**:
  - Database schema: `workouts`, `workout_exercises`, `exercise_sets` with atomic transactions.
  - Backend: Workout creation, exercise catalog, volume calculations.
  - Frontend: Dynamic workout logger with set addition and previous performance recall.

---

## Milestone 6: GitHub Activity Telemetry

- **Objective**: Automated sync of developer activity (commits, PRs, issues, active days).
- **Deliverables**:
  - Database schema: `github_daily_stats`.
  - Backend: GitHub API client, manual sync endpoint (`POST /api/v1/github/sync`), stats query (`GET /api/v1/github/stats`).
  - Frontend: Activity cards and commit streak indicators.

---

## Milestone 7: Unified Analytics Dashboard

- **Objective**: Central command center aggregating metrics across all 5 tracking domains.
- **Deliverables**:
  - Backend: Aggregated summary endpoint (`/api/v1/dashboard/summary?period=today|week|month|year`) with comparative deltas against previous periods.
  - Frontend: Command center dashboard with KPI summary cards, period switcher, trend comparisons (`↑ 15% vs last week`), and activity charts.
