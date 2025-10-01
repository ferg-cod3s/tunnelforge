package tunnels

import (
	"fmt"
	"os/exec"
	"sync"
)

// tailscaleService implements TunnelService for Tailscale
type tailscaleService struct {
	port   int
	mu     sync.Mutex
	running bool
	publicURL string
}

// newTailscaleService creates a new Tailscale tunnel service
func newTailscaleService() TunnelService {
	return &tailscaleService{}
}

// Start starts a Tailscale funnel on the specified port
func (t *tailscaleService) Start(port int) error {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.running {
		return fmt.Errorf("tailscale tunnel already running")
	}

	// Check if tailscale is installed
	if !t.IsInstalled() {
		return fmt.Errorf("tailscale is not installed - install from https://tailscale.com/download")
	}

	// Start Tailscale funnel (requires Tailscale to be running and authenticated)
	cmd := exec.Command("tailscale", "serve", fmt.Sprintf("localhost:%d", port))
	
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start tailscale serve: %w", err)
	}

	t.port = port
	t.running = true

	// Tailscale uses the node's Tailscale IP/domain
	// This would need to be discovered dynamically
	t.publicURL = fmt.Sprintf("https://your-tailscale-node.tailscale-domain.ts.net") // Placeholder

	// Monitor the process
	go func() {
		cmd.Wait()
		t.mu.Lock()
		t.running = false
		t.publicURL = ""
		t.mu.Unlock()
	}()

	return nil
}

// Stop stops the Tailscale tunnel
func (t *tailscaleService) Stop() error {
	t.mu.Lock()
	defer t.mu.Unlock()

	if !t.running {
		return nil
	}

	// Stop the tailscale serve
	cmd := exec.Command("tailscale", "serve", "reset")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to stop tailscale serve: %w", err)
	}

	t.running = false
	t.publicURL = ""
	return nil
}

// GetStatus returns the current status of the tunnel
func (t *tailscaleService) GetStatus() (*TunnelStatus, error) {
	t.mu.Lock()
	defer t.mu.Unlock()

	status := &TunnelStatus{
		Type: TunnelTypeTailscale,
	}

	if t.running {
		status.Running = true
		status.PublicURL = t.publicURL
	}

	return status, nil
}

// GetPublicURL returns the public URL of the tunnel
func (t *tailscaleService) GetPublicURL() (string, error) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if !t.running {
		return "", fmt.Errorf("tunnel is not running")
	}

	if t.publicURL == "" {
		return "", fmt.Errorf("public URL not available")
	}

	return t.publicURL, nil
}

// IsInstalled checks if tailscale is installed
func (t *tailscaleService) IsInstalled() bool {
	_, err := exec.LookPath("tailscale")
	return err == nil
}

// GetType returns the tunnel type
func (t *tailscaleService) GetType() TunnelType {
	return TunnelTypeTailscale
}

// StartQuickTunnel starts a quick tunnel (not applicable for tailscale)
func (t *tailscaleService) StartQuickTunnel(port int) error {
	return t.Start(port)
}

// StartWithConfig starts with config (not applicable for tailscale)
func (t *tailscaleService) StartWithConfig(port int, config *CloudflareConfig) error {
	return fmt.Errorf("StartWithConfig not supported for tailscale")
}
