package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"personal-data-os/api/internal/config"
	"personal-data-os/api/internal/database"
	appHTTP "personal-data-os/api/internal/http"
)

func main() {
	// 1. Setup structured logging
	var logHandler slog.Handler
	if os.Getenv("APP_ENV") == "production" {
		logHandler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})
	} else {
		logHandler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug})
	}
	logger := slog.New(logHandler)
	slog.SetDefault(logger)

	slog.Info("Starting Personal Data OS API (Foundation v0.1.0)...")

	// 2. Load and validate configuration
	cfg, err := config.Load()
	if err != nil {
		slog.Error("Configuration loading failed", "error", err)
		os.Exit(1)
	}

	// 3. Initialize PostgreSQL Database Connection Pool
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	db, err := database.Connect(ctx, cfg.DatabaseURL())
	if err != nil {
		slog.Warn("PostgreSQL connection could not be established at startup (database may be offline)", "error", err)
	} else {
		defer db.Close()
	}

	// 4. Build HTTP Router
	router := appHTTP.NewRouter()

	// 5. Configure HTTP Server
	server := &http.Server{
		Addr:         ":" + cfg.APIPort,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// 6. Run Server asynchronously
	go func() {
		slog.Info("HTTP Server listening", "port", cfg.APIPort, "env", cfg.AppEnv, "url", "http://localhost:"+cfg.APIPort)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("HTTP Server fatal error", "error", err)
			os.Exit(1)
		}
	}()

	// 7. Handle Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("Shutting down server gracefully...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("Server forced to shutdown", "error", err)
	}

	slog.Info("Personal Data OS API stopped cleanly.")
}
