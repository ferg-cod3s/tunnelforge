package power

// noOpManager provides a no-operation implementation for unsupported platforms
type noOpManager struct{}

// newNoOpManager creates a new no-op power manager
func newNoOpManager() *noOpManager {
	return &noOpManager{}
}

// PreventSleep does nothing on unsupported platforms
func (n *noOpManager) PreventSleep(reason string) error {
	// No-op implementation for unsupported platforms
	return nil
}

// AllowSleep does nothing on unsupported platforms
func (n *noOpManager) AllowSleep() error {
	// No-op implementation for unsupported platforms
	return nil
}

// IsSleepPrevented always returns false on unsupported platforms
func (n *noOpManager) IsSleepPrevented() bool {
	return false
}
