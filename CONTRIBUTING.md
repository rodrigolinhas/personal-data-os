# Contributing to Personal Data OS

Thank you for your interest in contributing to **Personal Data OS**! We welcome contributions that align with our core architectural principles and privacy standards.

---

## 1. Core Principles

Before submitting code, please keep these directives in mind:
1. **Respect the Modular Monolith**: Do NOT introduce microservices, message queues (Kafka, RabbitMQ), distributed caches (Redis), or heavy ORMs (GORM, Ent).
2. **Explicit SQL with `sqlc`**: Database interactions use raw SQL migrations (`golang-migrate` format) and type-safe generated queries with `sqlc`.
3. **Vertical Slice Development**: Implement complete end-to-end features rather than disconnected layers.
4. **Zero Personal Data & Secrets**: Never commit real health records, personal datasets, API tokens, or `.env` files. All test fixtures must use synthetic data.
5. **No Scope Creep**: Keep pull requests small, focused, and verified against a single issue or milestone.

---

## 2. Local Setup

Refer to [docs/development.md](docs/development.md) for full prerequisites and setup steps.

Quick verification commands:
```bash
# 1. Start PostgreSQL
docker compose up -d

# 2. Verify Backend
cd api
go test -v -race ./...
go vet ./...
go build ./cmd/api

# 3. Verify Frontend
cd ../web
npm run typecheck
npm run lint
npm test
npm run build
```

---

## 3. Finding Work & Issue Claiming

1. Check open issues in the GitHub repository.
2. Comment on the issue to state you are working on it before submitting a PR to avoid duplicate effort.
3. If proposing a new tracker or integration, first open an issue using the appropriate issue form (`tracker_proposal` or `integration_proposal`).

---

## 4. Branch Naming Conventions

Create a focused branch from `main`:

| Type | Format | Example |
| :--- | :--- | :--- |
| Feature | `feat/<issue-number>-<short-description>` | `feat/1-sleep-tracking` |
| Bug Fix | `fix/<issue-number>-<short-description>` | `fix/4-connection-pool-timeout` |
| Documentation | `docs/<short-description>` | `docs/api-guide-update` |
| Refactoring | `refactor/<short-description>` | `refactor/http-error-helpers` |
| Testing | `test/<short-description>` | `test/sleep-handler-integration` |
| Maintenance | `chore/<short-description>` | `chore/update-ci-actions` |

---

## 5. Commit Message Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<optional scope>): <description in imperative mood>
```

**Common Prefixes:**
- `feat`: New user-facing feature or API endpoint
- `fix`: Bug fix
- `docs`: Documentation updates
- `test`: Adding or updating tests
- `refactor`: Code changes that neither fix a bug nor add a feature
- `chore`: Build tooling, dependency, or CI changes

**Examples:**
- `feat(sleep): add sleep_logs schema migration and sqlc queries`
- `feat(api): expose POST /api/v1/sleep handler`
- `fix(database): configure ping timeout on connection pool`
- `test(web): add unit tests for health status card`
- `docs(readme): add quick start commands and privacy section`

---

## 6. Definition of Done (Vertical Slice Checklist)

A new feature PR is ready for review when:
- [ ] Database migration (`.up.sql` and `.down.sql`) created in `api/db/migrations/`.
- [ ] Explicit queries added in `api/db/queries/` and generated via `sqlc generate`.
- [ ] Go service and repository implemented in `api/internal/<domain>/`.
- [ ] HTTP handlers and validation implemented in `api/internal/http/`.
- [ ] Backend unit and integration tests added and passing (`go test -race ./...`).
- [ ] `docs/openapi/openapi.yaml` updated with new endpoints and schemas.
- [ ] Frontend API client, Zod schemas, and TanStack Query hooks created in `web/src/features/<domain>/api/`.
- [ ] Frontend UI components and forms created in `web/src/features/<domain>/`.
- [ ] Frontend tests added and passing (`npm test`).
- [ ] TypeScript checks and ESLint pass (`npm run typecheck && npm run lint`).
- [ ] Documentation updated where applicable.
- [ ] No real personal data, credentials, or `.env` files committed.

---

## 7. Privacy & Data Rules

- **Synthetic Fixtures**: All sample data in unit tests, mock handlers, and screenshots must be synthetic (e.g. sample sleep duration `459` minutes, date `2026-08-24`).
- **No Real Tokens**: Do not use real GitHub Personal Access Tokens or API keys even in test files. Use environment variable mocks.
- **Reporting Issues**: Never paste private health data or token logs into GitHub Issues or Pull Request descriptions.
