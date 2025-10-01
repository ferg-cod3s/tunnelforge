package tunnels

import (
	"fmt"
	"os/exec"
	"sync"
)

// ngrokService implements TunnelService for Ngrok
type ngrokService struct {
	cmd    *exec.Cmd
	port   int
	mu     sync.Mutex
	running bool
	publicURL string
}

// newNgrokService creates a new Ngrok tunnel service
func newNgrokService() TunnelService {
	return &ngrokService{}
}

// Start starts an Ngrok tunnel on the specified port
func (n *ngrokService) Start(port int) error {
	n.mu.Lock()
	defer n.mu.Unlock()

	if n.running {
		return fmt.Errorf("ngrok tunnel already running")
	}

	// Check if ngrok is installed
	if !n.IsInstalled() {
		return fmt.Errorf("ngrok is not installed - install from https://ngrok.com/download")
	}

	// Start ngrok tunnel
	cmd := exec.Command("ngrok", "http", fmt.Sprintf("%d", port))
	
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start ngrok: %w", err)
	}

	n.cmd = cmd
	n.port = port
	n.running = true

	// Note: Getting the public URL requires parsing ngrok's API or output
	// For now, we'll use a placeholder
	n.publicURL = fmt.Sprintf("https://random-subdomain.ngrok.io") // Placeholder

	// Monitor the process
	go func() {
		cmd.Wait()
		n.mu.Lock()
		n.running = false
		n.cmd = nil
		n.publicURL = ""
		n.mu.Unlock()
	}()

	return nil
}

// Stop stops the Ngrok tunnel
func (n *ngrokService) Stop() error {
	n.mu.Lock()
	defer n.mu.Unlock()

	if !n.running || n.cmd == nil {
		return nil
	}

	if err := n.cmd.Process.Kill(); err != nil {
		return fmt.Errorf("failed to stop ngrok: %w", err)
	}

	n.running = false
	n.cmd = nil
	n.publicURL = ""
	return nil
}

// GetStatus returns the current status of the tunnel
func (n *ngrokService) GetStatus() (*TunnelStatus, error) {
	n.mu.Lock()
	defer n.mu.Unlock()

	status := &TunnelStatus{
		Type: TunnelTypeNgrok,
	}

	if n.running {
		status.Running = true
		status.PublicURL = n.publicURL
	}

	return status, nil
}

// GetPublicURL returns the public URL of the tunnel
func (n *ngrokService) GetPublicURL() (string, error) {
	n.mu.Lock()
	defer n.mu.Unlock()

	if !n.running {
		return "", fmt.Errorf("tunnel is not running")
	}

	if n.publicURL == "" {
		return "", fmt.Errorf("public URL not available yet")
	}

	return n.publicURL, nil
}

// IsInstalled checks if ngrok is installed
func (n *ngrokService) IsInstalled() bool {
	_, err := exec.LookPath("ngrok")
	return err == nil
}

// GetType returns the tunnel type
func (n *ngrokService) GetType() TunnelType {
	return TunnelTypeNgrok
}

// StartQuickTunnel starts a quick tunnel (not applicable for ngrok)
func (n *ngrokService) StartQuickTunnel(port int) error {
	return n.Start(port)
}

// StartWithConfig starts with config (not applicable for ngrok)
func (n *ngrokService) StartWithConfig(port int, config *CloudflareConfig) error {
	return fmt.Errorf("StartWithConfig not supported for ngrok")
}
