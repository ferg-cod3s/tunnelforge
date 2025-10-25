package middleware

import (
	"log"
	"net/http"
	"strings"
	"time"
)

// DetailedLoggingMiddleware logs all HTTP requests with comprehensive information
func DetailedLoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Create a response writer wrapper to capture status code
		wrapped := &loggingResponseWriter{ResponseWriter: w, statusCode: 200}

		// Log request details
		clientIP := extractClientIP(r)
		userAgent := r.Header.Get("User-Agent")
		referer := r.Header.Get("Referer")
		origin := r.Header.Get("Origin")

		log.Printf("[DETAILED-REQUEST] %s %s from %s - UA: %s - Referrer: %s - Origin: %s",
			r.Method, r.URL.Path, clientIP, userAgent, referer, origin)

		// Log all headers for debugging
		log.Printf("[HEADERS] %s %s - Headers: %+v", r.Method, r.URL.Path, r.Header)

		// Call the next handler
		next.ServeHTTP(wrapped, r)

		// Log response details
		duration := time.Since(start)
		log.Printf("[DETAILED-RESPONSE] %s %s - Status: %d - Duration: %v - Size: %d",
			r.Method, r.URL.Path, wrapped.statusCode, duration, wrapped.size)

		// Log connection errors specifically
		if wrapped.statusCode >= 400 {
			log.Printf("[DETAILED-ERROR] %s %s - Status: %d - IP: %s - UA: %s",
				r.Method, r.URL.Path, wrapped.statusCode, clientIP, userAgent)
		}
	})
}

// extractClientIP extracts the real client IP address (different name to avoid conflict)
func extractClientIP(r *http.Request) string {
	// Check X-Forwarded-For header
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// Take the first IP in the list
		if idx := strings.Index(xff, ","); idx != -1 {
			return strings.TrimSpace(xff[:idx])
		}
		return strings.TrimSpace(xff)
	}

	// Check X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}

	// Fall back to RemoteAddr
	if idx := strings.LastIndex(r.RemoteAddr, ":"); idx != -1 {
		return r.RemoteAddr[:idx]
	}
	return r.RemoteAddr
}

// loggingResponseWriter wraps http.ResponseWriter to capture status code and response size (different name)
type loggingResponseWriter struct {
	http.ResponseWriter
	statusCode int
	size       int
}

func (rw *loggingResponseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *loggingResponseWriter) Write(b []byte) (int, error) {
	n, err := rw.ResponseWriter.Write(b)
	rw.size += n
	return n, err
}

// ConnectionLoggingMiddleware logs connection attempts and failures
func ConnectionLoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		clientIP := extractClientIP(r)

		// Log connection attempt
		log.Printf("[CONNECT] New connection from %s to %s %s",
			clientIP, r.Method, r.URL.Path)

		// Check for connection-specific headers
		if origin := r.Header.Get("Origin"); origin != "" {
			log.Printf("[CORS] Origin: %s", origin)
		}

		if upgrade := r.Header.Get("Upgrade"); upgrade != "" {
			log.Printf("[WEBSOCKET] WebSocket upgrade request from %s", clientIP)
		}

		// Call next handler
		next.ServeHTTP(w, r)
	})
}

// ErrorLoggingMiddleware logs errors with context
func ErrorLoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("[PANIC] %s %s - Panic: %v", r.Method, r.URL.Path, err)
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			}
		}()

		next.ServeHTTP(w, r)
	})
}
