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

-- name: GetSleepStats :one
-- Aggregates sleep statistics for the last 7 and 30 calendar days in a single query.
-- 7-day window: [CURRENT_DATE - 6, CURRENT_DATE] inclusive (today + previous 6 days).
-- 30-day window: [CURRENT_DATE - 29, CURRENT_DATE] inclusive (today + previous 29 days).
-- Missing days are ignored; averages use only existing records as denominator.
-- Returns NULL averages when no records exist in a window (record_count = 0).
-- Future dates are explicitly excluded.
SELECT
    COUNT(CASE WHEN date >= CURRENT_DATE - 6 THEN 1 END) AS count_7d,
    AVG(CASE WHEN date >= CURRENT_DATE - 6 THEN duration_minutes::double precision END) AS avg_duration_7d,
    AVG(CASE WHEN date >= CURRENT_DATE - 6 THEN quality::double precision END) AS avg_quality_7d,
    COUNT(*) AS count_30d,
    AVG(duration_minutes::double precision) AS avg_duration_30d,
    AVG(quality::double precision) AS avg_quality_30d
FROM sleep_logs
WHERE date >= CURRENT_DATE - 29
  AND date <= CURRENT_DATE;


