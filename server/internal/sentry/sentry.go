package sentry

import (
	"log"
	"os"
	"time"

	"github.com/getsentry/sentry-go"
)

// Initialize sets up Sentry for the Go server
func Initialize() error {
	dsn := os.Getenv("SENTRY_GO_DSN")
	if dsn == "" {
		log.Println("[Sentry] Go backend DSN not configured, skipping initialization")
		return nil
	}

	err := sentry.Init(sentry.ClientOptions{
		Dsn:              dsn,
		Environment:      getEnvironment(),
		Release:          os.Getenv("SENTRY_RELEASE"),
		EnableLogs:       true, // Enable logs to be sent to Sentry
		TracesSampleRate: 1.0,  // Capture 100% of transactions for tracing
		AttachStacktrace: true,
		BeforeSend: func(event *sentry.Event, hint *sentry.EventHint) *sentry.Event {
			// Filter out development errors unless explicitly enabled
			if os.Getenv("GO_ENV") != "production" && os.Getenv("SENTRY_DEBUG") != "true" {
				return nil
			}
			return event
		},
	})

	if err != nil {
		return err
	}

	log.Println("[Sentry] Go backend initialized successfully")
	return nil
}

// Flush ensures all events are sent before shutdown
func Flush() {
	sentry.Flush(2 * time.Second)
}

// CaptureError sends an error to Sentry
func CaptureError(err error, tags map[string]string) {
	if err == nil {
		return
	}

	sentry.WithScope(func(scope *sentry.Scope) {
		for key, value := range tags {
			scope.SetTag(key, value)
		}
		sentry.CaptureException(err)
	})
}

// CaptureMessage sends a message to Sentry
func CaptureMessage(message string, level sentry.Level) {
	sentry.CaptureMessage(message)
}

// RecoverPanic recovers from panics and sends to Sentry
func RecoverPanic() {
	if r := recover(); r != nil {
		sentry.CurrentHub().Recover(r)
		sentry.Flush(2 * time.Second)
		panic(r) // Re-panic after capturing
	}
}

func getEnvironment() string {
	env := os.Getenv("GO_ENV")
	if env == "" {
		return "development"
	}
	return env
}
