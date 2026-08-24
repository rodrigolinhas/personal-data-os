# API Guide — Personal Data OS

This document outlines the REST API design conventions, response envelopes, error structures, and OpenAPI maintenance workflow for **Personal Data OS**.

---

## 1. API Namespaces & Routing

| Namespace | Purpose | Example |
| :--- | :--- | :--- |
| `/health` | Infrastructure liveness & process telemetry | `GET /health` |
| `/api/v1/*` | Business domain resources & operations | `POST /api/v1/sleep`, `GET /api/v1/books` |

### Design Rules
- **Resource Names**: Plural nouns in lower-case (e.g. `/api/v1/sleep` for sleep logs, `/api/v1/books` for books, `/api/v1/workouts` for workouts).
- **HTTP Verbs**:
  - `GET`: Retrieve resource or collection (safe, idempotent).
  - `POST`: Create new resource or trigger action (e.g. `/api/v1/github/sync`).
  - `PUT` / `PATCH`: Update resource.
  - `DELETE`: Remove resource.
- **Content Type**: `application/json` for all request and response bodies.

---

## 2. Health Endpoint (`/health`)

The health endpoint provides basic process liveness without querying the database on every request:

```http
GET /health
```

**Response (`200 OK`)**:
```json
{
  "status": "ok",
  "service": "personal-data-os-api",
  "version": "0.1.0"
}
```

---

## 3. Standard Error Response Format

When an API request fails, the server responds with an appropriate HTTP status code and a consistent JSON payload:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "quality must be an integer between 1 and 10",
    "details": [
      {
        "field": "quality",
        "issue": "must be <= 10"
      }
    ]
  }
}
```

### Common HTTP Status Codes
- `200 OK`: Request succeeded.
- `201 Created`: Resource successfully created.
- `400 Bad Request`: Validation failure or malformed JSON payload.
- `404 Not Found`: Resource ID or date not found.
- `409 Conflict`: Unique constraint violation (e.g. log already exists for date).
- `500 Internal Server Error`: Unexpected server error (internal details omitted in production).

---

## 4. OpenAPI 3.1 Specification

The official API contract is maintained in:
```text
docs/openapi/openapi.yaml
```

Every new endpoint added to `api/` must be documented in `docs/openapi/openapi.yaml` as part of its vertical slice implementation.

---

## 5. Endpoint Implementation Workflow

When adding a new endpoint:
1. Implement the service logic and validation in `api/internal/<domain>/`.
2. Implement the HTTP handler in `api/internal/http/`.
3. Mount the route under `r.Route("/api/v1", ...)` in `api/internal/http/router.go`.
4. Write handler tests using `net/http/httptest` in `api/internal/http/<domain>_handler_test.go`.
5. Update `docs/openapi/openapi.yaml`.
