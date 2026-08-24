# PROJECT_CONTEXT.md

## 1. Product Vision

**Personal Data OS** is a self-hosted, personal telemetry and quantified-self operating system. It provides a centralized hub to collect, store, aggregate, and visualize personal metrics spanning physical health, cognitive habits, physical performance, and developer productivity.

---

## 2. Project Modules (Roadmap)

The platform is designed around **5 core tracking modules + 1 unified analytics layer**:

1. **Sleep Tracking**: Bedtime, wake time, duration calculation, quality scoring (1-10), moving averages (7d/30d), consistency indicators.
2. **Reading Tracker**: Book library management, granular reading sessions (pages read, minutes read), reading speed (pages/hr), streaks.
3. **Workouts & Strength**: Relational exercise logging (workouts -> exercises -> sets with reps, weight, RPE), weekly volume, frequency streaks.
4. **Habits & Discipline**: Generic daily/weekly routines (target & units), completion checklists, streaks, success rate tracking.
5. **GitHub Activity**: Automated GitHub event telemetry (commits, PRs, issues, active days, repositories).
6. **Unified Analytics Layer**: Aggregated summary endpoint (`/api/v1/dashboard/summary?period=today|week|month|year`).

---

## 3. Current Project Phase

- **Phase**: **Engineering Foundation Setup (Complete)**.
- **Goal**: Establish a robust repository structure, database connection pooling, configuration validation, HTTP routing with structured logging, API client abstractions, CI pipeline, and test suites.
- **First Vertical Slice**: **Sleep Tracking** (to be implemented following foundation cleanup and initial commit).

---

## 4. Architectural Decisions & Rationales

| Decision | Selected | Rationales |
| :--- | :--- | :--- |
| **System Architecture** | **Modular Monolith** | Single-binary simplicity, fast compile times, zero network hop latency, and low operational overhead for self-hosted deployment. |
| **Backend Language** | **Go (1.27+)** | Simple deployment, static single-binary compilation, strong concurrency model, and small runtime memory footprint. |
| **HTTP Router** | **`go-chi/chi/v5`** | Idiomatic `net/http` compatibility, lightweight routing, and composable middleware for logging, CORS, and recovery. |
| **Database** | **PostgreSQL 16** | Robust ACID transactions, rich JSON/date functions, window analytical queries, and connection pooling via `pgx/v5`. |
| **SQL & Type Safety** | **`pgx/v5` + `sqlc`** | Pure SQL queries with type-safe Go code generation. Eliminates ORM runtime overhead and keeps queries explicit and reviewable. |
| **Database Migrations**| **`golang-migrate`** | Versioned, reversible `.up.sql` and `.down.sql` migrations ensuring deterministic database schema evolution. |
| **Frontend Framework** | **React + TypeScript + Vite** | Fast dev server (HMR), strict typing mirroring backend contracts, and declarative state management with TanStack Query. |
| **Styling** | **Tailwind CSS** | Utility-first styling with build-time CSS generation, predictable styling tokens, and straightforward responsive design. |
| **API Contract** | **REST + OpenAPI 3.1** | Standardized `/api/v1` namespace for domain resources with living OpenAPI specification under `docs/openapi/`. |
| **CI / Automation** | **GitHub Actions** | Automated verification of formatting, linting, tests, security audits (`govulncheck`), and production builds on push/PR. |

---

## 5. Rejected Alternatives

- ❌ **GORM / Heavy ORMs**: Rejected in favor of explicit, reviewable SQL with `sqlc` to eliminate hidden query overhead and maintain full SQL control.
- ❌ **SQLite**: Rejected in favor of PostgreSQL to support advanced datetime calculations, robust connection pooling, and multi-threaded analytical aggregations.
- ❌ **Microservices / Kafka / Redis**: Rejected due to unnecessary operational complexity, distributed failure modes, and latency unjustified for single-user scale.
- ❌ **GraphQL**: Rejected in favor of a lean REST API with dedicated aggregated dashboard endpoints.
