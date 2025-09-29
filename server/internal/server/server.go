package server

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/cors"

	"github.com/ferg-cod3s/tunnelforge/go-server/internal/middleware"

	"github.com/ferg-cod3s/tunnelforge/go-server/internal/auth"
	"github.com/ferg-cod3s/tunnelforge/go-server/internal/analytics"
	"github.com/ferg-cod3s/tunnelforge/go-server/internal/registry"
	"github.com/ferg-cod3s/tunnelforge/go-server/internal/buffer"
	"github.com/ferg-cod3s/tunnelforge/go-server/internal/config"
	"github.com/ferg-cod3s/tunnelforge/go-server/internal/control"
	"github.com/ferg-cod3s/tunnelforge/go-server/internal/events"
	"github.com/ferg-cod3s/tunnelforge/go-server/internal/filesystem"
	"github.com/ferg-cod3s/tunnelforge/go-server/internal/git"
	"github.com/ferg-cod3s/tunnelforge/go-server/internal/logs"
	"github.com/ferg-cod3s/tunnelforge/go-server/internal/persistence"
	"github.com/ferg-cod3s/tunnelforge/go-server/internal/push"
	"github.com/ferg-cod3s/tunnelforge/go-server/internal/session"
	"github.com/ferg-cod3s/tunnelforge/go-server/internal/static"
	"github.com/ferg-cod3s/tunnelforge/go-server/internal/tmux"
	"github.com/ferg-cod3s/tunnelforge/go-server/internal/websocket"
	"github.com/ferg-cod3s/tunnelforge/go-server/internal/power"
	"github.com/ferg-cod3s/tunnelforge/go-server/internal/tunnels"
	"github.com/ferg-cod3s/tunnelforge/go-server/pkg/types"
)

type Config struct {
	Port string
}

type Server struct {
	config             *config.Config
	httpServer         *http.Server
	sessionManager     *session.Manager
	wsHandler          *websocket.Handler
	bufferAggregator   *buffer.BufferAggregator
	jwtAuth            *auth.JWTAuth
	passwordAuth       *auth.PasswordAuth
	fileSystem         *filesystem.FileSystemService
	gitService         *git.GitService
	logService         *logs.LogService
	controlService     *control.ControlService
	tmuxService        *tmux.TmuxService
	eventBroadcaster   *events.EventBroadcaster
	pushService        *push.PushService
	pushHandler        *push.PushHandler
	persistenceService *persistence.Service
	powerService       *power.Service
	tunnelService      *tunnels.Service
	startTime          time.Time
	analyticsService *analytics.Service
	registryService *registry.Service
	mu                 sync.RWMutex
}

func New(cfg *Config) (*Server, error) {
	// Load full configuration
	fullConfig := config.LoadConfig()
	if cfg.Port != "" {
		fullConfig.Port = cfg.Port
	}

	// Initialize persistence service if enabled
	var persistenceService *persistence.Service
	var sessionManager *session.Manager

	if fullConfig.EnablePersistence {
		// Create file store for session persistence
		fileStore, err := persistence.NewFileStore(fullConfig.PersistenceDir)
		if err != nil {
			log.Printf("Warning: Failed to initialize session persistence: %v", err)
			sessionManager = session.NewManager()
		} else {
			// Create persistence service with auto-save
			persistenceService = persistence.NewService(fileStore, true, fullConfig.PersistenceInterval)
			persistenceService.Start()

			// Create session manager with persistence
			sessionManager = session.NewManagerWithPersistence(persistenceService)

			// Restore persisted sessions on startup
			if err := sessionManager.RestorePersistedSessions(); err != nil {
				log.Printf("Warning: Failed to restore persisted sessions: %v", err)
			}
		}
	} else {
		// Create session manager without persistence
		sessionManager = session.NewManager()
	}

	// Create WebSocket handler
	wsHandler := websocket.NewHandler(sessionManager)
	wsHandler.SetAllowedOrigins(fullConfig.AllowedOrigins)

	// Create filesystem service with safe base path
	basePath := fullConfig.FileSystemBasePath
	if basePath == "" {
		basePath = "/" // Default to root, but this should be configured securely
	}
	fileSystemService := filesystem.NewFileSystemService(basePath)

	// Initialize authentication services
	// Initialize JWT revocation store
	revocationStore := auth.NewInMemoryRevocationStore()
	jwtAuth := auth.NewJWTAuth("tunnelforge-jwt-secret-change-in-production", revocationStore)
	passwordAuth := auth.NewPasswordAuth()
	// Initialize power management service
	powerService, err := power.NewService()
	if err != nil {
		log.Printf("Warning: Failed to initialize power management service: %v", err)
		powerService = nil
	}
	// Initialize tunnel services
	tunnelService := tunnels.NewService()
	if err := tunnelService.InitializeServices(); err != nil {
		log.Printf("Warning: Failed to initialize tunnel services: %v", err)
	}

	// Initialize event broadcaster
	eventBroadcaster := events.NewEventBroadcaster()

	// Create git service with safe base path
	gitBasePath := fullConfig.GitBasePath
	if gitBasePath == "" {
		gitBasePath = "/" // Default to root, but this should be configured securely
	}
	gitService := git.NewGitService(gitBasePath, eventBroadcaster)

	// Initialize buffer aggregator
	bufferAggregator := buffer.NewBufferAggregator()

	// Initialize log service
	logService := logs.NewLogService()

	// Initialize analytics service
	analyticsService := analytics.NewService(nil)

	// Initialize control service
	controlService := control.NewControlService(analyticsService)
	// Initialize registry service
	registryService := registry.NewService(nil)

	// Initialize tmux service
	tmuxService := tmux.NewTmuxService(sessionManager)

	// Initialize push notification system
	vapidKeyManager := push.NewVAPIDKeyManager(fullConfig.VAPIDKeyPath)
	vapidKeys, err := vapidKeyManager.GetOrGenerateKeys()
	if err != nil {
		log.Printf("Warning: Failed to initialize VAPID keys: %v", err)
		vapidKeys = nil
	}

	subscriptionStore := push.NewInMemorySubscriptionStore()
	var pushService *push.PushService
	var pushHandler *push.PushHandler

	if vapidKeys != nil {
		pushService, err = push.NewPushService(vapidKeys, subscriptionStore, nil)
		if err != nil {
			log.Printf("Warning: Failed to create push service: %v", err)
		} else {
			pushHandler = push.NewPushHandler(pushService, vapidKeyManager, subscriptionStore)
		}
	}

	s := &Server{
		config:             fullConfig,
		sessionManager:     sessionManager,
		wsHandler:          wsHandler,
		bufferAggregator:   bufferAggregator,
		jwtAuth:            jwtAuth,
		fileSystem:         fileSystemService,
		gitService:         gitService,
		logService:         logService,
		tmuxService:        tmuxService,
		controlService:     controlService,
		registryService:     registryService,
				analyticsService:    analyticsService,
		passwordAuth:       passwordAuth,
		powerService:       powerService,
		tunnelService:      tunnelService,
		pushService:        pushService,
		pushHandler:        pushHandler,
		persistenceService: persistenceService,
		eventBroadcaster:   eventBroadcaster,
		startTime:          time.Now(),
	}

	// Set up event broadcasting hooks
	s.setupEventHooks()

	// Setup HTTP server
	s.setupRoutes()

	return s, nil
}

func (s *Server) setupRoutes() {
	r := mux.NewRouter()

	// Health check
	r.HandleFunc("/health", s.handleHealth).Methods("GET")
	r.HandleFunc("/api/health", s.handleHealth).Methods("GET")

	// WebSocket endpoint
	r.HandleFunc("/ws", s.wsHandler.HandleWebSocket)

	// Buffer WebSocket endpoint for real-time terminal streaming
	r.HandleFunc("/buffers", s.bufferAggregator.HandleWebSocket)

	// API routes - unprotected base
	api := r.PathPrefix("/api").Subrouter()

	// General server endpoints for frontend compatibility
	api.HandleFunc("/config", s.handleServerConfig).Methods("GET")
	api.HandleFunc("/server/status", s.handleServerStatus).Methods("GET")

	// Server-Sent Events endpoint for real-time events
	api.HandleFunc("/events", s.eventBroadcaster.HandleSSE).Methods("GET")

	// Test endpoint to trigger events (for development/testing)
	api.HandleFunc("/events/test", s.handleTestEvent).Methods("POST")

	// Auth routes (should be accessible without authentication)
	auth := api.PathPrefix("/auth").Subrouter()
	auth.HandleFunc("/config", s.handleAuthConfig).Methods("GET")
	auth.HandleFunc("/login", s.handleLogin).Methods("POST")
	auth.HandleFunc("/password", s.handlePasswordAuth).Methods("POST")

	// Create authentication middleware that supports both JWT and local bypass
	authMiddleware := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Check for local bypass header first (for Mac app compatibility)
			if s.config.AllowLocalBypass {
				localHeader := r.Header.Get("X-TunnelForge-Local")
				if localHeader != "" {
					// Check if the request is from localhost
					clientIP := getClientIP(r)
					if isLocalhost(clientIP) {
						// Create a local user context for bypass authentication
						userCtx := &middleware.UserContext{
							UserID:   "local-user",
							Username: "system",
							Role:     "admin", // Local bypass gets admin privileges
						}
						ctx := context.WithValue(r.Context(), middleware.UserContextKey, userCtx)
						r = r.WithContext(ctx)
						next.ServeHTTP(w, r)
						return
					}
				}
			}

			// Fall back to standard JWT authentication
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				s.writeJSONError(w, "missing authorization header", http.StatusUnauthorized)
				return
			}

			const bearerPrefix = "Bearer "
			if !strings.HasPrefix(authHeader, bearerPrefix) {
				s.writeJSONError(w, "invalid authorization header format", http.StatusUnauthorized)
				return
			}

			token := strings.TrimPrefix(authHeader, bearerPrefix)
			userClaims, err := s.jwtAuth.ValidateToken(token)
			if err != nil {
				s.writeJSONError(w, fmt.Sprintf("invalid token: %v", err), http.StatusUnauthorized)
				return
			}

			// Add user context to request (similar to middleware.UserContext)
			userCtx := &middleware.UserContext{
				UserID:   userClaims.UserID,
				Username: userClaims.Username,
				Role:     strings.Join(userClaims.Roles, ","), // Join roles for compatibility
			}

			ctx := context.WithValue(r.Context(), middleware.UserContextKey, userCtx)
			r = r.WithContext(ctx)

			next.ServeHTTP(w, r)
		})
	}

	// Conditionally protect current-user endpoint based on auth requirement
	if s.config.AuthRequired {
		protectedAuth := auth.NewRoute().Subrouter()
		protectedAuth.Use(authMiddleware)
		protectedAuth.HandleFunc("/current-user", s.handleCurrentUser).Methods("GET")
		protectedAuth.HandleFunc("/logout", s.handleLogout).Methods("POST")
	} else {
		// When auth is not required, provide current-user endpoint without protection
		auth.HandleFunc("/current-user", s.handleCurrentUser).Methods("GET")
	}

	// Session routes (protected if auth is required)
	sessionRouter := api
	if s.config.AuthRequired {
		protectedAPI := api.NewRoute().Subrouter()
		protectedAPI.Use(authMiddleware)
		sessionRouter = protectedAPI
	}
	sessionRouter.HandleFunc("/sessions", s.handleListSessions).Methods("GET")
	sessionRouter.HandleFunc("/sessions", s.handleCreateSession).Methods("POST")
	sessionRouter.HandleFunc("/sessions/{id}", s.handleGetSession).Methods("GET")
	sessionRouter.HandleFunc("/sessions/{id}", s.handleDeleteSession).Methods("DELETE")
	sessionRouter.HandleFunc("/sessions/{id}/resize", s.handleResizeSession).Methods("POST")
	sessionRouter.HandleFunc("/sessions/{id}/reset-size", s.handleResetSessionSize).Methods("POST")
	sessionRouter.HandleFunc("/sessions/{id}/input", s.handleSessionInput).Methods("POST")
	sessionRouter.HandleFunc("/sessions/{id}/stream", s.handleSessionStream).Methods("GET")
	sessionRouter.HandleFunc("/cleanup-exited", s.handleCleanupExited).Methods("POST")
	sessionRouter.HandleFunc("/sessions/bulk", s.handleBulkCreateSessions).Methods("POST")
	sessionRouter.HandleFunc("/sessions/bulk/delete", s.handleBulkDeleteSessions).Methods("POST")
	sessionRouter.HandleFunc("/sessions/bulk/resize", s.handleBulkResizeSessions).Methods("POST")
	sessionRouter.HandleFunc("/sessions/groups", s.handleListSessionGroups).Methods("GET")
	sessionRouter.HandleFunc("/sessions/groups", s.handleCreateSessionGroup).Methods("POST")
	sessionRouter.HandleFunc("/sessions/groups/{groupId}", s.handleGetSessionGroup).Methods("GET")
	sessionRouter.HandleFunc("/sessions/groups/{groupId}", s.handleDeleteSessionGroup).Methods("DELETE")
	sessionRouter.HandleFunc("/sessions/groups/{groupId}/sessions", s.handleAddSessionToGroup).Methods("POST")
	sessionRouter.HandleFunc("/sessions/groups/{groupId}/sessions/{sessionId}", s.handleRemoveSessionFromGroup).Methods("DELETE")
	sessionRouter.HandleFunc("/sessions/{id}/groups", s.handleGetSessionGroups).Methods("GET")
	sessionRouter.HandleFunc("/sessions/{id}/hierarchy", s.handleGetSessionHierarchy).Methods("GET")
	sessionRouter.HandleFunc("/sessions/{id}/dependencies", s.handleGetSessionDependencies).Methods("GET")
	sessionRouter.HandleFunc("/sessions/tags", s.handleListSessionTags).Methods("GET")
	sessionRouter.HandleFunc("/sessions/tags", s.handleCreateSessionTag).Methods("POST")
	sessionRouter.HandleFunc("/sessions/tags/{tagName}", s.handleDeleteSessionTag).Methods("DELETE")
	sessionRouter.HandleFunc("/sessions/by-tag/{tagName}", s.handleGetSessionsByTag).Methods("GET")
	sessionRouter.HandleFunc("/registry/instances", s.handleListRegistryInstances).Methods("GET")
	sessionRouter.HandleFunc("/registry/instances", s.handleRegisterRegistryInstance).Methods("POST")
	sessionRouter.HandleFunc("/registry/instances/{instanceId}", s.handleGetRegistryInstance).Methods("GET")
	sessionRouter.HandleFunc("/analytics/metrics", s.handleGetAnalyticsMetrics).Methods("GET")
	sessionRouter.HandleFunc("/analytics/events", s.handleGetAnalyticsEvents).Methods("GET")
	sessionRouter.HandleFunc("/analytics/users/{userId}/activity", s.handleGetUserActivity).Methods("GET")
	sessionRouter.HandleFunc("/analytics/export", s.handleExportAnalytics).Methods("POST")
	sessionRouter.HandleFunc("/registry/instances/{instanceId}", s.handleUnregisterRegistryInstance).Methods("DELETE")
	sessionRouter.HandleFunc("/registry/sessions", s.handleDiscoverRemoteSessions).Methods("GET")
	sessionRouter.HandleFunc("/registry/sessions/{instanceId}/{sessionId}", s.handleGetRemoteSession).Methods("GET")
	sessionRouter.HandleFunc("/registry/stats", s.handleGetRegistryStats).Methods("GET")

	// Filesystem routes
	s.fileSystem.RegisterRoutes(r)

	// Git routes
	s.gitService.RegisterRoutes(r)

	// Log routes
	s.logService.RegisterRoutes(r)

	// Control routes
	s.controlService.RegisterRoutes(r)

	// Power management routes
	if s.powerService != nil {
		s.registerPowerRoutes(r)
	}
	// Tunnel routes
	if s.tunnelService != nil {
		s.registerTunnelRoutes(r)
	}
	// Tmux routes
	s.tmuxService.RegisterRoutes(r)

	// Repository discovery routes (for frontend file browser)
	sessionRouter.HandleFunc("/repositories/discover", s.handleRepositoryDiscover).Methods("GET")

	// Push notification routes
	if s.pushHandler != nil {
		s.pushHandler.RegisterRoutes(r)
	}

	// Domain setup routes

	// Control stream route (for frontend compatibility)
	sessionRouter.HandleFunc("/control/stream", s.handleControlStream).Methods("GET")
	// Control stream route (for frontend compatibility)
	sessionRouter.HandleFunc("/control/stream", s.handleControlStream).Methods("GET")

	// Static file serving (serve embedded frontend files)
	staticHandler, err := static.GetStaticHandler()
	if err != nil {
		log.Printf("Warning: Could not set up static file serving: %v", err)
	} else {
		// Serve static files at root, but only if not an API route
		r.PathPrefix("/").Handler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// If it's an API route, WebSocket, or health check, don't serve static files
			if strings.HasPrefix(r.URL.Path, "/api/") || 
			   strings.HasPrefix(r.URL.Path, "/ws") || 
			   strings.HasPrefix(r.URL.Path, "/buffers") || 
			   strings.HasPrefix(r.URL.Path, "/health") {
				http.NotFound(w, r)
				return
			}
			
			// The static handler now handles the root path internally
			staticHandler.ServeHTTP(w, r)
		}))
	}

	// CORS middleware
	c := cors.New(cors.Options{
		AllowedOrigins:   s.config.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization", "X-Requested-With", "X-CSRF-Token"},
		AllowCredentials: true,
	})

	// Build middleware chain: Apply security middleware in order
	var handler http.Handler = r

	// Apply CORS first (innermost)
	corsHandler := c.Handler(handler)

	// Apply compression and security headers, but skip for WebSocket and SSE routes
	handler = http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		// Skip compression and security headers for WebSocket and SSE endpoints
			if req.URL.Path == "/ws" || 
				strings.HasPrefix(req.URL.Path, "/api/fs/") || 
				req.URL.Path == "/buffers" ||
				req.URL.Path == "/api/events" ||
				req.URL.Path == "/api/repositories/discover" ||
				req.URL.Path == "/api/control/stream" ||
				strings.Contains(req.URL.Path, "/stream") {
			// SSE and WebSocket endpoints need direct access to the connection
			corsHandler.ServeHTTP(w, req)
			return
		}

		// Apply compression and security headers for non-streaming routes
		compressionHandler := middleware.Compression()(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			securityHandler := middleware.SecurityHeaders()(corsHandler)
			securityHandler.ServeHTTP(w, req)
		}))
		compressionHandler.ServeHTTP(w, req)
	})

	// Apply rate limiting if enabled, but skip for WebSocket and SSE endpoints
	if s.config.EnableRateLimit {
		rateLimiter := middleware.NewRateLimiter(s.config.RateLimitPerMin, time.Minute)
		prevHandler := handler // Capture current handler before redefining
		handler = http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			// Skip rate limiting for WebSocket and SSE endpoints to avoid hijacking interference
            if req.URL.Path == "/ws" || 
               strings.HasPrefix(req.URL.Path, "/api/fs/") || 
               req.URL.Path == "/buffers" ||
               req.URL.Path == "/api/events" ||
               req.URL.Path == "/api/repositories/discover" ||
               req.URL.Path == "/api/control/stream" ||
               strings.Contains(req.URL.Path, "/stream") {
				prevHandler.ServeHTTP(w, req)
				return
			}
			// Apply rate limiting for non-streaming routes
			rateLimiter.Middleware(prevHandler).ServeHTTP(w, req)
		})
	}

	// Apply request logging if enabled, but skip for WebSocket and SSE endpoints
	if s.config.EnableRequestLog {
		prevHandler := handler // Capture current handler before redefining
		handler = http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			// Skip request logging for WebSocket and SSE endpoints to avoid hijacking interference
            if req.URL.Path == "/ws" || 
               strings.HasPrefix(req.URL.Path, "/api/fs/") || 
               req.URL.Path == "/buffers" ||
               req.URL.Path == "/api/events" ||
               req.URL.Path == "/api/repositories/discover" ||
               req.URL.Path == "/api/control/stream" ||
               strings.Contains(req.URL.Path, "/stream") {
				prevHandler.ServeHTTP(w, req)
				return
			}
			// Apply request logging for non-streaming routes
			middleware.RequestLogger()(prevHandler).ServeHTTP(w, req)
		})
	}

	// Apply CSRF protection if enabled (for state-changing operations)
	if s.config.EnableCSRF {
		csrf := middleware.NewCSRF(middleware.CSRFConfig{
			Secret:    s.config.CSRFSecret,
			TokenName: "csrf_token",
		})
		handler = csrf.Middleware(handler)
	}

	// Apply IP whitelist if enabled (outermost - first check)
	if s.config.EnableIPWhitelist {
		ipWhitelist := middleware.NewIPWhitelist(s.config.AllowedIPs)
		handler = ipWhitelist.Middleware(handler)
	}

	s.httpServer = &http.Server{
		Addr:         fmt.Sprintf("%s:%s", s.config.Host, s.config.Port),
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
	s.mu.Lock()
	s.mu.Unlock()
}

// Handler returns the HTTP handler for the server
func (s *Server) Handler() http.Handler {
	return s.httpServer.Handler
}

func (s *Server) Start() error {
	// Start event broadcaster
	s.eventBroadcaster.Start()

	// Start buffer aggregator
	// Start analytics service
	if err := s.analyticsService.Start(); err != nil {
		log.Printf("Failed to start analytics service: %v", err)
	}
	go s.bufferAggregator.Start()

	// Start push notification service
	if s.pushService != nil {
		if err := s.pushService.Start(); err != nil {
			log.Printf("Failed to start push service: %v", err)
		}
	}
	// Start registry service
	if err := s.registryService.Start(); err != nil {
		log.Printf("Failed to start registry service: %v", err)
	}

	// Broadcast server start event
	startEvent := types.NewServerEvent(types.EventConnected).
		WithMessage("TunnelForge Go server started")
	s.broadcastEvent(startEvent)

	return s.httpServer.ListenAndServe()
}

func (s *Server) Shutdown(ctx context.Context) error {
	// Broadcast server shutdown event
shutdownEvent := types.NewServerEvent(types.EventServerShutdown)
shutdownEvent = shutdownEvent.WithMessage("TunnelForge Go server shutting down")
	// Stop analytics service
	if err := s.analyticsService.Stop(); err != nil {
		log.Printf("Failed to stop analytics service: %v", err)
	}
	s.broadcastEvent(shutdownEvent)

	// Stop buffer aggregator
	s.bufferAggregator.Stop()

	// Stop push notification service
	if s.pushService != nil {
		if err := s.pushService.Stop(); err != nil {
			log.Printf("Failed to stop push service: %v", err)
		}
	}
	// Stop registry service
	if err := s.registryService.Stop(); err != nil {
		log.Printf("Failed to stop registry service: %v", err)
	}

	// Stop event broadcaster
	s.eventBroadcaster.Stop()

	// Close all sessions
	s.sessionManager.CloseAll()

	// Stop persistence service
	if s.persistenceService != nil {
		s.persistenceService.Stop()
	}

	// Shutdown HTTP server
	return s.httpServer.Shutdown(ctx)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	fmt.Fprintf(w, `{"status":"ok","sessions":%d,"uptime":"%s"}`,
		s.sessionManager.Count(), time.Since(s.startTime).String())
}

// API handlers for Phase 4 implementation
func (s *Server) handleListSessions(w http.ResponseWriter, r *http.Request) {
	sessions := s.sessionManager.List()
	w.Header().Set("Content-Type", "application/json")

	// Convert to response format
	responses := make([]*types.SessionResponse, 0, len(sessions))
	for _, session := range sessions {
		status := "exited"
		if session.Active {
			status = "running"
		}
		responses = append(responses, &types.SessionResponse{
			ID:        session.ID,
			Title:     session.Title,
			Command:   session.Command,
			Cwd:       session.Cwd,
			Cols:      session.Cols,
			Rows:      session.Rows,
			CreatedAt: session.CreatedAt,
			UpdatedAt: session.UpdatedAt,
			Status:    status,
			Active:    session.Active,
			Clients:   len(session.Clients),
		})
	}

	// Return sessions array directly to match frontend expectations
	if err := json.NewEncoder(w).Encode(responses); err != nil {
		log.Printf("Failed to encode sessions response: %v", err)
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

func (s *Server) handleCreateSession(w http.ResponseWriter, r *http.Request) {
	var req types.SessionCreateRequest

	// Parse request body
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		// Return error for invalid JSON
		s.writeJSONError(w, "Invalid JSON in request body", http.StatusBadRequest)
		return
	}

	// Create session
	session, err := s.sessionManager.Create(&req)
	if err != nil {
		log.Printf("Failed to create session: %v", err)
		http.Error(w, fmt.Sprintf("Failed to create session: %v", err), http.StatusInternalServerError)
		return
	}

	// Broadcast session start event
	// Record analytics event
	s.analyticsService.RecordSessionActivity("system", session.ID, "created", nil)
	startEvent := types.NewServerEvent(types.EventSessionStart).
		WithSessionID(session.ID).
		WithSessionName(session.Title).
		WithCommand(session.Command)
	s.broadcastEvent(startEvent)

	// Return session response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)

	status := "exited"
	if session.Active {
		status = "running"
	}
	response := &types.SessionResponse{
		ID:        session.ID,
		Title:     session.Title,
		Command:   session.Command,
		Cwd:       session.Cwd,
		Cols:      session.Cols,
		Rows:      session.Rows,
		CreatedAt: session.CreatedAt,
		UpdatedAt: session.UpdatedAt,
		Status:    status,
		Active:    session.Active,
		Clients:   len(session.Clients),
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Failed to encode session response: %v", err)
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

// writeJSONError writes a JSON error response
func (s *Server) writeJSONError(w http.ResponseWriter, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	if err := json.NewEncoder(w).Encode(map[string]string{"error": message}); err != nil {
		log.Printf("Failed to encode error response: %v", err)
	}
}

func (s *Server) handleGetSession(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["id"]

	session := s.sessionManager.Get(sessionID)
	if session == nil {
		s.writeJSONError(w, "Session not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	status := "exited"
	if session.Active {
		status = "running"
	}
	response := &types.SessionResponse{
		ID:        session.ID,
		Title:     session.Title,
		Command:   session.Command,
		Cwd:       session.Cwd,
		Cols:      session.Cols,
		Rows:      session.Rows,
		CreatedAt: session.CreatedAt,
		UpdatedAt: session.UpdatedAt,
		Status:    status,
		Active:    session.Active,
		Clients:   len(session.Clients),
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Failed to encode session response: %v", err)
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

func (s *Server) handleDeleteSession(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["id"]

	// Get session info before closing for event broadcasting
	session := s.sessionManager.Get(sessionID)

	if err := s.sessionManager.Close(sessionID); err != nil {
		log.Printf("Failed to close session %s: %v", sessionID, err)
		s.writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Broadcast session exit event
	if session != nil {
		exitEvent := types.NewServerEvent(types.EventSessionExit).
			WithSessionID(session.ID).
			WithSessionName(session.Title).
			WithCommand(session.Command)
		s.broadcastEvent(exitEvent)
	}

	w.WriteHeader(http.StatusOK)
}

// handleServerConfig returns general server configuration
func (s *Server) handleServerConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	config := map[string]interface{}{
		"serverName":   s.config.ServerName,
		"version":      "1.0.0",
		"authRequired": s.config.AuthRequired,
		"features": map[string]bool{
			"auth":       true,
			"filesystem": true,
			"git":        true,
			"websocket":  true,
			"sse":        true, // ✅ SSE events implemented
		},
		"limits": map[string]interface{}{
			"maxSessions":    s.config.MaxSessions,
			"sessionTimeout": s.config.SessionTimeout,
		},
	}

	if err := json.NewEncoder(w).Encode(config); err != nil {
		log.Printf("Failed to encode server config response: %v", err)
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

// handleServerStatus returns server status (similar to health but with more info)
func (s *Server) handleServerStatus(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	status := map[string]interface{}{
		"status":     "running",
		"healthy":    true,
		"sessions":   s.sessionManager.Count(),
		"uptime":     time.Since(s.startTime).String(),
		"uptimeMs":   time.Since(s.startTime).Milliseconds(),
		"serverName": s.config.ServerName,
		"version":    "1.0.0",
		"timestamp":  time.Now().Unix(),
	}

	if err := json.NewEncoder(w).Encode(status); err != nil {
		log.Printf("Failed to encode server status response: %v", err)
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

// handleAuthConfig returns authentication configuration for the frontend
func (s *Server) handleAuthConfig(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Frontend expects the Option A format
	authRequired := s.config.AuthRequired
	passwordAuth := true // Supported today
	sshKeyAuth := false  // Not yet implemented

	methods := make([]string, 0, 2)
	if passwordAuth {
		methods = append(methods, "password")
	}
	if sshKeyAuth {
		methods = append(methods, "ssh-key")
	}

	resp := map[string]interface{}{
		"authRequired": authRequired,
		"authMethods":  methods,
		"passwordAuth": passwordAuth,
		"sshKeyAuth":   sshKeyAuth,
	}

	if err := json.NewEncoder(w).Encode(resp); err != nil {
		log.Printf("Failed to encode auth config response: %v", err)
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

// handleResizeSession resizes a terminal session
func (s *Server) handleResizeSession(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["id"]

	var req types.ResizeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeJSONError(w, "Invalid resize request", http.StatusBadRequest)
		return
	}

	// Validate dimensions
	if req.Cols <= 0 || req.Rows <= 0 {
		s.writeJSONError(w, "Invalid terminal dimensions", http.StatusBadRequest)
		return
	}

	if err := s.sessionManager.Resize(sessionID, req.Cols, req.Rows); err != nil {
		log.Printf("Failed to resize session %s: %v", sessionID, err)
		s.writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// handleSessionInput sends input to a terminal session
func (s *Server) handleSessionInput(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["id"]

	var req types.InputMessage
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeJSONError(w, "Invalid input request", http.StatusBadRequest)
		return
	}

	if err := s.sessionManager.WriteInput(sessionID, req.Data); err != nil {
		log.Printf("Failed to write input to session %s: %v", sessionID, err)
		s.writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// handleSessionStream provides Server-Sent Events stream for session output
func (s *Server) handleSessionStream(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["id"]

	session := s.sessionManager.Get(sessionID)
	if session == nil {
		s.writeJSONError(w, "Session not found", http.StatusNotFound)
		return
	}

	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	flusher, ok := w.(http.Flusher)
	if !ok {
		s.writeJSONError(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	// Create a channel to receive output from the session
	outputChan := make(chan []byte, 100)
	defer close(outputChan)

	// Register this stream with the session manager
	if err := s.sessionManager.AddSSEStream(sessionID, outputChan); err != nil {
		s.writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer s.sessionManager.RemoveSSEStream(sessionID, outputChan)

	// Stream output until client disconnects
	for {
		select {
		case data, ok := <-outputChan:
			if !ok {
				return
			}

			// Send SSE event
			if _, err := fmt.Fprintf(w, "data: %snn", string(data)); err != nil {
				log.Printf("Failed to write SSE data: %v", err)
				return
			}
			flusher.Flush()

		case <-r.Context().Done():
			return
		}
	}
}

// handleLogin handles user authentication and returns JWT token
func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var loginReq struct {
		Password string `json:"password"`
		Username string `json:"username,omitempty"` // Optional for future use
	}

	if err := json.NewDecoder(r.Body).Decode(&loginReq); err != nil {
		s.writeJSONError(w, "Invalid JSON request", http.StatusBadRequest)
		return
	}

	if loginReq.Password == "" {
		s.writeJSONError(w, "Password is required", http.StatusBadRequest)
		return
	}

	// For now, use a simple password check (should be configurable in production)
	expectedPassword := "tunnelforge-dev-password" // Should come from config
	if loginReq.Password != expectedPassword {
		s.writeJSONError(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Generate JWT token
	username := loginReq.Username
	if username == "" {
		username = "user"
	}

	userClaims := auth.UserClaims{
		UserID:   "user-1",
		Username: username,
		Roles:    []string{"user"},
	}

	token, err := s.jwtAuth.GenerateToken(userClaims, time.Hour*24)
	if err != nil {
		log.Printf("Failed to generate token: %v", err)
		s.writeJSONError(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"token":   token,
		"user": map[string]string{
			"id":       "user-1",
			"username": username,
			"role":     "user",
		},
	}); err != nil {
		log.Printf("Failed to encode login response: %v", err)
	}
}
// handleLogout handles user logout by revoking the JWT token
func (s *Server) handleLogout(w http.ResponseWriter, r *http.Request) {
	// Get the Authorization header
	authHeader := r.Header.Get("Authorization")
	if authHeader == "" {
		s.writeJSONError(w, "missing authorization header", http.StatusUnauthorized)
		return
	}

	// Check if it's a Bearer token
	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || parts[0] != "Bearer" {
		s.writeJSONError(w, "invalid authorization header format", http.StatusUnauthorized)
		return
	}

	tokenString := strings.TrimSpace(parts[1])
	if tokenString == "" {
		s.writeJSONError(w, "missing token", http.StatusBadRequest)
		return
	}

	// Revoke the token
	if err := s.jwtAuth.RevokeToken(tokenString); err != nil {
		log.Printf("Failed to revoke token: %v", err)
		s.writeJSONError(w, "Failed to logout", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Successfully logged out",
	}); err != nil {
		log.Printf("Failed to encode logout response: %v", err)
	}
}

// handlePasswordAuth handles password authentication (alternative endpoint)
func (s *Server) handlePasswordAuth(w http.ResponseWriter, r *http.Request) {
	// If auth is not required, just return success
	if !s.config.AuthRequired {
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Authentication not required",
			"token":   "guest-token",
			"user": map[string]string{
				"id":       "guest",
				"username": "guest",
				"role":     "admin",
			},
		}); err != nil {
			log.Printf("Failed to encode password auth response: %v", err)
		}
		return
	}

	// If auth is required, delegate to handleLogin
	s.handleLogin(w, r)
}

// handleCurrentUser returns current authenticated user info
func (s *Server) handleCurrentUser(w http.ResponseWriter, r *http.Request) {
	log.Printf("🔍 handleCurrentUser called - Method: %s, URL: %s", r.Method, r.URL.String())
	log.Printf("🔍 Auth required: %v", s.config.AuthRequired)
	log.Printf("🔍 Request headers: %v", r.Header)

	// Extract user from context (set by JWT middleware)
	userCtx := middleware.GetUserFromContext(r.Context())
	log.Printf("🔍 User context from JWT middleware: %+v", userCtx)

	// If no user context and auth is not required, return the system user
	if userCtx == nil && !s.config.AuthRequired {
		log.Printf("🔍 No user context and auth not required - getting system user")

		// Get current system user
		username := os.Getenv("USER")
		log.Printf("🔍 USER env var: %q", username)
		if username == "" {
			username = os.Getenv("USERNAME")
			log.Printf("🔍 USERNAME env var: %q", username)
		}
		if username == "" {
			username = "unknown"
			log.Printf("🔍 Fallback to 'unknown' username")
		}

		response := map[string]interface{}{
			"success": true,
			"userId":  username, // Frontend expects this field
			"user": map[string]string{
				"id":       username,
				"username": username,
				"role":     "admin", // Grant full access when auth is disabled
			},
		}

		log.Printf("🔍 Sending response: %+v", response)
		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(response); err != nil {
			log.Printf("❌ Error encoding response: %v", err)
		}
		return
	}

	// If no user context and auth is required, return error
	if userCtx == nil {
		log.Printf("🔍 No user context and auth is required - returning unauthorized")
		s.writeJSONError(w, "Authentication required", http.StatusUnauthorized)
		return
	}

	log.Printf("🔍 Using JWT user context")
	response := map[string]interface{}{
		"success": true,
		"userId":  userCtx.Username, // Frontend expects this field
		"user": map[string]string{
			"id":       userCtx.UserID,
			"username": userCtx.Username,
			"role":     userCtx.Role,
		},
	}

	log.Printf("🔍 Sending authenticated response: %+v", response)
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("❌ Error encoding authenticated response: %v", err)
	}
}

// setupEventHooks configures event broadcasting hooks for session lifecycle events
func (s *Server) setupEventHooks() {
	// Set up push notification integration with event broadcasting
	// We'll intercept the broadcast calls and also send push notifications
	log.Println("📡 Event hooks configured with push notification integration")
}

// broadcastEvent broadcasts an event to both SSE and push notification systems
func (s *Server) broadcastEvent(event *types.ServerEvent) {
	// First, broadcast via SSE
	s.eventBroadcaster.Broadcast(event)

	// Then, send push notifications if push service is available
	if s.pushService != nil {
		ctx := context.Background()
		if err := s.pushService.ProcessServerEvent(ctx, event); err != nil {
			log.Printf("Failed to process push notification for event %s: %v", event.Type, err)
		}
	}
}

// handleTestEvent handles test event broadcasting (for development/testing)
func (s *Server) handleTestEvent(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Type    string `json:"type"`
		Message string `json:"message"`
		Title   string `json:"title,omitempty"`
		Body    string `json:"body,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeJSONError(w, "Invalid JSON request", http.StatusBadRequest)
		return
	}

	// Create test event
	var event *types.ServerEvent
	switch req.Type {
	case "test-notification":
		event = types.NewServerEvent(types.EventTestNotification).
			WithMessage(req.Message).
			WithTestNotification(req.Title, req.Body)
	default:
		// Generic test event
		event = types.NewServerEvent(types.EventTestNotification).
			WithMessage(req.Message)
	}

	// Broadcast the event
	s.broadcastEvent(event)

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Test event broadcasted",
		"clients": s.eventBroadcaster.GetClientCount(),
	}); err != nil {
		log.Printf("Failed to encode test event response: %v", err)
	}
}

// handleRepositoryDiscover handles repository discovery for frontend file browser
func (s *Server) handleRepositoryDiscover(w http.ResponseWriter, r *http.Request) {
	// Get path parameter from query string
	queryPath := r.URL.Query().Get("path")
	if queryPath == "" {
		queryPath = "~"
	}

	// Expand ~ to home directory
	if strings.HasPrefix(queryPath, "~") {
		homeDir := os.Getenv("HOME")
		if homeDir != "" {
			queryPath = strings.Replace(queryPath, "~", homeDir, 1)
		}
	}

	// Resolve the path
	fullPath, err := filepath.Abs(queryPath)
	if err != nil {
		log.Printf("Failed to resolve path %s: %v", queryPath, err)
		s.writeJSONError(w, fmt.Sprintf("Invalid path: %v", err), http.StatusBadRequest)
		return
	}

	// Check if path exists and is accessible
	if _, err := os.Stat(fullPath); err != nil {
		if os.IsNotExist(err) {
			s.writeJSONError(w, "Path not found", http.StatusNotFound)
		} else {
			s.writeJSONError(w, fmt.Sprintf("Access denied: %v", err), http.StatusForbidden)
		}
		return
	}

	// Read directory contents
	entries, err := os.ReadDir(fullPath)
	if err != nil {
		log.Printf("Failed to read directory %s: %v", fullPath, err)
		s.writeJSONError(w, fmt.Sprintf("Failed to read directory: %v", err), http.StatusInternalServerError)
		return
	}

	var repositories []map[string]interface{}
	var directories []map[string]interface{}

	for _, entry := range entries {
		// Skip hidden files/directories unless specifically requested
		if strings.HasPrefix(entry.Name(), ".") {
			continue
		}

		entryPath := filepath.Join(fullPath, entry.Name())
		relativePath := filepath.Join(queryPath, entry.Name())

		if entry.IsDir() {
			directoryInfo := map[string]interface{}{
				"name": entry.Name(),
				"path": relativePath,
			}
			directories = append(directories, directoryInfo)

			// Check if it's a Git repository
			gitPath := filepath.Join(entryPath, ".git")
			if _, err := os.Stat(gitPath); err == nil {
				repositoryInfo := map[string]interface{}{
					"name":         entry.Name(),
					"path":         relativePath,
					"type":         "directory",
					"isRepository": true,
				}
				repositories = append(repositories, repositoryInfo)
			}
		}
	}

	// Sort by name
	sort.Slice(repositories, func(i, j int) bool {
		return repositories[i]["name"].(string) < repositories[j]["name"].(string)
	})
	sort.Slice(directories, func(i, j int) bool {
		return directories[i]["name"].(string) < directories[j]["name"].(string)
	})

	response := map[string]interface{}{
		"path":         queryPath,
		"fullPath":     fullPath,
		"repositories": repositories,
		"directories":  directories,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Failed to encode repository discovery response: %v", err)
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

// handleCleanupExited removes all exited sessions
func (s *Server) handleCleanupExited(w http.ResponseWriter, r *http.Request) {
	sessions := s.sessionManager.List()
	var removedCount int

	for _, session := range sessions {
		// Check if the session's process has exited
		if !session.Active || (session.Cmd != nil && session.Cmd.ProcessState != nil) {
			if err := s.sessionManager.Close(session.ID); err != nil {
				log.Printf("Failed to cleanup exited session %s: %v", session.ID, err)
			} else {
				removedCount++
			}
		}
	}

	response := map[string]interface{}{
		"message": fmt.Sprintf("Cleaned up %d exited sessions", removedCount),
		"count":   removedCount,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Failed to encode cleanup response: %v", err)
	}
}

// handleResetSessionSize resets terminal size to default dimensions
func (s *Server) handleResetSessionSize(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["id"]

	session := s.sessionManager.Get(sessionID)
	if session == nil {
		s.writeJSONError(w, "Session not found", http.StatusNotFound)
		return
	}

	// Reset to default terminal size (80x24)
	defaultCols, defaultRows := 80, 24

	if err := s.sessionManager.Resize(sessionID, defaultCols, defaultRows); err != nil {
		s.writeJSONError(w, fmt.Sprintf("Failed to reset session size: %v", err), http.StatusInternalServerError)
		return
	}

	response := map[string]interface{}{
		"message": "Session size reset to default",
		"cols":    defaultCols,
		"rows":    defaultRows,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Failed to encode reset size response: %v", err)
	}
}

// getClientIP extracts the client IP from the request
func getClientIP(r *http.Request) string {
	// Try X-Forwarded-For header first (for proxies)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// Take the first IP in the chain
		ips := strings.Split(xff, ",")
		return strings.TrimSpace(ips[0])
	}

	// Try X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}

	// Fall back to RemoteAddr
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}

	return ip
}

// isLocalhost checks if the IP is a localhost address
func isLocalhost(ip string) bool {
	if ip == "" {
		return false
	}

	// Parse the IP
	parsedIP := net.ParseIP(ip)
	if parsedIP == nil {
		return false
	}

	// Check for localhost IPs
	return parsedIP.IsLoopback() || 
		   ip == "127.0.0.1" || 
		   ip == "::1" || 
		   ip == "localhost"
}

// handleControlStream provides a Server-Sent Events stream for control events
func (s *Server) handleControlStream(w http.ResponseWriter, r *http.Request) {
	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	flusher, ok := w.(http.Flusher)
	if !ok {
		s.writeJSONError(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	// Send initial connection message
	w.Write([]byte(":oknn"))
	flusher.Flush()

	log.Printf("Control event stream connected")

	// Send periodic heartbeat to keep connection alive
	heartbeatTicker := time.NewTicker(30 * time.Second)
	defer heartbeatTicker.Stop()

	// Keep connection alive until client disconnects
	for {
		select {
		case <-heartbeatTicker.C:
			w.Write([]byte(":heartbeatnn"))
			flusher.Flush()
		case <-r.Context().Done():
			log.Printf("Control event stream disconnected")
			return
		}
	}
}

// registerCloudflareRoutes registers Cloudflare tunnel and domain management routes
// TODO: Re-enable when cloudflare service is properly integrated
/*
func (s *Server) registerCloudflareRoutes(router *mux.Router) {
	// Tunnel management routes
	router.HandleFunc("/tunnels/cloudflare", s.handleListCloudflareTunnels).Methods("GET")
	router.HandleFunc("/tunnels/cloudflare", s.handleCreateCloudflareTunnel).Methods("POST")
	router.HandleFunc("/tunnels/cloudflare/{id}", s.handleGetCloudflareTunnel).Methods("GET")
	router.HandleFunc("/tunnels/cloudflare/{id}", s.handleDeleteCloudflareTunnel).Methods("DELETE")
	
	// Domain management routes
	router.HandleFunc("/domains", s.handleListDomains).Methods("GET")
	router.HandleFunc("/domains", s.handleAssignDomain).Methods("POST")
	router.HandleFunc("/domains/{domain}", s.handleGetDomain).Methods("GET")
	router.HandleFunc("/domains/{domain}", s.handleRemoveDomain).Methods("DELETE")
	router.HandleFunc("/domains/{domain}/status", s.handleCheckDomainStatus).Methods("GET")
	
	log.Printf("Cloudflare tunnel routes registered")
}
*/

// handleListCloudflareTunnels lists all Cloudflare tunnels
// TODO: Re-enable when cloudflare service is added to Server struct
/*
func (s *Server) handleListCloudflareTunnels(w http.ResponseWriter, r *http.Request) {
	if s.cloudflareService == nil {
		s.writeJSONError(w, "Cloudflare tunnels not configured", http.StatusServiceUnavailable)
		return
	}
	
	tunnels, err := s.cloudflareService.ListTunnels()
	if err != nil {
		log.Printf("Failed to list Cloudflare tunnels: %v", err)
		s.writeJSONError(w, fmt.Sprintf("Failed to list tunnels: %v", err), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tunnels": tunnels,
	})
}
*/

// Cloudflare functions - commented out until cloudflare service is properly integrated
/*
// handleCreateCloudflareTunnel creates a new Cloudflare tunnel
func (s *Server) handleCreateCloudflareTunnel(w http.ResponseWriter, r *http.Request) {
	if s.cloudflareService == nil {
		s.writeJSONError(w, "Cloudflare tunnels not configured", http.StatusServiceUnavailable)
		return
	}
	
	var req struct {
		Name string `json:"name"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeJSONError(w, "Invalid JSON request", http.StatusBadRequest)
		return
	}
	
	if req.Name == "" {
		s.writeJSONError(w, "Tunnel name is required", http.StatusBadRequest)
		return
	}
	
	// Validate tunnel name
	if err := s.cloudflareService.ValidateTunnelName(req.Name); err != nil {
		s.writeJSONError(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	// Create tunnel (domain will be assigned later)
	tunnel, err := s.cloudflareService.CreateTunnel(req.Name, "")
	if err != nil {
		log.Printf("Failed to create Cloudflare tunnel: %v", err)
		s.writeJSONError(w, fmt.Sprintf("Failed to create tunnel: %v", err), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(tunnel)
}

// handleGetCloudflareTunnel gets a specific Cloudflare tunnel
func (s *Server) handleGetCloudflareTunnel(w http.ResponseWriter, r *http.Request) {
	if s.cloudflareService == nil {
		s.writeJSONError(w, "Cloudflare tunnels not configured", http.StatusServiceUnavailable)
		return
	}
	
	vars := mux.Vars(r)
	tunnelID := vars["id"]
	
	if tunnelID == "" {
		s.writeJSONError(w, "Tunnel ID is required", http.StatusBadRequest)
		return
	}
	
	tunnel, err := s.cloudflareService.GetTunnel(tunnelID)
	if err != nil {
		log.Printf("Failed to get Cloudflare tunnel: %v", err)
		s.writeJSONError(w, fmt.Sprintf("Failed to get tunnel: %v", err), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tunnel)
}

// handleDeleteCloudflareTunnel deletes a Cloudflare tunnel
func (s *Server) handleDeleteCloudflareTunnel(w http.ResponseWriter, r *http.Request) {
	if s.cloudflareService == nil {
		s.writeJSONError(w, "Cloudflare tunnels not configured", http.StatusServiceUnavailable)
		return
	}
	
	vars := mux.Vars(r)
	tunnelID := vars["id"]
	
	if tunnelID == "" {
		s.writeJSONError(w, "Tunnel ID is required", http.StatusBadRequest)
		return
	}
	
	err := s.cloudflareService.DeleteTunnel(tunnelID)
	if err != nil {
		log.Printf("Failed to delete Cloudflare tunnel: %v", err)
		s.writeJSONError(w, fmt.Sprintf("Failed to delete tunnel: %v", err), http.StatusInternalServerError)
		return
	}
	
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Tunnel deleted successfully",
	})
}

// handleListDomains lists all domain assignments
func (s *Server) handleListDomains(w http.ResponseWriter, r *http.Request) {
	if s.domainManager == nil {
		s.writeJSONError(w, "Domain management not configured", http.StatusServiceUnavailable)
		return
	}
	
	domains, err := s.domainManager.ListDomainAssignments()
	if err != nil {
		log.Printf("Failed to list domain assignments: %v", err)
		s.writeJSONError(w, fmt.Sprintf("Failed to list domains: %v", err), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"domains": domains,
	})
}

// handleAssignDomain assigns a domain to a tunnel
func (s *Server) handleAssignDomain(w http.ResponseWriter, r *http.Request) {
	if s.domainManager == nil {
		s.writeJSONError(w, "Domain management not configured", http.StatusServiceUnavailable)
		return
	}
	
	var req domain.AssignDomainRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeJSONError(w, "Invalid JSON request", http.StatusBadRequest)
		return
	}
	
	if req.Domain == "" || req.TunnelID == "" {
		s.writeJSONError(w, "Domain and tunnel ID are required", http.StatusBadRequest)
		return
	}
	
	assignment, err := s.domainManager.AssignDomain(req)
	if err != nil {
		log.Printf("Failed to assign domain: %v", err)
		s.writeJSONError(w, fmt.Sprintf("Failed to assign domain: %v", err), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(assignment)
}

// handleGetDomain gets a specific domain assignment
func (s *Server) handleGetDomain(w http.ResponseWriter, r *http.Request) {
	if s.domainManager == nil {
		s.writeJSONError(w, "Domain management not configured", http.StatusServiceUnavailable)
		return
	}
	
	vars := mux.Vars(r)
	domainName := vars["domain"]
	
	if domainName == "" {
		s.writeJSONError(w, "Domain name is required", http.StatusBadRequest)
		return
	}
	
	assignment, err := s.domainManager.GetDomainAssignment(domainName)
	if err != nil {
		log.Printf("Failed to get domain assignment: %v", err)
		s.writeJSONError(w, fmt.Sprintf("Failed to get domain: %v", err), http.StatusNotFound)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(assignment)
}

// handleRemoveDomain removes a domain assignment
func (s *Server) handleRemoveDomain(w http.ResponseWriter, r *http.Request) {
	if s.domainManager == nil {
		s.writeJSONError(w, "Domain management not configured", http.StatusServiceUnavailable)
		return
	}
	
	vars := mux.Vars(r)
	domainName := vars["domain"]
	
	if domainName == "" {
		s.writeJSONError(w, "Domain name is required", http.StatusBadRequest)
		return
	}
	
	err := s.domainManager.RemoveDomainAssignment(domainName)
	if err != nil {
		log.Printf("Failed to remove domain assignment: %v", err)
		s.writeJSONError(w, fmt.Sprintf("Failed to remove domain: %v", err), http.StatusInternalServerError)
		return
	}
	
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Domain assignment removed successfully",
	})
}

// handleCheckDomainStatus checks the status of a domain assignment
func (s *Server) handleCheckDomainStatus(w http.ResponseWriter, r *http.Request) {
	if s.domainManager == nil {
		s.writeJSONError(w, "Domain management not configured", http.StatusServiceUnavailable)
		return
	}
	
	vars := mux.Vars(r)
	domainName := vars["domain"]
	
	if domainName == "" {
		s.writeJSONError(w, "Domain name is required", http.StatusBadRequest)
		return
	}
	
	status, err := s.domainManager.CheckDomainStatus(domainName)
	if err != nil {
		log.Printf("Failed to check domain status: %v", err)
		s.writeJSONError(w, fmt.Sprintf("Failed to check domain status: %v", err), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"domain": domainName,
		"status": status,
	})
}
*/

// registerSecureConfigRoutes registers secure configuration management routes
// TODO: Re-enable when secure config manager is properly integrated
/*
func (s *Server) registerSecureConfigRoutes(router *mux.Router) {
	router.HandleFunc("/config/cloudflare/credentials", s.handleStoreCloudflareCredentials).Methods("POST")
	router.HandleFunc("/config/cloudflare/credentials", s.handleGetCloudflareCredentials).Methods("GET")
	router.HandleFunc("/config/cloudflare/credentials", s.handleDeleteCloudflareCredentials).Methods("DELETE")
	router.HandleFunc("/config/cloudflare/status", s.handleGetCloudflareStatus).Methods("GET")
	
	log.Printf("Secure configuration routes registered")
}

// handleStoreCloudflareCredentials stores Cloudflare credentials securely
func (s *Server) handleStoreCloudflareCredentials(w http.ResponseWriter, r *http.Request) {
	if s.secureConfigManager == nil {
		s.writeJSONError(w, "Secure configuration not available", http.StatusServiceUnavailable)
		return
	}
	
	var credentials config.CloudflareCredentials
	if err := json.NewDecoder(r.Body).Decode(&credentials); err != nil {
		s.writeJSONError(w, "Invalid JSON request", http.StatusBadRequest)
		return
	}
	
	if credentials.APIToken == "" || credentials.AccountID == "" {
		s.writeJSONError(w, "API token and account ID are required", http.StatusBadRequest)
		return
	}
	
	err := s.secureConfigManager.StoreCloudflareCredentials(credentials)
	if err != nil {
		log.Printf("Failed to store Cloudflare credentials: %v", err)
		s.writeJSONError(w, fmt.Sprintf("Failed to store credentials: %v", err), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Cloudflare credentials stored successfully",
	})
}

// handleGetCloudflareCredentials retrieves Cloudflare credentials
func (s *Server) handleGetCloudflareCredentials(w http.ResponseWriter, r *http.Request) {
	if s.secureConfigManager == nil {
		s.writeJSONError(w, "Secure configuration not available", http.StatusServiceUnavailable)
		return
	}
	
	credentials, err := s.secureConfigManager.GetCloudflareCredentials()
	if err != nil {
		log.Printf("Failed to get Cloudflare credentials: %v", err)
		s.writeJSONError(w, fmt.Sprintf("Failed to get credentials: %v", err), http.StatusInternalServerError)
		return
	}
	
	// Don't return the actual credentials for security, just indicate if they exist
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"configured": credentials.APIToken != "" && credentials.AccountID != "",
	})
}

// handleDeleteCloudflareCredentials deletes stored Cloudflare credentials
func (s *Server) handleDeleteCloudflareCredentials(w http.ResponseWriter, r *http.Request) {
	if s.secureConfigManager == nil {
		s.writeJSONError(w, "Secure configuration not available", http.StatusServiceUnavailable)
		return
	}
	
	err := s.secureConfigManager.DeleteCloudflareCredentials()
	if err != nil {
		log.Printf("Failed to delete Cloudflare credentials: %v", err)
		s.writeJSONError(w, fmt.Sprintf("Failed to delete credentials: %v", err), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Cloudflare credentials deleted successfully",
	})
}

// handleGetCloudflareStatus returns the status of Cloudflare configuration
func (s *Server) handleGetCloudflareStatus(w http.ResponseWriter, r *http.Request) {
	status := map[string]interface{}{
		"enabled": s.config.EnableCloudflareTunnels,
	}
	
	if s.secureConfigManager != nil {
		status["secure_storage_available"] = true
		status["credentials_configured"] = s.secureConfigManager.HasCloudflareCredentials()
	} else {
		status["secure_storage_available"] = false
		status["credentials_configured"] = s.config.CloudflareAPIToken != "" && s.config.CloudflareAccountID != ""
	}
	
	status["services_available"] = s.cloudflareService != nil
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}
*/

// handleAssignDomain assigns a domain to a tunnel and optionally associates with a session
// TODO: Remove duplicate - this is already defined above
/*
func (s *Server) handleAssignDomain(w http.ResponseWriter, r *http.Request) {
	if s.domainManager == nil {
		s.writeJSONError(w, "Domain management not configured", http.StatusServiceUnavailable)
		return
	}
	
	var req domain.AssignDomainRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeJSONError(w, "Invalid JSON request", http.StatusBadRequest)
		return
	}
	
	if req.Domain == "" || req.TunnelID == "" {
		s.writeJSONError(w, "Domain and tunnel ID are required", http.StatusBadRequest)
		return
	}
	
	assignment, err := s.domainManager.AssignDomain(req)
	if err != nil {
		log.Printf("Failed to assign domain: %v", err)
		s.writeJSONError(w, fmt.Sprintf("Failed to assign domain: %v", err), http.StatusInternalServerError)
		return
	}
	
	// Try to associate the tunnel with an existing session
	if err := s.associateTunnelWithSession(req.TunnelID, req.Domain); err != nil {
		log.Printf("Warning: Failed to associate tunnel with session: %v", err)
		// Don't fail the request, just log the warning
	}
	
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(assignment)
}

// associateTunnelWithSession tries to associate a tunnel with an existing session
func (s *Server) associateTunnelWithSession(tunnelID, domain string) error {
	// Get all sessions
	sessions := s.sessionManager.List()
	
	// Look for an active session that doesn't already have a tunnel
	for _, session := range sessions {
		if session.Active && (session.TunnelInfo == nil || session.TunnelInfo.TunnelID == "") {
			// Associate this tunnel with the session
			if err := s.sessionManager.AssociateTunnelWithSession(session.ID, tunnelID, domain); err != nil {
				log.Printf("Failed to associate tunnel %s with session %s: %v", tunnelID, session.ID, err)
				continue
			}
			
			log.Printf("Associated tunnel %s with session %s", tunnelID, session.ID)
			return nil
		}
	}
	
	log.Printf("No active session found to associate with tunnel %s", tunnelID)
	return fmt.Errorf("no active session available for tunnel association")
}
*/
// registerPowerRoutes registers power management API routes
func (s *Server) registerPowerRoutes(router *mux.Router) {
	api := router.PathPrefix("/api").Subrouter()
	
	// Power management endpoints
	api.HandleFunc("/power/prevent-sleep", s.handlePreventSleep).Methods("POST")
	api.HandleFunc("/power/allow-sleep", s.handleAllowSleep).Methods("POST")
	api.HandleFunc("/power/status", s.handlePowerStatus).Methods("GET")
}

// handlePreventSleep prevents system sleep
func (s *Server) handlePreventSleep(w http.ResponseWriter, r *http.Request) {
	if s.powerService == nil {
		s.writeJSONError(w, "Power management not available on this platform", http.StatusServiceUnavailable)
		return
	}

	var req struct {
		Reason string `json:"reason,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.Reason = "TunnelForge session active"
	}

	if req.Reason == "" {
		req.Reason = "TunnelForge session active"
	}

	if err := s.powerService.PreventSleep(req.Reason); err != nil {
		log.Printf("Failed to prevent sleep: %v", err)
		s.writeJSONError(w, fmt.Sprintf("Failed to prevent sleep: %v", err), http.StatusInternalServerError)
		return
	}

	// Broadcast power management event
	event := types.NewServerEvent(types.EventPowerSleepPrevented).
		WithMessage("System sleep prevention enabled").
		WithData(map[string]interface{}{
			"reason": req.Reason,
		})
	s.broadcastEvent(event)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Sleep prevention enabled",
		"reason":  req.Reason,
	})
}

// handleAllowSleep allows system sleep
func (s *Server) handleAllowSleep(w http.ResponseWriter, r *http.Request) {
	if s.powerService == nil {
		s.writeJSONError(w, "Power management not available on this platform", http.StatusServiceUnavailable)
		return
	}

	if err := s.powerService.AllowSleep(); err != nil {
		log.Printf("Failed to allow sleep: %v", err)
		s.writeJSONError(w, fmt.Sprintf("Failed to allow sleep: %v", err), http.StatusInternalServerError)
		return
	}

	// Broadcast power management event
	event := types.NewServerEvent(types.EventPowerSleepAllowed).
		WithMessage("System sleep prevention disabled")
	s.broadcastEvent(event)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Sleep prevention disabled",
	})
}

// handlePowerStatus returns current power management status
func (s *Server) handlePowerStatus(w http.ResponseWriter, r *http.Request) {
	if s.powerService == nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"available": false,
			"message":   "Power management not available on this platform",
		})
		return
	}

	status := s.powerService.GetStatus()
	status["available"] = true

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}
// registerTunnelRoutes registers tunnel management API routes
func (s *Server) registerTunnelRoutes(router *mux.Router) {
	api := router.PathPrefix("/api").Subrouter()
	
	// Tunnel management endpoints
	api.HandleFunc("/tunnels", s.handleListTunnels).Methods("GET")
	api.HandleFunc("/tunnels/{type}/start", s.handleStartTunnel).Methods("POST")
	api.HandleFunc("/tunnels/{type}/stop", s.handleStopTunnel).Methods("POST")
	api.HandleFunc("/tunnels/{type}/status", s.handleTunnelStatus).Methods("GET")
	api.HandleFunc("/tunnels/{type}/url", s.handleTunnelURL).Methods("GET")
}

// handleListTunnels returns all available tunnel services
func (s *Server) handleListTunnels(w http.ResponseWriter, r *http.Request) {
	if s.tunnelService == nil {
		s.writeJSONError(w, "Tunnel services not available", http.StatusServiceUnavailable)
		return
	}

	tunnels := s.tunnelService.ListServices()
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"tunnels": tunnels,
	})
}

// handleStartTunnel starts a tunnel of the specified type
func (s *Server) handleStartTunnel(w http.ResponseWriter, r *http.Request) {
	if s.tunnelService == nil {
		s.writeJSONError(w, "Tunnel services not available", http.StatusServiceUnavailable)
		return
	}

	vars := mux.Vars(r)
	tunnelTypeStr := vars["type"]
	
	var tunnelType tunnels.TunnelType
	switch tunnelTypeStr {
	case "cloudflare":
		tunnelType = tunnels.TunnelTypeCloudflare
	case "ngrok":
		tunnelType = tunnels.TunnelTypeNgrok
	case "tailscale":
		tunnelType = tunnels.TunnelTypeTailscale
	default:
		s.writeJSONError(w, "Invalid tunnel type", http.StatusBadRequest)
		return
	}

	service, err := s.tunnelService.GetService(tunnelType)
	if err != nil {
		s.writeJSONError(w, err.Error(), http.StatusNotFound)
		return
	}

	var req struct {
		Port int `json:"port"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeJSONError(w, "Invalid JSON request", http.StatusBadRequest)
		return
	}

	if req.Port <= 0 || req.Port > 65535 {
		s.writeJSONError(w, "Invalid port number", http.StatusBadRequest)
		return
	}

	if err := service.Start(req.Port); err != nil {
		log.Printf("Failed to start %s tunnel: %v", tunnelType, err)
		s.writeJSONError(w, fmt.Sprintf("Failed to start tunnel: %v", err), http.StatusInternalServerError)
		return
	}

	// Broadcast tunnel event
	event := types.NewServerEvent(types.EventTunnelStarted).
		WithMessage(fmt.Sprintf("%s tunnel started", tunnelType)).
		WithData(map[string]interface{}{
			"type": tunnelType,
			"port": req.Port,
		})
	s.broadcastEvent(event)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("%s tunnel started", tunnelType),
		"type":    tunnelType,
		"port":    req.Port,
	})
}

// handleStopTunnel stops a tunnel of the specified type
func (s *Server) handleStopTunnel(w http.ResponseWriter, r *http.Request) {
	if s.tunnelService == nil {
		s.writeJSONError(w, "Tunnel services not available", http.StatusServiceUnavailable)
		return
	}

	vars := mux.Vars(r)
	tunnelTypeStr := vars["type"]
	
	var tunnelType tunnels.TunnelType
	switch tunnelTypeStr {
	case "cloudflare":
		tunnelType = tunnels.TunnelTypeCloudflare
	case "ngrok":
		tunnelType = tunnels.TunnelTypeNgrok
	case "tailscale":
		tunnelType = tunnels.TunnelTypeTailscale
	default:
		s.writeJSONError(w, "Invalid tunnel type", http.StatusBadRequest)
		return
	}

	service, err := s.tunnelService.GetService(tunnelType)
	if err != nil {
		s.writeJSONError(w, err.Error(), http.StatusNotFound)
		return
	}

	if err := service.Stop(); err != nil {
		log.Printf("Failed to stop %s tunnel: %v", tunnelType, err)
		s.writeJSONError(w, fmt.Sprintf("Failed to stop tunnel: %v", err), http.StatusInternalServerError)
		return
	}

	// Broadcast tunnel event
	event := types.NewServerEvent(types.EventTunnelStopped).
		WithMessage(fmt.Sprintf("%s tunnel stopped", tunnelType)).
		WithData(map[string]interface{}{
			"type": tunnelType,
		})
	s.broadcastEvent(event)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": fmt.Sprintf("%s tunnel stopped", tunnelType),
		"type":    tunnelType,
	})
}

// handleTunnelStatus returns the status of a specific tunnel
func (s *Server) handleTunnelStatus(w http.ResponseWriter, r *http.Request) {
	if s.tunnelService == nil {
		s.writeJSONError(w, "Tunnel services not available", http.StatusServiceUnavailable)
		return
	}

	vars := mux.Vars(r)
	tunnelTypeStr := vars["type"]
	
	var tunnelType tunnels.TunnelType
	switch tunnelTypeStr {
	case "cloudflare":
		tunnelType = tunnels.TunnelTypeCloudflare
	case "ngrok":
		tunnelType = tunnels.TunnelTypeNgrok
	case "tailscale":
		tunnelType = tunnels.TunnelTypeTailscale
	default:
		s.writeJSONError(w, "Invalid tunnel type", http.StatusBadRequest)
		return
	}

	service, err := s.tunnelService.GetService(tunnelType)
	if err != nil {
		s.writeJSONError(w, err.Error(), http.StatusNotFound)
		return
	}

	status, err := service.GetStatus()
	if err != nil {
		s.writeJSONError(w, fmt.Sprintf("Failed to get tunnel status: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

// handleTunnelURL returns the public URL of a specific tunnel
func (s *Server) handleTunnelURL(w http.ResponseWriter, r *http.Request) {
	if s.tunnelService == nil {
		s.writeJSONError(w, "Tunnel services not available", http.StatusServiceUnavailable)
		return
	}

	vars := mux.Vars(r)
	tunnelTypeStr := vars["type"]
	
	var tunnelType tunnels.TunnelType
	switch tunnelTypeStr {
	case "cloudflare":
		tunnelType = tunnels.TunnelTypeCloudflare
	case "ngrok":
		tunnelType = tunnels.TunnelTypeNgrok
	case "tailscale":
		tunnelType = tunnels.TunnelTypeTailscale
	default:
		s.writeJSONError(w, "Invalid tunnel type", http.StatusBadRequest)
		return
	}

	service, err := s.tunnelService.GetService(tunnelType)
	if err != nil {
		s.writeJSONError(w, err.Error(), http.StatusNotFound)
		return
	}

	url, err := service.GetPublicURL()
	if err != nil {
		s.writeJSONError(w, err.Error(), http.StatusServiceUnavailable)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"url":   url,
		"type":  tunnelType,
	})
}

// Session Multiplexing Handlers

// handleBulkCreateSessions creates multiple sessions at once
func (s *Server) handleBulkCreateSessions(w http.ResponseWriter, r *http.Request) {
	var reqs []*types.SessionCreateRequest
	
	if err := json.NewDecoder(r.Body).Decode(&reqs); err != nil {
		s.writeJSONError(w, "Invalid JSON request", http.StatusBadRequest)
		return
	}

	sessions, err := s.sessionManager.BulkCreateSessions(reqs)
	if err != nil {
		s.writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sessions)
}

// handleBulkDeleteSessions deletes multiple sessions at once
func (s *Server) handleBulkDeleteSessions(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SessionIDs []string `json:"sessionIds"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeJSONError(w, "Invalid JSON request", http.StatusBadRequest)
		return
	}

	errors := s.sessionManager.BulkDeleteSessions(req.SessionIDs)
	
	response := map[string]interface{}{
		"deleted": len(req.SessionIDs) - len(errors),
	}
	
	if len(errors) > 0 {
		response["errors"] = errors
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// handleBulkResizeSessions resizes multiple sessions at once
func (s *Server) handleBulkResizeSessions(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SessionIDs []string `json:"sessionIds"`
		Cols       int      `json:"cols"`
		Rows       int      `json:"rows"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeJSONError(w, "Invalid JSON request", http.StatusBadRequest)
		return
	}

	if req.Cols <= 0 || req.Rows <= 0 {
		s.writeJSONError(w, "Invalid terminal dimensions", http.StatusBadRequest)
		return
	}

	errors := s.sessionManager.BulkResizeSessions(req.SessionIDs, req.Cols, req.Rows)
	
	response := map[string]interface{}{
		"resized": len(req.SessionIDs) - len(errors),
	}
	
	if len(errors) > 0 {
		response["errors"] = errors
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// handleListSessionGroups lists all session groups
func (s *Server) handleListSessionGroups(w http.ResponseWriter, r *http.Request) {
	groups := s.sessionManager.ListSessionGroups()
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(groups)
}

// handleCreateSessionGroup creates a new session group
func (s *Server) handleCreateSessionGroup(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string   `json:"name"`
		Description string   `json:"description,omitempty"`
		Tags        []string `json:"tags,omitempty"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeJSONError(w, "Invalid JSON request", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		s.writeJSONError(w, "Group name is required", http.StatusBadRequest)
		return
	}

	group, err := s.sessionManager.CreateSessionGroup(req.Name, req.Description, req.Tags)
	if err != nil {
		s.writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(group)
}

// handleGetSessionGroup gets a specific session group
func (s *Server) handleGetSessionGroup(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["groupId"]

	group, err := s.sessionManager.GetSessionGroup(groupID)
	if err != nil {
		s.writeJSONError(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(group)
}

// handleDeleteSessionGroup deletes a session group
func (s *Server) handleDeleteSessionGroup(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["groupId"]

	if err := s.sessionManager.DeleteSessionGroup(groupID); err != nil {
		s.writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// handleAddSessionToGroup adds a session to a group
func (s *Server) handleAddSessionToGroup(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["groupId"]
	
	var req struct {
		SessionID string `json:"sessionId"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeJSONError(w, "Invalid JSON request", http.StatusBadRequest)
		return
	}

	if err := s.sessionManager.AddSessionToGroup(groupID, req.SessionID); err != nil {
		s.writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// handleRemoveSessionFromGroup removes a session from a group
func (s *Server) handleRemoveSessionFromGroup(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	groupID := vars["groupId"]
	sessionID := vars["sessionId"]

	if err := s.sessionManager.RemoveSessionFromGroup(groupID, sessionID); err != nil {
		s.writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// handleGetSessionGroups gets all groups containing a session
func (s *Server) handleGetSessionGroups(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["id"]

	groups := s.sessionManager.GetSessionGroups(sessionID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(groups)
}

// handleGetSessionHierarchy gets hierarchy information for a session
func (s *Server) handleGetSessionHierarchy(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["id"]

	hierarchy, err := s.sessionManager.GetSessionHierarchy(sessionID)
	if err != nil {
		s.writeJSONError(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(hierarchy)
}

// handleGetSessionDependencies gets dependencies for a session
func (s *Server) handleGetSessionDependencies(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["id"]

	dependencies := s.sessionManager.GetSessionDependencies(sessionID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(dependencies)
}

// handleListSessionTags lists all session tags
func (s *Server) handleListSessionTags(w http.ResponseWriter, r *http.Request) {
	tags := s.sessionManager.ListSessionTags()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tags)
}

// handleCreateSessionTag creates a new session tag
func (s *Server) handleCreateSessionTag(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string `json:"name"`
		Color       string `json:"color,omitempty"`
		Description string `json:"description,omitempty"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.writeJSONError(w, "Invalid JSON request", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		s.writeJSONError(w, "Tag name is required", http.StatusBadRequest)
		return
	}

	tag, err := s.sessionManager.CreateSessionTag(req.Name, req.Color, req.Description)
	if err != nil {
		s.writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tag)
}

// handleDeleteSessionTag deletes a session tag
func (s *Server) handleDeleteSessionTag(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	tagName := vars["tagName"]

	if err := s.sessionManager.DeleteSessionTag(tagName); err != nil {
		s.writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// handleGetSessionsByTag gets all sessions with a specific tag
func (s *Server) handleGetSessionsByTag(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	tagName := vars["tagName"]

	sessions := s.sessionManager.GetSessionsByTag(tagName)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sessions)
}

// Remote Registry Handlers

// handleListRegistryInstances lists all registered remote instances
func (s *Server) handleListRegistryInstances(w http.ResponseWriter, r *http.Request) {
	instances := s.registryService.ListInstances()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(instances)
}

// handleRegisterRegistryInstance registers a new remote instance
func (s *Server) handleRegisterRegistryInstance(w http.ResponseWriter, r *http.Request) {
	var instance types.RemoteInstance
	
	if err := json.NewDecoder(r.Body).Decode(&instance); err != nil {
		s.writeJSONError(w, "Invalid JSON request", http.StatusBadRequest)
		return
	}

	if instance.ID == "" || instance.Name == "" || instance.URL == "" {
		s.writeJSONError(w, "ID, name, and URL are required", http.StatusBadRequest)
		return
	}

	if err := s.registryService.RegisterInstance(&instance); err != nil {
		s.writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(instance)
}

// handleGetRegistryInstance gets a specific remote instance
func (s *Server) handleGetRegistryInstance(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	instanceID := vars["instanceId"]

	instance, err := s.registryService.GetInstance(instanceID)
	if err != nil {
		s.writeJSONError(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(instance)
}

// handleUnregisterRegistryInstance unregisters a remote instance
func (s *Server) handleUnregisterRegistryInstance(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	instanceID := vars["instanceId"]

	if err := s.registryService.UnregisterInstance(instanceID); err != nil {
		s.writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// handleDiscoverRemoteSessions discovers sessions from all remote instances
func (s *Server) handleDiscoverRemoteSessions(w http.ResponseWriter, r *http.Request) {
	sessions, err := s.registryService.DiscoverSessions()
	if err != nil {
		s.writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sessions)
}

// handleGetRemoteSession gets a specific session from a remote instance
func (s *Server) handleGetRemoteSession(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	instanceID := vars["instanceId"]
	sessionID := vars["sessionId"]

	session, err := s.registryService.GetSession(instanceID, sessionID)
	if err != nil {
		if err.Error() == "session not found" {
			s.writeJSONError(w, err.Error(), http.StatusNotFound)
		} else {
			s.writeJSONError(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(session)
}

// handleGetRegistryStats gets registry statistics
func (s *Server) handleGetRegistryStats(w http.ResponseWriter, r *http.Request) {
	stats := s.registryService.GetStats()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// Analytics Handlers

// handleGetAnalyticsMetrics gets current analytics metrics
func (s *Server) handleGetAnalyticsMetrics(w http.ResponseWriter, r *http.Request) {
	metrics := s.analyticsService.GetMetrics()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metrics)
}

// handleGetAnalyticsEvents gets recent analytics events
func (s *Server) handleGetAnalyticsEvents(w http.ResponseWriter, r *http.Request) {
	limit := 100 // Default limit
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if parsedLimit, err := parseInt(limitStr); err == nil && parsedLimit > 0 {
			limit = parsedLimit
		}
	}

	events := s.analyticsService.GetRecentEvents(limit)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
}

// handleGetUserActivity gets activity data for a specific user
func (s *Server) handleGetUserActivity(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["userId"]

	activity, err := s.analyticsService.GetUserActivity(userID)
	if err != nil {
		s.writeJSONError(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(activity)
}

// handleExportAnalytics exports analytics data
func (s *Server) handleExportAnalytics(w http.ResponseWriter, r *http.Request) {
	filename := fmt.Sprintf("analytics_export_%d.json", time.Now().Unix())
	
	if err := s.analyticsService.ExportData(filename); err != nil {
		s.writeJSONError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"filename": filename,
		"status":   "exported",
	})
}

// Helper function to parse int (since we don't have strconv.Atoi in this context)
func parseInt(s string) (int, error) {
	result := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0, fmt.Errorf("invalid integer")
		}
		result = result*10 + int(c-'0')
	}
	return result, nil
}
