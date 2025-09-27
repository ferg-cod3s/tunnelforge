package control

import (
	"time"

	"github.com/ferg-cod3s/tunnelforge/go-server/pkg/types"
)

// AnalyticsRecorder interface for recording analytics events
type AnalyticsRecorder interface {
	RecordCommandActivity(userID, sessionID, commandID, command string, success bool, duration time.Duration)
	RecordSessionActivity(userID, sessionID, activityType string, duration *time.Duration)
}

// Manager manages the control system components
type Manager struct {
	commandEngine    *CommandEngine
	statusTracker    *StatusTracker
	analyticsRecorder AnalyticsRecorder
	startTime        time.Time
}

// NewManager creates a new control manager
func NewManager(eventBroadcaster EventBroadcaster, analyticsRecorder AnalyticsRecorder) *Manager {
	return &Manager{
		commandEngine:     NewCommandEngine(eventBroadcaster),
		statusTracker:     NewStatusTracker(),
		analyticsRecorder: analyticsRecorder,
		startTime:         time.Now(),
	}
}

// ExecuteCommand executes a command within a session
func (m *Manager) ExecuteCommand(sessionID string, req *types.CommandExecutionRequest) (*types.CommandExecution, error) {
	execution, err := m.commandEngine.ExecuteCommand(sessionID, req)
	if err != nil {
		return nil, err
	}

	// Record analytics
	if m.analyticsRecorder != nil {
		go func() {
			// Wait for command completion and record analytics
			time.Sleep(100 * time.Millisecond)
			for {
				currentExecution, err := m.commandEngine.GetExecution(execution.ID)
				if err != nil {
					break
				}
				
				if currentExecution.Status == types.CommandStatusCompleted || currentExecution.Status == types.CommandStatusFailed {
					command := currentExecution.Command[0]
					success := currentExecution.Status == types.CommandStatusCompleted
					duration := time.Duration(0)
					if currentExecution.Duration != nil {
						duration = *currentExecution.Duration
					}
					m.analyticsRecorder.RecordCommandActivity("system", sessionID, execution.ID, command, success, duration)
					break
				}
				
				time.Sleep(500 * time.Millisecond)
			}
		}()
	}

	return execution, nil
}

// GetExecution gets a command execution by ID
func (m *Manager) GetExecution(executionID string) (*types.CommandExecution, error) {
	return m.commandEngine.GetExecution(executionID)
}

// ListExecutions lists all command executions for a session
func (m *Manager) ListExecutions(sessionID string) []*types.CommandExecution {
	return m.commandEngine.ListExecutions(sessionID)
}

// CancelExecution cancels a running command execution
func (m *Manager) CancelExecution(executionID string) error {
	return m.commandEngine.CancelExecution(executionID)
}

// GetSystemStatus returns the current system status
func (m *Manager) GetSystemStatus() *SystemStatus {
	return m.statusTracker.GetSystemStatus(m.startTime)
}

// GetSessionStatus returns status for a specific session
func (m *Manager) GetSessionStatus(sessionID string) (*SessionStats, bool) {
	return m.statusTracker.GetSessionStatus(sessionID)
}

// GetCommandStatus returns status for a specific command
func (m *Manager) GetCommandStatus(command string) (*CommandStats, bool) {
	return m.statusTracker.GetCommandStatus(command)
}

// CleanupOldExecutions removes old completed executions
func (m *Manager) CleanupOldExecutions(maxAge time.Duration) int {
	return m.commandEngine.CleanupExecutions(maxAge)
}
