package http

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

// SlogLogger returns a chi middleware that logs requests using log/slog.
func SlogLogger() func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

			defer func() {
				slog.Info("HTTP Request",
					"method", r.Method,
					"path", r.URL.Path,
					"status", ww.Status(),
					"duration_ms", time.Since(start).Milliseconds(),
					"bytes", ww.BytesWritten(),
					"remote_ip", r.RemoteAddr,
				)
			}()

			next.ServeHTTP(ww, r)
		})
	}
}
