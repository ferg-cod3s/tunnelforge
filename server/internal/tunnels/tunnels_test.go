package tunnels

import (
	"testing"
)

func TestNewService(t *testing.T) {
	service := NewService()
	if service == nil {
		t.Fatal("Service is nil")
	}
}

func TestService_InitializeServices(t *testing.T) {
	service := NewService()
	err := service.InitializeServices()
	if err != nil {
		t.Fatalf("Failed to initialize services: %v", err)
	}
}

func TestService_ListServices(t *testing.T) {
	service := NewService()
	service.InitializeServices()
	
	tunnels := service.ListServices()
	if tunnels == nil {
		t.Fatal("ListServices returned nil")
	}
	
	// Should have at least cloudflare service
	if _, exists := tunnels[TunnelTypeCloudflare]; !exists {
		t.Error("Cloudflare service not found in list")
	}
}

func TestService_GetService(t *testing.T) {
	service := NewService()
	service.InitializeServices()
	
	// Test getting cloudflare service
	svc, err := service.GetService(TunnelTypeCloudflare)
	if err != nil {
		t.Fatalf("Failed to get cloudflare service: %v", err)
	}
	if svc == nil {
		t.Fatal("Cloudflare service is nil")
	}
	if svc.GetType() != TunnelTypeCloudflare {
		t.Errorf("Expected type %s, got %s", TunnelTypeCloudflare, svc.GetType())
	}
	
	// Test getting non-existent service
	_, err = service.GetService("nonexistent")
	if err == nil {
		t.Error("Expected error for non-existent service")
	}
}
