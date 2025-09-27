package control

import (
	"sync"
	"time"

	"github.com/ferg-cod3s/tunnelforge/go-server/pkg/types"
)

// StatusTracker tracks the status of various system components
type StatusTracker struct {
	commandStats map[string]*CommandStats
	sessionStats map[string]*SessionStats
	mu           sync.RWMutex
}

// CommandStats represents statistics for command executions
type CommandStats struct {
	TotalExecutions    int           `json:"totalExecutions"`
	SuccessfulExecutions int         `json:"successfulExecutions"`
	FailedExecutions   int           `json:"failedExecutions"`
	AverageDuration    time.Duration `json:"averageDuration"`
	LastExecutionTime  *time.Time    `json:"lastExecutionTime,omitempty"`
}

// SessionStats represents statistics for sessions
type SessionStats struct {
	SessionID       string        `json:"sessionId"`
	TotalCommands   int           `json:"totalCommands"`
	ActiveCommands  int           `json:"activeCommands"`
	CreatedAt       time.Time     `json:"createdAt"`
	LastActivity    time.Time     `json:"lastActivity"`
	TotalDuration   time.Duration `json:"totalDuration"`
}

// SystemStatus represents the overall system status
type SystemStatus struct {
	TotalSessions       int                    `json:"totalSessions"`
	ActiveSessions      int                    `json:"activeSessions"`
	TotalCommands       int                    `json:"totalCommands"`
	ActiveCommands      int                    `json:"activeCommands"`
	SessionStats        []*SessionStats        `json:"sessionStats"`
	CommandStats        map[string]*CommandStats `json:"commandStats"`
	Uptime              time.Duration          `json:"uptime"`
	StartTime           time.Time              `json:"startTime"`
}

// NewStatusTracker creates a new status tracker
func NewStatusTracker() *StatusTracker {
	return &StatusTracker{
		commandStats: make(map[string]*CommandStats),
		sessionStats: make(map[string]*SessionStats),
	}
}

// RecordCommandExecution records a command execution
func (st *StatusTracker) RecordCommandExecution(execution *types.CommandExecution) {
	st.mu.Lock()
	defer st.mu.Unlock()

	command := execution.Command[0] // Use the first part of the command as key
	
	stats, exists := st.commandStats[command]
	if !exists {
		stats = &CommandStats{}
		st.commandStats[command] = stats
	}

	stats.TotalExecutions++
	stats.LastExecutionTime = execution.StartedAt

	if execution.Status == types.CommandStatusCompleted {
		stats.SuccessfulExecutions++
		if execution.Duration != nil {
			// Simple moving average calculation
			if stats.AverageDuration == 0 {
				stats.AverageDuration = *execution.Duration
			} else {
				stats.AverageDuration = (stats.AverageDuration + *execution.Duration) / 2
			}
		}
	} else if execution.Status == types.CommandStatusFailed {
		stats.FailedExecutions++
	}

	// Update session stats
	sessionStats, exists := st.sessionStats[execution.SessionID]
	if !exists {
		sessionStats = &SessionStats{
			SessionID: execution.SessionID,
			CreatedAt: time.Now(),
		}
		st.sessionStats[execution.SessionID] = sessionStats
	}

	sessionStats.TotalCommands++
	sessionStats.LastActivity = time.Now()

	if execution.Status == types.CommandStatusRunning {
		sessionStats.ActiveCommands++
	} else {
		if sessionStats.ActiveCommands > 0 {
			sessionStats.ActiveCommands--
		}
		if execution.Duration != nil {
			sessionStats.TotalDuration += *execution.Duration
		}
	}
}

// RecordSessionActivity records session activity
func (st *StatusTracker) RecordSessionActivity(sessionID string) {
	st.mu.Lock()
	defer st.mu.Unlock()

	stats, exists := st.sessionStats[sessionID]
	if !exists {
		stats = &SessionStats{
			SessionID: sessionID,
			CreatedAt: time.Now(),
		}
		st.sessionStats[sessionID] = stats
	}

	stats.LastActivity = time.Now()
}

// RemoveSession removes session statistics
func (st *StatusTracker) RemoveSession(sessionID string) {
	st.mu.Lock()
	defer st.mu.Unlock()

	delete(st.sessionStats, sessionID)
}

// GetSystemStatus returns the current system status
func (st *StatusTracker) GetSystemStatus(startTime time.Time) *SystemStatus {
	st.mu.RLock()
	defer st.mu.RUnlock()

	status := &SystemStatus{
		StartTime:    startTime,
		Uptime:       time.Since(startTime),
		CommandStats: make(map[string]*CommandStats),
		SessionStats: make([]*SessionStats, 0),
	}

	// Copy command stats
	for cmd, stats := range st.commandStats {
		status.CommandStats[cmd] = stats
		status.TotalCommands += stats.TotalExecutions
	}

	// Copy session stats
	for _, stats := range st.sessionStats {
		status.SessionStats = append(status.SessionStats, stats)
		status.TotalSessions++
		if stats.ActiveCommands > 0 {
			status.ActiveSessions++
			status.ActiveCommands += stats.ActiveCommands
		}
	}

	return status
}

// GetSessionStatus returns status for a specific session
func (st *StatusTracker) GetSessionStatus(sessionID string) (*SessionStats, bool) {
	st.mu.RLock()
	defer st.mu.RUnlock()

	stats, exists := st.sessionStats[sessionID]
	return stats, exists
}

// GetCommandStatus returns status for a specific command
func (st *StatusTracker) GetCommandStatus(command string) (*CommandStats, bool) {
	st.mu.RLock()
	defer st.mu.RUnlock()

	stats, exists := st.commandStats[command]
	return stats, exists
}
