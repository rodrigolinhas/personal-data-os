package http

import (
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

// NewRouter builds and configures the main Chi HTTP router.
func NewRouter() *chi.Mux {
	r := chi.NewRouter()

	// Base middlewares
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(SlogLogger())
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))

	// CORS configuration for local web frontend
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Infrastructure health endpoint at root
	r.Get("/health", HandleHealth)
	r.Head("/health", HandleHealth)

	// API v1 namespace router for business domains
	r.Route("/api/v1", func(api chi.Router) {
		// Domain modules (Sleep, Reading, Workouts, Habits, GitHub) will mount here
	})

	return r
}
