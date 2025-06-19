package api

import (
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gorilla/mux"
	"github.com/vibetunnel/linux/pkg/ngrok"
	"github.com/vibetunnel/linux/pkg/session"
)

type Server struct {
	manager      *session.Manager
	staticPath   string
	password     string
	ngrokService *ngrok.Service
	port         int
}

func NewServer(manager *session.Manager, staticPath, password string, port int) *Server {
	return &Server{
		manager:      manager,
		staticPath:   staticPath,
		password:     password,
		ngrokService: ngrok.NewService(),
		port:         port,
	}
}

func (s *Server) Start(addr string) error {
	handler := s.createHandler()
	return http.ListenAndServe(addr, handler)
}

func (s *Server) createHandler() http.Handler {
	r := mux.NewRouter()

	api := r.PathPrefix("/api").Subrouter()
	if s.password != "" {
		api.Use(s.basicAuthMiddleware)
	}

	api.HandleFunc("/health", s.handleHealth).Methods("GET")
	api.HandleFunc("/sessions", s.handleListSessions).Methods("GET")
	api.HandleFunc("/sessions", s.handleCreateSession).Methods("POST")
	api.HandleFunc("/sessions/{id}", s.handleGetSession).Methods("GET")
	api.HandleFunc("/sessions/{id}/stream", s.handleStreamSession).Methods("GET")
	api.HandleFunc("/sessions/{id}/snapshot", s.handleSnapshotSession).Methods("GET")
	api.HandleFunc("/sessions/{id}/input", s.handleSendInput).Methods("POST")
	api.HandleFunc("/sessions/{id}", s.handleKillSession).Methods("DELETE")
	api.HandleFunc("/sessions/{id}/cleanup", s.handleCleanupSession).Methods("DELETE")
	api.HandleFunc("/sessions/{id}/resize", s.handleResizeSession).Methods("POST")
	api.HandleFunc("/sessions/multistream", s.handleMultistream).Methods("GET")
	api.HandleFunc("/cleanup-exited", s.handleCleanupExited).Methods("POST")
	api.HandleFunc("/fs/browse", s.handleBrowseFS).Methods("GET")
	api.HandleFunc("/mkdir", s.handleMkdir).Methods("POST")
	
	// Ngrok endpoints
	api.HandleFunc("/ngrok/start", s.handleNgrokStart).Methods("POST")
	api.HandleFunc("/ngrok/stop", s.handleNgrokStop).Methods("POST")
	api.HandleFunc("/ngrok/status", s.handleNgrokStatus).Methods("GET")

	if s.staticPath != "" {
		r.PathPrefix("/").Handler(http.FileServer(http.Dir(s.staticPath)))
	}

	return r
}

func (s *Server) basicAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if auth == "" {
			s.unauthorized(w)
			return
		}

		const prefix = "Basic "
		if !strings.HasPrefix(auth, prefix) {
			s.unauthorized(w)
			return
		}

		decoded, err := base64.StdEncoding.DecodeString(auth[len(prefix):])
		if err != nil {
			s.unauthorized(w)
			return
		}

		parts := strings.SplitN(string(decoded), ":", 2)
		if len(parts) != 2 || parts[0] != "admin" || parts[1] != s.password {
			s.unauthorized(w)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (s *Server) unauthorized(w http.ResponseWriter) {
	w.Header().Set("WWW-Authenticate", `Basic realm="VibeTunnel"`)
	http.Error(w, "Unauthorized", http.StatusUnauthorized)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (s *Server) handleListSessions(w http.ResponseWriter, r *http.Request) {
	sessions, err := s.manager.ListSessions()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sessions)
}

func (s *Server) handleCreateSession(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name       string   `json:"name"`
		Command    []string `json:"command"`    // Rust API format
		WorkingDir string   `json:"workingDir"` // Rust API format
		Cols       int      `json:"cols"`       // Terminal columns
		Rows       int      `json:"rows"`       // Terminal rows
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body. Expected JSON with 'command' array and optional 'workingDir'", http.StatusBadRequest)
		return
	}

	if len(req.Command) == 0 {
		http.Error(w, "Command array is required", http.StatusBadRequest)
		return
	}

	cmdline := req.Command
	cwd := req.WorkingDir

	// Set default terminal dimensions if not provided
	cols := req.Cols
	if cols <= 0 {
		cols = 120 // Better default for modern terminals
	}
	rows := req.Rows
	if rows <= 0 {
		rows = 30 // Better default for modern terminals
	}

	// Expand ~ in working directory
	if cwd != "" && cwd[0] == '~' {
		if cwd == "~" || cwd[:2] == "~/" {
			homeDir, err := os.UserHomeDir()
			if err == nil {
				if cwd == "~" {
					cwd = homeDir
				} else {
					cwd = filepath.Join(homeDir, cwd[2:])
				}
			}
		}
	}

	sess, err := s.manager.CreateSession(session.Config{
		Name:    req.Name,
		Cmdline: cmdline,
		Cwd:     cwd,
		Width:   cols,
		Height:  rows,
	})
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":   true,
		"message":   "Session created successfully",
		"error":     nil,
		"sessionId": sess.ID,
	})
}

func (s *Server) handleGetSession(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sess, err := s.manager.GetSession(vars["id"])
	if err != nil {
		http.Error(w, "Session not found", http.StatusNotFound)
		return
	}

	// Return current session info without blocking on status update
	// Status will be eventually consistent through background updates
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sess)
}

func (s *Server) handleStreamSession(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sess, err := s.manager.GetSession(vars["id"])
	if err != nil {
		http.Error(w, "Session not found", http.StatusNotFound)
		return
	}

	streamer := NewSSEStreamer(w, sess)
	streamer.Stream()
}

func (s *Server) handleSnapshotSession(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sess, err := s.manager.GetSession(vars["id"])
	if err != nil {
		http.Error(w, "Session not found", http.StatusNotFound)
		return
	}

	snapshot, err := GetSessionSnapshot(sess)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(snapshot)
}

func (s *Server) handleSendInput(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sess, err := s.manager.GetSession(vars["id"])
	if err != nil {
		log.Printf("[ERROR] handleSendInput: Session %s not found", vars["id"])
		http.Error(w, "Session not found", http.StatusNotFound)
		return
	}

	var req struct {
		Input string `json:"input"`
		Text  string `json:"text"`  // Alternative field name
		Type  string `json:"type"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[ERROR] handleSendInput: Failed to decode request: %v", err)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Handle alternative field names for compatibility
	input := req.Input
	if input == "" && req.Text != "" {
		input = req.Text
	}

	// Define special keys exactly as in Swift/macOS version
	specialKeys := map[string]string{
		"arrow_up":    "\x1b[A",
		"arrow_down":  "\x1b[B", 
		"arrow_right": "\x1b[C",
		"arrow_left":  "\x1b[D",
		"escape":      "\x1b",
		"enter":       "\r",        // CR, not LF (to match Swift)
		"ctrl_enter":  "\r",        // CR for ctrl+enter
		"shift_enter": "\x1b\x0d", // ESC + CR for shift+enter
	}

	// Check if this is a special key (automatic detection like Swift version)
	if mappedKey, isSpecialKey := specialKeys[input]; isSpecialKey {
		log.Printf("[DEBUG] handleSendInput: Sending special key '%s' (%q) to session %s", input, mappedKey, sess.ID[:8])
		err = sess.SendKey(mappedKey)
	} else {
		log.Printf("[DEBUG] handleSendInput: Sending text '%s' to session %s", input, sess.ID[:8])
		err = sess.SendText(input)
	}

	if err != nil {
		log.Printf("[ERROR] handleSendInput: Failed to send input: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	log.Printf("[DEBUG] handleSendInput: Successfully sent input to session %s", sess.ID[:8])
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleKillSession(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sess, err := s.manager.GetSession(vars["id"])
	if err != nil {
		http.Error(w, "Session not found", http.StatusNotFound)
		return
	}

	if err := sess.Kill(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Session deleted successfully",
	})
}

func (s *Server) handleCleanupSession(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	if err := s.manager.RemoveSession(vars["id"]); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleCleanupExited(w http.ResponseWriter, r *http.Request) {
	if err := s.manager.CleanupExitedSessions(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleMultistream(w http.ResponseWriter, r *http.Request) {
	sessionIDs := r.URL.Query()["session_id"]
	if len(sessionIDs) == 0 {
		http.Error(w, "No session IDs provided", http.StatusBadRequest)
		return
	}

	streamer := NewMultiSSEStreamer(w, s.manager, sessionIDs)
	streamer.Stream()
}

func (s *Server) handleBrowseFS(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Query().Get("path")
	if path == "" {
		path = "."
	}

	entries, err := BrowseDirectory(path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

func (s *Server) handleMkdir(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path string `json:"path"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := os.MkdirAll(req.Path, 0755); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleResizeSession(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sess, err := s.manager.GetSession(vars["id"])
	if err != nil {
		http.Error(w, "Session not found", http.StatusNotFound)
		return
	}

	var req struct {
		Cols int `json:"cols"`
		Rows int `json:"rows"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Cols <= 0 || req.Rows <= 0 {
		http.Error(w, "Cols and rows must be positive integers", http.StatusBadRequest)
		return
	}

	if err := sess.Resize(req.Cols, req.Rows); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Session resized successfully",
		"cols":   req.Cols,
		"rows":  req.Rows,
	})
}

// Ngrok Handlers

func (s *Server) handleNgrokStart(w http.ResponseWriter, r *http.Request) {
	var req ngrok.StartRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.AuthToken == "" {
		http.Error(w, "Auth token is required", http.StatusBadRequest)
		return
	}

	// Check if ngrok is already running
	if s.ngrokService.IsRunning() {
		status := s.ngrokService.GetStatus()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"success": true,
			"message": "Ngrok tunnel is already running",
			"tunnel":  status,
		})
		return
	}

	// Start the tunnel
	if err := s.ngrokService.Start(req.AuthToken, s.port); err != nil {
		log.Printf("[ERROR] Failed to start ngrok tunnel: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Return immediate response - tunnel status will be updated asynchronously
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Ngrok tunnel is starting",
		"tunnel":  s.ngrokService.GetStatus(),
	})
}

func (s *Server) handleNgrokStop(w http.ResponseWriter, r *http.Request) {
	if !s.ngrokService.IsRunning() {
		http.Error(w, "Ngrok tunnel is not running", http.StatusBadRequest)
		return
	}

	if err := s.ngrokService.Stop(); err != nil {
		log.Printf("[ERROR] Failed to stop ngrok tunnel: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Ngrok tunnel stopped",
	})
}

func (s *Server) handleNgrokStatus(w http.ResponseWriter, r *http.Request) {
	status := s.ngrokService.GetStatus()
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"tunnel":  status,
	})
}

// StartNgrok is a convenience method for CLI integration
func (s *Server) StartNgrok(authToken string) error {
	return s.ngrokService.Start(authToken, s.port)
}

// StopNgrok is a convenience method for CLI integration
func (s *Server) StopNgrok() error {
	return s.ngrokService.Stop()
}

// GetNgrokStatus returns the current ngrok status
func (s *Server) GetNgrokStatus() ngrok.StatusResponse {
	return s.ngrokService.GetStatus()
}