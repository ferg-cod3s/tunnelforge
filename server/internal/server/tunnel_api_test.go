package server

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
)

// TestTunnelAPIEndpoints tests the tunnel API endpoints
func TestTunnelAPIEndpoints(t *testing.T) {
	// Create test server
	server, err := NewServer(&Config{
		Port:     4021,
		NoAuth:   true,
		BasePath: "/tmp/tunnelforge-test",
	})
	if err != nil {
		t.Fatalf("Failed to create server: %v", err)
	}

	// Create router
	router := mux.NewRouter()
	server.registerTunnelRoutes(router)

	tests := []struct {
		name           string
		method         string
		path           string
		body           map[string]interface{}
		expectedStatus int
		checkResponse  func(*testing.T, map[string]interface{})
	}{
		{
			name:           "List tunnels",
			method:         "GET",
			path:           "/api/tunnels",
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, resp map[string]interface{}) {
				tunnels, ok := resp["tunnels"].(map[string]interface{})
				if !ok {
					t.Error("Expected tunnels in response")
					return
				}
				// Should have cloudflare, ngrok, tailscale
				if _, exists := tunnels["cloudflare"]; !exists {
					t.Error("Expected cloudflare tunnel in list")
				}
			},
		},
		{
			name:           "Get cloudflare status (not running)",
			method:         "GET",
			path:           "/api/tunnels/cloudflare/status",
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, resp map[string]interface{}) {
				running, ok := resp["running"].(bool)
				if !ok {
					t.Error("Expected 'running' field in response")
					return
				}
				if running {
					t.Error("Expected tunnel to not be running initially")
				}
			},
		},
		{
			name:   "Start cloudflare tunnel",
			method: "POST",
			path:   "/api/tunnels/cloudflare/start",
			body: map[string]interface{}{
				"port": 3001,
			},
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, resp map[string]interface{}) {
				success, ok := resp["success"].(bool)
				if !ok || !success {
					t.Error("Expected success=true in response")
				}
				tunnelType, ok := resp["type"].(string)
				if !ok || tunnelType != "cloudflare" {
					t.Error("Expected type=cloudflare in response")
				}
			},
		},
		{
			name:           "Get tunnel URL",
			method:         "GET",
			path:           "/api/tunnels/cloudflare/url",
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, resp map[string]interface{}) {
				url, ok := resp["url"].(string)
				if !ok || url == "" {
					t.Error("Expected non-empty URL in response")
				}
			},
		},
		{
			name:           "Stop cloudflare tunnel",
			method:         "POST",
			path:           "/api/tunnels/cloudflare/stop",
			expectedStatus: http.StatusOK,
			checkResponse: func(t *testing.T, resp map[string]interface{}) {
				success, ok := resp["success"].(bool)
				if !ok || !success {
					t.Error("Expected success=true in response")
				}
			},
		},
		{
			name:           "Invalid tunnel type",
			method:         "GET",
			path:           "/api/tunnels/invalid/status",
			expectedStatus: http.StatusBadRequest,
		},
		{
			name:   "Start tunnel with missing port",
			method: "POST",
			path:   "/api/tunnels/cloudflare/start",
			body:   map[string]interface{}{},
			expectedStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var req *http.Request
			if tt.body != nil {
				bodyBytes, _ := json.Marshal(tt.body)
				req = httptest.NewRequest(tt.method, tt.path, bytes.NewReader(bodyBytes))
				req.Header.Set("Content-Type", "application/json")
			} else {
				req = httptest.NewRequest(tt.method, tt.path, nil)
			}

			rr := httptest.NewRecorder()
			router.ServeHTTP(rr, req)

			if status := rr.Code; status != tt.expectedStatus {
				t.Errorf("Handler returned wrong status code: got %v want %v, body: %s",
					status, tt.expectedStatus, rr.Body.String())
				return
			}

			if tt.checkResponse != nil && rr.Code == http.StatusOK {
				var resp map[string]interface{}
				if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
					t.Fatalf("Failed to parse response: %v", err)
				}
				tt.checkResponse(t, resp)
			}
		})
	}
}

// TestTunnelServiceAvailability tests that tunnel service is properly initialized
func TestTunnelServiceAvailability(t *testing.T) {
	server, err := NewServer(&Config{
		Port:     4021,
		NoAuth:   true,
		BasePath: "/tmp/tunnelforge-test",
	})
	if err != nil {
		t.Fatalf("Failed to create server: %v", err)
	}

	if server.tunnelService == nil {
		t.Fatal("Tunnel service not initialized")
	}

	tunnels := server.tunnelService.ListServices()
	if len(tunnels) == 0 {
		t.Error("No tunnel services available")
	}
}

// TestTunnelStartStop tests starting and stopping tunnels
func TestTunnelStartStop(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	server, err := NewServer(&Config{
		Port:     4021,
		NoAuth:   true,
		BasePath: "/tmp/tunnelforge-test",
	})
	if err != nil {
		t.Fatalf("Failed to create server: %v", err)
	}

	// This test requires cloudflared to be installed
	// Skip if not available
	svc, err := server.tunnelService.GetService("cloudflare")
	if err != nil {
		t.Skip("Cloudflare tunnel service not available")
	}

	// Test start
	config := map[string]interface{}{
		"port": 3001,
	}
	if err := svc.Start(config); err != nil {
		t.Fatalf("Failed to start tunnel: %v", err)
	}

	// Verify running
	status := svc.GetStatus()
	if !status.Running {
		t.Error("Tunnel should be running after start")
	}

	// Test stop
	if err := svc.Stop(); err != nil {
		t.Fatalf("Failed to stop tunnel: %v", err)
	}

	// Verify stopped
	status = svc.GetStatus()
	if status.Running {
		t.Error("Tunnel should not be running after stop")
	}
}
