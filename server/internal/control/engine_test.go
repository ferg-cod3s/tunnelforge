package control

import (
	"testing"
	"time"

	"github.com/ferg-cod3s/tunnelforge/go-server/pkg/types"
)

// MockEventBroadcaster for testing
type MockEventBroadcaster struct {
	events []ControlEvent
}

func (m *MockEventBroadcaster) BroadcastEvent(event ControlEvent) {
	m.events = append(m.events, event)
}

func TestCommandEngine_ExecuteCommand(t *testing.T) {
	broadcaster := &MockEventBroadcaster{}
	engine := NewCommandEngine(broadcaster)

	req := &types.CommandExecutionRequest{
		Command: []string{"echo", "hello"},
		Cwd:     "/",
	}

	execution, err := engine.ExecuteCommand("test-session", req)
	if err != nil {
		t.Fatalf("Failed to execute command: %v", err)
	}

	if execution.SessionID != "test-session" {
		t.Errorf("Expected session ID 'test-session', got '%s'", execution.SessionID)
	}

	if len(execution.Command) != 2 || execution.Command[0] != "echo" {
		t.Errorf("Expected command ['echo', 'hello'], got %v", execution.Command)
	}

	if execution.Status != types.CommandStatusPending {
		t.Errorf("Expected status 'pending', got '%s'", execution.Status)
	}

	// Wait for command to complete
	time.Sleep(2 * time.Second)

	// Get updated execution
	updatedExecution, err := engine.GetExecution(execution.ID)
	if err != nil {
		t.Fatalf("Failed to get execution: %v", err)
	}

	if updatedExecution.Status != types.CommandStatusCompleted {
		t.Errorf("Expected status 'completed', got '%s'", updatedExecution.Status)
	}

	if updatedExecution.ExitCode == nil || *updatedExecution.ExitCode != 0 {
		t.Errorf("Expected exit code 0, got %v", updatedExecution.ExitCode)
	}

	// Check that completion event was broadcast
	if len(broadcaster.events) == 0 {
		t.Error("Expected completion event to be broadcast")
	}

	found := false
	for _, event := range broadcaster.events {
		if event.Category == "command" && event.Action == "completed" {
			found = true
			break
		}
	}

	if !found {
		t.Error("Expected command completion event not found")
	}
}

func TestCommandEngine_GetExecution(t *testing.T) {
	broadcaster := &MockEventBroadcaster{}
	engine := NewCommandEngine(broadcaster)

	req := &types.CommandExecutionRequest{
		Command: []string{"echo", "test"},
	}

	execution, err := engine.ExecuteCommand("test-session", req)
	if err != nil {
		t.Fatalf("Failed to execute command: %v", err)
	}

	retrieved, err := engine.GetExecution(execution.ID)
	if err != nil {
		t.Fatalf("Failed to get execution: %v", err)
	}

	if retrieved.ID != execution.ID {
		t.Errorf("Expected execution ID %s, got %s", execution.ID, retrieved.ID)
	}
}

func TestCommandEngine_ListExecutions(t *testing.T) {
	broadcaster := &MockEventBroadcaster{}
	engine := NewCommandEngine(broadcaster)

	// Execute multiple commands
	req1 := &types.CommandExecutionRequest{Command: []string{"echo", "1"}}
	req2 := &types.CommandExecutionRequest{Command: []string{"echo", "2"}}

	_, err := engine.ExecuteCommand("session1", req1)
	if err != nil {
		t.Fatalf("Failed to execute command 1: %v", err)
	}

	_, err = engine.ExecuteCommand("session1", req2)
	if err != nil {
		t.Fatalf("Failed to execute command 2: %v", err)
	}

	_, err = engine.ExecuteCommand("session2", req1)
	if err != nil {
		t.Fatalf("Failed to execute command 3: %v", err)
	}

	executions := engine.ListExecutions("session1")
	if len(executions) != 2 {
		t.Errorf("Expected 2 executions for session1, got %d", len(executions))
	}

	executions = engine.ListExecutions("session2")
	if len(executions) != 1 {
		t.Errorf("Expected 1 execution for session2, got %d", len(executions))
	}
}
