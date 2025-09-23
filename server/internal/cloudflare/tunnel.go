package cloudflare

import (
	"fmt"
	"log"
	"time"
)

// TunnelService manages Cloudflare tunnel lifecycle
type TunnelService struct {
	apiClient *APIClient
}

// NewTunnelService creates a new tunnel service
func NewTunnelService(apiClient *APIClient) *TunnelService {
	return &TunnelService{
		apiClient: apiClient,
	}
}

// TunnelInfo represents tunnel information for the frontend
type TunnelInfo struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	Domain    string    `json:"domain,omitempty"`
}

// CreateTunnel creates a new Cloudflare tunnel
func (ts *TunnelService) CreateTunnel(name, domain string) (*TunnelInfo, error) {
	log.Printf("Creating Cloudflare tunnel: %s", name)
	
	// Create tunnel request
	req := CreateTunnelRequest{
		Name: name,
		Config: TunnelConfig{
			OriginRequest: TunnelOriginRequest{
				ConnectTimeout: "30s",
				NoTLSVerify:    false,
			},
		},
	}

	// Create the tunnel
	tunnel, err := ts.apiClient.CreateTunnel(req)
	if err != nil {
		log.Printf("Failed to create tunnel: %v", err)
		return nil, fmt.Errorf("failed to create tunnel: %w", err)
	}

	log.Printf("Successfully created tunnel: %s (ID: %s)", tunnel.Name, tunnel.ID)

	// Return tunnel info
	tunnelInfo := &TunnelInfo{
		ID:        tunnel.ID,
		Name:      tunnel.Name,
		Status:    tunnel.Status,
		CreatedAt: tunnel.CreatedAt,
		Domain:    domain,
	}

	return tunnelInfo, nil
}

// ListTunnels lists all tunnels
func (ts *TunnelService) ListTunnels() ([]TunnelInfo, error) {
	log.Printf("Listing Cloudflare tunnels")
	
	tunnels, err := ts.apiClient.ListTunnels()
	if err != nil {
		log.Printf("Failed to list tunnels: %v", err)
		return nil, fmt.Errorf("failed to list tunnels: %w", err)
	}

	var tunnelInfos []TunnelInfo
	for _, tunnel := range tunnels {
		tunnelInfo := TunnelInfo{
			ID:        tunnel.ID,
			Name:      tunnel.Name,
			Status:    tunnel.Status,
			CreatedAt: tunnel.CreatedAt,
		}
		tunnelInfos = append(tunnelInfos, tunnelInfo)
	}

	log.Printf("Found %d tunnels", len(tunnelInfos))
	return tunnelInfos, nil
}

// GetTunnel gets a specific tunnel
func (ts *TunnelService) GetTunnel(tunnelID string) (*TunnelInfo, error) {
	log.Printf("Getting tunnel: %s", tunnelID)
	
	tunnel, err := ts.apiClient.GetTunnel(tunnelID)
	if err != nil {
		log.Printf("Failed to get tunnel: %v", err)
		return nil, fmt.Errorf("failed to get tunnel: %w", err)
	}

	tunnelInfo := &TunnelInfo{
		ID:        tunnel.ID,
		Name:      tunnel.Name,
		Status:    tunnel.Status,
		CreatedAt: tunnel.CreatedAt,
	}

	return tunnelInfo, nil
}

// DeleteTunnel deletes a tunnel
func (ts *TunnelService) DeleteTunnel(tunnelID string) error {
	log.Printf("Deleting tunnel: %s", tunnelID)
	
	err := ts.apiClient.DeleteTunnel(tunnelID)
	if err != nil {
		log.Printf("Failed to delete tunnel: %v", err)
		return fmt.Errorf("failed to delete tunnel: %w", err)
	}

	log.Printf("Successfully deleted tunnel: %s", tunnelID)
	return nil
}

// GetTunnelStatus gets the current status of a tunnel
func (ts *TunnelService) GetTunnelStatus(tunnelID string) (string, error) {
	tunnel, err := ts.apiClient.GetTunnel(tunnelID)
	if err != nil {
		return "", fmt.Errorf("failed to get tunnel status: %w", err)
	}
	
	return tunnel.Status, nil
}

// ValidateTunnelName validates a tunnel name
func (ts *TunnelService) ValidateTunnelName(name string) error {
	if name == "" {
		return fmt.Errorf("tunnel name cannot be empty")
	}
	
	if len(name) > 63 {
		return fmt.Errorf("tunnel name too long (max 63 characters)")
	}
	
	// Basic validation - should contain only alphanumeric characters and hyphens
	for i, char := range name {
		if !((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9') || char == '-') {
			return fmt.Errorf("tunnel name contains invalid character '%c' at position %d", char, i)
		}
	}
	
	if name[0] == '-' || name[len(name)-1] == '-' {
		return fmt.Errorf("tunnel name cannot start or end with hyphen")
	}
	
	return nil
}
