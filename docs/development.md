# Local Development Guide — Personal Data OS

This document provides a comprehensive guide for setting up, developing, testing, and troubleshooting **Personal Data OS** on a local workstation.

---

## 1. Prerequisites

Before starting, ensure the following software is installed:
- **Git** (2.30+)
- **Docker & Docker Compose** (for PostgreSQL)
- **Go** (1.27+)
- **Node.js** (20+ LTS recommended, minimum 18+) and **npm** (9+)
- *(Optional)* **`sqlc`** (for regenerating Go query models from SQL)
- *(Optional)* **`golang-migrate`** CLI (for managing manual migration runs)

---

## 2. Initial Setup

### 1. Clone the Repository
```bash
git clone https://github.com/rodrigolinhas/personal-data-os.git
cd personal-data-os
```

### 2. Configure Environment Variables
Copy the template configuration file:
```bash
cp .env.example .env
```

Verify your `.env` contains:
```env
# Application Configuration
APP_ENV=development
API_PORT=8080

# PostgreSQL Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=personal_data_os
POSTGRES_USER=personal_data
POSTGRES_PASSWORD=change_me
POSTGRES_SSLMODE=disable
```

### 3. Start PostgreSQL with Docker Compose
```bash
docker compose up -d
```
Verify the container is running and healthy:
```bash
docker compose ps
```

---

## 3. Running the Backend API (`api/`)

```bash
cd api
go run ./cmd/api
```
The API starts on `http://localhost:8080`.

Verify the health check endpoint:
```bash
curl http://localhost:8080/health
# Response: {"status":"ok","service":"personal-data-os-api","version":"0.1.0"}
```

---

## 4. Running the Frontend Web App (`web/`)

In a separate terminal window:
```bash
cd web
npm install
npm run dev
```
The Vite development server starts on `http://localhost:5173`. Open your browser at `http://localhost:5173` to see the live telemetry interface.

---

## 5. Testing & Verification Workflows

### Backend Commands (`api/`)
```bash
cd api

# Run all unit and integration tests with race detection
go test -v -race ./...

# Run static analysis
go vet ./...

# Check code formatting
gofmt -l .

# Build API binary
go build -o bin/api ./cmd/api
```

### Frontend Commands (`web/`)
```bash
cd web

# Run TypeScript typecheck (strict noEmit)
npm run typecheck

# Run ESLint
npm run lint

# Run Vitest test suite
npm test

# Build production bundle
npm run build
```

---

## 6. Database Migrations & SQLC Workflow

### Creating a New Migration
Migrations follow the `golang-migrate` format in `api/db/migrations/`:
```text
api/db/migrations/
  000001_create_sleep_logs.up.sql
  000001_create_sleep_logs.down.sql
```

### Generating Type-Safe Queries with `sqlc`
1. Write explicit queries in `api/db/queries/<domain>.sql` with sqlc query annotations (e.g. `-- name: CreateSleepLog :one`).
2. Run code generation:
   ```bash
   cd api
   sqlc generate
   ```
3. Type-safe Go models and query executors are generated in `api/db/sqlc/`.

---

## 7. OpenAPI Workflow

1. Document new endpoints in `docs/openapi/openapi.yaml` (OpenAPI 3.1 format).
2. Ensure request schemas, response schemas, and error structures mirror your Go structs and TypeScript Zod schemas.

---

## 8. Troubleshooting

### Port Conflicts
- **Port 5432 (PostgreSQL)**: If port 5432 is already bound by a local PostgreSQL instance, either stop the local service or change `POSTGRES_PORT` in `.env` and `docker-compose.yml`.
- **Port 8080 (API)**: Set `API_PORT=8081` (or another free port) in `.env`.
- **Port 5173 (Vite)**: Vite will automatically suggest port 5174 if 5173 is occupied.

### Database Connection Failure
If the backend cannot connect to PostgreSQL:
1. Ensure the container is healthy: `docker compose ps`.
2. Check database logs: `docker compose logs postgres`.
3. Verify connection credentials in `.env` match `docker-compose.yml`.
