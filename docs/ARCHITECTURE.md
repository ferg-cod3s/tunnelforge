# TunnelForge Architecture
*Updated 2025-01-27 - Architecture Correction Required*

> **🔄 ARCHITECTURE CORRECTION REQUIRED**: The current Tauri implementation approach is fundamentally incorrect. TunnelForge should be a **native Tauri application** that directly implements all the functionality of the original VibeTunnel Mac app, not a wrapper around a web interface.

## Current Status (Updated 2025-01-27)

**✅ PRODUCTION READY**:
- **Go server backend** - High-performance terminal management (Port 4021) - Production ready
- **SwiftUI macOS app** - Feature-complete native macOS application

**❌ REQUIRES COMPLETE RESTRUCTURE**:
- **Tauri v2 desktop apps** - Current implementation is wrong (web wrapper instead of native)

**⚠️ LEGACY (DEPRECATED)**:
- **Node.js server** - Original implementation (Port 4020) - Still functional

## Architecture Correction Required

### ❌ **CURRENT (INCORRECT) APPROACH**
```
┌─────────────────┐    ┌──────────────────┐    ┌────────────────┐
│   Tauri v2      │    │   Bun Frontend    │    │   Go Server    │
│   Desktop       │◄──►│   (Port 3001)     │◄──►│   (Port 4021)  │
│   (Web Wrapper)  │    │   Static + Proxy  │    │   API + WS     │
└─────────────────┘    └──────────────────┘    └────────────────┘
```

### ✅ **CORRECT APPROACH**
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

## Key Differences

### **Architecture Philosophy**
- **❌ WRONG**: Tauri app wraps web interface
- **✅ CORRECT**: Tauri app IS the native application

### **User Interface**
- **❌ WRONG**: HTML/JS web interface loaded in Tauri WebView
- **✅ CORRECT**: Native Tauri UI components with direct API integration

### **Service Implementation**
- **❌ WRONG**: None of the 41 original Mac app services implemented
- **✅ CORRECT**: All 41 original Mac app services implemented natively

### **Integration Pattern**
- **❌ WRONG**: Tauri → Web Frontend → Go Server
- **✅ CORRECT**: Tauri → Go Server (direct integration)

## Component Status

### **1. Go Server Backend** ✅ PRODUCTION READY
**Location**: `server/` directory  
**Port**: 4021  
**Status**: Production-ready with comprehensive testing

**Implemented Features**:
- `server/cmd/server/main.go` - Server entry point with graceful shutdown  
- `server/internal/server/server.go` - HTTP server with routing
- `server/internal/session/manager.go` - Thread-safe terminal session management
- `server/internal/terminal/` - PTY process management
- `server/internal/websocket/` - WebSocket communication
- `server/internal/auth/` - JWT authentication and CSRF protection
- `server/internal/files/` - File system operations
- `server/internal/git/` - Git integration
- `server/internal/notifications/` - Push notification system

**API Endpoints**:
- `POST /api/sessions` - Create new terminal session
- `GET /api/sessions` - List active sessions
- `GET /api/sessions/:id` - Get session details
- `DELETE /api/sessions/:id` - Terminate session
- `WebSocket /ws/sessions/:id` - Real-time terminal I/O

### **2. SwiftUI macOS App** ✅ PRODUCTION READY
**Location**: `mac/TunnelForge/` directory
**Status**: Feature-complete native macOS application

**Implemented Services (41 total)**:
- **Core Services**: ServerManager, SessionService, TerminalManager, NotificationService, ConfigManager
- **Advanced Services**: PowerManagementService, NgrokService, TailscaleService, CloudflareService, GitRepositoryMonitor, WorktreeService, NetworkMonitor, RemoteServicesStatusManager, SystemPermissionManager, SparkleUpdaterManager
- **UI Components**: 32 different views including SettingsView, SessionDetailView, WelcomeView, AboutView

### **3. Tauri v2 Desktop Apps** ❌ REQUIRES COMPLETE RESTRUCTURE
**Location**: `desktop/`, `windows/`, `linux/` directories
**Status**: Current implementation is fundamentally wrong

**Current Problems**:
- ❌ **Wrong Architecture**: Implemented as web wrapper instead of native app
- ❌ **Missing Services**: None of the 41 original Mac app services implemented
- ❌ **Web Dependency**: Loads HTML/JS interface instead of native UI
- ❌ **Poor Integration**: Tries to manage server process instead of direct API integration

**Required Changes**:
- ✅ **Remove Web Wrapper**: Delete HTML files and web-based configuration
- ✅ **Native UI Components**: Create native Tauri UI framework
- ✅ **Direct Server Integration**: API calls directly to Go server (port 4021)
- ✅ **Service Implementation**: Implement all 41 original Mac app services natively
- ✅ **System Integration**: Native system tray, notifications, power management

## Implementation Plan

### **Phase 1: Architecture Restructure** (1-2 weeks)
1. **Remove Web Wrapper Dependencies**
   - Delete `desktop/index.html`, `debug.html`, `test.html`
   - Remove web-based configuration from `tauri.conf.json`
   - Clean up web wrapper approach

2. **Create Native Tauri Structure**
   - Implement native UI components
   - Direct Go server API integration
   - Native system tray and notifications
   - Cross-platform settings management

### **Phase 2: Service Implementation** (4-6 weeks)
1. **Core Services Implementation**
   - ServerManager: Native server lifecycle management
   - SessionService: Terminal session management
   - TerminalManager: Terminal control and I/O
   - NotificationService: System notifications
   - ConfigManager: Configuration management

2. **Advanced Services Implementation**
   - PowerManagementService: Sleep prevention (macOS IOKit, Windows SetThreadExecutionState, Linux systemd-inhibit)
   - NgrokService: Ngrok tunnel integration
   - TailscaleService: Tailscale integration
   - CloudflareService: Cloudflare tunnel support
   - GitRepositoryMonitor: Git repository monitoring
   - WorktreeService: Git worktree management
   - NetworkMonitor: Network status monitoring
   - RemoteServicesStatusManager: Remote service status
   - SystemPermissionManager: System permissions
   - SparkleUpdaterManager: Auto-updates

3. **UI Components Implementation (32 Views)**
   - SettingsView: Main settings interface
   - SessionDetailView: Session details
   - WelcomeView: Onboarding experience
   - AboutView: About dialog
   - Multiple settings sections and components

### **Phase 3: Testing & Distribution** (2-3 weeks)
1. **Cross-Platform Testing**
   - Comprehensive testing on Windows 10/11, Ubuntu/Fedora/Arch Linux, macOS
   - Performance benchmarking across all platforms
   - Memory usage and startup time validation
   - System integration testing

2. **Package Creation & Signing**
   - Windows: MSI and NSIS installer creation with code signing
   - Linux: AppImage, .deb, .rpm package generation
   - macOS: DMG creation with notarization

## Technical Implementation

### **Native Tauri Command Pattern**
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

#[tauri::command]
async fn list_sessions() -> Result<Vec<SessionInfo>, String> {
    let client = reqwest::Client::new();
    let response = client
        .get("http://localhost:4021/api/sessions")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    response.json().await.map_err(|e| e.to_string())
}
```

### **Native Service Implementation**
```rust
// Cross-platform power management
pub struct PowerManager;

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

## Migration Strategy

### **Step 1: Backup Current Implementation**
```bash
cd desktop/src-tauri
cp -r src src.backup
cp tauri.conf.json tauri.conf.json.backup
```

### **Step 2: Remove Web Wrapper Dependencies**
```bash
cd desktop
rm index.html debug.html test.html serve-dev.js
# Update tauri.conf.json to remove web dependencies
```

### **Step 3: Implement Native Tauri Application**
```bash
cd desktop/src-tauri/src
# Create native UI components
# Implement direct Go server integration
# Add all 41 Mac app services
```

## Testing Strategy

### **Native Testing Approach**
- **Unit Tests**: Test individual service implementations
- **Integration Tests**: Test Tauri command integration with Go server
- **E2E Tests**: Test complete user workflows
- **Cross-Platform Tests**: Validate on Windows, Linux, macOS

### **Performance Benchmarks**
- **Startup Time**: <3 seconds on all platforms
- **Memory Usage**: <100MB for typical usage
- **CPU Usage**: Minimal impact on system performance
- **Network Performance**: Efficient API communication with Go server

## Risk Analysis

### **HIGH RISK** (Requires Immediate Attention)
**Architecture Misunderstanding** ❌ **CRITICAL**
- *Current Risk*: Implementation based on incorrect web wrapper approach
- *Required Action*: Complete restructure to native Tauri implementation
- *Timeline Impact*: 1-2 weeks to correct architecture
- *Mitigation*: Clean slate approach with native-first design

### **MEDIUM RISK**
**Service Implementation Complexity**
- *Risk*: Implementing 41 different services is complex
- *Mitigation*: Systematic implementation in priority order
- *Timeline Impact*: May require additional development time

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

## Conclusion

**The current Tauri implementation approach is fundamentally incorrect.** TunnelForge should be a native Tauri application that directly implements all the functionality of the original VibeTunnel Mac app, not a wrapper around a web interface.

**Goal**: Create native desktop applications for Windows, Linux, and macOS that provide all 41 services from the original Mac app.

**Approach**: Complete restructure from web wrapper to native implementation with direct Go server integration.

**Timeline**: 6-8 weeks for complete native implementation.

**Success Criteria**: Native desktop application that provides all original VibeTunnel functionality across all platforms.

---

*Last Updated: 2025-01-27*  
*Architecture Status: REQUIRES COMPLETE RESTRUCTURE*
