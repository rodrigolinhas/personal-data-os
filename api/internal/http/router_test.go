package http

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRouterEndpoints(t *testing.T) {
	router := NewRouter()

	tests := []struct {
		name           string
		method         string
		path           string
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
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			rr := httptest.NewRecorder()

			router.ServeHTTP(rr, req)

			if rr.Code != tt.expectedStatus {
				t.Errorf("Path %s (%s) got status %d, expected %d", tt.path, tt.method, rr.Code, tt.expectedStatus)
			}
		})
	}
}
