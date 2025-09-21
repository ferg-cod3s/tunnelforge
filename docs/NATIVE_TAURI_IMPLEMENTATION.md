# Native Tauri Implementation Plan
*Created 2025-01-27 - Complete Architecture Restructure Required*

## Overview

**The current Tauri implementation is fundamentally incorrect.** We need to completely restructure the desktop application to be a **native Tauri application** that directly implements all 41 services from the original VibeTunnel Mac app, not a wrapper around a web interface.

## Current Problems

### ❌ **WRONG APPROACH** - Current Implementation
- **Web Wrapper**: Tauri app loads HTML/JS interface that tries to call Tauri commands
- **Server Management**: Tries to manage Go server process instead of being native
- **Missing Services**: None of the 41 original Mac app services are implemented
- **Architecture Flaw**: Designed as web interface wrapper, not native application

### ✅ **CORRECT APPROACH** - Native Tauri Implementation
- **Native UI**: Direct Tauri UI components, no web interface
- **Direct Integration**: Native communication with Go server API
- **Service Implementation**: All 41 original Mac app services implemented natively
- **System Integration**: Native system tray, notifications, power management

## Architecture Restructure Required

### **Before (Current - WRONG)**
```
┌─────────────────┐    ┌──────────────────┐    ┌────────────────┐
│   Tauri v2      │    │   Bun Frontend   │    │   Go Server    │
│   Desktop       │◄──►│   (Port 3001)    │◄──►│   (Port 4021)  │
│   (Web Wrapper)  │    │   Static + Proxy │    │   API + WS     │
└─────────────────┘    └──────────────────┘    └────────────────┘
```

### **After (Correct - NATIVE)**
```
┌─────────────────────────────────────┐    ┌────────────────┐
│           Tauri v2 Native           │    │   Go Server    │
│           Desktop App               │◄──►│   (Port 4021)  │
│                                     │    │   API + WS     │
│ • Native UI Components              │    └────────────────┘
│ • Direct Server Integration         │
│ • System Tray & Notifications       │
│ • Power Management                  │
│ • Tunnel Integration                │
│ • All 41 Mac App Services           │
└─────────────────────────────────────┘
```

## Implementation Plan

### **Phase 1: Complete Restructure** (1-2 weeks)
*Priority: URGENT - Current implementation is unusable*

#### Week 1: Remove Web Wrapper Approach
**Current Status**: Tauri app incorrectly loads HTML interface

**Key Deliverables**:
- Remove `index.html` and web-based approach
- Remove web wrapper configuration from `tauri.conf.json`
- Create native Tauri UI components
- Direct integration with Go server API (port 4021)

#### Week 2: Core Native Implementation
- **Native UI Framework**: Implement native Tauri UI components
- **Server Integration**: Direct API calls to Go server
- **System Tray**: Native system tray implementation
- **Settings Management**: Native settings persistence
- **Session Management**: Native terminal session handling

**Phase 1 Success Criteria**:
- [ ] Native Tauri UI components implemented ✅
- [ ] Direct Go server integration working ✅
- [ ] System tray and notifications functional ✅
- [ ] Settings persistence across platforms ✅
- [ ] Session management working natively ✅

### **Phase 2: Service Implementation** (4-6 weeks)
*Priority: HIGH - Implement all 41 original Mac app services*

#### Core Services Implementation
1. **ServerManager**: Native server lifecycle management
2. **SessionService**: Terminal session management
3. **TerminalManager**: Terminal control and I/O
4. **NotificationService**: System notifications
5. **ConfigManager**: Configuration management

#### Advanced Services Implementation
1. **PowerManagementService**: Sleep prevention (macOS IOKit, Windows SetThreadExecutionState, Linux systemd-inhibit)
2. **NgrokService**: Ngrok tunnel integration
3. **TailscaleService**: Tailscale integration
4. **CloudflareService**: Cloudflare tunnel support
5. **GitRepositoryMonitor**: Git repository monitoring
6. **WorktreeService**: Git worktree management
7. **NetworkMonitor**: Network status monitoring
8. **RemoteServicesStatusManager**: Remote service status
9. **SystemPermissionManager**: System permissions
10. **SparkleUpdaterManager**: Auto-updates

#### UI Components Implementation (32 Views)
1. **SettingsView**: Main settings interface
2. **SessionDetailView**: Session details
3. **WelcomeView**: Onboarding experience
4. **AboutView**: About dialog
5. Multiple settings sections and components

**Phase 2 Success Criteria**:
- [ ] All 41 original Mac app services implemented natively
- [ ] Feature parity with original VibeTunnel app
- [ ] Cross-platform compatibility maintained
- [ ] Performance within 10% of native SwiftUI app

### **Phase 3: Advanced Features** (2-3 weeks)
*Priority: MEDIUM - Enhanced functionality*

#### Tunnel Integration Services
- Cloudflare tunnel integration (cloudflared CLI)
- Ngrok tunnel management (auth tokens, tunnel lifecycle)
- Tailscale integration (hostname discovery, status monitoring)
- Public URL generation and management

#### Advanced Session Management
- Session multiplexing and grouping
- Cross-session operations
- Remote session registry
- Session organization by project/type

#### System Integration
- Advanced power management
- Network monitoring and status
- Git repository monitoring
- Worktree management
- System permissions handling

#### Activity Monitoring
- Session activity tracking
- Performance metrics
- User analytics
- Usage statistics

**Phase 3 Success Criteria**:
- [ ] Advanced tunnel services implemented
- [ ] Session multiplexing working
- [ ] Activity monitoring functional
- [ ] All system integrations complete

## Technical Implementation

### **Native Tauri Structure**

```
desktop/src-tauri/src/
├── main.rs                    # Application entry point
├── lib.rs                     # Core application logic
├── commands/                  # Tauri command implementations
│   ├── server.rs             # Server management commands
│   ├── sessions.rs           # Session management commands
│   ├── tunnels.rs            # Tunnel integration commands
│   ├── power.rs              # Power management commands
│   └── settings.rs           # Settings management commands
├── services/                 # Service implementations
│   ├── power_manager.rs      # Power management service
│   ├── tunnel_manager.rs     # Tunnel management service
│   ├── session_manager.rs    # Session management service
│   └── git_monitor.rs        # Git monitoring service
├── ui/                       # Native UI components
│   ├── main_window.rs        # Main application window
│   ├── settings_window.rs    # Settings window
│   ├── session_window.rs     # Session management window
│   └── tray.rs               # System tray implementation
└── platform/                 # Platform-specific implementations
    ├── macos.rs              # macOS-specific features
    ├── windows.rs            # Windows-specific features
    └── linux.rs              # Linux-specific features
```

### **Key Implementation Patterns**

#### Native Server Integration
```rust
// Direct API integration with Go server
#[tauri::command]
async fn create_session(command: Vec<String>, name: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .post("http://localhost:4021/api/sessions")
        .json(&serde_json::json!({
            "command": command,
            "name": name
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    let session: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    Ok(session["sessionId"].as_str().unwrap_or("").to_string())
}
```

#### Native Power Management
```rust
// Cross-platform power management
pub struct PowerManager {
    // Platform-specific implementations
}

impl PowerManager {
    #[cfg(target_os = "macos")]
    pub fn prevent_sleep(&self) -> Result<(), String> {
        // macOS IOKit power assertions
        Ok(())
    }
    
    #[cfg(target_os = "windows")]
    pub fn prevent_sleep(&self) -> Result<(), String> {
        // Windows SetThreadExecutionState
        Ok(())
    }
    
    #[cfg(target_os = "linux")]
    pub fn prevent_sleep(&self) -> Result<(), String> {
        // Linux systemd-inhibit
        Ok(())
    }
}
```

#### Native Tunnel Integration
```rust
// Native tunnel service implementation
pub struct TunnelService {
    // Tunnel management logic
}

impl TunnelService {
    pub async fn start_cloudflare_tunnel(&self, port: u16) -> Result<String, String> {
        // Direct cloudflared integration
        Ok("tunnel-url".to_string())
    }
    
    pub async fn start_ngrok_tunnel(&self, port: u16) -> Result<String, String> {
        // Direct ngrok integration
        Ok("tunnel-url".to_string())
    }
}
```

## Migration Strategy

### **Step 1: Backup Current Implementation**
```bash
# Backup current (incorrect) implementation
cd desktop/src-tauri
cp -r src src.backup
cp tauri.conf.json tauri.conf.json.backup
```

### **Step 2: Clean Slate Approach**
```bash
# Remove web wrapper files
cd desktop
rm index.html
rm debug.html
rm test.html
rm serve-dev.js

# Clean Tauri configuration
cd src-tauri
# Remove web-based configuration
```

### **Step 3: Native Implementation**
```bash
# Create new native structure
cd desktop/src-tauri/src
# Implement native UI components
# Implement native service integrations
# Remove web wrapper dependencies
```

## Testing Strategy

### **Native Testing Approach**
- **Unit Tests**: Test individual service implementations
- **Integration Tests**: Test Tauri command integration
- **E2E Tests**: Test complete user workflows
- **Cross-Platform Tests**: Validate on Windows, Linux, macOS

### **Performance Benchmarks**
- **Startup Time**: <3 seconds on all platforms
- **Memory Usage**: <100MB for typical usage
- **CPU Usage**: Minimal impact on system performance
- **Network Performance**: Efficient API communication

## Risk Analysis

### **HIGH RISK** (Requires Immediate Attention)

**Architecture Restructure** ❌ **CRITICAL**
- *Current Risk*: Implementation based on incorrect web wrapper approach
- *Required Action*: Complete restructure to native Tauri implementation
- *Timeline Impact*: 1-2 weeks to correct architecture
- *Mitigation*: Clean slate approach with native-first design

### **MEDIUM RISK**

**Service Implementation Complexity**
- *Risk*: Implementing 41 different services is complex
- *Mitigation*: Systematic implementation in priority order
- *Timeline Impact*: May require additional development time

**Cross-Platform Compatibility**
- *Risk*: Native services may behave differently across platforms
- *Mitigation*: Platform-specific implementations with common interfaces
- *Timeline Impact*: Additional testing cycles may be required

## Success Metrics

### **Technical Metrics**
- **Architecture Correctness**: Native Tauri implementation (not web wrapper)
- **Service Completeness**: All 41 original Mac app services implemented
- **Platform Coverage**: Windows, Linux, macOS all supported
- **Performance**: Within 10% of native SwiftUI performance

### **User Experience Metrics**
- **Native Feel**: App behaves like native desktop application
- **Feature Complete**: All original VibeTunnel functionality available
- **Cross-Platform Consistency**: Consistent experience across platforms
- **Reliability**: Stable operation with all services working

## Immediate Next Steps

### **Week 1: Architecture Correction**
1. **Backup Current Implementation**
   ```bash
   # Save current work before restructuring
   cd desktop/src-tauri
   cp -r src src.backup
   cp tauri.conf.json tauri.conf.json.backup
   ```

2. **Remove Web Wrapper Dependencies**
   ```bash
   # Remove HTML/JS web interface
   cd desktop
   rm index.html debug.html test.html serve-dev.js
   ```

3. **Create Native Tauri Structure**
   ```bash
   # Implement native UI components
   # Direct Go server integration
   # Native service implementations
   ```

### **Week 2: Core Implementation**
1. **Native UI Components**
   - Main application window
   - Settings interface
   - Session management UI
   - System tray implementation

2. **Core Services**
   - Server management
   - Session management
   - Configuration management
   - Power management

3. **Integration Testing**
   - Direct Go server communication
   - Native UI functionality
   - Cross-platform compatibility

### **Dependencies for Success**
- **Clean Architecture**: Native Tauri implementation approach
- **Go Server Integration**: Direct API communication (already working)
- **Development Resources**: Rust expertise for native implementation
- **Testing Infrastructure**: Multi-platform testing environment

## Conclusion

**The current implementation must be completely restructured.** The web wrapper approach is fundamentally wrong for what we want to achieve.

**Goal**: Create a native Tauri application that directly implements all 41 services from the original VibeTunnel Mac app.

**Approach**: Clean slate implementation with native UI components and direct Go server integration.

**Timeline**: 6-8 weeks for complete native implementation with all features.

**Success Criteria**: Native desktop application that provides all original VibeTunnel functionality across Windows, Linux, and macOS.

---

*Created: 2025-01-27*  
*Status: REQUIRES COMPLETE RESTRUCTURE*
