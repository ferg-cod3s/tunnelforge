package session

import (
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/ferg-cod3s/tunnelforge/go-server/pkg/types"
)

// Multiplexer manages session organization and relationships
type Multiplexer struct {
	groups       map[string]*types.SessionGroup
	tags         map[string]*types.SessionTag
	dependencies map[string][]*types.SessionDependency
	hierarchies  map[string]*types.SessionHierarchy
	mu           sync.RWMutex
}

// NewMultiplexer creates a new session multiplexer
func NewMultiplexer() *Multiplexer {
	return &Multiplexer{
		groups:       make(map[string]*types.SessionGroup),
		tags:         make(map[string]*types.SessionTag),
		dependencies: make(map[string][]*types.SessionDependency),
		hierarchies:  make(map[string]*types.SessionHierarchy),
	}
}

// CreateGroup creates a new session group
func (m *Multiplexer) CreateGroup(name, description string, tags []string) (*types.SessionGroup, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	groupID := uuid.New().String()
	now := time.Now()

	group := &types.SessionGroup{
		ID:          groupID,
		Name:        name,
		Description: description,
		SessionIDs:  make([]string, 0),
		Tags:        tags,
		CreatedAt:   now,
		UpdatedAt:   now,
		Metadata:    make(map[string]interface{}),
	}

	m.groups[groupID] = group
	return group, nil
}

// GetGroup gets a session group by ID
func (m *Multiplexer) GetGroup(groupID string) (*types.SessionGroup, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	group, exists := m.groups[groupID]
	if !exists {
		return nil, fmt.Errorf("group not found: %s", groupID)
	}

	return group, nil
}

// ListGroups lists all session groups
func (m *Multiplexer) ListGroups() []*types.SessionGroup {
	m.mu.RLock()
	defer m.mu.RUnlock()

	groups := make([]*types.SessionGroup, 0, len(m.groups))
	for _, group := range m.groups {
		groups = append(groups, group)
	}

	// Sort by creation time (newest first)
	sort.Slice(groups, func(i, j int) bool {
		return groups[i].CreatedAt.After(groups[j].CreatedAt)
	})

	return groups
}

// AddSessionToGroup adds a session to a group
func (m *Multiplexer) AddSessionToGroup(groupID, sessionID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	group, exists := m.groups[groupID]
	if !exists {
		return fmt.Errorf("group not found: %s", groupID)
	}

	// Check if session is already in group
	for _, id := range group.SessionIDs {
		if id == sessionID {
			return fmt.Errorf("session already in group: %s", sessionID)
		}
	}

	group.SessionIDs = append(group.SessionIDs, sessionID)
	group.UpdatedAt = time.Now()

	return nil
}

// RemoveSessionFromGroup removes a session from a group
func (m *Multiplexer) RemoveSessionFromGroup(groupID, sessionID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	group, exists := m.groups[groupID]
	if !exists {
		return fmt.Errorf("group not found: %s", groupID)
	}

	for i, id := range group.SessionIDs {
		if id == sessionID {
			group.SessionIDs = append(group.SessionIDs[:i], group.SessionIDs[i+1:]...)
			group.UpdatedAt = time.Now()
			return nil
		}
	}

	return fmt.Errorf("session not found in group: %s", sessionID)
}

// DeleteGroup deletes a session group
func (m *Multiplexer) DeleteGroup(groupID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.groups[groupID]; !exists {
		return fmt.Errorf("group not found: %s", groupID)
	}

	delete(m.groups, groupID)
	return nil
}

// CreateTag creates a new session tag
func (m *Multiplexer) CreateTag(name, color, description string) (*types.SessionTag, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.tags[name]; exists {
		return nil, fmt.Errorf("tag already exists: %s", name)
	}

	tag := &types.SessionTag{
		Name:        name,
		Color:       color,
		Description: description,
		CreatedAt:   time.Now(),
	}

	m.tags[name] = tag
	return tag, nil
}

// GetTag gets a session tag by name
func (m *Multiplexer) GetTag(name string) (*types.SessionTag, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	tag, exists := m.tags[name]
	if !exists {
		return nil, fmt.Errorf("tag not found: %s", name)
	}

	return tag, nil
}

// ListTags lists all session tags
func (m *Multiplexer) ListTags() []*types.SessionTag {
	m.mu.RLock()
	defer m.mu.RUnlock()

	tags := make([]*types.SessionTag, 0, len(m.tags))
	for _, tag := range m.tags {
		tags = append(tags, tag)
	}

	// Sort by name
	sort.Slice(tags, func(i, j int) bool {
		return tags[i].Name < tags[j].Name
	})

	return tags
}

// DeleteTag deletes a session tag
func (m *Multiplexer) DeleteTag(name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.tags[name]; !exists {
		return fmt.Errorf("tag not found: %s", name)
	}

	delete(m.tags, name)
	return nil
}

// AddDependency creates a dependency relationship between sessions
func (m *Multiplexer) AddDependency(parentID, childID, depType, description string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	dependency := &types.SessionDependency{
		ParentSessionID: parentID,
		ChildSessionID:  childID,
		DependencyType:  depType,
		Description:     description,
	}

	// Add to parent's dependency list
	if m.dependencies[parentID] == nil {
		m.dependencies[parentID] = make([]*types.SessionDependency, 0)
	}
	m.dependencies[parentID] = append(m.dependencies[parentID], dependency)

	return nil
}

// GetDependencies gets all dependencies for a session
func (m *Multiplexer) GetDependencies(sessionID string) []*types.SessionDependency {
	m.mu.RLock()
	defer m.mu.RUnlock()

	dependencies := make([]*types.SessionDependency, 0)
	if deps, exists := m.dependencies[sessionID]; exists {
		dependencies = append(dependencies, deps...)
	}

	return dependencies
}

// RemoveDependency removes a dependency relationship
func (m *Multiplexer) RemoveDependency(parentID, childID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	deps, exists := m.dependencies[parentID]
	if !exists {
		return fmt.Errorf("no dependencies found for session: %s", parentID)
	}

	for i, dep := range deps {
		if dep.ChildSessionID == childID {
			m.dependencies[parentID] = append(deps[:i], deps[i+1:]...)
			return nil
		}
	}

	return fmt.Errorf("dependency not found: %s -> %s", parentID, childID)
}

// CreateHierarchy creates a parent-child relationship between sessions
func (m *Multiplexer) CreateHierarchy(parentID, childID string, metadata map[string]interface{}) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.hierarchies[childID]; exists {
		return fmt.Errorf("session already has a parent: %s", childID)
	}

	// Calculate hierarchy level and path
	level := 0
	path := []string{childID}

	if parentHierarchy, exists := m.hierarchies[parentID]; exists {
		level = parentHierarchy.Level + 1
		path = append(parentHierarchy.Path, childID)
	} else {
		path = []string{parentID, childID}
	}

	hierarchy := &types.SessionHierarchy{
		ParentID: parentID,
		ChildID:  childID,
		Level:    level,
		Path:     path,
		Metadata: metadata,
	}

	m.hierarchies[childID] = hierarchy
	return nil
}

// GetHierarchy gets the hierarchy information for a session
func (m *Multiplexer) GetHierarchy(sessionID string) (*types.SessionHierarchy, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	hierarchy, exists := m.hierarchies[sessionID]
	if !exists {
		return nil, fmt.Errorf("hierarchy not found for session: %s", sessionID)
	}

	return hierarchy, nil
}

// GetChildren gets all child sessions for a parent session
func (m *Multiplexer) GetChildren(parentID string) []*types.SessionHierarchy {
	m.mu.RLock()
	defer m.mu.RUnlock()

	children := make([]*types.SessionHierarchy, 0)
	for _, hierarchy := range m.hierarchies {
		if hierarchy.ParentID == parentID {
			children = append(children, hierarchy)
		}
	}

	return children
}

// RemoveHierarchy removes a hierarchy relationship
func (m *Multiplexer) RemoveHierarchy(childID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.hierarchies[childID]; !exists {
		return fmt.Errorf("hierarchy not found for session: %s", childID)
	}

	delete(m.hierarchies, childID)
	return nil
}

// FindSessionsByTag finds all sessions with a specific tag
func (m *Multiplexer) FindSessionsByTag(tagName string) []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	sessionIDs := make([]string, 0)
	for _, group := range m.groups {
		for _, tag := range group.Tags {
			if tag == tagName {
				sessionIDs = append(sessionIDs, group.SessionIDs...)
				break
			}
		}
	}

	return sessionIDs
}

// GetSessionGroups gets all groups that contain a specific session
func (m *Multiplexer) GetSessionGroups(sessionID string) []*types.SessionGroup {
	m.mu.RLock()
	defer m.mu.RUnlock()

	groups := make([]*types.SessionGroup, 0)
	for _, group := range m.groups {
		for _, id := range group.SessionIDs {
			if id == sessionID {
				groups = append(groups, group)
				break
			}
		}
	}

	return groups
}
