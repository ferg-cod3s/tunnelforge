# Push Notification Implementation Plan

This document outlines the comprehensive plan for improving VibeTunnel's notification system through two major initiatives:
1. Creating a dedicated Notifications tab in macOS settings
2. Migrating SessionMonitor from the Mac app to the server for unified notifications

## Overview

Currently, VibeTunnel has inconsistent notification implementations between the Mac and web clients. The Mac app has its own SessionMonitor while the web relies on server events. This leads to:
- Different notification behaviors between platforms
- Missing features (e.g., Claude Turn notifications not shown in web UI)
- Duplicate code and maintenance burden
- Inconsistent descriptions and thresholds

## Part 1: macOS Settings Redesign

### Current State
- Notification settings are cramped in the General tab
- No room for descriptive text explaining each notification type
- Settings are already at 710px height (quite tall)
- Missing helpful context that exists in the web UI

### Proposed Solution: Dedicated Notifications Tab

#### 1. Add Notifications Tab to SettingsTab enum

```swift
// SettingsTab.swift
enum SettingsTab: String, CaseIterable {
    case general
    case notifications  // NEW
    case quickStart
    case dashboard
    // ... rest of tabs
}

// Add display name and icon
var displayName: String {
    switch self {
    case .notifications: "Notifications"
    // ... rest
    }
}

var icon: String {
    switch self {
    case .notifications: "bell.badge"
    // ... rest
    }
}
```

#### 2. Create NotificationSettingsView.swift

```swift
struct NotificationSettingsView: View {
    @ObservedObject private var configManager = ConfigManager.shared
    @ObservedObject private var notificationService = NotificationService.shared
    
    var body: some View {
        Form {
            // Master toggle section
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Toggle("Show Session Notifications", isOn: $showNotifications)
                    Text("Display native macOS notifications for session and command events")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            
            // Notification types section
            Section {
                NotificationToggleRow(
                    title: "Session starts",
                    description: "When a new session starts (useful for shared terminals)",
                    isOn: $configManager.notificationSessionStart,
                    helpText: NotificationHelp.sessionStart
                )
                
                NotificationToggleRow(
                    title: "Session ends",
                    description: "When a session terminates or crashes (shows exit code)",
                    isOn: $configManager.notificationSessionExit,
                    helpText: NotificationHelp.sessionExit
                )
                
                // ... other notification types
            } header: {
                Text("Notification Types")
            }
            
            // Behavior section
            Section {
                Toggle("Play sound", isOn: $configManager.notificationSoundEnabled)
                Toggle("Show in Notification Center", isOn: $configManager.showInNotificationCenter)
            } header: {
                Text("Notification Behavior")
            }
            
            // Test section
            Section {
                Button("Test Notification") {
                    notificationService.sendTestNotification()
                }
            }
        }
    }
}
```

#### 3. Create Reusable NotificationToggleRow Component

```swift
struct NotificationToggleRow: View {
    let title: String
    let description: String
    @Binding var isOn: Bool
    let helpText: String
    
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Toggle(title, isOn: $isOn)
                        .toggleStyle(.checkbox)
                    HelpTooltip(text: helpText)
                }
                Text(description)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.vertical, 4)
    }
}
```

#### 4. Update SettingsView.swift

```swift
// Add the new tab
NotificationSettingsView()
    .tabItem {
        Label(SettingsTab.notifications.displayName, 
              systemImage: SettingsTab.notifications.icon)
    }
    .tag(SettingsTab.notifications)
```

#### 5. Update GeneralSettingsView.swift

Remove all notification-related settings to free up space.

### Standardized Notification Descriptions

Use these descriptions consistently across Mac and web:

| Type | Title | Description |
|------|-------|-------------|
| Session Start | Session starts | When a new session starts (useful for shared terminals) |
| Session Exit | Session ends | When a session terminates or crashes (shows exit code) |
| Command Error | Commands fail | When commands fail with non-zero exit codes |
| Command Completion | Commands complete (> 3 seconds) | When commands taking >3 seconds finish (builds, tests, etc.) |
| Terminal Bell | Terminal bell (🔔) | Terminal bell (^G) from vim, IRC mentions, completion sounds |
| Claude Turn | Claude turn notifications | When Claude AI finishes responding and awaits input |

## Part 2: Server-Side SessionMonitor Migration

### Current Architecture

```
Mac App:
  SessionMonitor (Swift) → NotificationService → macOS notifications
  
Server:
  PtyManager → Basic events → SSE → Web notifications
```

### Proposed Architecture

```
Server:
  PtyManager → SessionMonitor (TypeScript) → Enhanced events → SSE/WebSocket
                                                                    ↓
                                                        Mac & Web clients
```

### Implementation Steps

#### 1. Create Server-Side SessionMonitor

```typescript
// web/src/server/services/session-monitor.ts

export interface SessionState {
  id: string;
  name: string;
  command: string[];
  isRunning: boolean;
  activityStatus?: {
    isActive: boolean;
    lastActivity?: Date;
    specificStatus?: {
      app: string;
      status: string;
    };
  };
  commandStartTime?: Date;
  lastCommand?: string;
}

export class SessionMonitor {
  private sessions = new Map<string, SessionState>();
  private claudeIdleNotified = new Set<string>();
  private lastActivityState = new Map<string, boolean>();
  private commandThresholdMs = 3000; // 3 seconds
  
  constructor(
    private ptyManager: PtyManager,
    private eventBus: EventEmitter
  ) {
    this.setupEventListeners();
  }
  
  private detectClaudeSession(session: SessionState): boolean {
    const isClaudeCommand = session.command
      .join(' ')
      .toLowerCase()
      .includes('claude');
    
    const isClaudeApp = session.activityStatus?.specificStatus?.app
      .toLowerCase()
      .includes('claude') ?? false;
      
    return isClaudeCommand || isClaudeApp;
  }
  
  private checkClaudeTurnNotification(sessionId: string, newState: SessionState) {
    if (!this.detectClaudeSession(newState)) return;
    
    const currentActive = newState.activityStatus?.isActive ?? false;
    const previousActive = this.lastActivityState.get(sessionId) ?? false;
    
    // Claude went from active to idle
    if (previousActive && !currentActive && !this.claudeIdleNotified.has(sessionId)) {
      this.eventBus.emit('notification', {
        type: ServerEventType.ClaudeTurn,
        sessionId,
        sessionName: newState.name,
        message: 'Claude has finished responding'
      });
      this.claudeIdleNotified.add(sessionId);
    }
    
    // Reset when Claude becomes active again
    if (!previousActive && currentActive) {
      this.claudeIdleNotified.delete(sessionId);
    }
    
    this.lastActivityState.set(sessionId, currentActive);
  }
  
  // ... other monitoring methods
}
```

#### 2. Enhance Event Types

```typescript
// web/src/shared/types.ts

export enum ServerEventType {
  SessionStart = 'session-start',
  SessionExit = 'session-exit',
  CommandFinished = 'command-finished',
  CommandError = 'command-error',  // NEW - separate from finished
  Bell = 'bell',                   // NEW
  ClaudeTurn = 'claude-turn',
  Connected = 'connected'
}

export interface ServerEvent {
  type: ServerEventType;
  timestamp: string;
  sessionId: string;
  sessionName?: string;
  
  // Event-specific data
  exitCode?: number;
  command?: string;
  duration?: number;
  message?: string;
  
  // Activity status for richer client UI
  activityStatus?: {
    isActive: boolean;
    app?: string;
  };
}
```

#### 3. Integrate with PtyManager

```typescript
// web/src/server/pty/pty-manager.ts

class PtyManager {
  private sessionMonitor: SessionMonitor;
  
  constructor() {
    this.sessionMonitor = new SessionMonitor(this, serverEventBus);
  }
  
  // Feed data to SessionMonitor
  private handlePtyData(sessionId: string, data: string) {
    // Existing data handling...
    
    // Detect bell character
    if (data.includes('\x07')) {
      serverEventBus.emit('notification', {
        type: ServerEventType.Bell,
        sessionId,
        sessionName: this.sessions.get(sessionId)?.name
      });
    }
    
    // Update activity status
    this.sessionMonitor.updateActivity(sessionId, {
      isActive: true,
      lastActivity: new Date()
    });
  }
}
```

#### 4. Update Server Routes

```typescript
// web/src/server/routes/events.ts

// Enhanced event handling
serverEventBus.on('notification', (event: ServerEvent) => {
  // Send to all connected SSE clients
  broadcastEvent(event);
  
  // Log for debugging
  logger.info(`📢 Notification event: ${event.type} for session ${event.sessionId}`);
});
```

#### 5. Update Mac NotificationService

```swift
// NotificationService.swift

class NotificationService {
    // Remove local SessionMonitor dependency
    // Subscribe to server SSE events instead
    
    private func connectToServerEvents() {
        eventSource = EventSource(url: "http://localhost:4020/api/events")
        
        eventSource.onMessage { event in
            guard let data = event.data,
                  let serverEvent = try? JSONDecoder().decode(ServerEvent.self, from: data) else {
                return
            }
            
            Task { @MainActor in
                self.handleServerEvent(serverEvent)
            }
        }
    }
    
    private func handleServerEvent(_ event: ServerEvent) {
        // Map server events to notifications
        switch event.type {
        case .sessionStart:
            if preferences.sessionStart {
                sendNotification(for: event)
            }
        // ... handle other event types
        }
    }
}
```

#### 6. Update Web Notification Service

```typescript
// web/src/client/services/push-notification-service.ts

// Add Claude Turn to notification handling
private handleServerEvent(event: ServerEvent) {
  if (!this.preferences[this.mapEventTypeToPreference(event.type)]) {
    return;
  }
  
  // Send browser notification
  this.showNotification(event);
}

private mapEventTypeToPreference(type: ServerEventType): keyof NotificationPreferences {
  const mapping = {
    [ServerEventType.SessionStart]: 'sessionStart',
    [ServerEventType.SessionExit]: 'sessionExit',
    [ServerEventType.CommandFinished]: 'commandCompletion',
    [ServerEventType.CommandError]: 'commandError',
    [ServerEventType.Bell]: 'bell',
    [ServerEventType.ClaudeTurn]: 'claudeTurn'  // Now properly mapped
  };
  return mapping[type];
}
```

#### 7. Add Claude Turn to Web UI

```typescript
// web/src/client/components/settings.ts

// In notification types section
${this.renderNotificationToggle('claudeTurn', 'Claude Turn', 
  'When Claude AI finishes responding and awaits input')}
```

## Migration Strategy

### Phase 1: Preparation (Non-breaking)
1. Implement server-side SessionMonitor alongside existing system
2. Add new event types to shared types
3. Update web UI to show Claude Turn option

### Phase 2: Server Enhancement (Non-breaking)
1. Deploy enhanced server with SessionMonitor
2. Server emits both old and new event formats
3. Test with web client to ensure compatibility

### Phase 3: Mac App Migration
1. Update Mac app to consume server events
2. Keep fallback to local monitoring if server unavailable
3. Remove local SessionMonitor once stable

### Phase 4: Cleanup
1. Remove old event formats from server
2. Remove local SessionMonitor code from Mac
3. Document new architecture

## Testing Plan

### Unit Tests
- SessionMonitor Claude detection logic
- Event threshold calculations
- Activity state transitions

### Integration Tests
- Server events reach both Mac and web clients
- Notification preferences are respected
- Claude Turn notifications work correctly
- Bell character detection

### Manual Testing
- Test each notification type on both platforms
- Verify descriptions match
- Test with multiple clients connected
- Test offline Mac app behavior

## Success Metrics

1. **Consistency**: Same notifications appear on Mac and web for same events
2. **Feature Parity**: Claude Turn available on both platforms
3. **Performance**: No noticeable lag in notifications
4. **Reliability**: No missed notifications
5. **Maintainability**: Single codebase for monitoring logic

## Timeline Estimate

- **Week 1**: Implement macOS Notifications tab
- **Week 2**: Create server-side SessionMonitor
- **Week 3**: Integrate and test with web client
- **Week 4**: Migrate Mac app and testing
- **Week 5**: Polish, documentation, and deployment

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing notifications | High | Phased rollout, maintain backwards compatibility |
| Performance impact on server | Medium | Efficient event handling, consider debouncing |
| Mac app offline mode | Medium | Keep local fallback for critical notifications |
| Complex migration | Medium | Detailed testing plan, feature flags |

## Conclusion

This two-part implementation will:
1. Provide a better UI for notification settings on macOS
2. Create a unified notification system across all platforms
3. Reduce code duplication and maintenance burden
4. Ensure consistent behavior for all users

The migration is designed to be non-breaking with careful phases to minimize risk.