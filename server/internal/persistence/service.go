package persistence

import (
	"fmt"
	"log"
	"sort"
	"sync"
	"time"

	"github.com/ferg-cod3s/tunnelforge/go-server/pkg/types"
)

// Service handles session persistence operations
type Service struct {
	store                SessionStore
	autoSaveEnabled      bool
	saveInterval         time.Duration
	sessionMaxAge        time.Duration
	sessionCleanupAge    time.Duration
	maxPersistedSessions int
	stopChan             chan struct{}
	wg                   sync.WaitGroup
	mu                   sync.RWMutex
}

// NewService creates a new persistence service
func NewService(store SessionStore, autoSaveEnabled bool, saveInterval time.Duration) *Service {
	return &Service{
		store:                store,
		autoSaveEnabled:      autoSaveEnabled,
		saveInterval:         saveInterval,
		sessionMaxAge:        24 * time.Hour,     // Default: only restore sessions < 24h old
		sessionCleanupAge:    7 * 24 * time.Hour, // Default: delete sessions > 7 days old
		maxPersistedSessions: 100,                // Default: keep max 100 sessions
		stopChan:             make(chan struct{}),
	}
}

// NewServiceWithConfig creates a new persistence service with full configuration
func NewServiceWithConfig(store SessionStore, autoSaveEnabled bool, saveInterval, maxAge, cleanupAge time.Duration, maxSessions int) *Service {
	return &Service{
		store:                store,
		autoSaveEnabled:      autoSaveEnabled,
		saveInterval:         saveInterval,
		sessionMaxAge:        maxAge,
		sessionCleanupAge:    cleanupAge,
		maxPersistedSessions: maxSessions,
		stopChan:             make(chan struct{}),
	}
}

// Start begins the persistence service (starts auto-save if enabled)
func (s *Service) Start() {
	if s.autoSaveEnabled {
		s.wg.Add(1)
		go s.autoSaveLoop()
		log.Printf("📁 Session persistence started with auto-save interval: %v", s.saveInterval)
	} else {
		log.Printf("📁 Session persistence started (auto-save disabled)")
	}
}

// Stop gracefully shuts down the persistence service
func (s *Service) Stop() {
	close(s.stopChan)
	s.wg.Wait()

	if err := s.store.Close(); err != nil {
		log.Printf("Warning: failed to close session store: %v", err)
	}

	log.Printf("📁 Session persistence stopped")
}

// SaveSession persists a session to storage
func (s *Service) SaveSession(session *types.Session) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.store.SaveSession(session); err != nil {
		return fmt.Errorf("failed to save session %s: %w", session.ID, err)
	}

	return nil
}

// LoadSession retrieves a session from storage
func (s *Service) LoadSession(id string) (*types.Session, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	session, err := s.store.LoadSession(id)
	if err != nil {
		return nil, fmt.Errorf("failed to load session %s: %w", id, err)
	}

	return session, nil
}

// LoadAllSessions retrieves all persisted sessions
func (s *Service) LoadAllSessions() ([]*types.Session, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	sessions, err := s.store.LoadAllSessions()
	if err != nil {
		return nil, fmt.Errorf("failed to load all sessions: %w", err)
	}

	return sessions, nil
}

// DeleteSession removes a session from storage
func (s *Service) DeleteSession(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.store.DeleteSession(id); err != nil {
		return fmt.Errorf("failed to delete session %s: %w", id, err)
	}

	return nil
}

// ClearAll removes all sessions from storage
func (s *Service) ClearAll() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.store.ClearAll(); err != nil {
		return fmt.Errorf("failed to clear all sessions: %w", err)
	}

	return nil
}

// RestoreSessions loads and restores all persisted sessions with age filtering and cleanup
func (s *Service) RestoreSessions() ([]*types.Session, error) {
	sessions, err := s.LoadAllSessions()
	if err != nil {
		return nil, err
	}

	now := time.Now()
	var validSessions []*types.Session
	var toDelete []string
	var toRestore []*types.Session

	for _, session := range sessions {
		age := now.Sub(session.UpdatedAt)

		// Delete sessions older than cleanup age
		if age > s.sessionCleanupAge {
			toDelete = append(toDelete, session.ID)
			log.Printf("🗑️  Deleting old session: %s (age: %v, title: %s)", session.ID, age.Round(time.Hour), session.Title)
			continue
		}

		// Only restore sessions younger than max age
		if age <= s.sessionMaxAge {
			toRestore = append(toRestore, session)
		} else {
			// Keep but don't restore sessions between maxAge and cleanupAge
			validSessions = append(validSessions, session)
			log.Printf("⏸️  Skipping old session: %s (age: %v, title: %s)", session.ID, age.Round(time.Hour), session.Title)
		}
	}

	// Delete old sessions
	for _, id := range toDelete {
		if err := s.DeleteSession(id); err != nil {
			log.Printf("Warning: failed to delete old session %s: %v", id, err)
		}
	}

	// Check if we have too many sessions after cleanup
	totalSessions := len(toRestore) + len(validSessions)
	if totalSessions > s.maxPersistedSessions {
		excessCount := totalSessions - s.maxPersistedSessions

		log.Printf("⚠️  Too many sessions (%d > %d), deleting %d oldest sessions", totalSessions, s.maxPersistedSessions, excessCount)

		// Delete oldest sessions that we're not restoring
		deleted := 0
		for i := len(validSessions) - 1; i >= 0 && deleted < excessCount; i-- {
			session := validSessions[i]
			if err := s.DeleteSession(session.ID); err != nil {
				log.Printf("Warning: failed to delete excess session %s: %v", session.ID, err)
			} else {
				log.Printf("🗑️  Deleted excess session: %s (title: %s)", session.ID, session.Title)
				deleted++
			}
		}
	}

	if len(toDelete) > 0 {
		log.Printf("📁 Cleaned up %d old sessions (> %v)", len(toDelete), s.sessionCleanupAge)
	}

	if len(toRestore) > 0 {
		log.Printf("📁 Restored %d persisted sessions (< %v old)", len(toRestore), s.sessionMaxAge)
	} else {
		log.Printf("📁 No recent sessions to restore")
	}

	return toRestore, nil
}

// autoSaveLoop runs the periodic auto-save functionality and cleanup
func (s *Service) autoSaveLoop() {
	defer s.wg.Done()

	// Ticker for auto-save (existing functionality)
	saveTicker := time.NewTicker(s.saveInterval)
	defer saveTicker.Stop()

	// Ticker for periodic cleanup (every hour)
	cleanupTicker := time.NewTicker(1 * time.Hour)
	defer cleanupTicker.Stop()

	for {
		select {
		case <-saveTicker.C:
			// Auto-save is handled by the session manager calling SaveSession
			// No action needed here for auto-save
		case <-cleanupTicker.C:
			// Perform periodic cleanup of old sessions
			s.performCleanup()
		case <-s.stopChan:
			return
		}
	}
}

// performCleanup removes old sessions and enforces session limits
func (s *Service) performCleanup() {
	log.Printf("🧹 Starting periodic session cleanup...")

	sessions, err := s.LoadAllSessions()
	if err != nil {
		log.Printf("❌ Failed to load sessions for cleanup: %v", err)
		return
	}

	now := time.Now()
	var toDelete []string
	var keptCount int

	// Sort sessions by last updated time (newest first)
	sort.Slice(sessions, func(i, j int) bool {
		return sessions[i].UpdatedAt.After(sessions[j].UpdatedAt)
	})

	for _, session := range sessions {
		age := now.Sub(session.UpdatedAt)
		shouldDelete := false

		// Delete sessions older than cleanup age
		if age > s.sessionCleanupAge {
			shouldDelete = true
			log.Printf("🗑️  Cleanup: Deleting old session: %s (age: %v, title: %s)",
				session.ID, age.Round(time.Hour), session.Title)
		} else if keptCount >= s.maxPersistedSessions {
			// Enforce session limit (keep only the newest sessions)
			shouldDelete = true
			log.Printf("🗑️  Cleanup: Deleting excess session: %s (title: %s, keeping only %d newest)",
				session.ID, session.Title, s.maxPersistedSessions)
		} else {
			keptCount++
		}

		if shouldDelete {
			toDelete = append(toDelete, session.ID)
		}
	}

	// Delete the sessions
	if len(toDelete) > 0 {
		deletedCount := 0
		for _, sessionID := range toDelete {
			if err := s.DeleteSession(sessionID); err != nil {
				log.Printf("❌ Failed to delete session %s during cleanup: %v", sessionID, err)
			} else {
				deletedCount++
			}
		}
		log.Printf("✅ Cleanup completed: deleted %d sessions, kept %d sessions", deletedCount, keptCount)
	} else {
		log.Printf("✅ Cleanup completed: no sessions needed deletion")
	}
}

// GetStats returns persistence statistics
func (s *Service) GetStats() map[string]interface{} {
	sessions, err := s.LoadAllSessions()
	if err != nil {
		return map[string]interface{}{
			"error":           err.Error(),
			"autoSaveEnabled": s.autoSaveEnabled,
			"saveInterval":    s.saveInterval.String(),
		}
	}

	activeSessions := 0
	for _, session := range sessions {
		if session.Active {
			activeSessions++
		}
	}

	return map[string]interface{}{
		"totalSessions":   len(sessions),
		"activeSessions":  activeSessions,
		"autoSaveEnabled": s.autoSaveEnabled,
		"saveInterval":    s.saveInterval.String(),
	}
}
