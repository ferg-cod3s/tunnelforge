package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ferg-cod3s/tunnelforge/go-server/internal/sentry"
	"github.com/ferg-cod3s/tunnelforge/go-server/internal/server"
	"github.com/joho/godotenv"
)

const (
	DefaultPort = "4021"
)

func main() {
	// Load environment variables from .env.development if it exists
	if err := godotenv.Load("../.env.development"); err != nil {
		log.Printf("No .env.development file found, using system environment variables")
	}
	// Validate Sentry DSN
	if os.Getenv("SENTRY_GO_DSN") == "" {
		log.Printf("Warning: SENTRY_GO_DSN not set - Sentry error reporting disabled for Go server")
		log.Printf("Set SENTRY_GO_DSN in .env.development for error tracking")
	}

	// Initialize Sentry for error tracking
	if err := sentry.Initialize(); err != nil {
		log.Printf("Failed to initialize Sentry: %v", err)
	}
	// Ensure Sentry flushes events before shutdown
	defer sentry.Flush()

	port := os.Getenv("PORT")
	if port == "" {
		port = DefaultPort
	}

	// Create server instance
	srv, err := server.New(&server.Config{
		Port: port,
	})
	if err != nil {
		log.Fatalf("Failed to create server: %v", err)
	}

	// Start server in goroutine
	go func() {
		log.Printf("TunnelForge Go server starting on port %s", port)
		log.Printf("WebSocket endpoint: ws://localhost:%s/ws", port)
		log.Printf("Health check: http://localhost:%s/health", port)

		if err := srv.Start(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Create context with timeout for graceful shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}
