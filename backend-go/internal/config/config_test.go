package config

import (
	"os"
	"testing"
)

func TestLoad_Defaults(t *testing.T) {
	cfg := Load()

	if cfg.Port != "8002" {
		t.Errorf("Port = %q, want 8002", cfg.Port)
	}
	if cfg.JWTSecret != "iot-dashboard-secret-key-change-in-production" {
		t.Errorf("JWTSecret = %q", cfg.JWTSecret)
	}
	if cfg.LLMURL != "http://localhost:8001" {
		t.Errorf("LLMURL = %q", cfg.LLMURL)
	}
	if cfg.DatabaseURL == "" {
		t.Error("DatabaseURL should not be empty")
	}
}

func TestLoad_FromEnv(t *testing.T) {
	os.Setenv("PORT", "9999")
	os.Setenv("JWT_SECRET", "test-secret")
	os.Setenv("LLM_URL", "http://test:8001")
	defer func() {
		os.Unsetenv("PORT")
		os.Unsetenv("JWT_SECRET")
		os.Unsetenv("LLM_URL")
	}()

	cfg := Load()

	if cfg.Port != "9999" {
		t.Errorf("Port = %q, want 9999", cfg.Port)
	}
	if cfg.JWTSecret != "test-secret" {
		t.Errorf("JWTSecret = %q, want test-secret", cfg.JWTSecret)
	}
	if cfg.LLMURL != "http://test:8001" {
		t.Errorf("LLMURL = %q, want http://test:8001", cfg.LLMURL)
	}
}

func TestLoad_EnvNotSetUsesDefault(t *testing.T) {
	os.Unsetenv("PORT")
	os.Unsetenv("JWT_SECRET")
	os.Unsetenv("LLM_URL")

	cfg := Load()

	if cfg.Port != "8002" {
		t.Errorf("Port = %q, want 8002", cfg.Port)
	}
}
