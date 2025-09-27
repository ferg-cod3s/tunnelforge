package control

import (
	"context"
	"fmt"
	"os/exec"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/ferg-cod3s/tunnelforge/go-server/pkg/types"
)

// EventBroadcaster interface for broadcasting events
type EventBroadcaster interface {
	BroadcastEvent(event ControlEvent)
}

// CommandEngine manages command execution within sessions
type CommandEngine struct {
	executions       map[string]*types.CommandExecution
	mu               sync.RWMutex
	eventBroadcaster EventBroadcaster
}

// NewCommandEngine creates a new command execution engine
func NewCommandEngine(eventBroadcaster EventBroadcaster) *CommandEngine {
	return &CommandEngine{
		executions:       make(map[string]*types.CommandExecution),
		eventBroadcaster: eventBroadcaster,
	}
}

// ExecuteCommand executes a command within a session
func (ce *CommandEngine) ExecuteCommand(sessionID string, req *types.CommandExecutionRequest) (*types.CommandExecution, error) {
	ce.mu.Lock()
	defer ce.mu.Unlock()

	// Create execution record
	executionID := uuid.New().String()
	now := time.Now()

	execution := &types.CommandExecution{
		ID:        executionID,
		SessionID: sessionID,
		Command:   req.Command,
		Cwd:       req.Cwd,
		Env:       req.Env,
		Status:    types.CommandStatusPending,
		StartedAt: &now,
		Output:    make([]string, 0),
	}

	ce.executions[executionID] = execution

	// Start execution asynchronously
	go ce.executeCommandAsync(execution, req.Timeout)

	return execution, nil
}

// GetExecution gets a command execution by ID
func (ce *CommandEngine) GetExecution(executionID string) (*types.CommandExecution, error) {
	ce.mu.RLock()
	defer ce.mu.RUnlock()

	execution, exists := ce.executions[executionID]
	if !exists {
		return nil, fmt.Errorf("execution not found: %s", executionID)
	}

	return execution, nil
}

// ListExecutions lists all command executions for a session
func (ce *CommandEngine) ListExecutions(sessionID string) []*types.CommandExecution {
	ce.mu.RLock()
	defer ce.mu.RUnlock()

	var executions []*types.CommandExecution
	for _, execution := range ce.executions {
		if execution.SessionID == sessionID {
			executions = append(executions, execution)
		}
	}

	return executions
}

// CancelExecution cancels a running command execution
func (ce *CommandEngine) CancelExecution(executionID string) error {
	ce.mu.Lock()
	defer ce.mu.Unlock()

	execution, exists := ce.executions[executionID]
	if !exists {
		return fmt.Errorf("execution not found: %s", executionID)
	}

	if execution.Status != types.CommandStatusRunning {
		return fmt.Errorf("execution is not running: %s", execution.Status)
	}

	// Note: In a real implementation, we'd need to track the actual process
	// and send SIGTERM/SIGKILL. For now, we'll just mark as cancelled.
	execution.Status = types.CommandStatusCancelled
	now := time.Now()
	execution.CompletedAt = &now
	if execution.StartedAt != nil {
		duration := now.Sub(*execution.StartedAt)
		execution.Duration = &duration
	}

	return nil
}

// CleanupExecutions removes old completed executions
func (ce *CommandEngine) CleanupExecutions(maxAge time.Duration) int {
	ce.mu.Lock()
	defer ce.mu.Unlock()

	cutoff := time.Now().Add(-maxAge)
	removed := 0

	for id, execution := range ce.executions {
		if execution.Status == types.CommandStatusCompleted ||
		   execution.Status == types.CommandStatusFailed ||
		   execution.Status == types.CommandStatusCancelled {
			if execution.CompletedAt != nil && execution.CompletedAt.Before(cutoff) {
				delete(ce.executions, id)
				removed++
			}
		}
	}

	return removed
}

// executeCommandAsync executes a command asynchronously
func (ce *CommandEngine) executeCommandAsync(execution *types.CommandExecution, timeout *time.Duration) {
	// Update status to running
	ce.mu.Lock()
	execution.Status = types.CommandStatusRunning
	ce.mu.Unlock()

	// Prepare command
	cmd := exec.Command(execution.Command[0], execution.Command[1:]...)

	// Set working directory if specified
	if execution.Cwd != "" {
		cmd.Dir = execution.Cwd
	}

	// Set environment variables
	if execution.Env != nil {
		cmd.Env = make([]string, 0, len(execution.Env))
		for k, v := range execution.Env {
			cmd.Env = append(cmd.Env, fmt.Sprintf("%s=%s", k, v))
		}
	}

	// Create context for timeout
	ctx := context.Background()
	if timeout != nil {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, *timeout)
		defer cancel()
		cmd = exec.CommandContext(ctx, execution.Command[0], execution.Command[1:]...)
		if execution.Cwd != "" {
			cmd.Dir = execution.Cwd
		}
		if execution.Env != nil {
			cmd.Env = make([]string, 0, len(execution.Env))
			for k, v := range execution.Env {
				cmd.Env = append(cmd.Env, fmt.Sprintf("%s=%s", k, v))
			}
		}
	}

	// Start the command
	err := cmd.Start()
	if err != nil {
		ce.mu.Lock()
		execution.Status = types.CommandStatusFailed
		execution.Error = err.Error()
		now := time.Now()
		execution.CompletedAt = &now
		if execution.StartedAt != nil {
			duration := now.Sub(*execution.StartedAt)
			execution.Duration = &duration
		}
		ce.mu.Unlock()
		return
	}

	// Store PID
	ce.mu.Lock()
	execution.PID = cmd.Process.Pid
	ce.mu.Unlock()

	// Wait for completion
	err = cmd.Wait()

	// Update execution status
	ce.mu.Lock()
	now := time.Now()
	execution.CompletedAt = &now
	if execution.StartedAt != nil {
		duration := now.Sub(*execution.StartedAt)
		execution.Duration = &duration
	}

	if err != nil {
		execution.Status = types.CommandStatusFailed
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode := exitErr.ExitCode()
			execution.ExitCode = &exitCode
		}
		execution.Error = err.Error()
	} else {
		execution.Status = types.CommandStatusCompleted
		exitCode := 0
		execution.ExitCode = &exitCode
	}

	// Broadcast completion event
	if ce.eventBroadcaster != nil {
		ce.eventBroadcaster.BroadcastEvent(ControlEvent{
			Category: "command",
			Action:   "completed",
			Data: map[string]interface{}{
				"executionId": execution.ID,
				"sessionId":   execution.SessionID,
				"command":     execution.Command,
				"exitCode":    execution.ExitCode,
				"duration":    execution.Duration,
			},
		})
	}
	ce.mu.Unlock()
}
