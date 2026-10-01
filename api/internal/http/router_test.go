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
		updateFn: func(ctx context.Context, id int64, in sleep.UpdateInput) (sqlc.SleepLog, error) {
			return sqlc.SleepLog{ID: id}, nil
		},
		deleteFn: func(ctx context.Context, id int64) error {
			return nil
		},
		statsFn: func(ctx context.Context) (sleep.Stats, error) {
			return sleep.Stats{}, nil
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
		{
			name:           "Sleep Route PUT valid",
			method:         http.MethodPut,
			path:           "/api/v1/sleep/1",
			body:           `{"date":"2026-09-11","bedtime":"23:30","wake_time":"07:00","quality":8}`,
			expectedStatus: http.StatusOK,
		},
		{
			name:           "Sleep Route DELETE valid",
			method:         http.MethodDelete,
			path:           "/api/v1/sleep/1",
			expectedStatus: http.StatusNoContent,
		},
		{
			name:           "Sleep Route GET stats",
			method:         http.MethodGet,
			path:           "/api/v1/sleep/stats",
			expectedStatus: http.StatusOK,
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

func TestRouter_ClientIP_SecurityRegression(t *testing.T) {
	buf, cleanup := captureSlogOutput(t)
	defer cleanup()

	mockSvc := &mockSleepService{
		listFn: func(ctx context.Context, limit, offset int32) ([]sqlc.SleepLog, error) {
			return []sqlc.SleepLog{}, nil
		},
		statsFn: func(ctx context.Context) (sleep.Stats, error) {
			return sleep.Stats{}, nil
		},
	}
	router := NewRouter(mockSvc)

	routes := []struct {
		name string
		path string
	}{
		{name: "Health endpoint", path: "/health"},
		{name: "Sleep list endpoint", path: "/api/v1/sleep"},
		{name: "Sleep stats endpoint", path: "/api/v1/sleep/stats"},
	}

	for _, rt := range routes {
		t.Run(rt.name, func(t *testing.T) {
			buf.Reset()

			req := httptest.NewRequest(http.MethodGet, rt.path, nil)
			req.RemoteAddr = "203.0.113.10:54321"
			req.Header.Set("X-Forwarded-For", "127.0.0.1")
			req.Header.Set("X-Real-IP", "10.0.0.1")
			req.Header.Set("True-Client-IP", "192.168.1.1")

			rr := httptest.NewRecorder()
			router.ServeHTTP(rr, req)

			if rr.Code != http.StatusOK {
				t.Fatalf("expected status 200 for %s, got %d", rt.path, rr.Code)
			}

			// RemoteAddr must NOT be mutated by router middleware
			if req.RemoteAddr != "203.0.113.10:54321" {
				t.Errorf("RemoteAddr was mutated: got %q, want %q", req.RemoteAddr, "203.0.113.10:54321")
			}

			entry := parseSingleLogEntry(t, buf.Bytes())
			clientIP, ok := entry["client_ip"].(string)
			if !ok {
				t.Fatalf("missing client_ip in log entry for %s: %#v", rt.path, entry)
			}

			// The client IP must be extracted from the TCP peer (RemoteAddr), not attacker-controlled headers
			if clientIP != "203.0.113.10" {
				t.Errorf("expected client_ip '203.0.113.10', got %q", clientIP)
			}
			if clientIP == "127.0.0.1" || clientIP == "10.0.0.1" || clientIP == "192.168.1.1" {
				t.Errorf("spoofed header was trusted as client IP: %q", clientIP)
			}
		})
	}
}

func TestRouter_ClientIP_IPv6(t *testing.T) {
	buf, cleanup := captureSlogOutput(t)
	defer cleanup()

	router := NewRouter(nil)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	req.RemoteAddr = "[2001:db8::1]:54321"
	req.Header.Set("X-Forwarded-For", "2001:db8::99")
	req.Header.Set("X-Real-IP", "2001:db8::88")
	req.Header.Set("True-Client-IP", "2001:db8::77")

	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	if req.RemoteAddr != "[2001:db8::1]:54321" {
		t.Errorf("RemoteAddr was mutated: got %q, want %q", req.RemoteAddr, "[2001:db8::1]:54321")
	}

	entry := parseSingleLogEntry(t, buf.Bytes())
	if clientIP, ok := entry["client_ip"].(string); !ok || clientIP != "2001:db8::1" {
		t.Errorf("expected client_ip '2001:db8::1', got %#v", entry["client_ip"])
	}
}

func TestRouter_StandardHttptestRequest_NoPanic(t *testing.T) {
	router := NewRouter(nil)

	// Standard httptest request sets RemoteAddr to 192.0.2.1:1234
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}
}
