package main

import (
	"log/slog"
	"os"

	"github.com/joho/godotenv"
	"github.com/rishisulakhe/shipwright/backend/internal/config"
	"github.com/rishisulakhe/shipwright/backend/internal/database"
)

func main() {
	_ = godotenv.Load()

	cfg := config.Load()

	slog.Info("running database migrations")

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := database.RunMigrations(db, "migrations"); err != nil {
		slog.Error("migration failed", "error", err)
		os.Exit(1)
	}

	slog.Info("migrations completed successfully")
}
