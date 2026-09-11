package sleep

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"

	"personal-data-os/api/db/sqlc"
)

// ErrDuplicateDate is returned when attempting to create a sleep record for a date that already has one.
var ErrDuplicateDate = errors.New("a sleep record already exists for this date")

// CreateInput defines the domain input for creating a sleep record.
type CreateInput struct {
	Date     string
	Bedtime  string
	WakeTime string
	Quality  int16
	Notes    *string
}

// Service provides domain business operations for sleep tracking.
type Service struct {
	querier sqlc.Querier
}

// NewService constructs a new Sleep Service.
func NewService(querier sqlc.Querier) *Service {
	return &Service{querier: querier}
}

// Create validates and calculates server-controlled duration, persisting the sleep record via sqlc.
// It maps unique constraint violations on date to ErrDuplicateDate.
func (s *Service) Create(ctx context.Context, in CreateInput) (sqlc.SleepLog, error) {
	if s.querier == nil {
		return sqlc.SleepLog{}, errors.New("database querier is not initialized")
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

	log, err := s.querier.CreateSleepLog(ctx, params)
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
	if s.querier == nil {
		return nil, errors.New("database querier is not initialized")
	}

	params := sqlc.ListSleepLogsParams{
		Limit:  limit,
		Offset: offset,
	}

	records, err := s.querier.ListSleepLogs(ctx, params)
	if err != nil {
		return nil, err
	}

	if records == nil {
		records = []sqlc.SleepLog{}
	}

	return records, nil
}
