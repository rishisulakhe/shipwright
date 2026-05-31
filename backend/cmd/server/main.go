package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/rishisulakhe/shipwright/backend/internal/config"
	appmiddleware "github.com/rishisulakhe/shipwright/backend/internal/middleware"
	"github.com/rishisulakhe/shipwright/backend/internal/database"
	"github.com/rishisulakhe/shipwright/backend/internal/handlers"
	"github.com/rishisulakhe/shipwright/backend/internal/repository"
)

func main() {
	cfg := config.Load()

	level := new(slog.LevelVar)
	switch cfg.LogLevel {
	case "debug":
		level.Set(slog.LevelDebug)
	case "warn":
		level.Set(slog.LevelWarn)
	case "error":
		level.Set(slog.LevelError)
	default:
		level.Set(slog.LevelInfo)
	}
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level}))
	slog.SetDefault(logger)

	db, err := database.Connect(cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	repos := repository.NewRepositories(db)

	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:5173"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	healthHandler := &handlers.HealthHandler{DB: db}
	r.Get("/api/health", healthHandler.Health)
	r.Get("/api/health/db", healthHandler.DBHealth)

	authHandler := &handlers.AuthHandler{
		Repos:     repos,
		JWTSecret: []byte(cfg.JWTSecret),
	}
	r.Post("/api/auth/register", authHandler.Register)
	r.Post("/api/auth/login", authHandler.Login)
	r.Post("/api/auth/refresh", authHandler.Refresh)

	r.Group(func(r chi.Router) {
		r.Use(appmiddleware.AuthMiddleware([]byte(cfg.JWTSecret)))

		meHandler := &handlers.MeHandler{}
		r.Get("/api/me", meHandler.Me)

		hostHandler := handlers.NewHostHandler(repos, []byte(cfg.JWTSecret))
		r.Post("/api/hosts", hostHandler.Create)
		r.Get("/api/hosts", hostHandler.List)
		r.Get("/api/hosts/{hostID}", hostHandler.Get)
		r.Delete("/api/hosts/{hostID}", hostHandler.Delete)
		r.Post("/api/hosts/{hostID}/test-connection", hostHandler.TestConnection)
		r.Get("/api/hosts/{hostID}/containers", hostHandler.ListContainers)
		r.Get("/api/hosts/{hostID}/networks", hostHandler.ListNetworks)
		r.Get("/api/hosts/{hostID}/volumes", hostHandler.ListVolumes)
		r.Get("/api/hosts/{hostID}/images", hostHandler.ListImages)

		containerHandler := handlers.NewContainerHandler(repos, hostHandler.GetClients())
		r.Post("/api/hosts/{hostID}/containers", containerHandler.Create)
		r.Post("/api/hosts/{hostID}/containers/{containerID}/start", containerHandler.Start)
		r.Post("/api/hosts/{hostID}/containers/{containerID}/stop", containerHandler.Stop)
		r.Delete("/api/hosts/{hostID}/containers/{containerID}", containerHandler.Delete)

		networkHandler := handlers.NewNetworkHandler(repos, hostHandler.GetClients())
		r.Post("/api/hosts/{hostID}/networks", networkHandler.Create)
		r.Delete("/api/hosts/{hostID}/networks/{networkID}", networkHandler.Delete)
		r.Get("/api/hosts/{hostID}/networks/{networkID}", networkHandler.Inspect)
		r.Post("/api/hosts/{hostID}/networks/{networkID}/connect", networkHandler.Connect)
		r.Post("/api/hosts/{hostID}/networks/{networkID}/disconnect", networkHandler.Disconnect)

		volumeHandler := handlers.NewVolumeHandler(repos, hostHandler.GetClients())
		r.Post("/api/hosts/{hostID}/volumes", volumeHandler.Create)
		r.Delete("/api/hosts/{hostID}/volumes/{volumeName}", volumeHandler.Delete)

		r.Route("/api/admin", func(r chi.Router) {
			r.Use(appmiddleware.RequireRole("admin"))
		})
	})

	srv := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, syscall.SIGINT, syscall.SIGTERM)

	serverErrors := make(chan error, 1)
	go func() {
		slog.Info("server starting", "port", cfg.Port)
		serverErrors <- srv.ListenAndServe()
	}()

	select {
	case err := <-serverErrors:
		slog.Error("server error", "error", err)
		os.Exit(1)
	case sig := <-shutdown:
		slog.Info("shutting down", "signal", sig.String())

		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := srv.Shutdown(ctx); err != nil {
			slog.Error("graceful shutdown failed", "error", err)
			os.Exit(1)
		}

		slog.Info("server stopped gracefully")
	}
}