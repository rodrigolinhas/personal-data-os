package http

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"personal-data-os/api/db/sqlc"
	"personal-data-os/api/internal/sleep"
)

type mockSleepService struct {
	createFn func(ctx context.Context, in sleep.CreateInput) (sqlc.SleepLog, error)
	listFn   func(ctx context.Context, limit, offset int32) ([]sqlc.SleepLog, error)
	updateFn func(ctx context.Context, id int64, in sleep.UpdateInput) (sqlc.SleepLog, error)
	deleteFn func(ctx context.Context, id int64) error
}

func (m *mockSleepService) Create(ctx context.Context, in sleep.CreateInput) (sqlc.SleepLog, error) {
	if m.createFn != nil {
		return m.createFn(ctx, in)
	}
	return sqlc.SleepLog{}, nil
}

func (m *mockSleepService) List(ctx context.Context, limit, offset int32) ([]sqlc.SleepLog, error) {
	if m.listFn != nil {
		return m.listFn(ctx, limit, offset)
	}
	return []sqlc.SleepLog{}, nil
}

func (m *mockSleepService) Update(ctx context.Context, id int64, in sleep.UpdateInput) (sqlc.SleepLog, error) {
	if m.updateFn != nil {
		return m.updateFn(ctx, id, in)
	}
	return sqlc.SleepLog{}, nil
}

func (m *mockSleepService) Delete(ctx context.Context, id int64) error {
	if m.deleteFn != nil {
		return m.deleteFn(ctx, id)
	}
	return nil
}

func syntheticSleepLog(id int64, date string, bedMicros, wakeMicros int64, duration int32, quality int16, notes *string) sqlc.SleepLog {
	d, _ := time.Parse("2006-01-02", date)
	now := time.Now().UTC()
	var n pgtype.Text
	if notes != nil {
		n = pgtype.Text{String: *notes, Valid: true}
	}
	return sqlc.SleepLog{
		ID:              id,
		Date:            pgtype.Date{Time: d, Valid: true},
		Bedtime:         pgtype.Time{Microseconds: bedMicros, Valid: true},
		WakeTime:        pgtype.Time{Microseconds: wakeMicros, Valid: true},
		DurationMinutes: duration,
		Quality:         quality,
		Notes:           n,
		CreatedAt:       pgtype.Timestamptz{Time: now, Valid: true},
		UpdatedAt:       pgtype.Timestamptz{Time: now, Valid: true},
	}
}

func TestSleepHandler_Create(t *testing.T) {
	tests := []struct {
		name           string
		requestBody    string
		serviceFn      func(ctx context.Context, in sleep.CreateInput) (sqlc.SleepLog, error)
		expectedStatus int
		verifyResponse func(t *testing.T, body []byte)
	}{
		{
			name:        "Valid overnight sleep record",
			requestBody: `{"date":"2026-09-11","bedtime":"23:30","wake_time":"07:00","quality":8,"notes":"synthetic record"}`,
			serviceFn: func(ctx context.Context, in sleep.CreateInput) (sqlc.SleepLog, error) {
				note := "synthetic record"
				// 23:30 = 84600s = 84600000000 micros; 07:00 = 25200s = 25200000000 micros
				return syntheticSleepLog(1, in.Date, 84600000000, 25200000000, 450, in.Quality, &note), nil
			},
			expectedStatus: http.StatusCreated,
			verifyResponse: func(t *testing.T, body []byte) {
				var resp SleepResponse
				if err := json.Unmarshal(body, &resp); err != nil {
					t.Fatalf("failed to parse response: %v", err)
				}
				if resp.ID != 1 {
					t.Errorf("expected ID 1, got %d", resp.ID)
				}
				if resp.DurationMinutes != 450 {
					t.Errorf("expected duration 450, got %d", resp.DurationMinutes)
				}
				if resp.Date != "2026-09-11" {
					t.Errorf("expected date 2026-09-11, got %s", resp.Date)
				}
				if resp.Bedtime != "23:30" || resp.WakeTime != "07:00" {
					t.Errorf("expected bedtime 23:30 and wake_time 07:00, got %s, %s", resp.Bedtime, resp.WakeTime)
				}
				if resp.Notes == nil || *resp.Notes != "synthetic record" {
					t.Errorf("unexpected notes: %v", resp.Notes)
				}
			},
		},
		{
			name:        "Valid same-day sleep record",
			requestBody: `{"date":"2026-09-11","bedtime":"01:00","wake_time":"08:00","quality":7}`,
			serviceFn: func(ctx context.Context, in sleep.CreateInput) (sqlc.SleepLog, error) {
				// 01:00 = 3600s; 08:00 = 28800s
				return syntheticSleepLog(2, in.Date, 3600000000, 28800000000, 420, in.Quality, nil), nil
			},
			expectedStatus: http.StatusCreated,
			verifyResponse: func(t *testing.T, body []byte) {
				var resp SleepResponse
				if err := json.Unmarshal(body, &resp); err != nil {
					t.Fatalf("failed to parse response: %v", err)
				}
				if resp.DurationMinutes != 420 {
					t.Errorf("expected duration 420, got %d", resp.DurationMinutes)
				}
				if resp.Notes != nil {
					t.Errorf("expected nil notes, got %v", resp.Notes)
				}
			},
		},
		{
			name:           "Malformed JSON syntax",
			requestBody:    `{"date": "2026-09-11", "bedtime":`,
			expectedStatus: http.StatusBadRequest,
			verifyResponse: func(t *testing.T, body []byte) {
				var errResp ErrorResponse
				if err := json.Unmarshal(body, &errResp); err != nil {
					t.Fatalf("failed to parse error response: %v", err)
				}
				if errResp.Error.Code != "VALIDATION_ERROR" {
					t.Errorf("expected code VALIDATION_ERROR, got %s", errResp.Error.Code)
				}
			},
		},
		{
			name:           "Unknown field rejected",
			requestBody:    `{"date":"2026-09-11","bedtime":"23:30","wake_time":"07:00","quality":8,"duration_minutes":999}`,
			expectedStatus: http.StatusBadRequest,
			verifyResponse: func(t *testing.T, body []byte) {
				var errResp ErrorResponse
				_ = json.Unmarshal(body, &errResp)
				if errResp.Error.Code != "VALIDATION_ERROR" {
					t.Errorf("expected VALIDATION_ERROR, got %s", errResp.Error.Code)
				}
			},
		},
		{
			name:           "Multiple JSON documents rejected",
			requestBody:    `{"date":"2026-09-11","bedtime":"23:30","wake_time":"07:00","quality":8}{"extra":true}`,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Missing date",
			requestBody:    `{"bedtime":"23:30","wake_time":"07:00","quality":8}`,
			expectedStatus: http.StatusBadRequest,
			verifyResponse: func(t *testing.T, body []byte) {
				var errResp ErrorResponse
				_ = json.Unmarshal(body, &errResp)
				found := false
				for _, d := range errResp.Error.Details {
					if d.Field == "date" {
						found = true
					}
				}
				if !found {
					t.Error("expected date field error detail")
				}
			},
		},
		{
			name:           "Missing bedtime",
			requestBody:    `{"date":"2026-09-11","wake_time":"07:00","quality":8}`,
			expectedStatus: http.StatusBadRequest,
			verifyResponse: func(t *testing.T, body []byte) {
				var errResp ErrorResponse
				_ = json.Unmarshal(body, &errResp)
				found := false
				for _, d := range errResp.Error.Details {
					if d.Field == "bedtime" {
						found = true
					}
				}
				if !found {
					t.Error("expected bedtime field error detail")
				}
			},
		},
		{
			name:           "Missing wake_time",
			requestBody:    `{"date":"2026-09-11","bedtime":"23:30","quality":8}`,
			expectedStatus: http.StatusBadRequest,
			verifyResponse: func(t *testing.T, body []byte) {
				var errResp ErrorResponse
				_ = json.Unmarshal(body, &errResp)
				found := false
				for _, d := range errResp.Error.Details {
					if d.Field == "wake_time" {
						found = true
					}
				}
				if !found {
					t.Error("expected wake_time field error detail")
				}
			},
		},
		{
			name:           "Missing quality",
			requestBody:    `{"date":"2026-09-11","bedtime":"23:30","wake_time":"07:00"}`,
			expectedStatus: http.StatusBadRequest,
			verifyResponse: func(t *testing.T, body []byte) {
				var errResp ErrorResponse
				_ = json.Unmarshal(body, &errResp)
				found := false
				for _, d := range errResp.Error.Details {
					if d.Field == "quality" && d.Issue == "quality is required" {
						found = true
					}
				}
				if !found {
					t.Error("expected quality is required error detail")
				}
			},
		},
		{
			name:           "Invalid date format",
			requestBody:    `{"date":"2026-13-45","bedtime":"23:30","wake_time":"07:00","quality":8}`,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Invalid bedtime format",
			requestBody:    `{"date":"2026-09-11","bedtime":"25:00","wake_time":"07:00","quality":8}`,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Invalid wake_time format",
			requestBody:    `{"date":"2026-09-11","bedtime":"23:30","wake_time":"24:60","quality":8}`,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Quality below 1",
			requestBody:    `{"date":"2026-09-11","bedtime":"23:30","wake_time":"07:00","quality":0}`,
			expectedStatus: http.StatusBadRequest,
			verifyResponse: func(t *testing.T, body []byte) {
				var errResp ErrorResponse
				_ = json.Unmarshal(body, &errResp)
				found := false
				for _, d := range errResp.Error.Details {
					if d.Field == "quality" && d.Issue == "must be >= 1" {
						found = true
					}
				}
				if !found {
					t.Error("expected quality must be >= 1")
				}
			},
		},
		{
			name:           "Quality above 10",
			requestBody:    `{"date":"2026-09-11","bedtime":"23:30","wake_time":"07:00","quality":11}`,
			expectedStatus: http.StatusBadRequest,
			verifyResponse: func(t *testing.T, body []byte) {
				var errResp ErrorResponse
				_ = json.Unmarshal(body, &errResp)
				found := false
				for _, d := range errResp.Error.Details {
					if d.Field == "quality" && d.Issue == "must be <= 10" {
						found = true
					}
				}
				if !found {
					t.Error("expected quality must be <= 10")
				}
			},
		},
		{
			name:           "Non-integer quality",
			requestBody:    `{"date":"2026-09-11","bedtime":"23:30","wake_time":"07:00","quality":"excellent"}`,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Equal bedtime and wake time",
			requestBody:    `{"date":"2026-09-11","bedtime":"08:00","wake_time":"08:00","quality":8}`,
			expectedStatus: http.StatusBadRequest,
			verifyResponse: func(t *testing.T, body []byte) {
				var errResp ErrorResponse
				_ = json.Unmarshal(body, &errResp)
				found := false
				for _, d := range errResp.Error.Details {
					if d.Field == "wake_time" && d.Issue == "bedtime and wake_time cannot be equal" {
						found = true
					}
				}
				if !found {
					t.Error("expected bedtime and wake_time cannot be equal")
				}
			},
		},
		{
			name:        "Duplicate date returns 409 Conflict",
			requestBody: `{"date":"2026-09-11","bedtime":"23:30","wake_time":"07:00","quality":8}`,
			serviceFn: func(ctx context.Context, in sleep.CreateInput) (sqlc.SleepLog, error) {
				return sqlc.SleepLog{}, sleep.ErrDuplicateDate
			},
			expectedStatus: http.StatusConflict,
			verifyResponse: func(t *testing.T, body []byte) {
				var errResp ErrorResponse
				if err := json.Unmarshal(body, &errResp); err != nil {
					t.Fatalf("failed to parse error response: %v", err)
				}
				if errResp.Error.Code != "CONFLICT" {
					t.Errorf("expected CONFLICT code, got %s", errResp.Error.Code)
				}
			},
		},
		{
			name:        "Unexpected database error returns 500 Internal Server Error",
			requestBody: `{"date":"2026-09-11","bedtime":"23:30","wake_time":"07:00","quality":8}`,
			serviceFn: func(ctx context.Context, in sleep.CreateInput) (sqlc.SleepLog, error) {
				return sqlc.SleepLog{}, errors.New("unexpected db failure")
			},
			expectedStatus: http.StatusInternalServerError,
			verifyResponse: func(t *testing.T, body []byte) {
				var errResp ErrorResponse
				if err := json.Unmarshal(body, &errResp); err != nil {
					t.Fatalf("failed to parse error response: %v", err)
				}
				if errResp.Error.Code != "INTERNAL_ERROR" {
					t.Errorf("expected INTERNAL_ERROR code, got %s", errResp.Error.Code)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockSleepService{createFn: tt.serviceFn}
			handler := NewSleepHandler(svc)

			req := httptest.NewRequest(http.MethodPost, "/api/v1/sleep", bytes.NewBufferString(tt.requestBody))
			req.Header.Set("Content-Type", "application/json")
			rr := httptest.NewRecorder()

			handler.Create(rr, req)

			if rr.Code != tt.expectedStatus {
				t.Fatalf("expected status %d, got %d. Body: %s", tt.expectedStatus, rr.Code, rr.Body.String())
			}

			if tt.verifyResponse != nil {
				tt.verifyResponse(t, rr.Body.Bytes())
			}
		})
	}
}

func TestSleepHandler_List(t *testing.T) {
	tests := []struct {
		name           string
		query          string
		serviceFn      func(ctx context.Context, limit, offset int32) ([]sqlc.SleepLog, error)
		expectedStatus int
		verifyResponse func(t *testing.T, body []byte)
	}{
		{
			name:  "Successful list with records",
			query: "",
			serviceFn: func(ctx context.Context, limit, offset int32) ([]sqlc.SleepLog, error) {
				if limit != 20 || offset != 0 {
					t.Errorf("expected default limit 20 and offset 0, got limit %d, offset %d", limit, offset)
				}
				return []sqlc.SleepLog{
					syntheticSleepLog(2, "2026-09-12", 84600000000, 25200000000, 450, 9, nil),
					syntheticSleepLog(1, "2026-09-11", 84600000000, 25200000000, 450, 8, nil),
				}, nil
			},
			expectedStatus: http.StatusOK,
			verifyResponse: func(t *testing.T, body []byte) {
				var items []SleepResponse
				if err := json.Unmarshal(body, &items); err != nil {
					t.Fatalf("failed to parse list response: %v", err)
				}
				if len(items) != 2 {
					t.Fatalf("expected 2 items, got %d", len(items))
				}
				if items[0].Date != "2026-09-12" || items[1].Date != "2026-09-11" {
					t.Errorf("expected newest first order")
				}
			},
		},
		{
			name:  "Successful empty list returns []",
			query: "",
			serviceFn: func(ctx context.Context, limit, offset int32) ([]sqlc.SleepLog, error) {
				return []sqlc.SleepLog{}, nil
			},
			expectedStatus: http.StatusOK,
			verifyResponse: func(t *testing.T, body []byte) {
				if string(bytes.TrimSpace(body)) != "[]" {
					t.Errorf("expected empty JSON array [], got %s", string(body))
				}
			},
		},
		{
			name:  "Custom limit and offset",
			query: "?limit=10&offset=5",
			serviceFn: func(ctx context.Context, limit, offset int32) ([]sqlc.SleepLog, error) {
				if limit != 10 || offset != 5 {
					t.Errorf("expected limit 10 and offset 5, got limit %d, offset %d", limit, offset)
				}
				return []sqlc.SleepLog{}, nil
			},
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Invalid non-integer limit",
			query:          "?limit=abc",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Zero limit",
			query:          "?limit=0",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Negative limit",
			query:          "?limit=-5",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Limit exceeding 100",
			query:          "?limit=101",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Invalid non-integer offset",
			query:          "?offset=xyz",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Negative offset",
			query:          "?offset=-1",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:  "Service error returns 500",
			query: "",
			serviceFn: func(ctx context.Context, limit, offset int32) ([]sqlc.SleepLog, error) {
				return nil, errors.New("db error")
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			svc := &mockSleepService{listFn: tt.serviceFn}
			handler := NewSleepHandler(svc)

			req := httptest.NewRequest(http.MethodGet, "/api/v1/sleep"+tt.query, nil)
			rr := httptest.NewRecorder()

			handler.List(rr, req)

			if rr.Code != tt.expectedStatus {
				t.Fatalf("expected status %d, got %d. Body: %s", tt.expectedStatus, rr.Code, rr.Body.String())
			}

			if tt.verifyResponse != nil {
				tt.verifyResponse(t, rr.Body.Bytes())
			}
		})
	}
}

// --- Update handler tests ---

func TestSleepHandler_Update(t *testing.T) {
	tests := []struct {
		name           string
		path           string
		requestBody    string
		serviceFn      func(ctx context.Context, id int64, in sleep.UpdateInput) (sqlc.SleepLog, error)
		expectedStatus int
		verifyResponse func(t *testing.T, body []byte)
	}{
		{
			name:        "Valid update returns 200 with recalculated duration",
			path:        "/api/v1/sleep/1",
			requestBody: `{"date":"2026-09-11","bedtime":"23:30","wake_time":"07:00","quality":9,"notes":"updated note"}`,
			serviceFn: func(ctx context.Context, id int64, in sleep.UpdateInput) (sqlc.SleepLog, error) {
				// 23:30 -> 07:00 = 450 minutes
				return syntheticSleepLog(id, in.Date, 84600000000, 25200000000, 450, in.Quality, in.Notes), nil
			},
			expectedStatus: http.StatusOK,
			verifyResponse: func(t *testing.T, body []byte) {
				var resp SleepResponse
				if err := json.Unmarshal(body, &resp); err != nil {
					t.Fatalf("failed to parse response: %v", err)
				}
				if resp.ID != 1 {
					t.Errorf("expected ID 1, got %d", resp.ID)
				}
				if resp.DurationMinutes != 450 {
					t.Errorf("expected duration 450, got %d", resp.DurationMinutes)
				}
				if resp.Quality != 9 {
					t.Errorf("expected quality 9, got %d", resp.Quality)
				}
				if resp.Bedtime != "23:30" || resp.WakeTime != "07:00" {
					t.Errorf("unexpected times: bedtime=%s wake=%s", resp.Bedtime, resp.WakeTime)
				}
			},
		},
		{
			name:           "Malformed ID returns 400",
			path:           "/api/v1/sleep/abc",
			requestBody:    `{"date":"2026-09-11","bedtime":"23:30","wake_time":"07:00","quality":8}`,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Zero ID returns 400",
			path:           "/api/v1/sleep/0",
			requestBody:    `{"date":"2026-09-11","bedtime":"23:30","wake_time":"07:00","quality":8}`,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Negative ID returns 400",
			path:           "/api/v1/sleep/-1",
			requestBody:    `{"date":"2026-09-11","bedtime":"23:30","wake_time":"07:00","quality":8}`,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Malformed JSON returns 400",
			path:           "/api/v1/sleep/1",
			requestBody:    `{not-valid-json}`,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Unknown field duration_minutes rejected",
			path:           "/api/v1/sleep/1",
			requestBody:    `{"date":"2026-09-11","bedtime":"23:30","wake_time":"07:00","quality":8,"duration_minutes":999}`,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Multiple JSON values rejected",
			path:           "/api/v1/sleep/1",
			requestBody:    `{"date":"2026-09-11","bedtime":"23:30","wake_time":"07:00","quality":8}{"date":"2026-09-12","bedtime":"22:00","wake_time":"06:00","quality":7}`,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Missing date returns 400",
			path:           "/api/v1/sleep/1",
			requestBody:    `{"bedtime":"23:30","wake_time":"07:00","quality":8}`,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Missing bedtime returns 400",
			path:           "/api/v1/sleep/1",
			requestBody:    `{"date":"2026-09-11","wake_time":"07:00","quality":8}`,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Missing wake_time returns 400",
			path:           "/api/v1/sleep/1",
			requestBody:    `{"date":"2026-09-11","bedtime":"23:30","quality":8}`,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Missing quality returns 400",
			path:           "/api/v1/sleep/1",
			requestBody:    `{"date":"2026-09-11","bedtime":"23:30","wake_time":"07:00"}`,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Quality below 1 returns 400",
			path:           "/api/v1/sleep/1",
			requestBody:    `{"date":"2026-09-11","bedtime":"23:30","wake_time":"07:00","quality":0}`,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Quality above 10 returns 400",
			path:           "/api/v1/sleep/1",
			requestBody:    `{"date":"2026-09-11","bedtime":"23:30","wake_time":"07:00","quality":11}`,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Equal bedtime and wake_time returns 400",
			path:           "/api/v1/sleep/1",
			requestBody:    `{"date":"2026-09-11","bedtime":"08:00","wake_time":"08:00","quality":8}`,
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:        "Not found returns 404",
			path:        "/api/v1/sleep/99999",
			requestBody: `{"date":"2026-09-11","bedtime":"23:30","wake_time":"07:00","quality":8}`,
			serviceFn: func(ctx context.Context, id int64, in sleep.UpdateInput) (sqlc.SleepLog, error) {
				return sqlc.SleepLog{}, sleep.ErrNotFound
			},
			expectedStatus: http.StatusNotFound,
			verifyResponse: func(t *testing.T, body []byte) {
				var resp ErrorResponse
				if err := json.Unmarshal(body, &resp); err != nil {
					t.Fatalf("failed to parse error response: %v", err)
				}
				if resp.Error.Code != "NOT_FOUND" {
					t.Errorf("expected NOT_FOUND code, got %q", resp.Error.Code)
				}
			},
		},
		{
			name:        "Duplicate date returns 409",
			path:        "/api/v1/sleep/1",
			requestBody: `{"date":"2026-09-12","bedtime":"23:30","wake_time":"07:00","quality":8}`,
			serviceFn: func(ctx context.Context, id int64, in sleep.UpdateInput) (sqlc.SleepLog, error) {
				return sqlc.SleepLog{}, sleep.ErrDuplicateDate
			},
			expectedStatus: http.StatusConflict,
			verifyResponse: func(t *testing.T, body []byte) {
				var resp ErrorResponse
				if err := json.Unmarshal(body, &resp); err != nil {
					t.Fatalf("failed to parse error response: %v", err)
				}
				if resp.Error.Code != "CONFLICT" {
					t.Errorf("expected CONFLICT code, got %q", resp.Error.Code)
				}
			},
		},
		{
			name:        "Unexpected service error returns 500",
			path:        "/api/v1/sleep/1",
			requestBody: `{"date":"2026-09-11","bedtime":"23:30","wake_time":"07:00","quality":8}`,
			serviceFn: func(ctx context.Context, id int64, in sleep.UpdateInput) (sqlc.SleepLog, error) {
				return sqlc.SleepLog{}, errors.New("unexpected db failure")
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc := &mockSleepService{updateFn: tt.serviceFn}
			handler := NewSleepHandler(mockSvc)

			// Route via the real router so Chi resolves {id}
			router := NewRouter(mockSvc)

			req := httptest.NewRequest(http.MethodPut, tt.path, bytes.NewBufferString(tt.requestBody))
			req.Header.Set("Content-Type", "application/json")
			_ = handler // referenced to satisfy linter; routing done via router below
			rr := httptest.NewRecorder()

			router.ServeHTTP(rr, req)

			if rr.Code != tt.expectedStatus {
				t.Fatalf("expected status %d, got %d. Body: %s", tt.expectedStatus, rr.Code, rr.Body.String())
			}

			if tt.verifyResponse != nil {
				tt.verifyResponse(t, rr.Body.Bytes())
			}
		})
	}
}

// --- Delete handler tests ---

func TestSleepHandler_Delete(t *testing.T) {
	tests := []struct {
		name           string
		path           string
		serviceFn      func(ctx context.Context, id int64) error
		expectedStatus int
		verifyBody     func(t *testing.T, body []byte)
	}{
		{
			name: "Existing ID returns 204 with empty body",
			path: "/api/v1/sleep/1",
			serviceFn: func(ctx context.Context, id int64) error {
				return nil
			},
			expectedStatus: http.StatusNoContent,
			verifyBody: func(t *testing.T, body []byte) {
				if len(body) != 0 {
					t.Errorf("expected empty body for 204, got %q", string(body))
				}
			},
		},
		{
			name:           "Malformed ID returns 400",
			path:           "/api/v1/sleep/abc",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Zero ID returns 400",
			path:           "/api/v1/sleep/0",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:           "Negative ID returns 400",
			path:           "/api/v1/sleep/-1",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name: "Missing record returns 404",
			path: "/api/v1/sleep/99999",
			serviceFn: func(ctx context.Context, id int64) error {
				return sleep.ErrNotFound
			},
			expectedStatus: http.StatusNotFound,
			verifyBody: func(t *testing.T, body []byte) {
				var resp ErrorResponse
				if err := json.Unmarshal(body, &resp); err != nil {
					t.Fatalf("failed to parse error response: %v", err)
				}
				if resp.Error.Code != "NOT_FOUND" {
					t.Errorf("expected NOT_FOUND code, got %q", resp.Error.Code)
				}
			},
		},
		{
			name: "Unexpected service error returns 500",
			path: "/api/v1/sleep/1",
			serviceFn: func(ctx context.Context, id int64) error {
				return errors.New("unexpected db failure")
			},
			expectedStatus: http.StatusInternalServerError,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockSvc := &mockSleepService{deleteFn: tt.serviceFn}
			router := NewRouter(mockSvc)

			req := httptest.NewRequest(http.MethodDelete, tt.path, nil)
			rr := httptest.NewRecorder()

			router.ServeHTTP(rr, req)

			if rr.Code != tt.expectedStatus {
				t.Fatalf("expected status %d, got %d. Body: %s", tt.expectedStatus, rr.Code, rr.Body.String())
			}

			if tt.verifyBody != nil {
				tt.verifyBody(t, rr.Body.Bytes())
			}
		})
	}
}
