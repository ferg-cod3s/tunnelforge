# Phase 4 Testing Plan - Cross-Platform Validation & Tauri Integration

**Objective**: Validate TunnelForge desktop apps (Windows, macOS, Linux) with Tauri integration and verify access mode switching through UI.

**Duration**: 2-3 weeks  
**Prerequisites**: Phase 3 tests passed ✅  
**Status**: Ready to execute

---

## Overview

Phase 4 focuses on end-to-end testing of the Tauri desktop applications across all three platforms, with emphasis on:
1. Server startup within Tauri environment
2. Network binding based on UI-selected access mode
3. Configuration persistence
4. Access mode switching UI functionality
5. Cross-platform consistency

---

## Phase 4.1: Linux Tauri Desktop App Testing

### Prerequisites
- Tauri v2 dependencies installed
- Go 1.21+ and Rust 1.70+ available
- Node.js/Bun for frontend builds

### Build Steps
```bash
cd /home/f3rg/src/github/tunnelforge/desktop
npm install  # or bun install
npm run tauri build  # Build desktop app
```

### Test Procedure

#### 4.1.1 Application Startup Test
- [ ] Launch built Tauri app
- [ ] Verify window opens with UI
- [ ] Check system tray integration (if enabled)
- [ ] Verify server process starts in background
- [ ] Monitor for startup errors in console

#### 4.1.2 LocalhostOnly Mode Test (Default)
- [ ] Verify default access mode is "LocalhostOnly"
- [ ] Check UI displays correct mode
- [ ] Verify `~/.config/tunnelforge/config.json` has correct setting
- [ ] Run `ss -tlnp | grep 4021` → should show `127.0.0.1:4021`
- [ ] Test curl to localhost succeeds
- [ ] Test curl from external host fails

#### 4.1.3 NetworkAccess Mode via UI
- [ ] Click "Allow Network Access" toggle in settings
- [ ] Verify toggle state changes in UI
- [ ] Verify config file updated to "NetworkAccess"
- [ ] Server should restart automatically
- [ ] Run `ss -tlnp | grep 4021` → should show `*:4021`
- [ ] Test curl from external host succeeds
- [ ] Test curl from localhost still succeeds

#### 4.1.4 Rapid Toggle Test (UI-based)
- [ ] Toggle access mode 5 times rapidly via UI
- [ ] Monitor for crashes, hangs, or errors
- [ ] Verify binding changes each time
- [ ] Check server logs for errors
- [ ] Verify no socket leaks

#### 4.1.5 Settings Persistence Test
- [ ] Set access mode to NetworkAccess
- [ ] Close application
- [ ] Reopen application
- [ ] Verify access mode persists
- [ ] Check config file unchanged
- [ ] Verify server started with correct binding

### Success Criteria
- [ ] App starts and UI displays correctly
- [ ] Access mode settings work via UI
- [ ] Server bindings update correctly with access mode
- [ ] Settings persist across app restarts
- [ ] No crashes or hangs during testing

---

## Phase 4.2: Windows Tauri Desktop App Testing

### Prerequisites
- Windows 10/11 with latest updates
- Visual Studio Build Tools or MSVC installed
- Rust and Go installed

### Build Steps
```bash
cd windows\src-tauri
npm install
npm run tauri build
# Creates MSI installer in src-tauri\target\release
```

### Test Procedure

#### 4.2.1 Installation Test
- [ ] Run MSI installer as standard user
- [ ] Verify installation completes without errors
- [ ] Check application installed to Program Files
- [ ] Verify Start Menu shortcuts created
- [ ] Verify Windows Services integration (if configured)

#### 4.2.2 Application Startup Test
- [ ] Launch from Start Menu
- [ ] Verify window opens with UI
- [ ] Check Windows Notification area tray icon
- [ ] Verify background server process starts
- [ ] Monitor Performance Monitor for resource usage

#### 4.2.3 LocalhostOnly Mode Test
- [ ] Verify default access mode is "LocalhostOnly"
- [ ] Use `netstat -ano | findstr 4021` to check binding
- [ ] Should show `127.0.0.1:4021` LISTENING
- [ ] Test with `curl http://127.0.0.1:4021/health` (using Git Bash or WSL)
- [ ] Verify localhost connection succeeds

#### 4.2.4 NetworkAccess Mode via UI
- [ ] Toggle "Allow Network Access" in UI
- [ ] Verify config updated (check user config folder)
- [ ] Use `netstat -ano | findstr 4021`
- [ ] Should show `0.0.0.0:4021` or `*:4021` LISTENING
- [ ] Test with `curl http://<machine-ip>:4021/health`
- [ ] Verify network connection succeeds

#### 4.2.5 Windows Service Integration (if implemented)
- [ ] Check if TunnelForge service is installed
- [ ] Verify service starts on boot
- [ ] Test stopping/starting service
- [ ] Verify bindings update correctly

### Success Criteria
- [ ] MSI installer works correctly
- [ ] App launches and UI displays
- [ ] Access mode switching works via UI
- [ ] Bindings update correctly per access mode
- [ ] No Windows-specific errors or crashes

---

## Phase 4.3: macOS Tauri Desktop App Testing

### Prerequisites
- macOS 10.13+ with latest updates
- Xcode Command Line Tools installed
- Rust and Go installed
- Apple Developer certificate (for code signing, optional for testing)

### Build Steps
```bash
cd mac/
npm install
npm run tauri build
# Creates app bundle in target/release/bundle
```

### Test Procedure

#### 4.3.1 Application Launch Test
- [ ] Run `open target/release/bundle/macos/TunnelForge.app`
- [ ] Verify app launches without security warnings
- [ ] Check menu bar icon appears
- [ ] Verify Dock icon shows when focused

#### 4.3.2 Permissions Test (macOS)
- [ ] Check if permission dialogs appear
- [ ] Grant necessary permissions (network, notifications, etc.)
- [ ] Verify permissions persist

#### 4.3.3 LocalhostOnly Mode Test
- [ ] Default should be LocalhostOnly
- [ ] Use `lsof -i :4021` to check binding
- [ ] Should show `127.0.0.1` binding
- [ ] Test with `curl http://127.0.0.1:4021/health`
- [ ] Verify localhost access works

#### 4.3.4 NetworkAccess Mode via UI
- [ ] Toggle access mode via settings
- [ ] Verify UI update reflects change
- [ ] Use `lsof -i :4021` to verify binding change
- [ ] Should show wildcard or all-interfaces binding
- [ ] Test with `curl http://<machine-ip>:4021/health`
- [ ] Verify network access works

#### 4.3.5 Launch Agent Test (if implemented)
- [ ] Verify TunnelForge.plist exists in ~/Library/LaunchAgents/
- [ ] Test enabling auto-start
- [ ] Restart Mac and verify app launches automatically
- [ ] Test disabling auto-start

### Success Criteria
- [ ] App launches without errors or warnings
- [ ] macOS permissions handled correctly
- [ ] Access mode switching works correctly
- [ ] Bindings update appropriately
- [ ] Launch agent integration works (if applicable)

---

## Phase 4.4: Cross-Platform Consistency Testing

### UI Functionality Tests
- [ ] All platforms have identical access mode UI controls
- [ ] Settings screen layout is consistent
- [ ] Default values match across platforms
- [ ] Error messages are consistent

### Configuration Format Tests
- [ ] Config file format identical on all platforms
- [ ] Config stored in platform-specific location
  - Linux: `~/.config/tunnelforge/config.json`
  - Windows: `%APPDATA%\tunnelforge\config.json`
  - macOS: `~/Library/Application Support/tunnelforge/config.json`
- [ ] Config values match between UI and file

### Server Binding Tests
- [ ] Same binding logic applies to all platforms
- [ ] Performance characteristics similar
- [ ] No platform-specific gotchas or edge cases

### Stress Testing
- [ ] Rapid access mode switching (10+ times per minute)
- [ ] Sustained operation (8+ hours without restart)
- [ ] Memory usage remains stable over time
- [ ] No resource leaks detected

---

## Phase 4.5: Integration Testing

### End-to-End Workflows

#### Workflow 1: Fresh Installation → Local Development
1. Install TunnelForge on fresh system
2. Launch app
3. Verify default LocalhostOnly mode
4. Create terminal session via UI
5. Verify session accessible at localhost:4021

#### Workflow 2: Switch to Network → Share with Team
1. Launch TunnelForge with existing config
2. Toggle to NetworkAccess mode
3. Verify binding changes
4. Share machine IP with team member
5. Verify they can access terminal from external machine

#### Workflow 3: Network → Local (Security Toggle)
1. Running in NetworkAccess mode with team member connected
2. Toggle back to LocalhostOnly mode
3. Verify team member connection drops
4. Verify only localhost access works

---

## Phase 4.6: Error Handling & Edge Cases

### Error Scenarios
- [ ] Port 4021 already in use → graceful handling
- [ ] Config file corrupted → proper recovery or reset
- [ ] Network interface disappears → connection timeout handling
- [ ] Permission denied on config directory → fallback or error message
- [ ] Server process crashes → auto-restart or user notification

### Edge Cases
- [ ] User has no internet connection → LocalhostOnly still works
- [ ] User switches networks → binding verified correct
- [ ] Multiple TunnelForge instances running → second instance handles gracefully
- [ ] Config file manually edited while app running → app reflects changes on restart

---

## Test Report Template

Each phase should produce a report including:
1. **Platform Information**
   - OS version
   - Architecture
   - Tauri version

2. **Test Results**
   - Startup status
   - Access mode switching results
   - Network binding verification
   - UI functionality

3. **Performance Metrics**
   - Startup time
   - Memory usage
   - CPU usage

4. **Issues Found**
   - Severity level
   - Steps to reproduce
   - Workaround (if available)

5. **Recommendations**
   - Critical fixes needed
   - Nice-to-have improvements
   - Platform-specific considerations

---

## Success Criteria - Phase 4 Complete

All of the following must be true:
- [ ] Linux Tauri app builds and runs successfully
- [ ] Windows Tauri app builds and runs successfully
- [ ] macOS Tauri app builds and runs successfully
- [ ] Access mode switching works via UI on all platforms
- [ ] Network bindings update correctly on all platforms
- [ ] Configuration persists across app restarts
- [ ] No critical crashes or hangs
- [ ] Cross-platform consistency verified
- [ ] Integration tests pass
- [ ] Error handling verified

---

## Next Steps (Phase 5)

After Phase 4 completion:
1. Multi-user and concurrency testing
2. Load testing with multiple sessions
3. Production hardening
4. Security validation
5. Performance optimization
6. Beta release preparation

---

**Document Created**: 2025-10-17  
**Status**: Ready for Phase 4 Execution  
**Estimated Effort**: 2-3 weeks for complete cross-platform testing
