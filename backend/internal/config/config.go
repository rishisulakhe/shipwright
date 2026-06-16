package config

import "os"

type Config struct {
	Port           string
	DatabaseURL    string
	JWTSecret      string
	LogLevel       string
	MigrationsPath string
}

func Load() *Config {
	return &Config{
		Port:           getEnv("PORT", "8080"),
		DatabaseURL:    getEnv("DATABASE_URL", "postgres://dduser:ddpass@db:5432/dockerdash?sslmode=disable"),
		JWTSecret:      getEnv("JWT_SECRET", "change-me-in-production"),
		LogLevel:       getEnv("LOG_LEVEL", "info"),
		MigrationsPath: getEnv("MIGRATIONS_PATH", "migrations"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
