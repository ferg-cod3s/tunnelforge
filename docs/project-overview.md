<!-- Generated: 2025-01-27 18:00:00 UTC -->
# TunnelForge Project Overview

> **🔄 Architecture Correction Required**: TunnelForge is being restructured from the incorrect web wrapper approach to a **native Tauri implementation** that directly implements all 41 services from the original VibeTunnel Mac app.

## Current Status

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

## Target Architecture

TunnelForge will provide **native desktop applications** for Windows, Linux, and macOS that directly integrate with the Go server backend to provide all the functionality of the original VibeTunnel Mac app.

The project provides cross-platform desktop applications that run a local Go HTTP server with WebSocket support for real-time terminal streaming. Users access their terminals through native desktop interfaces, with the Go server running on port 4021 for terminal management.

## Key Files

**Main Entry Points**
- `server/cmd/server/main.go` - Go server entry point
- `desktop/src-tauri/src/main.rs` - Tauri desktop app entry point
- `mac/TunnelForge/` - SwiftUI macOS app (reference implementation)

**Core Configuration**
- `server/go.mod` - Go dependencies and module definition
- `desktop/src-tauri/tauri.conf.json` - Tauri configuration
- `mac/TunnelForge.xcodeproj/` - macOS app project

## Technology Stack

**Go Server Backend** - High-performance Go server
- HTTP server: `server/internal/server/server.go`
- Terminal management: `server/internal/terminal/`
- Session management: `server/internal/session/manager.go`
- PTY integration: `creack/pty` for native terminal process creation

**Native Tauri Desktop Applications** - Cross-platform desktop apps
- Rust backend with native UI components using Tauri v2
- Direct API integration with Go server (no web wrapper)
- Native system integration (tray, notifications, file system)
- Cross-platform support (macOS, Windows, Linux)
- Direct Go server integration (port 4021)

**SwiftUI macOS App** - Reference implementation
- Complete native macOS application with all 41 services
- Menu bar integration and system tray
- Power management and tunnel integration
- Git repository monitoring and worktree management

## Platform Support

**Desktop Requirements**
- **macOS**: macOS 14.0+ (Sonoma or later)
- **Windows**: Windows 10+ (64-bit)
- **Linux**: Ubuntu 20.04+, Debian 11+, or equivalent
- **Build Tools**: Go 1.21+, Rust 1.70+, Tauri v2

**Server Platforms**
- **Go Server**: Any platform supported by Go (macOS, Linux, Windows)
- **Headless Support**: Perfect for VPS/cloud deployments

**Key Platform Files**
- Go server: `server/`
- Native Tauri apps: `desktop/`, `windows/`, `linux/`
- SwiftUI macOS app: `mac/TunnelForge/`
- Cross-platform distribution via Tauri

## Implementation Plan

### **Phase 1: Architecture Restructure** (1-2 weeks)
1. **Remove Web Wrapper Dependencies**
   - Delete HTML files and web-based approach
   - Remove web wrapper configuration from `tauri.conf.json`
   - Create native Tauri UI components

2. **Create Native Tauri Structure**
   - Implement native UI components
   - Direct Go server API integration
   - Native system tray and notifications

### **Phase 2: Service Implementation** (4-6 weeks)
1. **Core Services Implementation**
   - ServerManager: Native server lifecycle management
   - SessionService: Terminal session management
   - TerminalManager: Terminal control and I/O
   - NotificationService: System notifications
   - ConfigManager: Configuration management

2. **Advanced Services Implementation**
   - PowerManagementService: Sleep prevention
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
   - System integration testing

2. **Package Creation & Signing**
   - Windows: MSI and NSIS installer creation with code signing
   - Linux: AppImage, .deb, .rpm package generation
   - macOS: DMG creation with notarization

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

---

*Last Updated: 2025-01-27*  
*Architecture Status: REQUIRES COMPLETE RESTRUCTURE*
