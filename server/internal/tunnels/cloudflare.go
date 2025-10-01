package tunnels

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
)

// CloudflareConfig holds configuration for Cloudflare Tunnel
type CloudflareConfig struct {
	TunnelID       string
	TunnelName     string
	Hostname       string
	CredPath       string
	UseQuickTunnel bool
}

// Validate checks if the CloudflareConfig is valid
func (c *CloudflareConfig) Validate() error {
	if c.UseQuickTunnel {
		return nil
	}
	
	if c.TunnelID == "" && c.TunnelName == "" {
		return fmt.Errorf("either TunnelID or TunnelName must be provided")
	}
	
	if c.Hostname == "" {
		return fmt.Errorf("Hostname must be provided for authenticated tunnels")
	}
	
	return nil
}

// cloudflareService implements TunnelService for Cloudflare Tunnel
type cloudflareService struct {
	cmd       *exec.Cmd
	port      int
	mu        sync.Mutex
	running   bool
	publicURL string
	config    *CloudflareConfig
	stdout    io.ReadCloser
	stderr    io.ReadCloser
}

// newCloudflareService creates a new Cloudflare tunnel service
func newCloudflareService() TunnelService {
	return &cloudflareService{}
}

// StartQuickTunnel starts a quick (temporary) tunnel
func (c *cloudflareService) StartQuickTunnel(port int) error {
	config := &CloudflareConfig{
		UseQuickTunnel: true,
	}
	return c.StartWithConfig(port, config)
}

// StartWithConfig starts a Cloudflare tunnel with custom configuration
func (c *cloudflareService) StartWithConfig(port int, config *CloudflareConfig) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.running {
		return fmt.Errorf("cloudflare tunnel already running")
	}

	if !c.IsInstalled() {
		return fmt.Errorf("cloudflared is not installed - install from https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/tunnel-guide/")
	}

	if err := config.Validate(); err != nil {
		return fmt.Errorf("invalid configuration: %w", err)
	}

	c.config = config
	c.port = port

	var cmd *exec.Cmd
	
	if config.UseQuickTunnel {
		cmd = exec.Command("cloudflared", "tunnel", "--url", fmt.Sprintf("http://localhost:%d", port))
	} else {
		args := []string{"tunnel"}
		
		if config.CredPath != "" {
			args = append(args, "--credentials-file", config.CredPath)
		}
		
		args = append(args, "run")
		if config.TunnelID != "" {
			args = append(args, config.TunnelID)
		} else {
			args = append(args, config.TunnelName)
		}
		
		cmd = exec.Command("cloudflared", args...)
		
		if config.Hostname != "" {
			configPath, err := c.createConfigFile(port, config)
			if err != nil {
				return fmt.Errorf("failed to create config file: %w", err)
			}
			cmd.Args = append([]string{"cloudflared", "tunnel", "--config", configPath, "run"}, cmd.Args[2:]...)
		}
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}
	c.stdout = stdout

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to create stderr pipe: %w", err)
	}
	c.stderr = stderr

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start cloudflared: %w", err)
	}

	c.cmd = cmd
	c.running = true

	go c.monitorOutput()

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

// Start starts a Cloudflare tunnel on the specified port using quick tunnel
func (c *cloudflareService) Start(port int) error {
	return c.StartQuickTunnel(port)
}

// createConfigFile creates a temporary config file for authenticated tunnels
func (c *cloudflareService) createConfigFile(port int, config *CloudflareConfig) (string, error) {
	tmpDir := os.TempDir()
	configPath := filepath.Join(tmpDir, fmt.Sprintf("cloudflared-%s.yml", config.TunnelID))
	
	configContent := fmt.Sprintf(`tunnel: %s
credentials-file: %s

ingress:
  - hostname: %s
    service: http://localhost:%d
  - service: http_status:404
`, config.TunnelID, config.CredPath, config.Hostname, port)

	if err := os.WriteFile(configPath, []byte(configContent), 0600); err != nil {
		return "", err
	}

	return configPath, nil
}

// monitorOutput monitors cloudflared output to extract the public URL
func (c *cloudflareService) monitorOutput() {
	scanner := bufio.NewScanner(c.stderr)
	for scanner.Scan() {
		line := scanner.Text()
		
		if url, err := c.extractURLFromOutput(line); err == nil {
			c.mu.Lock()
			if c.publicURL == "" {
				c.publicURL = url
			}
			c.mu.Unlock()
		}
	}
}

// extractURLFromOutput extracts the public URL from cloudflared output
func (c *cloudflareService) extractURLFromOutput(output string) (string, error) {
	quickTunnelPattern := regexp.MustCompile(`https://[a-z0-9-]+\.trycloudflare\.com`)
	
	if match := quickTunnelPattern.FindString(output); match != "" {
		return match, nil
	}
	
	customDomainPattern := regexp.MustCompile(`https://[a-z0-9.-]+\.[a-z]{2,}`)
	
	if strings.Contains(output, "Registered tunnel connection") || 
	   strings.Contains(output, "Connection registered") {
		if match := customDomainPattern.FindString(output); match != "" {
			return match, nil
		}
	}
	
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.config != nil && c.config.Hostname != "" && !c.config.UseQuickTunnel {
		if strings.Contains(output, "Connection") && strings.Contains(output, "registered") {
			return fmt.Sprintf("https://%s", c.config.Hostname), nil
		}
	}
	
	return "", fmt.Errorf("no URL found in output")
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
	
	if c.config != nil && c.config.TunnelID != "" {
		tmpDir := os.TempDir()
		configPath := filepath.Join(tmpDir, fmt.Sprintf("cloudflared-%s.yml", c.config.TunnelID))
		os.Remove(configPath)
	}
	
	c.config = nil
	
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
