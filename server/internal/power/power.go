// Package power provides cross-platform power management functionality
// to prevent system sleep during terminal sessions.
package power

import (
	"runtime"
	"fmt"
	"sync"
)

// PowerManager interface for platform-specific power management
type PowerManager interface {
	PreventSleep(reason string) error
	AllowSleep() error
	IsSleepPrevented() bool
}

// Service manages power management across platforms
type Service struct {
	manager PowerManager
	mu      sync.RWMutex
	enabled bool
	active  bool
}

// NewService creates a new power management service
func NewService() (*Service, error) {
	manager, err := newPlatformManager()
	if err != nil {
		return nil, fmt.Errorf("failed to create platform power manager: %w", err)
	}

	return &Service{
		manager: manager,
		enabled: true, // Default to enabled
		active:  false,
	}, nil
}

// newPlatformManager creates the appropriate platform-specific manager
func newPlatformManager() (PowerManager, error) {
	switch runtime.GOOS {
	case "darwin":
		return newMacOSManager()
	case "linux":
		return newLinuxManager()
	case "windows":
		return newWindowsManager()
	default:
		return newNoOpManager(), nil // Fallback for unsupported platforms
	}
}

// PreventSleep prevents the system from sleeping
func (s *Service) PreventSleep(reason string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.enabled {
		return fmt.Errorf("power management is disabled")
	}

	if s.active {
		return nil // Already preventing sleep
	}

	if err := s.manager.PreventSleep(reason); err != nil {
		return fmt.Errorf("failed to prevent sleep: %w", err)
	}

	s.active = true
	return nil
}

// AllowSleep allows the system to sleep again
func (s *Service) AllowSleep() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.active {
		return nil // Not currently preventing sleep
	}

	if err := s.manager.AllowSleep(); err != nil {
		return fmt.Errorf("failed to allow sleep: %w", err)
	}

	s.active = false
	return nil
}

// IsSleepPrevented returns whether sleep is currently prevented
func (s *Service) IsSleepPrevented() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.active
}

// UpdateSleepPrevention updates sleep prevention based on server state
func (s *Service) UpdateSleepPrevention(enabled bool, serverRunning bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.enabled = enabled

	if !enabled || !serverRunning {
		// Disable sleep prevention
		if s.active {
			if err := s.manager.AllowSleep(); err != nil {
				return fmt.Errorf("failed to allow sleep during update: %w", err)
			}
			s.active = false
		}
		return nil
	}

	// Enable sleep prevention if not already active
	if !s.active {
		reason := "TunnelForge server is running"
		if err := s.manager.PreventSleep(reason); err != nil {
			return fmt.Errorf("failed to prevent sleep during update: %w", err)
		}
		s.active = true
	}

	return nil
}

// GetStatus returns the current power management status
func (s *Service) GetStatus() map[string]interface{} {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return map[string]interface{}{
		"enabled":         s.enabled,
		"sleep_prevented": s.active,
	}
}
