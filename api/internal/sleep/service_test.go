package sleep_test

import (
	"context"
	"errors"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"personal-data-os/api/db/sqlc"
	"personal-data-os/api/internal/sleep"
)

type mockQuerier struct {
	createFn func(ctx context.Context, arg sqlc.CreateSleepLogParams) (sqlc.SleepLog, error)
	listFn   func(ctx context.Context, arg sqlc.ListSleepLogsParams) ([]sqlc.SleepLog, error)
	updateFn func(ctx context.Context, arg sqlc.UpdateSleepLogParams) (sqlc.SleepLog, error)
	deleteFn func(ctx context.Context, id int64) (int64, error)
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

func (m *mockQuerier) UpdateSleepLog(ctx context.Context, arg sqlc.UpdateSleepLogParams) (sqlc.SleepLog, error) {
	if m.updateFn != nil {
		return m.updateFn(ctx, arg)
	}
	return sqlc.SleepLog{}, nil
}

func (m *mockQuerier) DeleteSleepLog(ctx context.Context, id int64) (int64, error) {
	if m.deleteFn != nil {
		return m.deleteFn(ctx, id)
	}
	return 0, nil
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

	_, err = svc.Update(context.Background(), 1, sleep.UpdateInput{
		Date:     "2026-09-11",
		Bedtime:  "23:30",
		WakeTime: "07:00",
		Quality:  8,
	})
	if err == nil {
		t.Fatal("expected error on nil querier (Update), got nil")
	}

	err = svc.Delete(context.Background(), 1)
	if err == nil {
		t.Fatal("expected error on nil querier (Delete), got nil")
	}
}

// --- Update service tests ---

func TestService_Update_Success(t *testing.T) {
	notes := "updated synthetic note"
	mock := &mockQuerier{
		updateFn: func(ctx context.Context, arg sqlc.UpdateSleepLogParams) (sqlc.SleepLog, error) {
			// 23:30 -> 07:00 = 450 minutes
			if arg.DurationMinutes != 450 {
				t.Errorf("expected duration 450, got %d", arg.DurationMinutes)
			}
			if arg.ID != 10 {
				t.Errorf("expected ID 10, got %d", arg.ID)
			}
			if arg.Quality != 9 {
				t.Errorf("expected quality 9, got %d", arg.Quality)
			}
			if !arg.Notes.Valid || arg.Notes.String != notes {
				t.Errorf("expected notes %q, got %v", notes, arg.Notes)
			}
			return sqlc.SleepLog{
				ID:              arg.ID,
				DurationMinutes: arg.DurationMinutes,
				Quality:         arg.Quality,
				Notes:           arg.Notes,
			}, nil
		},
	}

	svc := sleep.NewService(mock)
	record, err := svc.Update(context.Background(), 10, sleep.UpdateInput{
		Date:     "2026-09-11",
		Bedtime:  "23:30",
		WakeTime: "07:00",
		Quality:  9,
		Notes:    &notes,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if record.ID != 10 {
		t.Errorf("expected ID 10, got %d", record.ID)
	}
	if record.DurationMinutes != 450 {
		t.Errorf("expected duration 450, got %d", record.DurationMinutes)
	}
}

func TestService_Update_DurationRecalculated(t *testing.T) {
	// 01:00 -> 08:00 = 420 minutes (same-day sleep)
	var capturedDuration int32
	mock := &mockQuerier{
		updateFn: func(ctx context.Context, arg sqlc.UpdateSleepLogParams) (sqlc.SleepLog, error) {
			capturedDuration = arg.DurationMinutes
			return sqlc.SleepLog{DurationMinutes: arg.DurationMinutes}, nil
		},
	}

	svc := sleep.NewService(mock)
	_, err := svc.Update(context.Background(), 1, sleep.UpdateInput{
		Date:     "2026-09-11",
		Bedtime:  "01:00",
		WakeTime: "08:00",
		Quality:  7,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if capturedDuration != 420 {
		t.Errorf("expected recalculated duration 420, got %d", capturedDuration)
	}
}

func TestService_Update_NotFound(t *testing.T) {
	mock := &mockQuerier{
		updateFn: func(ctx context.Context, arg sqlc.UpdateSleepLogParams) (sqlc.SleepLog, error) {
			return sqlc.SleepLog{}, pgx.ErrNoRows
		},
	}

	svc := sleep.NewService(mock)
	_, err := svc.Update(context.Background(), 99999, sleep.UpdateInput{
		Date:     "2026-09-11",
		Bedtime:  "23:30",
		WakeTime: "07:00",
		Quality:  8,
	})
	if !errors.Is(err, sleep.ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestService_Update_DuplicateDate(t *testing.T) {
	mock := &mockQuerier{
		updateFn: func(ctx context.Context, arg sqlc.UpdateSleepLogParams) (sqlc.SleepLog, error) {
			return sqlc.SleepLog{}, &pgconn.PgError{
				Code:           "23505",
				ConstraintName: "sleep_logs_date_key",
			}
		},
	}

	svc := sleep.NewService(mock)
	_, err := svc.Update(context.Background(), 1, sleep.UpdateInput{
		Date:     "2026-09-12",
		Bedtime:  "23:30",
		WakeTime: "07:00",
		Quality:  8,
	})
	if !errors.Is(err, sleep.ErrDuplicateDate) {
		t.Fatalf("expected ErrDuplicateDate, got %v", err)
	}
}

func TestService_Update_DatabaseError(t *testing.T) {
	dbErr := errors.New("unexpected db failure")
	mock := &mockQuerier{
		updateFn: func(ctx context.Context, arg sqlc.UpdateSleepLogParams) (sqlc.SleepLog, error) {
			return sqlc.SleepLog{}, dbErr
		},
	}

	svc := sleep.NewService(mock)
	_, err := svc.Update(context.Background(), 1, sleep.UpdateInput{
		Date:     "2026-09-11",
		Bedtime:  "23:30",
		WakeTime: "07:00",
		Quality:  8,
	})
	if !errors.Is(err, dbErr) {
		t.Fatalf("expected db error, got %v", err)
	}
}

func TestService_Update_EqualBedtimeWakeTime(t *testing.T) {
	svc := sleep.NewService(&mockQuerier{})
	_, err := svc.Update(context.Background(), 1, sleep.UpdateInput{
		Date:     "2026-09-11",
		Bedtime:  "08:00",
		WakeTime: "08:00",
		Quality:  8,
	})
	if !errors.Is(err, sleep.ErrEqualBedtimeWakeTime) {
		t.Fatalf("expected ErrEqualBedtimeWakeTime, got %v", err)
	}
}

func TestService_Update_InvalidDate(t *testing.T) {
	svc := sleep.NewService(&mockQuerier{})
	_, err := svc.Update(context.Background(), 1, sleep.UpdateInput{
		Date:     "not-a-date",
		Bedtime:  "23:30",
		WakeTime: "07:00",
		Quality:  8,
	})
	if err == nil {
		t.Fatal("expected error for invalid date, got nil")
	}
}

// --- Delete service tests ---

func TestService_Delete_Success(t *testing.T) {
	mock := &mockQuerier{
		deleteFn: func(ctx context.Context, id int64) (int64, error) {
			if id != 5 {
				t.Errorf("expected id 5, got %d", id)
			}
			return 1, nil
		},
	}

	svc := sleep.NewService(mock)
	if err := svc.Delete(context.Background(), 5); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
}

func TestService_Delete_NotFound(t *testing.T) {
	mock := &mockQuerier{
		deleteFn: func(ctx context.Context, id int64) (int64, error) {
			return 0, nil
		},
	}

	svc := sleep.NewService(mock)
	err := svc.Delete(context.Background(), 99999)
	if !errors.Is(err, sleep.ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestService_Delete_DatabaseError(t *testing.T) {
	dbErr := errors.New("db connection lost")
	mock := &mockQuerier{
		deleteFn: func(ctx context.Context, id int64) (int64, error) {
			return 0, dbErr
		},
	}

	svc := sleep.NewService(mock)
	err := svc.Delete(context.Background(), 1)
	if !errors.Is(err, dbErr) {
		t.Fatalf("expected db error, got %v", err)
	}
}
