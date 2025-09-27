package types

import (
	"os/exec"
	"time"

	"github.com/gorilla/websocket"
)

// Session represents a terminal session
type Session struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Command   string    `json:"command"`
	Cwd       string    `json:"cwd"`
	Cols      int       `json:"cols"`
	Rows      int       `json:"rows"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
	Active    bool      `json:"active"`

	// Tunnel information
	TunnelInfo *TunnelInfo `json:"tunnel_info,omitempty"`

	// Internal fields (not serialized)
	PTY     interface{} `json:"-"` // Will be *os.File from pty.Start()
	Cmd     *exec.Cmd   `json:"-"`
	Clients []*WSClient `json:"-"`
}

// WSClient represents a WebSocket client connected to a session
type WSClient struct {
	ID        string
	Conn      *websocket.Conn
	SessionID string
	LastPing  time.Time
	Send      chan []byte
	Done      chan struct{}
}

// SessionCreateRequest represents a request to create a new session
type SessionCreateRequest struct {
	Command []string `json:"command,omitempty"`
	Cwd     string   `json:"cwd,omitempty"`
	Title   string   `json:"title,omitempty"`
	Cols    int      `json:"cols,omitempty"`
	Rows    int      `json:"rows,omitempty"`
}

// SessionResponse represents a session in API responses
type SessionResponse struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Command   string    `json:"command"`
	Cwd       string    `json:"cwd"`
	Cols      int       `json:"cols"`
	Rows      int       `json:"rows"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
	Status    string    `json:"status"`
	Active    bool      `json:"active"`
	Clients   int       `json:"clients"`
}

// ResizeRequest represents a terminal resize request
type ResizeRequest struct {
	Cols int `json:"cols"`
	Rows int `json:"rows"`
}

// InputMessage represents input from WebSocket client
type InputMessage struct {
	Type string `json:"type"`
	Data string `json:"data"`
}

// OutputMessage represents output to WebSocket client
type OutputMessage struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

// TunnelInfo represents tunnel information associated with a session
type TunnelInfo struct {
	TunnelID string `json:"tunnel_id,omitempty"`
	Domain   string `json:"domain,omitempty"`
	Status   string `json:"status,omitempty"` // "active", "inactive", "pending"
}

// CommandStatus represents the status of a command execution
type CommandStatus string

const (
	CommandStatusPending   CommandStatus = "pending"
	CommandStatusRunning   CommandStatus = "running"
	CommandStatusCompleted CommandStatus = "completed"
	CommandStatusFailed    CommandStatus = "failed"
	CommandStatusCancelled CommandStatus = "cancelled"
)

// CommandExecution represents a command execution within a session
type CommandExecution struct {
	ID          string        `json:"id"`
	SessionID   string        `json:"sessionId"`
	Command     []string      `json:"command"`
	Cwd         string        `json:"cwd,omitempty"`
	Env         map[string]string `json:"env,omitempty"`
	Status      CommandStatus `json:"status"`
	PID         int           `json:"pid,omitempty"`
	ExitCode    *int          `json:"exitCode,omitempty"`
	StartedAt   *time.Time    `json:"startedAt,omitempty"`
	CompletedAt *time.Time    `json:"completedAt,omitempty"`
	Duration    *time.Duration `json:"duration,omitempty"`
	Output      []string      `json:"output,omitempty"`
	Error       string        `json:"error,omitempty"`
}

// CommandExecutionRequest represents a request to execute a command
type CommandExecutionRequest struct {
	Command []string            `json:"command"`
	Cwd     string              `json:"cwd,omitempty"`
	Env     map[string]string   `json:"env,omitempty"`
	Timeout *time.Duration      `json:"timeout,omitempty"`
}

// CommandExecutionResponse represents the response from command execution
type CommandExecutionResponse struct {
	ExecutionID string `json:"executionId"`
	Status      string `json:"status"`
	Message     string `json:"message,omitempty"`
}

// SessionGroup represents a group of related sessions
type SessionGroup struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description,omitempty"`
	SessionIDs  []string          `json:"sessionIds"`
	Tags        []string          `json:"tags,omitempty"`
	CreatedAt   time.Time         `json:"createdAt"`
	UpdatedAt   time.Time         `json:"updatedAt"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// SessionTag represents a tag that can be applied to sessions
type SessionTag struct {
	Name        string    `json:"name"`
	Color       string    `json:"color,omitempty"`
	Description string    `json:"description,omitempty"`
	CreatedAt   time.Time `json:"createdAt"`
}

// BulkSessionOperation represents a bulk operation on multiple sessions
type BulkSessionOperation struct {
	Operation string      `json:"operation"` // "start", "stop", "delete", "tag", "resize"
	SessionIDs []string    `json:"sessionIds"`
	Parameters interface{} `json:"parameters,omitempty"` // Operation-specific parameters
}

// SessionDependency represents a dependency relationship between sessions
type SessionDependency struct {
	ParentSessionID string `json:"parentSessionId"`
	ChildSessionID  string `json:"childSessionId"`
	DependencyType  string `json:"dependencyType"` // "requires", "blocks", "related"
	Description     string `json:"description,omitempty"`
}

// SessionHierarchy represents a hierarchical relationship between sessions
type SessionHierarchy struct {
	ParentID   string               `json:"parentId"`
	ChildID    string               `json:"childId"`
	Level      int                  `json:"level"`      // Depth in hierarchy
	Path       []string             `json:"path"`       // Full path from root
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

// RemoteInstance represents a remote TunnelForge instance
type RemoteInstance struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	URL         string            `json:"url"`
	Status      string            `json:"status"` // "online", "offline", "unknown"
	LastSeen    time.Time         `json:"lastSeen"`
	Version     string            `json:"version,omitempty"`
	Region      string            `json:"region,omitempty"`
	Tags        []string          `json:"tags,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// RemoteSession represents a session running on a remote instance
type RemoteSession struct {
	Session     *Session         `json:"session"`
	InstanceID  string           `json:"instanceId"`
	InstanceURL string           `json:"instanceUrl"`
	Distance    int              `json:"distance,omitempty"` // Network distance/routing cost
}

// RegistryConfig represents configuration for the remote registry
type RegistryConfig struct {
	EnableDiscovery    bool          `json:"enableDiscovery"`
	DiscoveryInterval  time.Duration `json:"discoveryInterval"`
	HealthCheckTimeout time.Duration `json:"healthCheckTimeout"`
	MaxRetries         int           `json:"maxRetries"`
	RetryDelay         time.Duration `json:"retryDelay"`
}

// RegistryStats represents statistics for the remote registry
type RegistryStats struct {
	TotalInstances    int `json:"totalInstances"`
	OnlineInstances   int `json:"onlineInstances"`
	TotalRemoteSessions int `json:"totalRemoteSessions"`
	LastDiscoveryTime *time.Time `json:"lastDiscoveryTime,omitempty"`
}

// ActivityEvent represents a user activity event
type ActivityEvent struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`        // "session_created", "session_deleted", "command_executed", etc.
	UserID      string                 `json:"userId,omitempty"`
	SessionID   string                 `json:"sessionId,omitempty"`
	CommandID   string                 `json:"commandId,omitempty"`
	Timestamp   time.Time              `json:"timestamp"`
	Duration    *time.Duration         `json:"duration,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
	IPAddress   string                 `json:"ipAddress,omitempty"`
	UserAgent   string                 `json:"userAgent,omitempty"`
}

// AnalyticsMetrics represents various analytics metrics
type AnalyticsMetrics struct {
	TotalSessionsCreated    int64         `json:"totalSessionsCreated"`
	TotalCommandsExecuted   int64         `json:"totalCommandsExecuted"`
	TotalActiveUsers        int64         `json:"totalActiveUsers"`
	AverageSessionDuration  time.Duration `json:"averageSessionDuration"`
	PeakConcurrentSessions  int64         `json:"peakConcurrentSessions"`
	MostUsedCommands        []CommandStat `json:"mostUsedCommands"`
	UserActivityByHour      []HourlyStat  `json:"userActivityByHour"`
	SessionCreationByDay    []DailyStat   `json:"sessionCreationByDay"`
	CommandExecutionByDay   []DailyStat   `json:"commandExecutionByDay"`
}

// CommandStat represents statistics for a command
type CommandStat struct {
	Command     string `json:"command"`
	Count       int64  `json:"count"`
	SuccessRate float64 `json:"successRate"`
	AvgDuration time.Duration `json:"avgDuration"`
}

// HourlyStat represents activity statistics for an hour
type HourlyStat struct {
	Hour  int   `json:"hour"`
	Count int64 `json:"count"`
}

// DailyStat represents activity statistics for a day
type DailyStat struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

// UserActivity represents activity data for a specific user
type UserActivity struct {
	UserID            string        `json:"userId"`
	LastActivity      time.Time     `json:"lastActivity"`
	TotalSessions     int64         `json:"totalSessions"`
	TotalCommands     int64         `json:"totalCommands"`
	TotalTimeSpent    time.Duration `json:"totalTimeSpent"`
	FavoriteCommands  []string      `json:"favoriteCommands"`
	ActivityStreak    int           `json:"activityStreak"`
	MostActiveHour    int           `json:"mostActiveHour"`
	MostActiveDay     string        `json:"mostActiveDay"`
}

// AnalyticsConfig represents configuration for the analytics system
type AnalyticsConfig struct {
	EnableTracking      bool          `json:"enableTracking"`
	RetentionPeriod     time.Duration `json:"retentionPeriod"`
	CollectionInterval  time.Duration `json:"collectionInterval"`
	MaxEventsPerUser    int           `json:"maxEventsPerUser"`
	EnableRealTime      bool          `json:"enableRealTime"`
	ExportPath          string        `json:"exportPath"`
}
