# Contributing to Personal Data OS

Thank you for your interest in contributing to **Personal Data OS**! We welcome contributions that align with our core architectural principles and privacy standards.

---

## 1. Core Principles

Before submitting code, please keep these directives in mind:
1. **Respect the Modular Monolith**: Do NOT introduce microservices, message queues (Kafka, RabbitMQ), distributed caches (Redis), or heavy ORMs (GORM, Ent).
2. **Explicit SQL with `sqlc`**: Database interactions use raw SQL migrations (`golang-migrate` format) and type-safe generated queries with `sqlc`.
3. **Vertical Slice Development**: Plan work as complete vertical product slices. Implementation may be split into focused database, backend, and frontend issues/PRs when they remain linked to a single parent feature.
4. **Zero Personal Data & Secrets**: Never commit real health records, personal datasets, API tokens, or `.env` files. All test fixtures must use synthetic data.
5. **No Scope Creep**: Keep pull requests small, focused, and tied to a single implementation issue. When the issue belongs to a larger feature, keep it linked to its parent feature and milestone.

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
2. Distinguish between:

   * **Parent feature issues**, which define complete user-facing capabilities and acceptance criteria.
   * **Implementation issues**, which define focused, PR-sized database, backend, frontend, testing, or documentation work.
3. Prefer working from an implementation issue when one exists.
4. Comment on the issue to state you are working on it before submitting a PR to avoid duplicate effort.
5. Keep implementation issues linked to their parent feature and milestone so the complete vertical slice remains traceable.
6. If proposing a new tracker or integration, first open an issue using the appropriate issue form (`tracker_proposal` or `integration_proposal`).


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

## 6. Definition of Done

A pull request is ready for review when all requirements relevant to its scope are complete.

### All PRs

* [ ] The PR addresses one focused implementation issue.
* [ ] The implementation matches the issue acceptance criteria.
* [ ] Relevant tests are added or updated and passing.
* [ ] Existing tests continue to pass.
* [ ] Formatting, linting, and static analysis pass for affected code.
* [ ] Documentation is updated where applicable.
* [ ] No unrelated refactoring or scope creep is included.
* [ ] No real personal data, credentials, API tokens, or `.env` files are committed.

### Database PRs

When the issue changes persistence or SQL:

* [ ] Reversible migrations (`.up.sql` and `.down.sql`) are added under `api/db/migrations/`.
* [ ] Explicit queries are added or updated under `api/db/queries/`.
* [ ] Generated `sqlc` code is refreshed with `sqlc generate`.
* [ ] Database constraints enforce applicable domain invariants.
* [ ] Database/query tests are added where appropriate.

### Backend / API PRs

When the issue changes backend behavior:

* [ ] Go domain/service/repository code is implemented in the appropriate package.
* [ ] HTTP handlers and validation are implemented where applicable.
* [ ] API errors follow the project's standard error format.
* [ ] Backend unit and/or integration tests are added and passing.
* [ ] `go test -race ./...` passes.
* [ ] `go vet ./...` passes.
* [ ] `docs/openapi/openapi.yaml` is updated when the public API contract changes.

### Frontend PRs

When the issue changes the web application:

* [ ] API client types, schemas, and TanStack Query hooks are updated where applicable.
* [ ] UI components and forms are implemented under the appropriate feature module.
* [ ] Loading, empty, validation, and error states are handled where applicable.
* [ ] Frontend tests are added or updated and passing.
* [ ] `npm run typecheck` passes.
* [ ] `npm run lint` passes.
* [ ] `npm test` passes.
* [ ] `npm run build` succeeds.

### Parent Feature Completion

A parent feature issue is complete only when:

* [ ] All required implementation issues are closed.
* [ ] The complete end-to-end user flow satisfies the parent acceptance criteria.
* [ ] Database, API, and UI behavior are consistent with one another where applicable.
* [ ] The public API contract and relevant documentation reflect the delivered feature.
* [ ] The integrated feature passes the repository CI pipeline.

---

## 7. Privacy & Data Rules

- **Synthetic Fixtures**: All sample data in unit tests, mock handlers, and screenshots must be synthetic (e.g. sample sleep duration `459` minutes, date `2026-08-24`).
- **No Real Tokens**: Do not use real GitHub Personal Access Tokens or API keys even in test files. Use environment variable mocks.
- **Reporting Issues**: Never paste private health data or token logs into GitHub Issues or Pull Request descriptions.
