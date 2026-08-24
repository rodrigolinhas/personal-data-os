# Database Guide — Personal Data OS

This document covers the PostgreSQL database architecture, connection pooling, migrations, query tooling, and data modeling standards for **Personal Data OS**.

---

## 1. Overview

Personal Data OS uses **PostgreSQL 16** as its single, unified relational database engine.

Key characteristics:
- **ACID Transactions**: Guaranteeing atomic consistency for multi-table updates (e.g. Workouts -> Exercises -> Sets).
- **Connection Pooling**: Managed via `jackc/pgx/v5` (`pgxpool`) in `api/internal/database/`.
- **Explicit SQL**: No heavy ORMs (GORM, Ent). Pure SQL queries compiled with `sqlc`.
- **Deterministic Migrations**: Managed via `golang-migrate` versioned SQL files.

---

## 2. PostgreSQL Setup & Docker Compose

In local development, PostgreSQL runs via Docker Compose:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: personal_data_os_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-personal_data}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-change_me}
      POSTGRES_DB: ${POSTGRES_DB:-personal_data_os}
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-personal_data} -d ${POSTGRES_DB:-personal_data_os}"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
    driver: local
```

Data is persisted in the Docker volume `postgres_data`.

---

## 3. Migration Workflow (`golang-migrate`)

Migrations are located in `api/db/migrations/` and use standard numeric sequential prefixes:

```text
api/db/migrations/
  000001_create_sleep_logs.up.sql
  000001_create_sleep_logs.down.sql
  000002_create_books_and_reading.up.sql
  000002_create_books_and_reading.down.sql
```

### Migration Rules
1. Every `.up.sql` MUST have an accompanying `.down.sql` that cleanly reverses the migration.
2. Tables must use snake_case for table and column names.
3. Every table MUST define a primary key (`BIGSERIAL` or `UUID`), `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, and `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` where applicable.
4. Use CHECK constraints for numerical boundaries (e.g. `quality BETWEEN 1 AND 10`, `duration_minutes >= 0`).

---

## 4. `sqlc` Query Generation

`sqlc` parses explicit SQL queries in `api/db/queries/` against the schema in `api/db/migrations/` and generates type-safe Go code.

### Configuration (`api/sqlc.yaml`)
```yaml
version: "2"
sql:
  - schema: "db/migrations"
    queries: "db/queries"
    gen:
      go:
        package: "sqlc"
        out: "db/sqlc"
        sql_package: "pgx/v5"
        emit_json_tags: true
        emit_prepared_queries: false
        emit_interface: true
        emit_exact_table_names: false
```

### Query Annotation Standard
```sql
-- name: CreateSleepLog :one
INSERT INTO sleep_logs (
    date, bedtime, wake_time, duration_minutes, quality, notes
) VALUES (
    $1, $2, $3, $4, $5, $6
)
RETURNING *;

-- name: ListSleepLogs :many
SELECT * FROM sleep_logs
ORDER BY date DESC
LIMIT $1 OFFSET $2;
```

---

## 5. Data Privacy & Synthetic Testing

1. **Synthetic Data Only**: All test fixtures, seed data, and query examples must use synthetic/fictional data.
2. **Never Commit Real Databases**: Production database dumps, SQLite files, or personal backups must NEVER be added to version control.
3. **Connection Credentials**: Passwords and connection strings must remain in `.env` and never be committed.
