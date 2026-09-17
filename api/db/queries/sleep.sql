-- Sleep Tracking queries for the Sleep Tracking module (Milestone 2, Issue #11).
-- Generated code lives in api/db/sqlc/ via: cd api && sqlc generate

-- name: CreateSleepLog :one
-- Inserts a new sleep record and returns the persisted row.
-- duration_minutes is calculated and supplied by the backend service (#12).
-- A unique constraint on date means a duplicate date raises a uniqueness violation
-- that #12 will translate into HTTP 409 Conflict.
INSERT INTO sleep_logs (
    date,
    bedtime,
    wake_time,
    duration_minutes,
    quality,
    notes
) VALUES (
    $1, $2, $3, $4, $5, $6
)
RETURNING *;

-- name: ListSleepLogs :many
-- Returns sleep records ordered newest first, with LIMIT/OFFSET pagination.
SELECT *
FROM sleep_logs
ORDER BY date DESC
LIMIT $1
OFFSET $2;

-- name: UpdateSleepLog :one
-- Updates an existing sleep record and returns the persisted row.
-- duration_minutes is recalculated and supplied by the backend service (#14).
UPDATE sleep_logs
SET
    date = $2,
    bedtime = $3,
    wake_time = $4,
    duration_minutes = $5,
    quality = $6,
    notes = $7,
    updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: DeleteSleepLog :execrows
-- Deletes a sleep record by id and returns the number of affected rows.
DELETE FROM sleep_logs
WHERE id = $1;

