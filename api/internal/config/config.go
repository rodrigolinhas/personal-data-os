package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// Config holds the application configuration loaded from environment variables.
type Config struct {
	AppEnv           string
	APIPort          string
	PostgresHost     string
	PostgresPort     string
	PostgresDB       string
	PostgresUser     string
	PostgresPassword string
	PostgresSSLMode  string
}

// Load reads configuration from .env files and environment variables, validating required fields.
func Load() (*Config, error) {
	// Attempt loading from root .env or local .env (non-fatal if missing)
	_ = godotenv.Load("../.env")
	_ = godotenv.Load(".env")

	cfg := &Config{
		AppEnv:           getEnv("APP_ENV", "development"),
		APIPort:          getEnv("API_PORT", "8080"),
		PostgresHost:     getEnv("POSTGRES_HOST", "localhost"),
		PostgresPort:     getEnv("POSTGRES_PORT", "5432"),
		PostgresDB:       getEnv("POSTGRES_DB", "personal_data_os"),
		PostgresUser:     getEnv("POSTGRES_USER", "personal_data"),
		PostgresPassword: getEnv("POSTGRES_PASSWORD", "change_me"),
		PostgresSSLMode:  getEnv("POSTGRES_SSLMODE", "disable"),
	}

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("configuration validation error: %w", err)
	}

	return cfg, nil
}

// Validate ensures that all critical configuration values are present and well-formed.
func (c *Config) Validate() error {
	if c.APIPort == "" {
		return fmt.Errorf("API_PORT must not be empty")
	}
	if _, err := strconv.Atoi(c.APIPort); err != nil {
		return fmt.Errorf("API_PORT must be a valid integer: %w", err)
	}

	if c.PostgresHost == "" {
		return fmt.Errorf("POSTGRES_HOST must not be empty")
	}
	if c.PostgresPort == "" {
		return fmt.Errorf("POSTGRES_PORT must not be empty")
	}
	if _, err := strconv.Atoi(c.PostgresPort); err != nil {
		return fmt.Errorf("POSTGRES_PORT must be a valid integer: %w", err)
	}

	if c.PostgresDB == "" {
		return fmt.Errorf("POSTGRES_DB must not be empty")
	}
	if c.PostgresUser == "" {
		return fmt.Errorf("POSTGRES_USER must not be empty")
	}

	return nil
}

// DatabaseURL constructs a connection string suitable for pgxpool.
func (c *Config) DatabaseURL() string {
	encodedPass := url.QueryEscape(c.PostgresPassword)
	return fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=%s",
		c.PostgresUser,
		encodedPass,
		c.PostgresHost,
		c.PostgresPort,
		c.PostgresDB,
		c.PostgresSSLMode,
	)
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
