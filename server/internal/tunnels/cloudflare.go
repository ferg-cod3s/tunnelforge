package tunnels

import (
	"fmt"
	"os/exec"
	"sync"
)

// cloudflareService implements TunnelService for Cloudflare Tunnel
type cloudflareService struct {
	cmd    *exec.Cmd
	port   int
	mu     sync.Mutex
	running bool
	publicURL string
}

// newCloudflareService creates a new Cloudflare tunnel service
func newCloudflareService() TunnelService {
	return &cloudflareService{}
}

// Start starts a Cloudflare tunnel on the specified port
func (c *cloudflareService) Start(port int) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.running {
		return fmt.Errorf("cloudflare tunnel already running")
	}

	// Check if cloudflared is installed
	if !c.IsInstalled() {
		return fmt.Errorf("cloudflared is not installed - install from https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/tunnel-guide/")
	}

	// For now, we'll use a temporary tunnel that requires manual setup
	// In production, this would use authenticated tunnels with proper configuration
	cmd := exec.Command("cloudflared", "tunnel", "--url", fmt.Sprintf("http://localhost:%d", port))
	
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start cloudflared: %w", err)
	}

	c.cmd = cmd
	c.port = port
	c.running = true

	// Note: Getting the public URL from cloudflared output is complex
	// For now, we'll indicate it's running but URL discovery needs implementation
	c.publicURL = fmt.Sprintf("https://tunnel-%d.cloudflare.example", port) // Placeholder

	// Monitor the process
	go func() {
		cmd.Wait()
		c.mu.Lock()
		c.running = false
		c.cmd = nil
		c.publicURL = ""
		c.mu.Unlock()
	}()

	return nil
}

// Stop stops the Cloudflare tunnel
func (c *cloudflareService) Stop() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.running || c.cmd == nil {
		return nil
	}

	if err := c.cmd.Process.Kill(); err != nil {
		return fmt.Errorf("failed to stop cloudflared: %w", err)
	}

	c.running = false
	c.cmd = nil
	c.publicURL = ""
	return nil
}

// GetStatus returns the current status of the tunnel
func (c *cloudflareService) GetStatus() (*TunnelStatus, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	status := &TunnelStatus{
		Type: TunnelTypeCloudflare,
	}

	if c.running {
		status.Running = true
		status.PublicURL = c.publicURL
	}

	return status, nil
}

// GetPublicURL returns the public URL of the tunnel
func (c *cloudflareService) GetPublicURL() (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.running {
		return "", fmt.Errorf("tunnel is not running")
	}

	if c.publicURL == "" {
		return "", fmt.Errorf("public URL not available yet")
	}

	return c.publicURL, nil
}

// IsInstalled checks if cloudflared is installed
func (c *cloudflareService) IsInstalled() bool {
	_, err := exec.LookPath("cloudflared")
	return err == nil
}

// GetType returns the tunnel type
func (c *cloudflareService) GetType() TunnelType {
	return TunnelTypeCloudflare
}
