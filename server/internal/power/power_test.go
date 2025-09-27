package power

import (
	"testing"
	"time"
)

func TestNewService(t *testing.T) {
	service, err := NewService()
	if err != nil {
		t.Fatalf("Failed to create power service: %v", err)
	}
	if service == nil {
		t.Fatal("Service is nil")
	}
}

func TestService_GetStatus(t *testing.T) {
	service, err := NewService()
	if err != nil {
		t.Skipf("Skipping test due to platform limitation: %v", err)
	}

	status := service.GetStatus()
	if status == nil {
		t.Fatal("Status is nil")
	}

	// Check that required fields are present
	if _, ok := status["enabled"]; !ok {
		t.Error("Status missing 'enabled' field")
	}
	if _, ok := status["sleep_prevented"]; !ok {
		t.Error("Status missing 'sleep_prevented' field")
	}
	if _, ok := status["platform"]; !ok {
		t.Error("Status missing 'platform' field")
	}
}

func TestService_PreventAllowSleep(t *testing.T) {
	service, err := NewService()
	if err != nil {
		t.Skipf("Skipping test due to platform limitation: %v", err)
	}

	// Initially should not be preventing sleep
	if service.IsSleepPrevented() {
		t.Error("Service should not be preventing sleep initially")
	}

	// Prevent sleep
	err = service.PreventSleep("test")
	if err != nil {
		t.Fatalf("Failed to prevent sleep: %v", err)
	}

	// Give it a moment to take effect
	time.Sleep(100 * time.Millisecond)

	// Allow sleep
	err = service.AllowSleep()
	if err != nil {
		t.Fatalf("Failed to allow sleep: %v", err)
	}

	// Give it a moment to take effect
	time.Sleep(100 * time.Millisecond)
}

func TestService_UpdateSleepPrevention(t *testing.T) {
	service, err := NewService()
	if err != nil {
		t.Skipf("Skipping test due to platform limitation: %v", err)
	}

	// Test enabling sleep prevention
	err = service.UpdateSleepPrevention(true, true)
	if err != nil {
		t.Fatalf("Failed to update sleep prevention: %v", err)
	}

	// Test disabling sleep prevention
	err = service.UpdateSleepPrevention(false, true)
	if err != nil {
		t.Fatalf("Failed to disable sleep prevention: %v", err)
	}
}
