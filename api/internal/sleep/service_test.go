package sleep_test

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"personal-data-os/api/db/sqlc"
	"personal-data-os/api/internal/sleep"
)

type mockQuerier struct {
	createFn func(ctx context.Context, arg sqlc.CreateSleepLogParams) (sqlc.SleepLog, error)
	listFn   func(ctx context.Context, arg sqlc.ListSleepLogsParams) ([]sqlc.SleepLog, error)
}

func (m *mockQuerier) CreateSleepLog(ctx context.Context, arg sqlc.CreateSleepLogParams) (sqlc.SleepLog, error) {
	if m.createFn != nil {
		return m.createFn(ctx, arg)
	}
	return sqlc.SleepLog{}, nil
}

func (m *mockQuerier) ListSleepLogs(ctx context.Context, arg sqlc.ListSleepLogsParams) ([]sqlc.SleepLog, error) {
	if m.listFn != nil {
		return m.listFn(ctx, arg)
	}
	return nil, nil
}

func TestService_Create_Success(t *testing.T) {
	notes := "synthetic test note"
	mock := &mockQuerier{
		createFn: func(ctx context.Context, arg sqlc.CreateSleepLogParams) (sqlc.SleepLog, error) {
			if arg.DurationMinutes != 450 {
				t.Errorf("expected duration 450, got %d", arg.DurationMinutes)
			}
			if arg.Quality != 8 {
				t.Errorf("expected quality 8, got %d", arg.Quality)
			}
			if !arg.Notes.Valid || arg.Notes.String != notes {
				t.Errorf("expected notes %s, got %v", notes, arg.Notes)
			}
			return sqlc.SleepLog{
				ID:              1,
				DurationMinutes: arg.DurationMinutes,
				Quality:         arg.Quality,
				Notes:           arg.Notes,
			}, nil
		},
	}

	svc := sleep.NewService(mock)
	in := sleep.CreateInput{
		Date:     "2026-09-11",
		Bedtime:  "23:30",
		WakeTime: "07:00",
		Quality:  8,
		Notes:    &notes,
	}

	record, err := svc.Create(context.Background(), in)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if record.ID != 1 {
		t.Errorf("expected ID 1, got %d", record.ID)
	}
	if record.DurationMinutes != 450 {
		t.Errorf("expected duration 450, got %d", record.DurationMinutes)
	}
}

func TestService_Create_DuplicateDate(t *testing.T) {
	mock := &mockQuerier{
		createFn: func(ctx context.Context, arg sqlc.CreateSleepLogParams) (sqlc.SleepLog, error) {
			return sqlc.SleepLog{}, &pgconn.PgError{
				Code:           "23505",
				ConstraintName: "sleep_logs_date_key",
			}
		},
	}

	svc := sleep.NewService(mock)
	in := sleep.CreateInput{
		Date:     "2026-09-11",
		Bedtime:  "23:30",
		WakeTime: "07:00",
		Quality:  8,
	}

	_, err := svc.Create(context.Background(), in)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !errors.Is(err, sleep.ErrDuplicateDate) {
		t.Fatalf("expected ErrDuplicateDate, got %v", err)
	}
}

func TestService_Create_DatabaseError(t *testing.T) {
	dbErr := errors.New("connection failed")
	mock := &mockQuerier{
		createFn: func(ctx context.Context, arg sqlc.CreateSleepLogParams) (sqlc.SleepLog, error) {
			return sqlc.SleepLog{}, dbErr
		},
	}

	svc := sleep.NewService(mock)
	in := sleep.CreateInput{
		Date:     "2026-09-11",
		Bedtime:  "23:30",
		WakeTime: "07:00",
		Quality:  8,
	}

	_, err := svc.Create(context.Background(), in)
	if !errors.Is(err, dbErr) {
		t.Fatalf("expected database error %v, got %v", dbErr, err)
	}
}

func TestService_Create_InvalidDate(t *testing.T) {
	svc := sleep.NewService(&mockQuerier{})
	in := sleep.CreateInput{
		Date:     "not-a-date",
		Bedtime:  "23:30",
		WakeTime: "07:00",
		Quality:  8,
	}

	_, err := svc.Create(context.Background(), in)
	if err == nil {
		t.Fatal("expected error for invalid date, got nil")
	}
}

func TestService_Create_EqualBedtimeWakeTime(t *testing.T) {
	svc := sleep.NewService(&mockQuerier{})
	in := sleep.CreateInput{
		Date:     "2026-09-11",
		Bedtime:  "08:00",
		WakeTime: "08:00",
		Quality:  8,
	}

	_, err := svc.Create(context.Background(), in)
	if !errors.Is(err, sleep.ErrEqualBedtimeWakeTime) {
		t.Fatalf("expected ErrEqualBedtimeWakeTime, got %v", err)
	}
}

func TestService_List_Success(t *testing.T) {
	mock := &mockQuerier{
		listFn: func(ctx context.Context, arg sqlc.ListSleepLogsParams) ([]sqlc.SleepLog, error) {
			if arg.Limit != 20 || arg.Offset != 0 {
				t.Errorf("unexpected params: limit=%d, offset=%d", arg.Limit, arg.Offset)
			}
			return []sqlc.SleepLog{
				{ID: 2, DurationMinutes: 480},
				{ID: 1, DurationMinutes: 450},
			}, nil
		},
	}

	svc := sleep.NewService(mock)
	records, err := svc.List(context.Background(), 20, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(records) != 2 {
		t.Fatalf("expected 2 records, got %d", len(records))
	}
}

func TestService_List_Empty(t *testing.T) {
	mock := &mockQuerier{
		listFn: func(ctx context.Context, arg sqlc.ListSleepLogsParams) ([]sqlc.SleepLog, error) {
			return nil, nil
		},
	}

	svc := sleep.NewService(mock)
	records, err := svc.List(context.Background(), 20, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if records == nil {
		t.Fatal("expected non-nil empty slice, got nil")
	}
	if len(records) != 0 {
		t.Fatalf("expected 0 records, got %d", len(records))
	}
}

func TestService_NilQuerier(t *testing.T) {
	svc := sleep.NewService(nil)
	_, err := svc.Create(context.Background(), sleep.CreateInput{
		Date:     "2026-09-11",
		Bedtime:  "23:30",
		WakeTime: "07:00",
		Quality:  8,
	})
	if err == nil {
		t.Fatal("expected error on nil querier, got nil")
	}

	_, err = svc.List(context.Background(), 20, 0)
	if err == nil {
		t.Fatal("expected error on nil querier, got nil")
	}
}
