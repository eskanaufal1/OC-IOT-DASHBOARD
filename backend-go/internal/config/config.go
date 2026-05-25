package config

import "os"

type Config struct {
	Port       string
	DatabaseURL string
	JWTSecret  string
	LLMURL     string
}

func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "8002"),
		DatabaseURL: getEnv("DATABASE_URL", "postgres://jelly:jelly1997@192.168.1.100:5433/iot_dashboard?sslmode=disable"),
		JWTSecret:   getEnv("JWT_SECRET", "iot-dashboard-secret-key-change-in-production"),
		LLMURL:      getEnv("LLM_URL", "http://localhost:8001"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
