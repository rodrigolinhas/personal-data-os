# AGENTS.md

Instructions and architectural guidelines for AI coding assistants (Gemini, Claude, Codex, Cursor, etc.) working on **Personal Data OS**.

---

## 1. Core Directives

1. **Read `PROJECT_CONTEXT.md` First**: Always consult [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) to understand current progress, roadmap, and design philosophy before making architectural changes.
2. **Respect the Modular Monolith**: Do NOT introduce microservices, message brokers (Kafka, RabbitMQ), distributed caches (Redis), or complex event-sourcing engines. The system is designed as an ultra-fast, maintainable modular monolith.
3. **No Premature Complexity & Scope Control**:
   - **Do not implement unrelated features while solving a task.**
   - Focus exclusively on the current milestone or issue assigned.
   - Do NOT invent future tables, queries, or endpoints ahead of time.
4. **Explicit SQL & Type Safety**:
   - Do NOT use GORM, Ent, or any heavy ORMs.
   - Use raw, version-controlled SQL migrations (`golang-migrate` format) and type-safe query generation with **`sqlc`**.
   - Keep SQL queries explicit, readable, and visible in `api/db/queries/`.
5. **Database Standards**:
   - Target **PostgreSQL 16+** via `jackc/pgx/v5` (`pgxpool`).
   - Do not switch to SQLite or NoSQL.
6. **API Architecture**:
   - Preserve the RESTful `/api/v1` endpoint namespace.
   - Document any new endpoint in `docs/openapi/openapi.yaml`.
7. **Security & Secrets**:
   - NEVER commit real credentials, access tokens, API keys, or `.env` files to git.
   - Always update `.env.example` when introducing new configuration flags.
   - Validate environment configuration during application startup with clear failure messages.
8. **Testing & Code Quality**:
   - Always write unit and integration tests for new business logic in the respective package.
   - Backend tests must run cleanly via `go test ./...` and pass `go vet`.
   - Frontend tests must run cleanly via Vitest (`npm test`), ESLint (`npm run lint`), and TypeScript typecheck (`npm run typecheck`).

---

## 2. Standard Commands

### Backend (`api/`)
```bash
# Run unit & integration tests
go test -v ./...

# Run static analysis
go vet ./...

# Check code formatting
gofmt -l .

# Run application
go run ./cmd/api
```

### Frontend (`web/`)
```bash
# Typecheck TypeScript
npm run typecheck

# Lint with ESLint
npm run lint

# Check code formatting with Prettier
npm run format:check

# Format code with Prettier
npm run format

# Run Vitest test suite
npm test

# Production build
npm run build
```

---

## 3. Scope Rule
> **Do not implement unrelated features while solving a task.**  
> Keep all pull requests, commits, and file changes small, focused, and verified.
