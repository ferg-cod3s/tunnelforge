# SSE (Server-Sent Events) Refactor Implementation Plan

**Created**: 2025-09-27
**Status**: Ready for Implementation
**Estimated Effort**: Medium (4-6 weeks)
**Risk Level**: Low-Medium

## Executive Summary

This plan implements Server-Sent Events (SSE) to replace aggressive HTTP polling in TunnelForge's frontend while maintaining WebSocket functionality for terminal I/O. The current 1-second polling interval causes rate limiting issues (400 errors at 100 requests/minute), particularly during folder browsing operations.

## Problem Statement

### Current Issues
- **Rate Limiting**: 1-second HTTP polling in `frontend/src/stores/sessions.js` hits 100 requests/minute limit
- **Poor User Experience**: 400 errors during folder browsing due to rate limiting
- **Resource Waste**: Unnecessary server load from constant polling
- **Latency**: 1-second delay for session updates vs. real-time SSE

### Current Architecture
```
Frontend (Vue.js) --[1s HTTP Polling]--> Go Server (Port 4021)
Frontend (Terminal) --[WebSocket]--> Go Server (Port 4021)
```

### Target Architecture
```
Frontend (Vue.js) --[SSE EventSource]--> Go Server (Port 4021)
Frontend (Terminal) --[WebSocket]--> Go Server (Port 4021)
```

## Research Findings

### Backend Analysis
- **WebSocket Infrastructure**: Robust event broadcaster in `internal/events/broadcaster.go`
- **Rate Limiting**: Middleware excludes WebSocket but not SSE endpoints
- **No SSE Implementation**: Missing traditional `text/event-stream` endpoints

### Frontend Analysis
- **Polling Implementation**: Located in `frontend/src/stores/sessions.js`
- **Vue.js/Pinia Store**: Session management with reactive state
- **Browser Compatibility**: Modern EventSource API support (IE fallback needed)

### Best Practices Research
- **SSE vs WebSocket**: SSE optimal for unidirectional server-to-client updates
- **Hybrid Approach**: SSE for session lists, WebSocket for terminal I/O
- **Progressive Enhancement**: Automatic fallback to reduced polling for unsupported browsers

## Implementation Strategy

### Phase 1: Backend SSE Infrastructure (Week 1-2)

#### 1.1 Create SSE Handler
**File**: `internal/handlers/sse.go`

```go
package handlers

import (
    "context"
    "encoding/json"
    "fmt"
    "net/http"
    "time"
)

type SSEHandler struct {
    broadcaster *events.Broadcaster
}

func NewSSEHandler(broadcaster *events.Broadcaster) *SSEHandler {
    return &SSEHandler{broadcaster: broadcaster}
}

func (h *SSEHandler) HandleSessionsSSE(w http.ResponseWriter, r *http.Request) {
    // Set SSE headers
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Connection", "keep-alive")
    w.Header().Set("Access-Control-Allow-Origin", "*")
    w.Header().Set("Access-Control-Allow-Headers", "Cache-Control")

    // Create client channel
    clientChan := make(chan []byte, 10)

    // Subscribe to session events
    h.broadcaster.Subscribe("sessions", clientChan)
    defer h.broadcaster.Unsubscribe("sessions", clientChan)

    // Send initial session list
    sessions := h.getCurrentSessions()
    data, _ := json.Marshal(sessions)
    fmt.Fprintf(w, "data: %s\n\n", data)
    w.(http.Flusher).Flush()

    // Send heartbeat every 30 seconds
    heartbeat := time.NewTicker(30 * time.Second)
    defer heartbeat.Stop()

    for {
        select {
        case event := <-clientChan:
            fmt.Fprintf(w, "data: %s\n\n", event)
            w.(http.Flusher).Flush()
        case <-heartbeat.C:
            fmt.Fprintf(w, ": heartbeat\n\n")
            w.(http.Flusher).Flush()
        case <-r.Context().Done():
            return
        }
    }
}
```

#### 1.2 Update Server Routing
**File**: `internal/server/server.go`

```go
// Add SSE endpoints
sseHandler := handlers.NewSSEHandler(s.broadcaster)
r.HandleFunc("/api/sse/sessions", sseHandler.HandleSessionsSSE).Methods("GET")
```

#### 1.3 Rate Limiting Exemption
**File**: `internal/middleware/ratelimit.go`

```go
// Exempt SSE endpoints from rate limiting
func (rl *RateLimiter) shouldExempt(r *http.Request) bool {
    exemptPaths := []string{
        "/ws/",
        "/api/sse/",  // Add SSE exemption
    }

    for _, path := range exemptPaths {
        if strings.HasPrefix(r.URL.Path, path) {
            return true
        }
    }
    return false
}
```

#### 1.4 Integrate with Event Broadcaster
**File**: `internal/session/manager.go`

```go
// Ensure session events are broadcast
func (m *Manager) CreateSession(ctx context.Context, req CreateSessionRequest) (*Session, error) {
    session := &Session{
        ID: generateID(),
        Command: req.Command,
        Name: req.Name,
        Status: "running",
        CreatedAt: time.Now(),
    }

    m.sessions[session.ID] = session

    // Broadcast session update
    m.broadcaster.Broadcast("sessions", map[string]interface{}{
        "type": "session_created",
        "session": session,
        "sessions": m.GetAllSessions(),
    })

    return session, nil
}
```

### Phase 2: Frontend SSE Implementation (Week 2-3)

#### 2.1 Create SSE Service
**File**: `frontend/src/services/sse.js`

```javascript
class SSEService {
    constructor() {
        this.eventSource = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.listeners = new Map();
    }

    connect(endpoint) {
        if (!window.EventSource) {
            console.warn('SSE not supported, falling back to polling');
            return false;
        }

        try {
            this.eventSource = new EventSource(endpoint);

            this.eventSource.onopen = () => {
                console.log('SSE connection opened');
                this.reconnectAttempts = 0;
            };

            this.eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.notifyListeners(data);
                } catch (error) {
                    console.error('Failed to parse SSE message:', error);
                }
            };

            this.eventSource.onerror = () => {
                console.error('SSE connection error');
                this.reconnect(endpoint);
            };

            return true;
        } catch (error) {
            console.error('Failed to create SSE connection:', error);
            return false;
        }
    }

    reconnect(endpoint) {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            return;
        }

        setTimeout(() => {
            this.reconnectAttempts++;
            const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts), 30000);
            console.log(`Reconnecting SSE in ${delay}ms (attempt ${this.reconnectAttempts})`);
            this.connect(endpoint);
        }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
    }

    addListener(callback) {
        const id = Date.now() + Math.random();
        this.listeners.set(id, callback);
        return id;
    }

    removeListener(id) {
        this.listeners.delete(id);
    }

    notifyListeners(data) {
        this.listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('SSE listener error:', error);
            }
        });
    }

    disconnect() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
    }
}

export default new SSEService();
```

#### 2.2 Update Sessions Store
**File**: `frontend/src/stores/sessions.js`

```javascript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiClient from '@/services/api'
import sseService from '@/services/sse'

export const useSessionsStore = defineStore('sessions', () => {
    const sessions = ref([])
    const loading = ref(false)
    const error = ref(null)
    const connected = ref(false)
    const usingSSE = ref(false)
    const pollingInterval = ref(null)

    // SSE connection management
    const connectSSE = () => {
        const success = sseService.connect('/api/sse/sessions')

        if (success) {
            usingSSE.value = true
            connected.value = true

            sseService.addListener((data) => {
                if (data.sessions) {
                    sessions.value = data.sessions
                }

                if (data.type === 'session_created') {
                    // Handle real-time session creation
                    sessions.value = data.sessions
                }

                if (data.type === 'session_terminated') {
                    // Handle real-time session termination
                    sessions.value = data.sessions
                }

                error.value = null
            })
        } else {
            // Fallback to polling
            startPolling()
        }
    }

    // Polling fallback (reduced frequency)
    const startPolling = () => {
        usingSSE.value = false
        console.log('Using polling fallback (10s interval)')

        // Initial fetch
        fetchSessions()

        // Reduced polling interval for fallback
        pollingInterval.value = setInterval(fetchSessions, 10000) // 10 seconds
    }

    const stopPolling = () => {
        if (pollingInterval.value) {
            clearInterval(pollingInterval.value)
            pollingInterval.value = null
        }
    }

    const fetchSessions = async () => {
        if (loading.value) return

        try {
            loading.value = true
            const response = await apiClient.get('/api/sessions')
            sessions.value = response.data || []
            error.value = null
            connected.value = true
        } catch (err) {
            console.error('Failed to fetch sessions:', err)
            error.value = err.message
            connected.value = false
        } finally {
            loading.value = false
        }
    }

    const startConnection = () => {
        connectSSE()
    }

    const stopConnection = () => {
        sseService.disconnect()
        stopPolling()
        connected.value = false
    }

    // Computed properties
    const activeSessions = computed(() =>
        sessions.value.filter(session => session.status === 'running')
    )

    const sessionCount = computed(() => sessions.value.length)

    return {
        // State
        sessions,
        loading,
        error,
        connected,
        usingSSE,

        // Computed
        activeSessions,
        sessionCount,

        // Actions
        startConnection,
        stopConnection,
        fetchSessions
    }
})
```

#### 2.3 Update Session List Component
**File**: `frontend/src/components/SessionList.vue`

```vue
<template>
    <div class="session-list">
        <div class="connection-status">
            <span
                :class="['status-indicator', connected ? 'connected' : 'disconnected']"
                :title="usingSSE ? 'Real-time updates via SSE' : 'Polling fallback'"
            >
                {{ connected ? '●' : '○' }}
            </span>
            {{ usingSSE ? 'Real-time' : 'Polling' }}
        </div>

        <div v-if="error" class="error-message">
            {{ error }}
        </div>

        <div v-if="loading" class="loading">
            Loading sessions...
        </div>

        <div v-else-if="sessions.length === 0" class="no-sessions">
            No active sessions
        </div>

        <div v-else class="sessions">
            <div
                v-for="session in sessions"
                :key="session.id"
                class="session-item"
            >
                <h3>{{ session.name }}</h3>
                <p>{{ session.command.join(' ') }}</p>
                <span class="status">{{ session.status }}</span>
            </div>
        </div>
    </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useSessionsStore } from '@/stores/sessions'

const sessionsStore = useSessionsStore()
const { sessions, loading, error, connected, usingSSE } = storeToRefs(sessionsStore)

onMounted(() => {
    sessionsStore.startConnection()
})

onUnmounted(() => {
    sessionsStore.stopConnection()
})
</script>
```

### Phase 3: Testing & Validation (Week 3-4)

#### 3.1 Unit Tests
**File**: `internal/handlers/sse_test.go`

```go
func TestSSEHandler_HandleSessionsSSE(t *testing.T) {
    // Test SSE connection and message broadcasting
    broadcaster := events.NewBroadcaster()
    handler := NewSSEHandler(broadcaster)

    // Create test request
    req := httptest.NewRequest("GET", "/api/sse/sessions", nil)
    w := httptest.NewRecorder()

    // Test connection establishment
    go handler.HandleSessionsSSE(w, req)

    // Verify headers
    assert.Equal(t, "text/event-stream", w.Header().Get("Content-Type"))
    assert.Equal(t, "no-cache", w.Header().Get("Cache-Control"))
    assert.Equal(t, "keep-alive", w.Header().Get("Connection"))
}
```

#### 3.2 Integration Tests
**File**: `test/integration/sse_test.go`

```go
func TestSSEIntegration(t *testing.T) {
    // Start test server
    server := startTestServer()
    defer server.Close()

    // Test SSE connection
    resp, err := http.Get(server.URL + "/api/sse/sessions")
    require.NoError(t, err)
    defer resp.Body.Close()

    // Verify SSE headers
    assert.Equal(t, "text/event-stream", resp.Header.Get("Content-Type"))

    // Test session creation event
    createSession(server.URL, "test-session")

    // Verify SSE event received
    scanner := bufio.NewScanner(resp.Body)
    for scanner.Scan() {
        line := scanner.Text()
        if strings.HasPrefix(line, "data: ") {
            var event map[string]interface{}
            json.Unmarshal([]byte(line[6:]), &event)
            if event["type"] == "session_created" {
                assert.Equal(t, "test-session", event["session"].(map[string]interface{})["name"])
                break
            }
        }
    }
}
```

#### 3.3 Frontend Tests
**File**: `frontend/tests/unit/sse.spec.js`

```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import SSEService from '@/services/sse'

describe('SSEService', () => {
    let mockEventSource

    beforeEach(() => {
        mockEventSource = {
            addEventListener: vi.fn(),
            close: vi.fn(),
            readyState: 1
        }

        global.EventSource = vi.fn(() => mockEventSource)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('should establish SSE connection', () => {
        const success = SSEService.connect('/api/sse/sessions')

        expect(success).toBe(true)
        expect(global.EventSource).toHaveBeenCalledWith('/api/sse/sessions')
    })

    it('should handle message events', () => {
        const listener = vi.fn()
        SSEService.addListener(listener)

        SSEService.connect('/api/sse/sessions')

        // Simulate message event
        const messageEvent = new MessageEvent('message', {
            data: JSON.stringify({ type: 'session_created', sessions: [] })
        })

        mockEventSource.onmessage(messageEvent)

        expect(listener).toHaveBeenCalledWith({
            type: 'session_created',
            sessions: []
        })
    })
})
```

### Phase 4: Performance Optimization & Monitoring (Week 4-5)

#### 4.1 Connection Pool Management
**File**: `internal/handlers/sse_pool.go`

```go
type SSEConnectionPool struct {
    connections map[string]chan []byte
    mutex       sync.RWMutex
    maxConns    int
}

func NewSSEConnectionPool(maxConns int) *SSEConnectionPool {
    return &SSEConnectionPool{
        connections: make(map[string]chan []byte),
        maxConns:    maxConns,
    }
}

func (p *SSEConnectionPool) AddConnection(id string, ch chan []byte) error {
    p.mutex.Lock()
    defer p.mutex.Unlock()

    if len(p.connections) >= p.maxConns {
        return fmt.Errorf("connection pool full")
    }

    p.connections[id] = ch
    return nil
}

func (p *SSEConnectionPool) RemoveConnection(id string) {
    p.mutex.Lock()
    defer p.mutex.Unlock()

    if ch, exists := p.connections[id]; exists {
        close(ch)
        delete(p.connections, id)
    }
}

func (p *SSEConnectionPool) BroadcastToAll(message []byte) {
    p.mutex.RLock()
    defer p.mutex.RUnlock()

    for _, ch := range p.connections {
        select {
        case ch <- message:
        default:
            // Channel full, skip this connection
        }
    }
}
```

#### 4.2 Metrics Collection
**File**: `internal/metrics/sse_metrics.go`

```go
type SSEMetrics struct {
    activeConnections  prometheus.Gauge
    messagesTransmitted prometheus.Counter
    connectionErrors   prometheus.Counter
    reconnectionAttempts prometheus.Counter
}

func NewSSEMetrics() *SSEMetrics {
    return &SSEMetrics{
        activeConnections: prometheus.NewGauge(prometheus.GaugeOpts{
            Name: "sse_active_connections",
            Help: "Number of active SSE connections",
        }),
        messagesTransmitted: prometheus.NewCounter(prometheus.CounterOpts{
            Name: "sse_messages_transmitted_total",
            Help: "Total number of SSE messages transmitted",
        }),
        connectionErrors: prometheus.NewCounter(prometheus.CounterOpts{
            Name: "sse_connection_errors_total",
            Help: "Total number of SSE connection errors",
        }),
        reconnectionAttempts: prometheus.NewCounter(prometheus.CounterOpts{
            Name: "sse_reconnection_attempts_total",
            Help: "Total number of SSE reconnection attempts",
        }),
    }
}
```

### Phase 5: Migration & Rollback Strategy (Week 5-6)

#### 5.1 Feature Flag Implementation
**File**: `internal/config/features.go`

```go
type FeatureFlags struct {
    SSEEnabled bool `json:"sse_enabled" env:"SSE_ENABLED" default:"false"`
}

func (c *Config) IsSSEEnabled() bool {
    return c.Features.SSEEnabled
}
```

#### 5.2 Gradual Migration Script
**File**: `scripts/migrate-to-sse.sh`

```bash
#!/bin/bash

# Migration script for SSE rollout
set -e

echo "Starting SSE migration..."

# Step 1: Enable SSE for 10% of users
kubectl patch deployment tunnelforge-server -p '{"spec":{"template":{"spec":{"containers":[{"name":"server","env":[{"name":"SSE_ENABLED","value":"true"},{"name":"SSE_ROLLOUT_PERCENTAGE","value":"10"}]}]}}}}'

echo "SSE enabled for 10% of users"
sleep 60

# Monitor error rates
ERROR_RATE=$(curl -s "http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~'5..'}[5m])" | jq '.data.result[0].value[1]' | tr -d '"')

if (( $(echo "$ERROR_RATE > 0.01" | bc -l) )); then
    echo "Error rate too high ($ERROR_RATE), rolling back..."
    kubectl patch deployment tunnelforge-server -p '{"spec":{"template":{"spec":{"containers":[{"name":"server","env":[{"name":"SSE_ENABLED","value":"false"}]}]}}}}'
    exit 1
fi

# Step 2: Increase to 50%
kubectl patch deployment tunnelforge-server -p '{"spec":{"template":{"spec":{"containers":[{"name":"server","env":[{"name":"SSE_ROLLOUT_PERCENTAGE","value":"50"}]}]}}}}'

echo "SSE enabled for 50% of users"
sleep 300

# Final check and full rollout
ERROR_RATE=$(curl -s "http://prometheus:9090/api/v1/query?query=rate(http_requests_total{status=~'5..'}[5m])" | jq '.data.result[0].value[1]' | tr -d '"')

if (( $(echo "$ERROR_RATE > 0.01" | bc -l) )); then
    echo "Error rate too high ($ERROR_RATE), rolling back..."
    kubectl patch deployment tunnelforge-server -p '{"spec":{"template":{"spec":{"containers":[{"name":"server","env":[{"name":"SSE_ENABLED","value":"false"}]}]}}}}'
    exit 1
fi

# Step 3: Full rollout
kubectl patch deployment tunnelforge-server -p '{"spec":{"template":{"spec":{"containers":[{"name":"server","env":[{"name":"SSE_ROLLOUT_PERCENTAGE","value":"100"}]}]}}}}'

echo "SSE migration completed successfully"
```

## Success Criteria

### Automated Verification

- [ ] SSE endpoints return correct `text/event-stream` headers
- [ ] Event broadcasting works for session creation/termination
- [ ] Rate limiting exemption applied to SSE endpoints
- [ ] Frontend automatically falls back to polling when SSE unavailable
- [ ] Reconnection logic works with exponential backoff
- [ ] Memory usage remains under 100MB for 1000 concurrent SSE connections
- [ ] All existing WebSocket terminal functionality remains unaffected

### Manual Verification

- [ ] Real-time session updates visible in browser without refresh
- [ ] No 400 rate limiting errors during heavy folder browsing
- [ ] Connection status indicator shows SSE vs polling state
- [ ] Browser disconnection/reconnection handled gracefully
- [ ] Cross-browser compatibility (Chrome, Firefox, Safari, Edge)
- [ ] Mobile browser support verified
- [ ] Performance improvement: <100ms latency for session updates

## Risk Assessment & Mitigation

### HIGH RISK

**Browser Compatibility Issues**
- *Risk*: Older browsers (IE) don't support EventSource API
- *Mitigation*: Automatic fallback to 10-second polling for unsupported browsers
- *Detection*: Feature detection with `window.EventSource` check

**Server Resource Exhaustion**
- *Risk*: Too many concurrent SSE connections overwhelm server
- *Mitigation*: Connection pool with configurable limits (default: 1000)
- *Monitoring*: Prometheus metrics for active connections and memory usage

### MEDIUM RISK

**Network Proxy Issues**
- *Risk*: Corporate proxies may block SSE connections
- *Mitigation*: Automatic fallback to polling with exponential backoff
- *Timeline Impact*: May require additional proxy configuration documentation

**Migration Complexity**
- *Risk*: Complex frontend state management during migration
- *Mitigation*: Feature flag approach with gradual rollout
- *Rollback Plan*: Instant rollback via feature flag disable

### LOW RISK

**Development Environment Issues**
- *Risk*: Local development setup may differ from production
- *Mitigation*: Docker-based development environment matching production
- *Testing*: Comprehensive integration tests covering both SSE and polling modes

## Performance Expectations

### Before Implementation
- **Polling Frequency**: 1 request/second per client
- **Rate Limiting**: 400 errors at 100 requests/minute
- **Latency**: 1-second average delay for updates
- **Server Load**: High due to constant polling

### After Implementation
- **Real-time Updates**: <100ms latency via SSE
- **Rate Limiting**: Eliminated for session updates
- **Server Load**: 80% reduction in unnecessary requests
- **Browser Support**: 95% SSE, 5% polling fallback

## Implementation Checklist

### Phase 1: Backend (Week 1-2)
- [ ] Create `internal/handlers/sse.go` with EventSource support
- [ ] Add SSE routes to `internal/server/server.go`
- [ ] Update rate limiting middleware for SSE exemption
- [ ] Integrate session events with broadcaster
- [ ] Add SSE connection pool management
- [ ] Write unit tests for SSE handlers

### Phase 2: Frontend (Week 2-3)
- [ ] Create `frontend/src/services/sse.js` service
- [ ] Update `frontend/src/stores/sessions.js` with SSE support
- [ ] Modify `frontend/src/components/SessionList.vue` for real-time updates
- [ ] Add connection status indicators
- [ ] Implement automatic fallback to polling
- [ ] Write frontend unit tests

### Phase 3: Testing (Week 3-4)
- [ ] Integration tests for SSE endpoint functionality
- [ ] Cross-browser compatibility testing
- [ ] Performance testing with concurrent connections
- [ ] Fallback mechanism testing
- [ ] Load testing to verify rate limiting elimination

### Phase 4: Monitoring (Week 4-5)
- [ ] Add Prometheus metrics for SSE connections
- [ ] Create Grafana dashboard for SSE monitoring
- [ ] Set up alerting for connection failures
- [ ] Performance benchmarking and optimization

### Phase 5: Deployment (Week 5-6)
- [ ] Feature flag implementation
- [ ] Gradual rollout script (10% → 50% → 100%)
- [ ] Rollback procedures documentation
- [ ] Production monitoring setup
- [ ] User documentation updates

## Related Documentation

- **API Documentation**: Update with new SSE endpoints
- **Frontend Architecture**: Document SSE integration patterns
- **Operations Guide**: SSE monitoring and troubleshooting
- **Browser Compatibility**: Supported EventSource features

## Future Enhancements

### Short Term (1-2 months)
- **Message Filtering**: Client-side filtering for specific session types
- **Compression**: Gzip compression for SSE messages
- **Authentication**: JWT token validation for SSE connections

### Long Term (3-6 months)
- **Advanced Reconnection**: Smart reconnection based on network conditions
- **Message Queuing**: Server-side message queuing for disconnected clients
- **WebSocket Migration**: Evaluate migrating all communication to WebSocket

---

**Implementation Owner**: Backend/Frontend Teams
**Review Required**: Architecture Team, DevOps Team
**Documentation Updates**: API docs, User guides, Operations runbooks

*This plan addresses the specific rate limiting issues while maintaining all existing functionality and providing a clear migration path.*