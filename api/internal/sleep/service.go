package sleep

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"personal-data-os/api/db/sqlc"
)

// ErrDuplicateDate is returned when attempting to create or update a sleep record for a date that already has one.
var ErrDuplicateDate = errors.New("a sleep record already exists for this date")

// ErrNotFound is returned when attempting to update or delete a non-existent sleep record.
var ErrNotFound = errors.New("sleep record not found")

// Store defines the data-access methods required by the Sleep Service.
// This is a consumer-owned interface containing only the methods the service
// actually needs, decoupling it from the full generated sqlc.Querier.
type Store interface {
	CreateSleepLog(ctx context.Context, arg sqlc.CreateSleepLogParams) (sqlc.SleepLog, error)
	ListSleepLogs(ctx context.Context, arg sqlc.ListSleepLogsParams) ([]sqlc.SleepLog, error)
	UpdateSleepLog(ctx context.Context, arg sqlc.UpdateSleepLogParams) (sqlc.SleepLog, error)
	DeleteSleepLog(ctx context.Context, id int64) (int64, error)
	GetSleepStats(ctx context.Context) (sqlc.GetSleepStatsRow, error)
}

// CreateInput defines the domain input for creating a sleep record.
type CreateInput struct {
	Date     string
	Bedtime  string
	WakeTime string
	Quality  int16
	Notes    *string
}

// UpdateInput defines the domain input for updating an existing sleep record.
type UpdateInput struct {
	Date     string
	Bedtime  string
	WakeTime string
	Quality  int16
	Notes    *string
}

// StatsSummary holds aggregate statistics for a calendar-date window.
type StatsSummary struct {
	AverageDurationMinutes *float64
	AverageQuality         *float64
	RecordCount            int64
}

// Stats holds sleep statistics for both the 7-day and 30-day windows.
type Stats struct {
	Last7Days  StatsSummary
	Last30Days StatsSummary
}

// Service provides domain business operations for sleep tracking.
type Service struct {
	store Store
}

// NewService constructs a new Sleep Service.
func NewService(store Store) *Service {
	return &Service{store: store}
}

// Create validates and calculates server-controlled duration, persisting the sleep record via sqlc.
// It maps unique constraint violations on date to ErrDuplicateDate.
func (s *Service) Create(ctx context.Context, in CreateInput) (sqlc.SleepLog, error) {
	if s.store == nil {
		return sqlc.SleepLog{}, errors.New("database store is not initialized")
	}

	durationMinutes, err := CalculateDuration(in.Bedtime, in.WakeTime)
	if err != nil {
		return sqlc.SleepLog{}, err
	}

	parsedDate, err := time.Parse("2006-01-02", in.Date)
	if err != nil {
		return sqlc.SleepLog{}, fmt.Errorf("invalid date format, expected YYYY-MM-DD: %w", err)
	}

	bedHour, bedMin, bedSec, err := ParseTimeOfDay(in.Bedtime)
	if err != nil {
		return sqlc.SleepLog{}, err
	}

	wakeHour, wakeMin, wakeSec, err := ParseTimeOfDay(in.WakeTime)
	if err != nil {
		return sqlc.SleepLog{}, err
	}

	bedMicros := int64(bedHour)*3_600_000_000 + int64(bedMin)*60_000_000 + int64(bedSec)*1_000_000
	wakeMicros := int64(wakeHour)*3_600_000_000 + int64(wakeMin)*60_000_000 + int64(wakeSec)*1_000_000

	var notesText pgtype.Text
	if in.Notes != nil {
		notesText = pgtype.Text{String: *in.Notes, Valid: true}
	}

	params := sqlc.CreateSleepLogParams{
		Date:            pgtype.Date{Time: parsedDate, Valid: true},
		Bedtime:         pgtype.Time{Microseconds: bedMicros, Valid: true},
		WakeTime:        pgtype.Time{Microseconds: wakeMicros, Valid: true},
		DurationMinutes: durationMinutes,
		Quality:         in.Quality,
		Notes:           notesText,
	}

	log, err := s.store.CreateSleepLog(ctx, params)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == "sleep_logs_date_key" {
			return sqlc.SleepLog{}, ErrDuplicateDate
		}
		return sqlc.SleepLog{}, err
	}

	return log, nil
}

// List returns sleep records with limit and offset pagination.
func (s *Service) List(ctx context.Context, limit, offset int32) ([]sqlc.SleepLog, error) {
	if s.store == nil {
		return nil, errors.New("database store is not initialized")
	}

	params := sqlc.ListSleepLogsParams{
		Limit:  limit,
		Offset: offset,
	}

	records, err := s.store.ListSleepLogs(ctx, params)
	if err != nil {
		return nil, err
	}

	if records == nil {
		records = []sqlc.SleepLog{}
	}

	return records, nil
}

// Update validates and recalculates duration, updating the sleep record via sqlc.
// It maps pgx.ErrNoRows to ErrNotFound, and unique constraint violations on date to ErrDuplicateDate.
func (s *Service) Update(ctx context.Context, id int64, in UpdateInput) (sqlc.SleepLog, error) {
	if s.store == nil {
		return sqlc.SleepLog{}, errors.New("database store is not initialized")
	}

	durationMinutes, err := CalculateDuration(in.Bedtime, in.WakeTime)
	if err != nil {
		return sqlc.SleepLog{}, err
	}

	parsedDate, err := time.Parse("2006-01-02", in.Date)
	if err != nil {
		return sqlc.SleepLog{}, fmt.Errorf("invalid date format, expected YYYY-MM-DD: %w", err)
	}

	bedHour, bedMin, bedSec, err := ParseTimeOfDay(in.Bedtime)
	if err != nil {
		return sqlc.SleepLog{}, err
	}

	wakeHour, wakeMin, wakeSec, err := ParseTimeOfDay(in.WakeTime)
	if err != nil {
		return sqlc.SleepLog{}, err
	}

	bedMicros := int64(bedHour)*3_600_000_000 + int64(bedMin)*60_000_000 + int64(bedSec)*1_000_000
	wakeMicros := int64(wakeHour)*3_600_000_000 + int64(wakeMin)*60_000_000 + int64(wakeSec)*1_000_000

	var notesText pgtype.Text
	if in.Notes != nil {
		notesText = pgtype.Text{String: *in.Notes, Valid: true}
	}

	params := sqlc.UpdateSleepLogParams{
		ID:              id,
		Date:            pgtype.Date{Time: parsedDate, Valid: true},
		Bedtime:         pgtype.Time{Microseconds: bedMicros, Valid: true},
		WakeTime:        pgtype.Time{Microseconds: wakeMicros, Valid: true},
		DurationMinutes: durationMinutes,
		Quality:         in.Quality,
		Notes:           notesText,
	}

	log, err := s.store.UpdateSleepLog(ctx, params)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return sqlc.SleepLog{}, ErrNotFound
		}
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" && pgErr.ConstraintName == "sleep_logs_date_key" {
			return sqlc.SleepLog{}, ErrDuplicateDate
		}
		return sqlc.SleepLog{}, err
	}

	return log, nil
}

// Delete removes a sleep record by id.
// It returns ErrNotFound if no row was deleted.
func (s *Service) Delete(ctx context.Context, id int64) error {
	if s.store == nil {
		return errors.New("database store is not initialized")
	}

	rowsAffected, err := s.store.DeleteSleepLog(ctx, id)
	if err != nil {
		return err
	}

	if rowsAffected == 0 {
		return ErrNotFound
	}

	return nil
}

// Stats retrieves aggregated sleep statistics for both the 7-day and 30-day windows.
// It maps generated pgtype.Float8 nullable values to domain *float64 pointers,
// preserving null averages when no records exist in a window.
func (s *Service) Stats(ctx context.Context) (Stats, error) {
	if s.store == nil {
		return Stats{}, errors.New("database store is not initialized")
	}

	row, err := s.store.GetSleepStats(ctx)
	if err != nil {
		return Stats{}, err
	}

	return Stats{
		Last7Days: StatsSummary{
			AverageDurationMinutes: float8ToPtr(row.AvgDuration7d),
			AverageQuality:         float8ToPtr(row.AvgQuality7d),
			RecordCount:            row.Count7d,
		},
		Last30Days: StatsSummary{
			AverageDurationMinutes: float8ToPtr(row.AvgDuration30d),
			AverageQuality:         float8ToPtr(row.AvgQuality30d),
			RecordCount:            row.Count30d,
		},
	}, nil
}

// float8ToPtr converts a pgtype.Float8 to a *float64.
// Returns nil when the database value is NULL (Valid == false).
func float8ToPtr(f pgtype.Float8) *float64 {
	if !f.Valid {
		return nil
	}
	return &f.Float64
}
