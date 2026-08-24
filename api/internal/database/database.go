package database

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// DB encapsulates the pgx connection pool.
type DB struct {
	Pool *pgxpool.Pool
}

// Connect initializes and verifies a PostgreSQL connection pool.
func Connect(ctx context.Context, connString string) (*DB, error) {
	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database connection string: %w", err)
	}

	config.MaxConns = 25
	config.MinConns = 2
	config.MaxConnLifetime = 1 * time.Hour
	config.MaxConnIdleTime = 30 * time.Minute

	slog.Info("Initializing PostgreSQL connection pool...", "host", config.ConnConfig.Host, "database", config.ConnConfig.Database)

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("failed to establish database pool: %w", err)
	}

	// Verify database connectivity
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("database health check ping failed: %w", err)
	}

	slog.Info("PostgreSQL connection verified successfully.")
	return &DB{Pool: pool}, nil
}

// Ping checks whether the database connection is alive.
func (db *DB) Ping(ctx context.Context) error {
	if db.Pool == nil {
		return fmt.Errorf("database pool is not initialized")
	}
	return db.Pool.Ping(ctx)
}

// Close gracefully closes all connections in the pool.
func (db *DB) Close() {
	if db.Pool != nil {
		slog.Info("Closing PostgreSQL connection pool...")
		db.Pool.Close()
	}
}
