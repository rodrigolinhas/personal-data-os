package http

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/go-chi/chi/v5/middleware"
)

// safeBuffer is a concurrency-safe in-memory buffer used to capture slog output.
type safeBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (s *safeBuffer) Write(p []byte) (n int, err error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.buf.Write(p)
}

func (s *safeBuffer) Bytes() []byte {
	s.mu.Lock()
	defer s.mu.Unlock()
	cp := make([]byte, s.buf.Len())
	copy(cp, s.buf.Bytes())
	return cp
}

func (s *safeBuffer) Reset() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.buf.Reset()
}

// captureSlogOutput sets a temporary JSON slog handler directing output to a safeBuffer,
// restoring the previous default logger when the cleanup function is called.
func captureSlogOutput(t *testing.T) (*safeBuffer, func()) {
	t.Helper()
	buf := &safeBuffer{}
	handler := slog.NewJSONHandler(buf, nil)
	prev := slog.Default()
	slog.SetDefault(slog.New(handler))

	cleanup := func() {
		slog.SetDefault(prev)
	}
	return buf, cleanup
}

func parseSingleLogEntry(t *testing.T, data []byte) map[string]any {
	t.Helper()
	var entry map[string]any
	if err := json.Unmarshal(bytes.TrimSpace(data), &entry); err != nil {
		t.Fatalf("failed to parse structured log JSON: %v, raw: %s", err, string(data))
	}
	return entry
}

func TestClientIPFromRemoteAddr_Direct(t *testing.T) {
	tests := []struct {
		name               string
		remoteAddr         string
		headers            map[string]string
		expectedClientIP   string
		expectedRemoteAddr string
	}{
		{
			name:       "IPv4 with port and spoofed headers",
			remoteAddr: "203.0.113.10:54321",
			headers: map[string]string{
				"X-Forwarded-For": "127.0.0.1",
				"X-Real-IP":       "10.0.0.1",
				"True-Client-IP":  "192.168.1.1",
			},
			expectedClientIP:   "203.0.113.10",
			expectedRemoteAddr: "203.0.113.10:54321",
		},
		{
			name:               "Bare IPv4 without port",
			remoteAddr:         "198.51.100.20",
			headers:            map[string]string{"X-Forwarded-For": "10.10.10.10"},
			expectedClientIP:   "198.51.100.20",
			expectedRemoteAddr: "198.51.100.20",
		},
		{
			name:               "IPv6 with port and spoofed header",
			remoteAddr:         "[2001:db8::1]:54321",
			headers:            map[string]string{"X-Forwarded-For": "2001:db8::99"},
			expectedClientIP:   "2001:db8::1",
			expectedRemoteAddr: "[2001:db8::1]:54321",
		},
		{
			name:               "Bare IPv6 without port",
			remoteAddr:         "2001:db8::2",
			headers:            nil,
			expectedClientIP:   "2001:db8::2",
			expectedRemoteAddr: "2001:db8::2",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var observedContextIP string
			var observedRemoteAddr string

			handler := middleware.ClientIPFromRemoteAddr(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				observedContextIP = middleware.GetClientIP(r.Context())
				observedRemoteAddr = r.RemoteAddr
				w.WriteHeader(http.StatusOK)
			}))

			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			req.RemoteAddr = tt.remoteAddr
			for k, v := range tt.headers {
				req.Header.Set(k, v)
			}
			rr := httptest.NewRecorder()

			handler.ServeHTTP(rr, req)

			if observedContextIP != tt.expectedClientIP {
				t.Errorf("GetClientIP() = %q, want %q", observedContextIP, tt.expectedClientIP)
			}
			if observedRemoteAddr != tt.expectedRemoteAddr {
				t.Errorf("r.RemoteAddr was mutated: got %q, want %q", observedRemoteAddr, tt.expectedRemoteAddr)
			}
			if req.RemoteAddr != tt.expectedRemoteAddr {
				t.Errorf("original req.RemoteAddr was mutated: got %q, want %q", req.RemoteAddr, tt.expectedRemoteAddr)
			}
		})
	}
}

func TestSlogLogger_ContextClientIPPreferred(t *testing.T) {
	buf, cleanup := captureSlogOutput(t)
	defer cleanup()

	// Chain ClientIPFromRemoteAddr before SlogLogger
	chain := middleware.ClientIPFromRemoteAddr(SlogLogger()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/ping", nil)
	req.RemoteAddr = "203.0.113.10:54321"
	rr := httptest.NewRecorder()

	chain.ServeHTTP(rr, req)

	entry := parseSingleLogEntry(t, buf.Bytes())
	if clientIP, ok := entry["client_ip"].(string); !ok || clientIP != "203.0.113.10" {
		t.Errorf("expected client_ip to be context-extracted '203.0.113.10', got %#v", entry["client_ip"])
	}
}

func TestSlogLogger_FallbackToRemoteAddrWhenContextEmpty(t *testing.T) {
	tests := []struct {
		name       string
		remoteAddr string
		expectedIP string
	}{
		{
			name:       "IPv4 with port is normalized to host",
			remoteAddr: "198.51.100.20:12345",
			expectedIP: "198.51.100.20",
		},
		{
			name:       "Bare IPv4 without port",
			remoteAddr: "198.51.100.20",
			expectedIP: "198.51.100.20",
		},
		{
			name:       "IPv6 with port is normalized to host",
			remoteAddr: "[2001:db8::1]:12345",
			expectedIP: "2001:db8::1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			buf, cleanup := captureSlogOutput(t)
			defer cleanup()

			// Direct SlogLogger with NO ClientIPFrom* middleware in the chain
			chain := SlogLogger()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			}))

			req := httptest.NewRequest(http.MethodGet, "/standalone", nil)
			req.RemoteAddr = tt.remoteAddr
			rr := httptest.NewRecorder()

			chain.ServeHTTP(rr, req)

			entry := parseSingleLogEntry(t, buf.Bytes())
			if clientIP, ok := entry["client_ip"].(string); !ok || clientIP != tt.expectedIP {
				t.Errorf("expected client_ip fallback %q, got %#v", tt.expectedIP, entry["client_ip"])
			}
		})
	}
}

func TestSlogLogger_SpoofedForwardingHeadersNotLogged(t *testing.T) {
	buf, cleanup := captureSlogOutput(t)
	defer cleanup()

	chain := middleware.ClientIPFromRemoteAddr(SlogLogger()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})))

	req := httptest.NewRequest(http.MethodGet, "/secure", nil)
	req.RemoteAddr = "203.0.113.30:43210"
	req.Header.Set("X-Forwarded-For", "127.0.0.1")
	req.Header.Set("X-Real-IP", "10.0.0.1")
	req.Header.Set("True-Client-IP", "192.168.1.1")
	rr := httptest.NewRecorder()

	chain.ServeHTTP(rr, req)

	entry := parseSingleLogEntry(t, buf.Bytes())
	clientIP, ok := entry["client_ip"].(string)
	if !ok {
		t.Fatalf("expected client_ip string attribute, got %#v", entry["client_ip"])
	}
	if clientIP != "203.0.113.30" {
		t.Errorf("expected client_ip '203.0.113.30', got %q", clientIP)
	}
	if clientIP == "127.0.0.1" || clientIP == "10.0.0.1" || clientIP == "192.168.1.1" {
		t.Errorf("spoofed header IP was trusted: %q", clientIP)
	}
}

func TestSlogLogger_PreservesAttributesAndHandlerBehavior(t *testing.T) {
	buf, cleanup := captureSlogOutput(t)
	defer cleanup()

	chain := middleware.ClientIPFromRemoteAddr(SlogLogger()(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"created":true}`))
	})))

	req := httptest.NewRequest(http.MethodPost, "/api/v1/resource", nil)
	req.RemoteAddr = "192.0.2.10:50000"
	rr := httptest.NewRecorder()

	chain.ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Errorf("expected status %d, got %d", http.StatusCreated, rr.Code)
	}
	if body := rr.Body.String(); body != `{"created":true}` {
		t.Errorf("expected body %q, got %q", `{"created":true}`, body)
	}

	entry := parseSingleLogEntry(t, buf.Bytes())
	if msg, ok := entry["msg"].(string); !ok || msg != "HTTP Request" {
		t.Errorf("expected msg 'HTTP Request', got %#v", entry["msg"])
	}
	if method, ok := entry["method"].(string); !ok || method != "POST" {
		t.Errorf("expected method 'POST', got %#v", entry["method"])
	}
	if path, ok := entry["path"].(string); !ok || path != "/api/v1/resource" {
		t.Errorf("expected path '/api/v1/resource', got %#v", entry["path"])
	}
	if status, ok := entry["status"].(float64); !ok || int(status) != http.StatusCreated {
		t.Errorf("expected status 201, got %#v", entry["status"])
	}
	if clientIP, ok := entry["client_ip"].(string); !ok || clientIP != "192.0.2.10" {
		t.Errorf("expected client_ip '192.0.2.10', got %#v", entry["client_ip"])
	}
	if _, ok := entry["duration_ms"]; !ok {
		t.Errorf("missing duration_ms in log entry")
	}
	if bytesVal, ok := entry["bytes"].(float64); !ok || int(bytesVal) != len(`{"created":true}`) {
		t.Errorf("expected bytes %d, got %#v", len(`{"created":true}`), entry["bytes"])
	}
}
