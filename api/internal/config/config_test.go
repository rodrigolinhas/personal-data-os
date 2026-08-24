package config

import (
	"os"
	"testing"
)

func TestConfigLoadDefaults(t *testing.T) {
	// Clean env overrides
	os.Unsetenv("API_PORT")
	os.Unsetenv("POSTGRES_HOST")
	os.Unsetenv("POSTGRES_DB")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Expected valid default config, got error: %v", err)
	}

	if cfg.APIPort != "8080" {
		t.Errorf("Expected APIPort 8080, got %s", cfg.APIPort)
	}
	if cfg.PostgresHost != "localhost" {
		t.Errorf("Expected PostgresHost localhost, got %s", cfg.PostgresHost)
	}
	if cfg.PostgresDB != "personal_data_os" {
		t.Errorf("Expected PostgresDB personal_data_os, got %s", cfg.PostgresDB)
	}
}

func TestConfigValidationErrors(t *testing.T) {
	tests := []struct {
		name      string
		mutate    func(c *Config)
		expectErr bool
	}{
		{
			name: "Invalid Port",
			mutate: func(c *Config) {
				c.APIPort = "invalid-port"
			},
			expectErr: true,
		},
		{
			name: "Empty DB Host",
			mutate: func(c *Config) {
				c.PostgresHost = ""
			},
			expectErr: true,
		},
		{
			name: "Empty DB Name",
			mutate: func(c *Config) {
				c.PostgresDB = ""
			},
			expectErr: true,
		},
		{
			name: "Invalid DB Port",
			mutate: func(c *Config) {
				c.PostgresPort = "not-a-number"
			},
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &Config{
				AppEnv:           "development",
				APIPort:          "8080",
				PostgresHost:     "localhost",
				PostgresPort:     "5432",
				PostgresDB:       "personal_data_os",
				PostgresUser:     "personal_data",
				PostgresPassword: "change_me",
				PostgresSSLMode:  "disable",
			}
			tt.mutate(cfg)
			err := cfg.Validate()
			if (err != nil) != tt.expectErr {
				t.Errorf("Validate() error = %v, expectErr = %v", err, tt.expectErr)
			}
		})
	}
}

func TestDatabaseURL(t *testing.T) {
	cfg := &Config{
		PostgresHost:     "127.0.0.1",
		PostgresPort:     "5432",
		PostgresDB:       "personal_data_os",
		PostgresUser:     "user",
		PostgresPassword: "secret/pass#",
		PostgresSSLMode:  "disable",
	}

	expected := "postgres://user:secret%2Fpass%23@127.0.0.1:5432/personal_data_os?sslmode=disable"
	got := cfg.DatabaseURL()
	if got != expected {
		t.Errorf("DatabaseURL() = %s, expected %s", got, expected)
	}
}
