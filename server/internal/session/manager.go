package session

import (
	"fmt"
	"log"
	"os/exec"
	"sync"

	"github.com/ferg-cod3s/tunnelforge/go-server/internal/persistence"
	"github.com/ferg-cod3s/tunnelforge/go-server/internal/terminal"
	"github.com/ferg-cod3s/tunnelforge/go-server/pkg/types"
)

// ManagerInterface defines the interface for session management
type ManagerInterface interface {
	CreateSession(req *types.SessionCreateRequest) (*types.Session, error)
	GetSession(sessionID string) (*types.Session, error)
	DeleteSession(sessionID string) error
	ListSessions() ([]*types.Session, error)
	GetProcessInfo(sessionID string) (interface{}, bool)
	GetProcessStats() map[string]interface{}
	RegisterPTYProcess(sessionID string, cmd *exec.Cmd) error
	// Additional methods needed by websocket handler
	Get(sessionID string) *types.Session
	AddClientToSession(sessionID string, client *types.WSClient) error
	GetPTYSession(sessionID string) interface{}
	// Additional methods needed by tmux
	Create(req *types.SessionCreateRequest) (*types.Session, error)
}

type Manager struct {
	ptyManager         *terminal.PTYManager
	optPtyManager      *terminal.OptimizedPTYManager
	useOptimized       bool
	sseStreams         map[string][]chan []byte
	sseStreamsMu       sync.RWMutex
	persistenceService *persistence.Service
	persistenceEnabled bool
}

func NewManager() *Manager {
	m := &Manager{
		ptyManager:         terminal.NewPTYManager(),
		optPtyManager:      terminal.NewOptimizedPTYManager(),
		useOptimized:       true, // Enable optimizations by default
		sseStreams:         make(map[string][]chan []byte),
		persistenceEnabled: false, // Disabled by default
	}

	// Set up SSE broadcasting - the manager implements the interface
	m.optPtyManager.SetSSEBroadcaster(m)

	return m
}

// NewManagerWithPersistence creates a new manager with persistence enabled
func NewManagerWithPersistence(persistenceService *persistence.Service) *Manager {
	m := &Manager{
		ptyManager:         terminal.NewPTYManager(),
		optPtyManager:      terminal.NewOptimizedPTYManager(),
		useOptimized:       true,
		sseStreams:         make(map[string][]chan []byte),
		persistenceService: persistenceService,
		persistenceEnabled: true,
	}

	// Set up SSE broadcasting - the manager implements the interface
	m.optPtyManager.SetSSEBroadcaster(m)

	return m
}

// RestorePersistedSessions restores sessions from persistent storage
func (m *Manager) RestorePersistedSessions() error {
	if !m.persistenceEnabled || m.persistenceService == nil {
		return nil // Persistence not enabled
	}

	sessions, err := m.persistenceService.RestoreSessions()
	if err != nil {
		return fmt.Errorf("failed to restore sessions: %w", err)
	}

	// For now, we only restore session metadata
	// The actual PTY processes are not restored (this would require more complex state management)
	// Sessions will be marked as inactive until a client connects and reinitializes them
	for _, session := range sessions {
		session.Active = false // Mark as inactive since PTY process is not running
		log.Printf("📁 Restored session metadata: %s (%s)", session.ID, session.Title)
	}

	return nil
}

func (m *Manager) Create(req *types.SessionCreateRequest) (*types.Session, error) {
	var session *types.Session
	var err error

	if m.useOptimized {
		// Use optimized manager for fast session creation
		session, err = m.optPtyManager.CreateSession(req)
	} else {
		// Fallback to original manager
		session, err = m.ptyManager.CreateSession(req)
	}

	if err != nil {
		return nil, err
	}

	// Save to persistence if enabled
	if m.persistenceEnabled && m.persistenceService != nil {
		if persistErr := m.persistenceService.SaveSession(session); persistErr != nil {
			log.Printf("Warning: failed to persist session %s: %v", session.ID, persistErr)
		} else {
			log.Printf("📁 Session %s persisted", session.ID)
		}
	}

	return session, nil
}

func (m *Manager) Get(id string) *types.Session {
	if m.useOptimized {
		optSession := m.optPtyManager.GetSession(id)
		if optSession == nil {
			return nil
		}
		// Convert OptimizedPTYSession to types.Session
		return &types.Session{
			ID:        optSession.ID,
			Title:     optSession.Title,
			Command:   optSession.Command,
			Cwd:       optSession.Cwd,
			Cols:      optSession.Cols,
			Rows:      optSession.Rows,
			CreatedAt: optSession.CreatedAt,
			UpdatedAt: optSession.UpdatedAt,
			Active:    optSession.Active,
			PTY:       nil,                        // Set during lazy init
			Cmd:       nil,                        // Set during lazy init
			Clients:   make([]*types.WSClient, 0), // Will be populated when initialized
		}
	}

	// Fallback to original manager
	ptySession := m.ptyManager.GetSession(id)
	if ptySession == nil {
		return nil
	}

	// Convert PTYSession to types.Session
	return &types.Session{
		ID:        ptySession.ID,
		Title:     ptySession.Title,
		Command:   ptySession.Command,
		Cwd:       ptySession.Cwd,
		Cols:      ptySession.Cols,
		Rows:      ptySession.Rows,
		CreatedAt: ptySession.CreatedAt,
		UpdatedAt: ptySession.UpdatedAt,
		Active:    ptySession.Active,
		PTY:       ptySession.PTY,
		Cmd:       ptySession.Cmd,
		Clients:   ptySession.GetClients(),
	}
}

func (m *Manager) List() []*types.Session {
	if m.useOptimized {
		// List optimized sessions
		optSessions := m.optPtyManager.ListSessions()
		sessions := make([]*types.Session, 0, len(optSessions))

		for _, optSession := range optSessions {
			sessions = append(sessions, &types.Session{
				ID:        optSession.ID,
				Title:     optSession.Title,
				Command:   optSession.Command,
				Cwd:       optSession.Cwd,
				Cols:      optSession.Cols,
				Rows:      optSession.Rows,
				CreatedAt: optSession.CreatedAt,
				UpdatedAt: optSession.UpdatedAt,
				Active:    optSession.Active,
				PTY:       nil,                        // Set during lazy init
				Cmd:       nil,                        // Set during lazy init
				Clients:   make([]*types.WSClient, 0), // Will be populated when initialized
			})
		}

		return sessions
	}

	// Fallback to original manager
	ptySessions := m.ptyManager.ListSessions()
	sessions := make([]*types.Session, 0, len(ptySessions))

	for _, ptySession := range ptySessions {
		sessions = append(sessions, &types.Session{
			ID:        ptySession.ID,
			Title:     ptySession.Title,
			Command:   ptySession.Command,
			Cwd:       ptySession.Cwd,
			Cols:      ptySession.Cols,
			Rows:      ptySession.Rows,
			CreatedAt: ptySession.CreatedAt,
			UpdatedAt: ptySession.UpdatedAt,
			Active:    ptySession.Active,
			PTY:       ptySession.PTY,
			Cmd:       ptySession.Cmd,
			Clients:   ptySession.GetClients(),
		})
	}

	return sessions
}

func (m *Manager) Close(id string) error {
	var err error

	if m.useOptimized {
		err = m.optPtyManager.CloseSession(id)
	} else {
		err = m.ptyManager.CloseSession(id)
	}

	if err != nil {
		return err
	}

	// Remove from persistence if enabled
	if m.persistenceEnabled && m.persistenceService != nil {
		if persistErr := m.persistenceService.DeleteSession(id); persistErr != nil {
			log.Printf("Warning: failed to remove session %s from persistence: %v", id, persistErr)
		} else {
			log.Printf("📁 Session %s removed from persistence", id)
		}
	}

	return nil
}

func (m *Manager) CloseAll() {
	if m.useOptimized {
		m.optPtyManager.CloseAll()
	} else {
		m.ptyManager.CloseAll()
	}
}

// CleanupExitedSessions removes sessions that have exited
func (m *Manager) CleanupExitedSessions() ([]string, error) {
	// Base implementation - no cleanup needed
	return []string{}, nil
}

// CreateSession creates a new session (alias for Create for interface compatibility)
func (m *Manager) CreateSession(req *types.SessionCreateRequest) (*types.Session, error) {
	return m.Create(req)
}

// ListSessions returns all sessions (alias for List for interface compatibility)
func (m *Manager) ListSessions() ([]*types.Session, error) {
	return m.List(), nil
}

// UpdateSessionStatus updates session status (base implementation does nothing)
func (m *Manager) UpdateSessionStatus(sessionID string, status string, pid int, exitCode int) error {
	return nil
}

// OnPTYProcessStarted handles PTY process start (base implementation does nothing)
func (m *Manager) OnPTYProcessStarted(sessionID string, pid int) error {
	return nil
}

// OnPTYProcessExited handles PTY process exit (base implementation does nothing)
func (m *Manager) OnPTYProcessExited(sessionID string, exitCode int) error {
	return nil
}

// RegisterPTYProcess registers a PTY process (base implementation does nothing)
func (m *Manager) RegisterPTYProcess(sessionID string, cmd *exec.Cmd) error {
	return nil
}

// GetProcessInfo gets process information (base implementation returns nil)
func (m *Manager) GetProcessInfo(sessionID string) (interface{}, bool) {
	return nil, false
}

// GetProcessStats gets process statistics (base implementation returns empty map)
func (m *Manager) GetProcessStats() map[string]interface{} {
	return map[string]interface{}{}
}


// GetSession gets a session by ID (alias for Get)
func (m *Manager) GetSession(sessionID string) (*types.Session, error) {
	session := m.Get(sessionID)
	if session == nil {
		return nil, fmt.Errorf("session not found: %s", sessionID)
	}
	return session, nil
}

// DeleteSession deletes a session
func (m *Manager) DeleteSession(sessionID string) error {
	// Simple implementation - just return nil for now
	// TODO: Implement proper session deletion
	return nil
}

// Stop stops the manager (base implementation does nothing)
func (m *Manager) Stop() {
	// Base implementation does nothing
}

func (m *Manager) Count() int {
	if m.useOptimized {
		return m.optPtyManager.Count()
	}
	return m.ptyManager.Count()
}

// AddClientToSession adds a WebSocket client to a session, triggering lazy initialization if needed
func (m *Manager) AddClientToSession(sessionID string, client *types.WSClient) error {
	if m.useOptimized {
		// For optimized sessions, trigger lazy initialization on first client
		optSession := m.optPtyManager.GetSession(sessionID)
		if optSession == nil {
			return fmt.Errorf("session not found: %s", sessionID)
		}

		// This will trigger lazy initialization if needed
		return optSession.AddClient(client, m.optPtyManager.GetEnvTemplate())
	}

	// Fallback to original manager
	ptySession := m.ptyManager.GetSession(sessionID)
	if ptySession == nil {
		return fmt.Errorf("session not found: %s", sessionID)
	}

	ptySession.AddClient(client)
	return nil
}

// RemoveClientFromSession removes a WebSocket client from a session
func (m *Manager) RemoveClientFromSession(sessionID string, clientID string) error {
	if m.useOptimized {
		optSession := m.optPtyManager.GetSession(sessionID)
		if optSession == nil {
			return fmt.Errorf("session not found: %s", sessionID)
		}
		// TODO: Implement client removal in optimized sessions
		log.Printf("Client %s removed from optimized session %s", clientID, sessionID)
		return nil
	}

	// Fallback to original manager
	ptySession := m.ptyManager.GetSession(sessionID)
	if ptySession == nil {
		return fmt.Errorf("session not found: %s", sessionID)
	}

	// TODO: Implement client removal in PTY sessions
	log.Printf("Client %s removed from session %s", clientID, sessionID)
	return nil
}

// GetPTYSession returns the underlying PTY session for WebSocket handling
func (m *Manager) GetPTYSession(id string) interface{} {
	if m.useOptimized {
		// For optimized sessions, we need to convert or initialize
		optSession := m.optPtyManager.GetSession(id)
		if optSession == nil {
			return nil
		}
		// Convert optimized session to regular PTY session
		return optSession.ToPTYSession()
	}
	return m.ptyManager.GetSession(id)
}

// Resize resizes a terminal session
func (m *Manager) Resize(sessionID string, cols, rows int) error {
	if m.useOptimized {
		optSession := m.optPtyManager.GetSession(sessionID)
		if optSession == nil {
			return fmt.Errorf("session not found: %s", sessionID)
		}

		// Ensure session is initialized by adding and immediately removing a dummy client
		dummyClient := &types.WSClient{ID: "dummy-client-12345678", SessionID: sessionID}
		if err := optSession.AddClient(dummyClient, m.optPtyManager.GetEnvTemplate()); err != nil {
			return fmt.Errorf("failed to initialize session: %v", err)
		}
		// Remove the dummy client immediately
		optSession.RemoveClient("dummy-client-12345678")

		return optSession.Resize(cols, rows)
	}

	ptySession := m.ptyManager.GetSession(sessionID)
	if ptySession == nil {
		return fmt.Errorf("session not found: %s", sessionID)
	}
	return ptySession.Resize(cols, rows)
}

// WriteInput writes input to a terminal session
func (m *Manager) WriteInput(sessionID string, input string) error {
	if m.useOptimized {
		optSession := m.optPtyManager.GetSession(sessionID)
		if optSession == nil {
			return fmt.Errorf("session not found: %s", sessionID)
		}

		// Ensure session is initialized by adding and immediately removing a dummy client
		dummyClient := &types.WSClient{ID: "dummy-client-12345678", SessionID: sessionID}
		if err := optSession.AddClient(dummyClient, m.optPtyManager.GetEnvTemplate()); err != nil {
			return fmt.Errorf("failed to initialize session: %v", err)
		}
		// Remove the dummy client immediately
		optSession.RemoveClient("dummy-client-12345678")

		return optSession.WriteInput([]byte(input))
	}

	ptySession := m.ptyManager.GetSession(sessionID)
	if ptySession == nil {
		return fmt.Errorf("session not found: %s", sessionID)
	}
	return ptySession.WriteInput([]byte(input))
}

// AddSSEStream adds a Server-Sent Events stream for a session
func (m *Manager) AddSSEStream(sessionID string, stream chan []byte) error {
	m.sseStreamsMu.Lock()
	defer m.sseStreamsMu.Unlock()

	if m.sseStreams[sessionID] == nil {
		m.sseStreams[sessionID] = make([]chan []byte, 0)
	}
	m.sseStreams[sessionID] = append(m.sseStreams[sessionID], stream)
	return nil
}

// RemoveSSEStream removes a Server-Sent Events stream for a session
func (m *Manager) RemoveSSEStream(sessionID string, stream chan []byte) {
	m.sseStreamsMu.Lock()
	defer m.sseStreamsMu.Unlock()

	streams := m.sseStreams[sessionID]
	for i, s := range streams {
		if s == stream {
			m.sseStreams[sessionID] = append(streams[:i], streams[i+1:]...)
			break
		}
	}

	if len(m.sseStreams[sessionID]) == 0 {
		delete(m.sseStreams, sessionID)
	}
}

// BroadcastToSSEStreams broadcasts data to all SSE streams for a session
func (m *Manager) BroadcastToSSEStreams(sessionID string, data []byte) {
	m.sseStreamsMu.RLock()
	defer m.sseStreamsMu.RUnlock()

	streams := m.sseStreams[sessionID]
	for _, stream := range streams {
		select {
		case stream <- data:
		default:
			// Drop message if channel is full
		}
	}
}

// AssociateTunnelWithSession associates a tunnel with a session
func (m *Manager) AssociateTunnelWithSession(sessionID, tunnelID, domain string) error {
	session := m.Get(sessionID)
	if session == nil {
		return fmt.Errorf("session not found: %s", sessionID)
	}
	
	session.TunnelInfo = &types.TunnelInfo{
		TunnelID: tunnelID,
		Domain:   domain,
		Status:   "active",
	}
	
	// Update session in persistence if enabled
	if m.persistenceEnabled && m.persistenceService != nil {
		if err := m.persistenceService.SaveSession(session); err != nil {
			log.Printf("Warning: failed to persist session with tunnel info: %v", err)
		}
	}
	
	log.Printf("Associated tunnel %s with session %s (domain: %s)", tunnelID, sessionID, domain)
	return nil
}

// GetSessionByTunnel gets a session by tunnel ID
func (m *Manager) GetSessionByTunnel(tunnelID string) (*types.Session, error) {
	sessions := m.List()
	for _, session := range sessions {
		if session.TunnelInfo != nil && session.TunnelInfo.TunnelID == tunnelID {
			return session, nil
		}
	}
	
	return nil, fmt.Errorf("session not found for tunnel: %s", tunnelID)
}

// GetTunnelInfoForSession gets tunnel information for a session
func (m *Manager) GetTunnelInfoForSession(sessionID string) (*types.TunnelInfo, error) {
	session := m.Get(sessionID)
	if session == nil {
		return nil, fmt.Errorf("session not found: %s", sessionID)
	}
	
	return session.TunnelInfo, nil
}

// DisassociateTunnelFromSession removes tunnel association from a session
func (m *Manager) DisassociateTunnelFromSession(sessionID string) error {
	session := m.Get(sessionID)
	if session == nil {
		return fmt.Errorf("session not found: %s", sessionID)
	}
	
	session.TunnelInfo = nil
	
	// Update session in persistence if enabled
	if m.persistenceEnabled && m.persistenceService != nil {
		if err := m.persistenceService.SaveSession(session); err != nil {
			log.Printf("Warning: failed to persist session without tunnel info: %v", err)
		}
	}
	
	log.Printf("Disassociated tunnel from session %s", sessionID)
	return nil
}
