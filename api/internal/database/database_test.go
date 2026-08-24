package database

import (
	"context"
	"testing"
)

func TestDatabasePingUninitialized(t *testing.T) {
	db := &DB{Pool: nil}
	err := db.Ping(context.Background())
	if err == nil {
		t.Error("Expected error when pinging nil database pool, got nil")
	}
}

func TestDatabaseInvalidConnString(t *testing.T) {
	ctx := context.Background()
	_, err := Connect(ctx, "invalid-postgres-conn-string-://:")
	if err == nil {
		t.Error("Expected error for invalid connection string, got nil")
	}
}
