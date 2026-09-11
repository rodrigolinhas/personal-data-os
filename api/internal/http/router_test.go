package http

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"personal-data-os/api/db/sqlc"
	"personal-data-os/api/internal/sleep"
)

func TestRouterEndpoints(t *testing.T) {
	mockSvc := &mockSleepService{
		createFn: func(ctx context.Context, in sleep.CreateInput) (sqlc.SleepLog, error) {
			return sqlc.SleepLog{ID: 1}, nil
		},
		listFn: func(ctx context.Context, limit, offset int32) ([]sqlc.SleepLog, error) {
			return []sqlc.SleepLog{}, nil
		},
	}
	router := NewRouter(mockSvc)

	tests := []struct {
		name           string
		method         string
		path           string
		body           string
		expectedStatus int
	}{
		{
			name:           "Root Health GET",
			method:         http.MethodGet,
			path:           "/health",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Root Health HEAD",
			method:         http.MethodHead,
			path:           "/health",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Nonexistent Route 404",
			method:         http.MethodGet,
			path:           "/nonexistent",
			expectedStatus: http.StatusNotFound,
		},
		{
			name:           "Sleep Route GET",
			method:         http.MethodGet,
			path:           "/api/v1/sleep",
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Sleep Route POST",
			method:         http.MethodPost,
			path:           "/api/v1/sleep",
			body:           `{"date":"2026-09-11","bedtime":"23:30","wake_time":"07:00","quality":8}`,
			expectedStatus: http.StatusCreated,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var req *http.Request
			if tt.body != "" {
				req = httptest.NewRequest(tt.method, tt.path, bytes.NewBufferString(tt.body))
				req.Header.Set("Content-Type", "application/json")
			} else {
				req = httptest.NewRequest(tt.method, tt.path, nil)
			}
			rr := httptest.NewRecorder()

			router.ServeHTTP(rr, req)

			if rr.Code != tt.expectedStatus {
				t.Errorf("Path %s (%s) got status %d, expected %d", tt.path, tt.method, rr.Code, tt.expectedStatus)
			}
		})
	}
}

func TestRouterEndpoints_NilService(t *testing.T) {
	router := NewRouter(nil)

	// Health check must still work when sleep service is nil
	healthReq := httptest.NewRequest(http.MethodGet, "/health", nil)
	healthRR := httptest.NewRecorder()
	router.ServeHTTP(healthRR, healthReq)
	if healthRR.Code != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, healthRR.Code)
	}

	// Sleep route should return 500 when service is nil
	sleepReq := httptest.NewRequest(http.MethodGet, "/api/v1/sleep", nil)
	sleepRR := httptest.NewRecorder()
	router.ServeHTTP(sleepRR, sleepReq)
	if sleepRR.Code != http.StatusInternalServerError {
		t.Errorf("Expected status %d, got %d", http.StatusInternalServerError, sleepRR.Code)
	}
}
