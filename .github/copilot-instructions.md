# GitHub Copilot & Coding Agent Instructions — Personal Data OS

Guidelines for AI assistants working in this repository.

## Architecture Directives
- **Modular Monolith**: The application consists of `api/` (Go Chi backend) and `web/` (React Vite frontend).
- **Directory Structure**:
  - `api/`: Go backend (`cmd/api/main.go`, `internal/config`, `internal/database`, `internal/http`, `db/migrations`, `db/queries`, `db/sqlc`).
  - `web/`: React frontend (`src/api`, `src/app`, `src/features`, `src/components`, `src/pages`, `src/shared`).
  - `docs/`: Architecture, API specifications, and documentation.
- **Explicit SQL**: Do NOT use ORMs (GORM, Ent). Use raw migrations and `sqlc`.
- **Vertical Slice Method**: Implement changes end-to-end (Migration ➔ sqlc ➔ Go service ➔ HTTP ➔ Tests ➔ OpenAPI ➔ React API ➔ UI ➔ Frontend tests).
- **No Scope Creep**: Implement only what was requested. Do not add future tables or endpoints prematurely.
- **Zero Secrets & Synthetic Data**: Never commit credentials or real personal data. Use synthetic data in all tests and examples.
