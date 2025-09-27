package power

import (
	"fmt"
	"os/exec"
	"sync"
)

// linuxManager implements PowerManager for Linux using systemd-inhibit
type linuxManager struct {
	cmd    *exec.Cmd
	mu     sync.Mutex
	active bool
}

// newLinuxManager creates a new Linux power manager
func newLinuxManager() (*linuxManager, error) {
	return &linuxManager{
		active: false,
	}, nil
}

// PreventSleep prevents sleep using systemd-inhibit
func (l *linuxManager) PreventSleep(reason string) error {
	l.mu.Lock()
	defer l.mu.Unlock()

	if l.active {
		return nil // Already active
	}

	// Use systemd-inhibit to prevent sleep
	// This is more reliable than other methods on modern Linux systems
	cmd := exec.Command("systemd-inhibit",
		"--what=idle:sleep",
		"--who=TunnelForge",
		"--why="+reason,
		"--mode=block",
		"sleep", "infinity")

	if err := cmd.Start(); err != nil {
		// Fallback to using org.freedesktop.ScreenSaver if systemd-inhibit fails
		return l.fallbackPreventSleep(reason)
	}

	l.cmd = cmd
	l.active = true

	// Monitor the process
	go func() {
		cmd.Wait()
		l.mu.Lock()
		l.active = false
		l.cmd = nil
		l.mu.Unlock()
	}()

	return nil
}

// AllowSleep allows sleep by terminating systemd-inhibit
func (l *linuxManager) AllowSleep() error {
	l.mu.Lock()
	defer l.mu.Unlock()

	if !l.active || l.cmd == nil {
		return nil
	}

	if err := l.cmd.Process.Kill(); err != nil {
		return fmt.Errorf("failed to kill systemd-inhibit process: %w", err)
	}

	l.active = false
	l.cmd = nil
	return nil
}

// IsSleepPrevented returns whether sleep is currently prevented
func (l *linuxManager) IsSleepPrevented() bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.active
}

// fallbackPreventSleep provides alternative sleep prevention for systems without systemd
func (l *linuxManager) fallbackPreventSleep(reason string) error {
	// Try using xdg-screensaver or other methods
	// For now, return an error indicating systemd-inhibit is required
	return fmt.Errorf("systemd-inhibit not available - install systemd for power management support")
}
