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
		DatabaseURL:    getEnv("DATABASE_URL", ""),
		JWTSecret:      getEnv("JWT_SECRET", ""),
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
