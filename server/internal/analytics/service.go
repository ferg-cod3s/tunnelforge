package analytics

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/ferg-cod3s/tunnelforge/go-server/pkg/types"
)

// Service provides activity monitoring and analytics
type Service struct {
	config       *types.AnalyticsConfig
	events       []types.ActivityEvent
	metrics      *types.AnalyticsMetrics
	userActivity map[string]*types.UserActivity
	mu           sync.RWMutex
	started      bool
	stopChan     chan struct{}
}

// NewService creates a new analytics service
func NewService(config *types.AnalyticsConfig) *Service {
	if config == nil {
		config = &types.AnalyticsConfig{
			EnableTracking:     true,
			RetentionPeriod:    30 * 24 * time.Hour, // 30 days
			CollectionInterval: 1 * time.Hour,
			MaxEventsPerUser:   1000,
			EnableRealTime:     true,
		}
	}

	return &Service{
		config:       config,
		events:       make([]types.ActivityEvent, 0),
		metrics:      &types.AnalyticsMetrics{},
		userActivity: make(map[string]*types.UserActivity),
		stopChan:     make(chan struct{}),
	}
}

// Start starts the analytics service
func (s *Service) Start() error {
	if s.started {
		return fmt.Errorf("analytics service already started")
	}

	s.started = true
	log.Printf("Starting analytics service")

	if s.config.EnableTracking {
		go s.collectionLoop()
		go s.cleanupLoop()
	}

	return nil
}

// Stop stops the analytics service
func (s *Service) Stop() error {
	if !s.started {
		return nil
	}

	log.Printf("Stopping analytics service")
	close(s.stopChan)
	s.started = false
	return nil
}

// RecordEvent records an activity event
func (s *Service) RecordEvent(eventType string, userID, sessionID, commandID string, metadata map[string]interface{}) {
	if !s.config.EnableTracking {
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	event := types.ActivityEvent{
		ID:        uuid.New().String(),
		Type:      eventType,
		UserID:    userID,
		SessionID: sessionID,
		CommandID: commandID,
		Timestamp: time.Now(),
		Metadata:  metadata,
	}

	s.events = append(s.events, event)

	// Update user activity
	s.updateUserActivity(&event)

	// Limit events per user
	s.limitUserEvents(userID)
}

// RecordSessionActivity records session-related activity
func (s *Service) RecordSessionActivity(userID, sessionID string, activityType string, duration *time.Duration) {
	metadata := map[string]interface{}{
		"activityType": activityType,
	}
	if duration != nil {
		metadata["duration"] = duration.Milliseconds()
	}

	s.RecordEvent("session_"+activityType, userID, sessionID, "", metadata)
}

// RecordCommandActivity records command execution activity
func (s *Service) RecordCommandActivity(userID, sessionID, commandID string, command string, success bool, duration time.Duration) {
	metadata := map[string]interface{}{
		"command": command,
		"success": success,
		"duration": duration.Milliseconds(),
	}

	eventType := "command_executed"
	if !success {
		eventType = "command_failed"
	}

	s.RecordEvent(eventType, userID, sessionID, commandID, metadata)
}

// GetMetrics returns current analytics metrics
func (s *Service) GetMetrics() *types.AnalyticsMetrics {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Create a copy of metrics
	metrics := *s.metrics
	return &metrics
}

// GetUserActivity returns activity data for a specific user
func (s *Service) GetUserActivity(userID string) (*types.UserActivity, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	activity, exists := s.userActivity[userID]
	if !exists {
		return nil, fmt.Errorf("user not found: %s", userID)
	}

	// Return a copy
	userActivity := *activity
	return &userActivity, nil
}

// GetRecentEvents returns recent activity events
func (s *Service) GetRecentEvents(limit int) []types.ActivityEvent {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if limit <= 0 || limit > len(s.events) {
		limit = len(s.events)
	}

	// Return most recent events
	start := len(s.events) - limit
	if start < 0 {
		start = 0
	}

	events := make([]types.ActivityEvent, limit)
	copy(events, s.events[start:])
	return events
}

// ExportData exports analytics data to a file
func (s *Service) ExportData(filename string) error {
	if s.config.ExportPath != "" {
		filename = filepath.Join(s.config.ExportPath, filename)
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	data := map[string]interface{}{
		"events":       s.events,
		"metrics":      s.metrics,
		"userActivity": s.userActivity,
		"exportedAt":   time.Now(),
	}

	file, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	return json.NewEncoder(file).Encode(data)
}

// updateUserActivity updates user activity statistics
func (s *Service) updateUserActivity(event *types.ActivityEvent) {
	userID := event.UserID
	if userID == "" {
		return
	}

	activity, exists := s.userActivity[userID]
	if !exists {
		activity = &types.UserActivity{
			UserID:         userID,
			LastActivity:   event.Timestamp,
			FavoriteCommands: make([]string, 0),
		}
		s.userActivity[userID] = activity
	}

	activity.LastActivity = event.Timestamp

	// Update counters based on event type
	switch event.Type {
	case "session_created":
		activity.TotalSessions++
	case "command_executed", "command_failed":
		activity.TotalCommands++
		if duration, ok := event.Metadata["duration"].(float64); ok {
			activity.TotalTimeSpent += time.Duration(duration) * time.Millisecond
		}
	}
}

// limitUserEvents limits the number of events stored per user
func (s *Service) limitUserEvents(userID string) {
	if s.config.MaxEventsPerUser <= 0 {
		return
	}

	// Count events for this user
	userEvents := 0
	for _, event := range s.events {
		if event.UserID == userID {
			userEvents++
		}
	}

	// If over limit, remove oldest events for this user
	if userEvents > s.config.MaxEventsPerUser {
		eventsToRemove := userEvents - s.config.MaxEventsPerUser
		
		filteredEvents := make([]types.ActivityEvent, 0, len(s.events)-eventsToRemove)
		removed := 0
		
		for _, event := range s.events {
			if event.UserID == userID && removed < eventsToRemove {
				removed++
				continue
			}
			filteredEvents = append(filteredEvents, event)
		}
		
		s.events = filteredEvents
	}
}

// collectionLoop periodically updates metrics
func (s *Service) collectionLoop() {
	ticker := time.NewTicker(s.config.CollectionInterval)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopChan:
			return
		case <-ticker.C:
			s.updateMetrics()
		}
	}
}

// updateMetrics recalculates analytics metrics
func (s *Service) updateMetrics() {
	s.mu.Lock()
	defer s.mu.Unlock()

	metrics := &types.AnalyticsMetrics{}

	// Calculate basic counts
	for _, event := range s.events {
		switch event.Type {
		case "session_created":
			metrics.TotalSessionsCreated++
		case "command_executed", "command_failed":
			metrics.TotalCommandsExecuted++
		}
	}

	// Calculate command statistics
	commandStats := make(map[string]*types.CommandStat)
	sessionCount := 0

	for _, event := range s.events {
		if event.Type == "command_executed" || event.Type == "command_failed" {
			command := ""
			if cmd, ok := event.Metadata["command"].(string); ok {
				command = cmd
			}

			stat, exists := commandStats[command]
			if !exists {
				stat = &types.CommandStat{Command: command}
				commandStats[command] = stat
			}

			stat.Count++
			if event.Type == "command_executed" {
				// This is a simplified success tracking
				// In reality, you'd need more sophisticated logic
			}

			if duration, ok := event.Metadata["duration"].(float64); ok {
				stat.AvgDuration += time.Duration(duration) * time.Millisecond
			}
		} else if event.Type == "session_created" {
			sessionCount++
		}
	}

	// Convert command stats to slice and sort
	for _, stat := range commandStats {
		if stat.Count > 0 {
			stat.AvgDuration = stat.AvgDuration / time.Duration(stat.Count)
		}
		metrics.MostUsedCommands = append(metrics.MostUsedCommands, *stat)
	}

	sort.Slice(metrics.MostUsedCommands, func(i, j int) bool {
		return metrics.MostUsedCommands[i].Count > metrics.MostUsedCommands[j].Count
	})

	// Limit to top 10
	if len(metrics.MostUsedCommands) > 10 {
		metrics.MostUsedCommands = metrics.MostUsedCommands[:10]
	}

	s.metrics = metrics
}

// cleanupLoop periodically removes old events
func (s *Service) cleanupLoop() {
	ticker := time.NewTicker(24 * time.Hour) // Clean up daily
	defer ticker.Stop()

	for {
		select {
		case <-s.stopChan:
			return
		case <-ticker.C:
			s.cleanupOldEvents()
		}
	}
}

// cleanupOldEvents removes events older than the retention period
func (s *Service) cleanupOldEvents() {
	s.mu.Lock()
	defer s.mu.Unlock()

	cutoff := time.Now().Add(-s.config.RetentionPeriod)
	
	filteredEvents := make([]types.ActivityEvent, 0)
	for _, event := range s.events {
		if event.Timestamp.After(cutoff) {
			filteredEvents = append(filteredEvents, event)
		}
	}
	
	removed := len(s.events) - len(filteredEvents)
	s.events = filteredEvents
	
	if removed > 0 {
		log.Printf("Cleaned up %d old analytics events", removed)
	}
}
