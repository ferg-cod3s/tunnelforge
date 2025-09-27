package registry

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/ferg-cod3s/tunnelforge/go-server/pkg/types"
)

// Service manages remote TunnelForge instances and session discovery
type Service struct {
	config       *types.RegistryConfig
	instances    map[string]*types.RemoteInstance
	instancesMux sync.RWMutex
	httpClient   *http.Client
	started      bool
	stopChan     chan struct{}
}

// NewService creates a new remote registry service
func NewService(config *types.RegistryConfig) *Service {
	if config == nil {
		config = &types.RegistryConfig{
			EnableDiscovery:    true,
			DiscoveryInterval:  30 * time.Second,
			HealthCheckTimeout: 5 * time.Second,
			MaxRetries:         3,
			RetryDelay:         1 * time.Second,
		}
	}

	return &Service{
		config:     config,
		instances:  make(map[string]*types.RemoteInstance),
		httpClient: &http.Client{Timeout: config.HealthCheckTimeout},
		stopChan:   make(chan struct{}),
	}
}

// Start starts the registry service
func (s *Service) Start() error {
	if s.started {
		return fmt.Errorf("registry service already started")
	}

	s.started = true
	log.Printf("Starting remote registry service")

	if s.config.EnableDiscovery {
		go s.discoveryLoop()
	}

	return nil
}

// Stop stops the registry service
func (s *Service) Stop() error {
	if !s.started {
		return nil
	}

	log.Printf("Stopping remote registry service")
	close(s.stopChan)
	s.started = false
	return nil
}

// RegisterInstance registers a remote instance
func (s *Service) RegisterInstance(instance *types.RemoteInstance) error {
	s.instancesMux.Lock()
	defer s.instancesMux.Unlock()

	instance.LastSeen = time.Now()
	if instance.Status == "" {
		instance.Status = "unknown"
	}

	s.instances[instance.ID] = instance
	log.Printf("Registered remote instance: %s (%s)", instance.Name, instance.URL)

	return nil
}

// UnregisterInstance unregisters a remote instance
func (s *Service) UnregisterInstance(instanceID string) error {
	s.instancesMux.Lock()
	defer s.instancesMux.Unlock()

	if _, exists := s.instances[instanceID]; !exists {
		return fmt.Errorf("instance not found: %s", instanceID)
	}

	delete(s.instances, instanceID)
	log.Printf("Unregistered remote instance: %s", instanceID)

	return nil
}

// GetInstance gets a remote instance by ID
func (s *Service) GetInstance(instanceID string) (*types.RemoteInstance, error) {
	s.instancesMux.RLock()
	defer s.instancesMux.RUnlock()

	instance, exists := s.instances[instanceID]
	if !exists {
		return nil, fmt.Errorf("instance not found: %s", instanceID)
	}

	return instance, nil
}

// ListInstances lists all registered remote instances
func (s *Service) ListInstances() []*types.RemoteInstance {
	s.instancesMux.RLock()
	defer s.instancesMux.RUnlock()

	instances := make([]*types.RemoteInstance, 0, len(s.instances))
	for _, instance := range s.instances {
		instances = append(instances, instance)
	}

	return instances
}

// DiscoverSessions discovers sessions from all online remote instances
func (s *Service) DiscoverSessions() ([]*types.RemoteSession, error) {
	s.instancesMux.RLock()
	instances := make([]*types.RemoteInstance, 0, len(s.instances))
	for _, instance := range s.instances {
		instances = append(instances, instance)
	}
	s.instancesMux.RUnlock()

	var allSessions []*types.RemoteSession

	for _, instance := range instances {
		if instance.Status != "online" {
			continue
		}

		sessions, err := s.discoverSessionsFromInstance(instance)
		if err != nil {
			log.Printf("Failed to discover sessions from instance %s: %v", instance.ID, err)
			continue
		}

		allSessions = append(allSessions, sessions...)
	}

	return allSessions, nil
}

// GetSession gets a specific session from a remote instance
func (s *Service) GetSession(instanceID, sessionID string) (*types.RemoteSession, error) {
	instance, err := s.GetInstance(instanceID)
	if err != nil {
		return nil, err
	}

	if instance.Status != "online" {
		return nil, fmt.Errorf("instance is not online: %s", instanceID)
	}

	return s.getSessionFromInstance(instance, sessionID)
}

// ConnectToSession establishes a connection to a remote session
func (s *Service) ConnectToSession(instanceID, sessionID string) (interface{}, error) {
	// This would return a proxy connection to the remote session
	// For now, return nil as this requires WebSocket proxying
	return nil, fmt.Errorf("remote session connection not implemented")
}

// GetStats returns registry statistics
func (s *Service) GetStats() *types.RegistryStats {
	s.instancesMux.RLock()
	defer s.instancesMux.RUnlock()

	stats := &types.RegistryStats{
		TotalInstances: len(s.instances),
	}

	for _, instance := range s.instances {
		if instance.Status == "online" {
			stats.OnlineInstances++
		}
	}

	// Note: TotalRemoteSessions would need to be calculated by calling DiscoverSessions
	// For performance, we don't do this in GetStats

	return stats
}

// discoveryLoop runs the background discovery process
func (s *Service) discoveryLoop() {
	ticker := time.NewTicker(s.config.DiscoveryInterval)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopChan:
			return
		case <-ticker.C:
			s.performDiscovery()
		}
	}
}

// performDiscovery checks the health of all registered instances
func (s *Service) performDiscovery() {
	s.instancesMux.Lock()
	instances := make([]*types.RemoteInstance, 0, len(s.instances))
	for _, instance := range s.instances {
		instances = append(instances, instance)
	}
	s.instancesMux.Unlock()

	for _, instance := range instances {
		s.checkInstanceHealth(instance)
	}
}

// checkInstanceHealth checks if a remote instance is healthy
func (s *Service) checkInstanceHealth(instance *types.RemoteInstance) {
	ctx, cancel := context.WithTimeout(context.Background(), s.config.HealthCheckTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", instance.URL+"/health", nil)
	if err != nil {
		s.updateInstanceStatus(instance.ID, "offline")
		return
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		s.updateInstanceStatus(instance.ID, "offline")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		s.updateInstanceStatus(instance.ID, "online")
	} else {
		s.updateInstanceStatus(instance.ID, "offline")
	}
}

// updateInstanceStatus updates the status of a remote instance
func (s *Service) updateInstanceStatus(instanceID, status string) {
	s.instancesMux.Lock()
	defer s.instancesMux.Unlock()

	if instance, exists := s.instances[instanceID]; exists {
		oldStatus := instance.Status
		instance.Status = status
		instance.LastSeen = time.Now()

		if oldStatus != status {
			log.Printf("Instance %s status changed: %s -> %s", instanceID, oldStatus, status)
		}
	}
}

// discoverSessionsFromInstance discovers sessions from a specific remote instance
func (s *Service) discoverSessionsFromInstance(instance *types.RemoteInstance) ([]*types.RemoteSession, error) {
	ctx, cancel := context.WithTimeout(context.Background(), s.config.HealthCheckTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", instance.URL+"/api/sessions", nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("remote instance returned status %d", resp.StatusCode)
	}

	var sessions []*types.Session
	if err := json.NewDecoder(resp.Body).Decode(&sessions); err != nil {
		return nil, err
	}

	remoteSessions := make([]*types.RemoteSession, 0, len(sessions))
	for _, session := range sessions {
		remoteSessions = append(remoteSessions, &types.RemoteSession{
			Session:     session,
			InstanceID:  instance.ID,
			InstanceURL: instance.URL,
		})
	}

	return remoteSessions, nil
}

// getSessionFromInstance gets a specific session from a remote instance
func (s *Service) getSessionFromInstance(instance *types.RemoteInstance, sessionID string) (*types.RemoteSession, error) {
	ctx, cancel := context.WithTimeout(context.Background(), s.config.HealthCheckTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", instance.URL+"/api/sessions/"+sessionID, nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == http.StatusNotFound {
			return nil, fmt.Errorf("session not found")
		}
		return nil, fmt.Errorf("remote instance returned status %d", resp.StatusCode)
	}

	var session types.Session
	if err := json.NewDecoder(resp.Body).Decode(&session); err != nil {
		return nil, err
	}

	return &types.RemoteSession{
		Session:     &session,
		InstanceID:  instance.ID,
		InstanceURL: instance.URL,
	}, nil
}
