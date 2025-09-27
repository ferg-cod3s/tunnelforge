package power

import (
	"os"
	"fmt"
	"os/exec"
	"strconv"
	"sync"
)

// macOSManager implements PowerManager for macOS using IOKit
type macOSManager struct {
	assertionID int
	mu          sync.Mutex
	active      bool
}

// newMacOSManager creates a new macOS power manager
func newMacOSManager() (*macOSManager, error) {
	return &macOSManager{
		assertionID: -1,
		active:      false,
	}, nil
}

// PreventSleep prevents sleep using IOKit power assertions
func (m *macOSManager) PreventSleep(reason string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.active {
		return nil // Already active
	}

	// Use caffeinate command as a reliable way to prevent sleep
	// This creates a power assertion that prevents idle sleep
	cmd := exec.Command("caffeinate", "-i", "-m", "-s", "-w", strconv.Itoa(os.Getpid()))
	
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start caffeinate: %w", err)
	}

	// Store the process ID for potential cleanup
	m.assertionID = cmd.Process.Pid
	m.active = true

	// Let the process run in background
	go func() {
		cmd.Wait() // Wait for process to finish
		m.mu.Lock()
		m.active = false
		m.assertionID = -1
		m.mu.Unlock()
	}()

	return nil
}

// AllowSleep allows sleep by terminating the caffeinate process
func (m *macOSManager) AllowSleep() error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if !m.active || m.assertionID == -1 {
		return nil
	}

	// Kill the caffeinate process
	cmd := exec.Command("kill", strconv.Itoa(m.assertionID))
	if err := cmd.Run(); err != nil {
		// Try pkill as fallback
		cmd = exec.Command("pkill", "-f", "caffeinate")
		cmd.Run() // Ignore error, best effort
	}

	m.active = false
	m.assertionID = -1
	return nil
}

// IsSleepPrevented returns whether sleep is currently prevented
func (m *macOSManager) IsSleepPrevented() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.active
}
