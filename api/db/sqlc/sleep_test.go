package sqlc_test

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	sqlcdb "personal-data-os/api/db/sqlc"
)

// connectTestDB returns a pgxpool connection configured via environment variables.
//
// Skip/fail strategy:
//   - If POSTGRES_HOST is unset and TCP to localhost:5432 fails, the test is
//     skipped. This preserves a good local developer experience where the DB
//     is simply not running.
//   - If POSTGRES_HOST is explicitly set in the environment (as it is in CI),
//     any failure — TCP, authentication, ping — is a hard test failure. A
//     configured integration environment must not silently pass with a skip.
func connectTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()

	host := os.Getenv("POSTGRES_HOST")
	explicitlyConfigured := host != ""
	if host == "" {
		host = "localhost"
	}
	port := envOrDefault("POSTGRES_PORT", "5432")
	user := envOrDefault("POSTGRES_USER", "personal_data")
	pass := envOrDefault("POSTGRES_PASSWORD", "change_me")
	db := envOrDefault("POSTGRES_DB", "personal_data_os")
	ssl := envOrDefault("POSTGRES_SSLMODE", "disable")

	// TCP probe: fast-fail before attempting a full connection.
	conn, err := net.DialTimeout("tcp", net.JoinHostPort(host, port), 2*time.Second)
	if err != nil {
		if explicitlyConfigured {
			t.Fatalf("POSTGRES_HOST is set but PostgreSQL is not reachable at %s:%s: %v", host, port, err)
		}
		t.Skipf("PostgreSQL not reachable at %s:%s — skipping integration test: %v", host, port, err)
	}
	conn.Close()

	connStr := fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=%s",
		user, pass, host, port, db, ssl,
	)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, connStr)
	if err != nil {
		// Pool creation only parses config; treat as fatal in all cases because
		// a malformed connection string is always a configuration error.
		t.Fatalf("Failed to create connection pool (%s:%s): %v", host, port, err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		if explicitlyConfigured {
			t.Fatalf("POSTGRES_HOST is set but ping failed (%s:%s): %v", host, port, err)
		}
		t.Skipf("PostgreSQL ping failed at %s:%s — skipping integration test: %v", host, port, err)
	}

	return pool
}

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// cleanSleepLogs truncates the table to ensure test isolation.
func cleanSleepLogs(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	_, err := pool.Exec(context.Background(), "TRUNCATE TABLE sleep_logs RESTART IDENTITY")
	if err != nil {
		t.Fatalf("Failed to clean sleep_logs: %v", err)
	}
}

// syntheticDate builds a pgtype.Date from year/month/day.
func syntheticDate(year int, month time.Month, day int) pgtype.Date {
	t := time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
	return pgtype.Date{Time: t, Valid: true}
}

// syntheticTime builds a pgtype.Time from hour/minute (microseconds since midnight).
func syntheticTime(hour, minute int) pgtype.Time {
	micros := int64(hour)*3_600_000_000 + int64(minute)*60_000_000
	return pgtype.Time{Microseconds: micros, Valid: true}
}

// syntheticText wraps a string as a valid pgtype.Text.
func syntheticText(s string) pgtype.Text {
	return pgtype.Text{String: s, Valid: true}
}

// TestCreateSleepLog_ValidRecord verifies that a valid record is inserted and returned.
func TestCreateSleepLog_ValidRecord(t *testing.T) {
	pool := connectTestDB(t)
	defer pool.Close()
	cleanSleepLogs(t, pool)

	q := sqlcdb.New(pool)
	ctx := context.Background()

	params := sqlcdb.CreateSleepLogParams{
		Date:            syntheticDate(2026, 8, 24),
		Bedtime:         syntheticTime(23, 21),
		WakeTime:        syntheticTime(6, 58),
		DurationMinutes: 457,
		Quality:         8,
		Notes:           syntheticText("synthetic test record"),
	}

	log, err := q.CreateSleepLog(ctx, params)
	if err != nil {
		t.Fatalf("CreateSleepLog failed: %v", err)
	}

	if log.ID <= 0 {
		t.Errorf("Expected positive ID, got %d", log.ID)
	}
	if log.DurationMinutes != 457 {
		t.Errorf("Expected duration 457, got %d", log.DurationMinutes)
	}
	if log.Quality != 8 {
		t.Errorf("Expected quality 8, got %d", log.Quality)
	}
	if !log.Notes.Valid || log.Notes.String != "synthetic test record" {
		t.Errorf("Unexpected notes: %+v", log.Notes)
	}
	if !log.CreatedAt.Valid {
		t.Error("Expected created_at to be populated")
	}
	if !log.UpdatedAt.Valid {
		t.Error("Expected updated_at to be populated")
	}
}

// TestCreateSleepLog_NullNotes verifies that NULL notes are accepted.
func TestCreateSleepLog_NullNotes(t *testing.T) {
	pool := connectTestDB(t)
	defer pool.Close()
	cleanSleepLogs(t, pool)

	q := sqlcdb.New(pool)
	ctx := context.Background()

	params := sqlcdb.CreateSleepLogParams{
		Date:            syntheticDate(2026, 8, 24),
		Bedtime:         syntheticTime(23, 0),
		WakeTime:        syntheticTime(7, 0),
		DurationMinutes: 480,
		Quality:         7,
		Notes:           pgtype.Text{Valid: false}, // NULL
	}

	log, err := q.CreateSleepLog(ctx, params)
	if err != nil {
		t.Fatalf("CreateSleepLog with NULL notes failed: %v", err)
	}
	if log.Notes.Valid {
		t.Errorf("Expected NULL notes, got %q", log.Notes.String)
	}
}

// TestCreateSleepLog_DuplicateDate verifies that a duplicate date is rejected
// and that PostgreSQL raises the named unique constraint (SQLSTATE 23505,
// ConstraintName "sleep_logs_date_key").
func TestCreateSleepLog_DuplicateDate(t *testing.T) {
	pool := connectTestDB(t)
	defer pool.Close()
	cleanSleepLogs(t, pool)

	q := sqlcdb.New(pool)
	ctx := context.Background()

	params := sqlcdb.CreateSleepLogParams{
		Date:            syntheticDate(2026, 8, 24),
		Bedtime:         syntheticTime(23, 0),
		WakeTime:        syntheticTime(7, 0),
		DurationMinutes: 480,
		Quality:         7,
	}

	if _, err := q.CreateSleepLog(ctx, params); err != nil {
		t.Fatalf("First insert failed: %v", err)
	}

	_, err := q.CreateSleepLog(ctx, params)
	if err == nil {
		t.Fatal("Expected duplicate date to be rejected, but insert succeeded")
	}

	// Use structured pgx/PostgreSQL error inspection instead of string matching.
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) {
		t.Fatalf("Expected a *pgconn.PgError, got %T: %v", err, err)
	}
	// SQLSTATE 23505 = unique_violation
	if pgErr.Code != "23505" {
		t.Errorf("Expected SQLSTATE 23505 (unique_violation), got %q", pgErr.Code)
	}
	if pgErr.ConstraintName != "sleep_logs_date_key" {
		t.Errorf("Expected ConstraintName %q, got %q", "sleep_logs_date_key", pgErr.ConstraintName)
	}
}

// TestCreateSleepLog_QualityBoundaries verifies quality 1 and 10 are accepted;
// quality 0 and 11 are rejected.
func TestCreateSleepLog_QualityBoundaries(t *testing.T) {
	pool := connectTestDB(t)
	defer pool.Close()

	q := sqlcdb.New(pool)
	ctx := context.Background()

	cases := []struct {
		name    string
		date    pgtype.Date
		quality int16
		wantErr bool
	}{
		{"quality_1_accepted", syntheticDate(2026, 8, 24), 1, false},
		{"quality_10_accepted", syntheticDate(2026, 8, 25), 10, false},
		{"quality_0_rejected", syntheticDate(2026, 8, 26), 0, true},
		{"quality_11_rejected", syntheticDate(2026, 8, 27), 11, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cleanSleepLogs(t, pool)
			params := sqlcdb.CreateSleepLogParams{
				Date:            tc.date,
				Bedtime:         syntheticTime(23, 0),
				WakeTime:        syntheticTime(7, 0),
				DurationMinutes: 480,
				Quality:         tc.quality,
			}
			_, err := q.CreateSleepLog(ctx, params)
			if tc.wantErr && err == nil {
				t.Errorf("Expected error for quality %d, got nil", tc.quality)
			}
			if !tc.wantErr && err != nil {
				t.Errorf("Expected no error for quality %d, got: %v", tc.quality, err)
			}
		})
	}
}

// TestCreateSleepLog_DurationBoundaries verifies duration > 0 is required.
func TestCreateSleepLog_DurationBoundaries(t *testing.T) {
	pool := connectTestDB(t)
	defer pool.Close()

	q := sqlcdb.New(pool)
	ctx := context.Background()

	cases := []struct {
		name            string
		durationMinutes int32
		wantErr         bool
	}{
		{"positive_duration_accepted", 1, false},
		{"zero_duration_rejected", 0, true},
		{"negative_duration_rejected", -1, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cleanSleepLogs(t, pool)
			params := sqlcdb.CreateSleepLogParams{
				Date:            syntheticDate(2026, 8, 24),
				Bedtime:         syntheticTime(23, 0),
				WakeTime:        syntheticTime(7, 0),
				DurationMinutes: tc.durationMinutes,
				Quality:         7,
			}
			_, err := q.CreateSleepLog(ctx, params)
			if tc.wantErr && err == nil {
				t.Errorf("Expected error for duration %d, got nil", tc.durationMinutes)
			}
			if !tc.wantErr && err != nil {
				t.Errorf("Expected no error for duration %d, got: %v", tc.durationMinutes, err)
			}
		})
	}
}

// TestListSleepLogs_EmptyTable verifies that listing an empty table returns zero records.
func TestListSleepLogs_EmptyTable(t *testing.T) {
	pool := connectTestDB(t)
	defer pool.Close()
	cleanSleepLogs(t, pool)

	q := sqlcdb.New(pool)
	logs, err := q.ListSleepLogs(context.Background(), sqlcdb.ListSleepLogsParams{Limit: 10, Offset: 0})
	if err != nil {
		t.Fatalf("ListSleepLogs failed: %v", err)
	}
	if len(logs) != 0 {
		t.Errorf("Expected 0 records from empty table, got %d", len(logs))
	}
}

// TestListSleepLogs_NewestFirst verifies that records are ordered by date DESC.
func TestListSleepLogs_NewestFirst(t *testing.T) {
	pool := connectTestDB(t)
	defer pool.Close()
	cleanSleepLogs(t, pool)

	q := sqlcdb.New(pool)
	ctx := context.Background()

	// Insert in ascending date order; expect list returns descending.
	dates := []struct {
		year, day int
		month     time.Month
	}{
		{2026, 24, time.August},
		{2026, 25, time.August},
		{2026, 27, time.August},
	}
	for i, d := range dates {
		_, err := q.CreateSleepLog(ctx, sqlcdb.CreateSleepLogParams{
			Date:            syntheticDate(d.year, d.month, d.day),
			Bedtime:         syntheticTime(23, 0),
			WakeTime:        syntheticTime(7, 0),
			DurationMinutes: int32(400 + i*10),
			Quality:         int16(5 + i),
		})
		if err != nil {
			t.Fatalf("Insert failed for date %d/%d/%d: %v", d.year, d.month, d.day, err)
		}
	}

	logs, err := q.ListSleepLogs(ctx, sqlcdb.ListSleepLogsParams{Limit: 10, Offset: 0})
	if err != nil {
		t.Fatalf("ListSleepLogs failed: %v", err)
	}
	if len(logs) != 3 {
		t.Fatalf("Expected 3 records, got %d", len(logs))
	}

	// First record should be the newest date (2026-08-27).
	if logs[0].Date.Time.Day() != 27 {
		t.Errorf("Expected newest record first (day 27), got day %d", logs[0].Date.Time.Day())
	}
	// Last record should be the oldest (2026-08-24).
	if logs[2].Date.Time.Day() != 24 {
		t.Errorf("Expected oldest record last (day 24), got day %d", logs[2].Date.Time.Day())
	}
}

// TestListSleepLogs_Limit verifies that LIMIT is respected.
func TestListSleepLogs_Limit(t *testing.T) {
	pool := connectTestDB(t)
	defer pool.Close()
	cleanSleepLogs(t, pool)

	q := sqlcdb.New(pool)
	ctx := context.Background()

	for i := 24; i <= 27; i++ {
		_, err := q.CreateSleepLog(ctx, sqlcdb.CreateSleepLogParams{
			Date:            syntheticDate(2026, time.August, i),
			Bedtime:         syntheticTime(23, 0),
			WakeTime:        syntheticTime(7, 0),
			DurationMinutes: 480,
			Quality:         7,
		})
		if err != nil {
			t.Fatalf("Insert failed: %v", err)
		}
	}

	logs, err := q.ListSleepLogs(ctx, sqlcdb.ListSleepLogsParams{Limit: 2, Offset: 0})
	if err != nil {
		t.Fatalf("ListSleepLogs failed: %v", err)
	}
	if len(logs) != 2 {
		t.Errorf("Expected exactly 2 records with LIMIT 2, got %d", len(logs))
	}
}

// TestListSleepLogs_Offset verifies that OFFSET skips the correct records.
func TestListSleepLogs_Offset(t *testing.T) {
	pool := connectTestDB(t)
	defer pool.Close()
	cleanSleepLogs(t, pool)

	q := sqlcdb.New(pool)
	ctx := context.Background()

	// Insert 3 records for days 24, 25, 27 (newest-first order will be 27, 25, 24).
	for _, day := range []int{24, 25, 27} {
		_, err := q.CreateSleepLog(ctx, sqlcdb.CreateSleepLogParams{
			Date:            syntheticDate(2026, time.August, day),
			Bedtime:         syntheticTime(23, 0),
			WakeTime:        syntheticTime(7, 0),
			DurationMinutes: 480,
			Quality:         7,
		})
		if err != nil {
			t.Fatalf("Insert failed: %v", err)
		}
	}

	// With OFFSET 1, should skip the first (newest) record (day 27).
	logs, err := q.ListSleepLogs(ctx, sqlcdb.ListSleepLogsParams{Limit: 10, Offset: 1})
	if err != nil {
		t.Fatalf("ListSleepLogs failed: %v", err)
	}
	if len(logs) != 2 {
		t.Fatalf("Expected 2 records with OFFSET 1, got %d", len(logs))
	}
	// First result after skipping newest (day 27) should be day 25.
	if logs[0].Date.Time.Day() != 25 {
		t.Errorf("Expected day 25 after OFFSET 1, got day %d", logs[0].Date.Time.Day())
	}
}
