package tunnels

import (
	"testing"
	"time"
)

func TestCloudflareService_GetType(t *testing.T) {
	svc := newCloudflareService()
	if svc.GetType() != TunnelTypeCloudflare {
		t.Errorf("Expected type %s, got %s", TunnelTypeCloudflare, svc.GetType())
	}
}

func TestCloudflareService_IsInstalled(t *testing.T) {
	svc := newCloudflareService()
	installed := svc.IsInstalled()
	t.Logf("Cloudflared installed: %v", installed)
}

func TestCloudflareService_GetStatus_NotRunning(t *testing.T) {
	svc := newCloudflareService()
	status, err := svc.GetStatus()
	if err != nil {
		t.Fatalf("GetStatus failed: %v", err)
	}
	if status.Running {
		t.Error("Expected tunnel to not be running")
	}
	if status.Type != TunnelTypeCloudflare {
		t.Errorf("Expected type %s, got %s", TunnelTypeCloudflare, status.Type)
	}
}

func TestCloudflareService_GetPublicURL_NotRunning(t *testing.T) {
	svc := newCloudflareService()
	_, err := svc.GetPublicURL()
	if err == nil {
		t.Error("Expected error when getting URL from non-running tunnel")
	}
}

func TestCloudflareService_Stop_NotRunning(t *testing.T) {
	svc := newCloudflareService()
	err := svc.Stop()
	if err != nil {
		t.Errorf("Stop on non-running tunnel should not error: %v", err)
	}
}

func TestCloudflareService_Start_AlreadyRunning(t *testing.T) {
	svc := newCloudflareService().(*cloudflareService)
	
	if !svc.IsInstalled() {
		t.Skip("cloudflared not installed, skipping integration test")
	}
	
	err := svc.Start(8080)
	if err != nil {
		t.Fatalf("Failed to start tunnel: %v", err)
	}
	defer svc.Stop()
	
	// Try to start again
	err = svc.Start(8081)
	if err == nil {
		t.Error("Expected error when starting already running tunnel")
	}
}

func TestCloudflareService_StartStop(t *testing.T) {
	svc := newCloudflareService()
	
	if !svc.IsInstalled() {
		t.Skip("cloudflared not installed, skipping integration test")
	}
	
	err := svc.Start(8080)
	if err != nil {
		t.Fatalf("Failed to start tunnel: %v", err)
	}
	
	// Give it a moment to start
	time.Sleep(500 * time.Millisecond)
	
	status, err := svc.GetStatus()
	if err != nil {
		t.Fatalf("GetStatus failed: %v", err)
	}
	if !status.Running {
		t.Error("Expected tunnel to be running")
	}
	
	err = svc.Stop()
	if err != nil {
		t.Fatalf("Failed to stop tunnel: %v", err)
	}
	
	// Give it a moment to stop
	time.Sleep(500 * time.Millisecond)
	
	status, err = svc.GetStatus()
	if err != nil {
		t.Fatalf("GetStatus failed: %v", err)
	}
	if status.Running {
		t.Error("Expected tunnel to be stopped")
	}
}

func TestCloudflareService_WithConfig(t *testing.T) {
	svc := newCloudflareService()
	
	if !svc.IsInstalled() {
		t.Skip("cloudflared not installed, skipping integration test")
	}
	
	config := &CloudflareConfig{
		TunnelID:   "test-tunnel-id",
		TunnelName: "test-tunnel",
		Hostname:   "test.example.com",
		CredPath:   "/path/to/creds.json",
	}
	
	err := svc.StartWithConfig(8080, config)
	if err != nil {
		t.Logf("StartWithConfig failed (expected if credentials don't exist): %v", err)
	} else {
		defer svc.Stop()
	}
}

func TestCloudflareService_QuickTunnel(t *testing.T) {
	svc := newCloudflareService()
	
	if !svc.IsInstalled() {
		t.Skip("cloudflared not installed, skipping integration test")
	}
	
	err := svc.StartQuickTunnel(8080)
	if err != nil {
		t.Fatalf("Failed to start quick tunnel: %v", err)
	}
	defer svc.Stop()
	
	// Wait for URL to be available with timeout
	maxWait := 10 * time.Second
	waitInterval := 500 * time.Millisecond
	waited := time.Duration(0)
	var url string
	
	for waited < maxWait {
		url, err = svc.GetPublicURL()
		if err == nil && url != "" {
			break
		}
		time.Sleep(waitInterval)
		waited += waitInterval
	}
	
	if err != nil {
		t.Fatalf("Failed to get public URL: %v", err)
	}
	
	if url == "" {
		t.Error("Public URL is empty")
	}
	
	t.Logf("Quick tunnel URL: %s", url)
}

func TestCloudflareService_URLExtraction(t *testing.T) {
	svc := newCloudflareService().(*cloudflareService)
	
	testCases := []struct {
		name     string
		output   string
		expected string
		hasError bool
	}{
		{
			name:     "standard output",
			output:   "2024-01-15 10:30:45 INF Your quick tunnel is available at: https://test-abc-123.trycloudflare.com",
			expected: "https://test-abc-123.trycloudflare.com",
			hasError: false,
		},
		{
			name:     "output with extra text",
			output:   "Some logs\nYour quick tunnel is available at: https://another-test.trycloudflare.com\nMore logs",
			expected: "https://another-test.trycloudflare.com",
			hasError: false,
		},
		{
			name:     "no URL in output",
			output:   "Some error occurred",
			expected: "",
			hasError: true,
		},
	}
	
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			url, err := svc.extractURLFromOutput(tc.output)
			if tc.hasError {
				if err == nil {
					t.Error("Expected error but got none")
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
				if url != tc.expected {
					t.Errorf("Expected URL %s, got %s", tc.expected, url)
				}
			}
		})
	}
}

func TestCloudflareConfig_Validate(t *testing.T) {
	testCases := []struct {
		name     string
		config   *CloudflareConfig
		hasError bool
	}{
		{
			name: "valid quick tunnel config",
			config: &CloudflareConfig{
				UseQuickTunnel: true,
			},
			hasError: false,
		},
		{
			name: "valid authenticated tunnel config",
			config: &CloudflareConfig{
				TunnelID:   "test-id",
				TunnelName: "test-name",
				Hostname:   "test.example.com",
				CredPath:   "/path/to/creds.json",
			},
			hasError: false,
		},
		{
			name: "missing tunnel ID but has name",
			config: &CloudflareConfig{
				TunnelName: "test-name",
				Hostname:   "test.example.com",
				CredPath:   "/path/to/creds.json",
			},
			hasError: false,
		},
		{
			name: "missing hostname",
			config: &CloudflareConfig{
				TunnelID:   "test-id",
				TunnelName: "test-name",
				CredPath:   "/path/to/creds.json",
			},
			hasError: true,
		},
	}
	
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.config.Validate()
			if tc.hasError && err == nil {
				t.Error("Expected validation error but got none")
			}
			if !tc.hasError && err != nil {
				t.Errorf("Unexpected validation error: %v", err)
			}
		})
	}
}

func TestCloudflareService_Integration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}
	
	svc := newCloudflareService()
	
	if !svc.IsInstalled() {
		t.Skip("cloudflared not installed, skipping integration test")
	}
	
	// Test quick tunnel
	err := svc.StartQuickTunnel(8080)
	if err != nil {
		t.Fatalf("Failed to start quick tunnel: %v", err)
	}
	
	// Wait for URL
	maxWait := 10 * time.Second
	waitInterval := 500 * time.Millisecond
	waited := time.Duration(0)
	var url string
	
	for waited < maxWait {
		url, err = svc.GetPublicURL()
		if err == nil && url != "" {
			break
		}
		time.Sleep(waitInterval)
		waited += waitInterval
	}
	
	if url == "" {
		t.Error("Failed to get public URL within timeout")
	} else {
		t.Logf("Got public URL: %s", url)
	}
	
	// Check status
	status, err := svc.GetStatus()
	if err != nil {
		t.Fatalf("GetStatus failed: %v", err)
	}
	if !status.Running {
		t.Error("Expected tunnel to be running")
	}
	if status.PublicURL != url {
		t.Errorf("Status URL mismatch: got %s, expected %s", status.PublicURL, url)
	}
	
	// Stop tunnel
	err = svc.Stop()
	if err != nil {
		t.Fatalf("Failed to stop tunnel: %v", err)
	}
	
	// Verify stopped
	time.Sleep(500 * time.Millisecond)
	status, err = svc.GetStatus()
	if err != nil {
		t.Fatalf("GetStatus failed: %v", err)
	}
	if status.Running {
		t.Error("Expected tunnel to be stopped")
	}
}
