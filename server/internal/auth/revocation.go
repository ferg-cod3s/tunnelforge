package auth

import (
	"sync"
	"time"
)

// RevocationStore manages revoked JWT tokens
type RevocationStore interface {
	Revoke(tokenID string, expiry time.Time) error
	IsRevoked(tokenID string) bool
	Cleanup() error
}

// InMemoryRevocationStore implements RevocationStore with in-memory storage
type InMemoryRevocationStore struct {
	revoked map[string]time.Time
	mu      sync.RWMutex
}

// NewInMemoryRevocationStore creates a new in-memory revocation store
func NewInMemoryRevocationStore() *InMemoryRevocationStore {
	store := &InMemoryRevocationStore{
		revoked: make(map[string]time.Time),
	}
	
	// Start cleanup goroutine
	go store.cleanupRoutine()
	
	return store
}

// Revoke marks a token as revoked
func (s *InMemoryRevocationStore) Revoke(tokenID string, expiry time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.revoked[tokenID] = expiry
	return nil
}

// IsRevoked checks if a token is revoked
func (s *InMemoryRevocationStore) IsRevoked(tokenID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	expiry, exists := s.revoked[tokenID]
	if !exists {
		return false
	}
	
	// If token has expired, it's no longer revoked
	if time.Now().After(expiry) {
		return false
	}
	
	return true
}

// Cleanup removes expired revocations
func (s *InMemoryRevocationStore) Cleanup() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	now := time.Now()
	for tokenID, expiry := range s.revoked {
		if now.After(expiry) {
			delete(s.revoked, tokenID)
		}
	}
	
	return nil
}

// cleanupRoutine runs periodic cleanup
func (s *InMemoryRevocationStore) cleanupRoutine() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()
	
	for {
		select {
		case <-ticker.C:
			s.Cleanup()
		}
	}
}
