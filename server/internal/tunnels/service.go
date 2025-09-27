// Package tunnels provides cross-platform tunnel management services
// for exposing local services via public URLs.
package tunnels

import (
	"fmt"
	"sync"
)

// TunnelType represents the type of tunnel service
type TunnelType string

const (
	TunnelTypeCloudflare TunnelType = "cloudflare"
	TunnelTypeNgrok      TunnelType = "ngrok"
	TunnelTypeTailscale  TunnelType = "tailscale"
)

// TunnelService interface for tunnel management
type TunnelService interface {
	Start(port int) error
	Stop() error
	GetStatus() (*TunnelStatus, error)
	GetPublicURL() (string, error)
	IsInstalled() bool
	GetType() TunnelType
}

// TunnelStatus represents the current status of a tunnel
type TunnelStatus struct {
	Running   bool   `json:"running"`
	PublicURL string `json:"public_url,omitempty"`
	Error     string `json:"error,omitempty"`
	Type      TunnelType `json:"type"`
}

// Service manages multiple tunnel services
type Service struct {
	services map[TunnelType]TunnelService
	mu       sync.RWMutex
}

// NewService creates a new tunnel service manager
func NewService() *Service {
	return &Service{
		services: make(map[TunnelType]TunnelService),
	}
}

// RegisterService registers a tunnel service
func (s *Service) RegisterService(service TunnelService) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.services[service.GetType()] = service
}

// GetService returns a tunnel service by type
func (s *Service) GetService(tunnelType TunnelType) (TunnelService, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	service, exists := s.services[tunnelType]
	if !exists {
		return nil, fmt.Errorf("tunnel service %s not available", tunnelType)
	}
	
	return service, nil
}

// ListServices returns all available tunnel services
func (s *Service) ListServices() map[TunnelType]TunnelStatus {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	result := make(map[TunnelType]TunnelStatus)
	for tunnelType, service := range s.services {
		status := TunnelStatus{
			Type: tunnelType,
		}
		
		if tunnelStatus, err := service.GetStatus(); err == nil {
			status = *tunnelStatus
		} else {
			status.Error = err.Error()
		}
		
		result[tunnelType] = status
	}
	
	return result
}

// InitializeServices initializes all available tunnel services
func (s *Service) InitializeServices() error {
	// Initialize Cloudflare service (highest priority)
	if cloudflareSvc := newCloudflareService(); cloudflareSvc != nil {
		s.RegisterService(cloudflareSvc)
	}
	
	// Initialize Ngrok service
	if ngrokSvc := newNgrokService(); ngrokSvc != nil {
		s.RegisterService(ngrokSvc)
	}
	
	// Initialize Tailscale service
	if tailscaleSvc := newTailscaleService(); tailscaleSvc != nil {
		s.RegisterService(tailscaleSvc)
	}
	
	return nil
}
