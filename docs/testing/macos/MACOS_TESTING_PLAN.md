# TunnelForge macOS Testing Plan

## Overview

This document outlines the comprehensive testing strategy for TunnelForge on macOS platforms. The macOS implementation is built with Tauri v2 and provides native macOS integration features including system tray, notifications, launch agents, and professional DMG packaging.

## Current Implementation Status

### ✅ Completed Features

**Core Functionality:**
- Tauri v2 application structure with Rust backend
- Go server process management and lifecycle
- WebSocket integration for real-time terminal sessions
- System tray integration with NSStatusBar
- macOS Launch Services integration
- Native macOS notifications via NSUserNotificationCenter
- Professional DMG packaging with create-dmg
- Code signing and notarization support
- Sparkle framework integration for auto-updates

**Build System:**
- Cross-platform Tauri configuration
- DMG creation with custom backgrounds and layouts
- Code signing with Developer ID certificates
- Apple notarization service integration
- Automated build pipeline configuration
- Gatekeeper compatibility

### 🚧 Implementation Notes

**macOS-Specific Features:**
- Launch agent integration (`~/Library/LaunchAgents/`)
- NSStatusBar system tray integration
- NSUserNotificationCenter notifications
- macOS accessibility permissions
- AppleScript support for automation
- Keychain integration for secure storage
- Dock icon management
- Full-screen and window management

**Build Configuration:**
- Target macOS versions: 12.0+ (Monterey and later)
- Architectures: x64 and Apple Silicon (ARM64)
- Package format: DMG with notarization
- Code signing: Developer ID Application certificate
- Notarization: Apple Notary Service integration

## Testing Environment Requirements

### Hardware Requirements
- **Minimum**: macOS 12.0+, 8GB RAM, 5GB free disk space
- **Recommended**: macOS 14.0+, 16GB RAM, 10GB free disk space
- **Test Machines**: Multiple configurations for comprehensive testing

### Software Requirements
- **Operating Systems**: macOS 12.0+ (Monterey), 13.0+ (Ventura), 14.0+ (Sonoma), 15.0+ (Sequoia)
- **Development Tools**: Xcode 14+, Command Line Tools
- **Security**: Valid Apple Developer ID certificates for signing
- **Testing Tools**: macOS Console, Activity Monitor, System Information

### Test Environment Setup

#### Development Environment
```bash
# Install Xcode Command Line Tools
xcode-select --install

# Install system dependencies
# WebKit2, GTK, and other dependencies handled by Tauri

# Install Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add x86_64-apple-darwin
rustup target add aarch64-apple-darwin

# Install Tauri CLI
cargo install tauri-cli
```

#### Test Environment Matrix
| Environment | macOS Version | Architecture | Configuration |
|-------------|---------------|--------------|---------------|
| **Desktop 1** | macOS 12.7 (Monterey) | Intel x64 | Standard user, no admin rights |
| **Desktop 2** | macOS 13.6 (Ventura) | Intel x64 | Admin user, enterprise environment |
| **Desktop 3** | macOS 14.6 (Sonoma) | Apple Silicon | Standard user, personal use |
| **Desktop 4** | macOS 15.0 (Sequoia) | Apple Silicon | Developer environment |
| **Desktop 5** | macOS 13.6 (Ventura) | Apple Silicon | Mixed architecture testing |
| **Server 1** | macOS 14.0+ (Sonoma) | Apple Silicon | Server environment |

## Comprehensive Test Plan

### Phase 1: Installation Testing (Day 1)

#### 1.1 DMG Installation Testing
**Objective**: Verify DMG installer functionality across different macOS versions

**Test Scenarios:**
- [ ] Clean installation on macOS 12.7+ (Monterey)
- [ ] Clean installation on macOS 13.6+ (Ventura)
- [ ] Clean installation on macOS 14.6+ (Sonoma)
- [ ] Clean installation on macOS 15.0+ (Sequoia)
- [ ] Upgrade installation from previous version
- [ ] Drag-and-drop installation from DMG
- [ ] Installation verification (files, Launch Services)
- [ ] Gatekeeper compatibility testing
- [ ] Quarantine attribute removal
- [ ] Complete uninstallation

**Success Criteria:**
- DMG opens correctly and displays application
- Drag-and-drop installation works smoothly
- Gatekeeper allows execution after notarization
- All files installed to correct locations
- Application launches after installation
- Uninstallation removes all components

#### 1.2 Code Signing and Notarization Testing
**Objective**: Verify Apple security integration

**Test Scenarios:**
- [ ] Application code signature validation
- [ ] Gatekeeper compatibility
- [ ] Quarantine attribute handling
- [ ] Notarization ticket validation
- [ ] Developer ID verification
- [ ] Hardened runtime compatibility
- [ ] Library validation
- [ ] Entitlements verification

**Success Criteria:**
- Code signature validates correctly
- Gatekeeper allows execution without warnings
- Notarization ticket is valid and current
- No security policy violations
- Hardened runtime functions properly

### Phase 2: Core Functionality Testing (Day 1)

#### 2.1 Application Launch Testing
**Objective**: Verify application startup and initialization

**Test Scenarios:**
- [ ] First-time launch (initial setup)
- [ ] Normal application launch
- [ ] Launch with existing configuration
- [ ] Launch after system reboot
- [ ] Launch as different user types
- [ ] Launch with command line arguments
- [ ] Startup time measurement (< 3 seconds target)
- [ ] Dock icon appearance and behavior
- [ ] Menu bar integration

**Success Criteria:**
- Application launches within target time
- Main window appears correctly
- System tray icon appears in menu bar
- No startup crashes or errors
- Configuration loads properly
- Dock integration works correctly

#### 2.2 System Tray Integration Testing
**Objective**: Verify menu bar functionality

**Test Scenarios:**
- [ ] Menu bar icon appearance
- [ ] Menu bar icon behavior (click to toggle)
- [ ] Context menu functionality
- [ ] Menu item actions (Open, New Session, Settings, etc.)
- [ ] Server status display in menu
- [ ] Copy URL functionality
- [ ] Quit/exit functionality
- [ ] Menu bar persistence across restarts
- [ ] Multiple display compatibility

**Success Criteria:**
- Menu bar icon displays correctly
- All menu items function properly
- Server status updates in real-time
- No menu-related crashes
- Proper cleanup on application exit
- Works correctly with multiple displays

#### 2.3 Server Management Testing
**Objective**: Verify Go server lifecycle management

**Test Scenarios:**
- [ ] Server startup on application launch
- [ ] Server health monitoring
- [ ] Server restart functionality
- [ ] Server shutdown on application exit
- [ ] Server status display in UI
- [ ] Server logs accessibility
- [ ] Server port configuration (default: 4021)
- [ ] Multiple server instances prevention
- [ ] Server process management

**Success Criteria:**
- Server starts automatically
- Health checks work correctly
- No port conflicts or binding issues
- Proper process cleanup on exit
- Server logs accessible and informative

### Phase 3: macOS Integration Testing (Day 2)

#### 3.1 Launch Agent Testing
**Objective**: Verify Launch Services integration

**Test Scenarios:**
- [ ] Launch agent installation
- [ ] Launch agent configuration
- [ ] Auto-start functionality
- [ ] Login item registration
- [ ] Launch agent permissions
- [ ] Launch agent debugging
- [ ] Multi-user compatibility
- [ ] System restart behavior

**Success Criteria:**
- Launch agent installs correctly
- Auto-start works as configured
- No permission issues
- Compatible with different user accounts
- Proper cleanup when disabled

#### 3.2 Notification System Testing
**Objective**: Verify native macOS notification system

**Test Scenarios:**
- [ ] Server status change notifications
- [ ] Session creation notifications
- [ ] Error and warning notifications
- [ ] Notification Center integration
- [ ] Notification permissions
- [ ] Notification settings and preferences
- [ ] Multiple notification handling
- [ ] Notification sound and visual feedback

**Success Criteria:**
- Notifications appear in Notification Center
- Notification content displays correctly
- No notification-related crashes
- User can control notification settings
- Proper integration with macOS notification system

#### 3.3 Accessibility and Permissions Testing
**Objective**: Verify macOS security and accessibility integration

**Test Scenarios:**
- [ ] Accessibility permissions
- [ ] Screen recording permissions
- [ ] Automation permissions
- [ ] Keychain access permissions
- [ ] File system permissions
- [ ] Network permissions
- [ ] Permission request dialogs
- [ ] Graceful handling of denied permissions

**Success Criteria:**
- Permission requests work correctly
- Graceful degradation when permissions denied
- No crashes related to permissions
- Proper user feedback for permission issues
- Compatible with macOS security model

### Phase 4: Performance and Stability Testing (Day 2)

#### 4.1 Memory Usage Testing
**Objective**: Verify memory usage meets targets

**Test Scenarios:**
- [ ] Baseline memory usage (target: < 100MB)
- [ ] Memory usage with 10 concurrent sessions
- [ ] Memory usage with 50 concurrent sessions
- [ ] Memory usage with 100 concurrent sessions
- [ ] Memory leak detection (long-running test)
- [ ] Memory usage across different macOS versions
- [ ] Memory usage on Intel vs Apple Silicon

**Success Criteria:**
- Memory usage within specified limits
- No memory leaks detected
- Stable memory usage over time
- Performance consistent across macOS versions
- Optimized for both Intel and Apple Silicon

#### 4.2 Startup Time Testing
**Objective**: Verify application startup performance

**Test Scenarios:**
- [ ] Cold start time measurement (target: < 2 seconds)
- [ ] Warm start time measurement (target: < 1 second)
- [ ] Server startup time (target: < 3 seconds)
- [ ] WebView initialization time
- [ ] Menu bar initialization time
- [ ] Time to interactive
- [ ] Startup time on Intel vs Apple Silicon
- [ ] Startup time across different macOS versions

**Success Criteria:**
- All startup times meet or exceed targets
- Consistent performance across reboots
- No startup failures or timeouts
- Optimized for both architectures
- Performance comparable across macOS versions

#### 4.3 Stability Testing
**Objective**: Verify application stability under various conditions

**Test Scenarios:**
- [ ] Long-running test (24+ hours)
- [ ] System sleep/wake cycle handling
- [ ] Network connectivity changes
- [ ] High CPU usage scenarios
- [ ] Low memory conditions
- [ ] Multiple user sessions
- [ ] Concurrent application instances
- [ ] Display arrangement changes
- [ ] System software updates

**Success Criteria:**
- No crashes or hangs during extended use
- Proper handling of system events
- Graceful degradation under resource pressure
- Clean recovery from error conditions
- Compatible with system updates

### Phase 5: Apple Silicon and Migration Testing (Day 2)

#### 5.1 Apple Silicon Testing
**Objective**: Comprehensive testing on Apple Silicon Macs

**Test Scenarios:**
- [ ] Native ARM64 performance
- [ ] Rosetta 2 compatibility (if needed)
- [ ] Universal binary functionality
- [ ] Apple Silicon-specific optimizations
- [ ] Memory management on Apple Silicon
- [ ] Graphics performance
- [ ] Power management
- [ ] Thermal performance

**Success Criteria:**
- Native performance on Apple Silicon
- Proper universal binary execution
- Optimized for Apple Silicon architecture
- No compatibility issues
- Efficient power and thermal management

#### 5.2 Migration Testing
**Objective**: Verify migration from SwiftUI to Tauri version

**Test Scenarios:**
- [ ] Feature parity with SwiftUI version
- [ ] Settings migration
- [ ] User data migration
- [ ] Configuration compatibility
- [ ] User experience comparison
- [ ] Performance comparison
- [ ] Stability comparison

**Success Criteria:**
- All features from SwiftUI version available
- Smooth migration path for users
- No data loss during migration
- Improved or equivalent performance
- Better or equivalent stability

## Build and Deployment Testing

### Build Verification
```bash
# Build for both architectures
cargo tauri build --target x86_64-apple-darwin
cargo tauri build --target aarch64-apple-darwin

# Create universal binary
lipo -create -output universal-binary target/x86_64-apple-darwin/release/bundle/dmg/TunnelForge.app/Contents/MacOS/tunnelforge target/aarch64-apple-darwin/release/bundle/dmg/TunnelForge.app/Contents/MacOS/tunnelforge

# Create DMG
npm run build:dmg
```

### DMG and Notarization Validation
- [ ] DMG file size check (< 100MB target)
- [ ] DMG layout and appearance
- [ ] Code signing verification
- [ ] Notarization ticket validation
- [ ] Gatekeeper compatibility
- [ ] Installation script testing
- [ ] Background image and layout
- [ ] EULA and licensing

## Troubleshooting and Issue Resolution

### Common Issues and Solutions

#### Installation Issues
- **Gatekeeper Blocks Installation**: Verify notarization, check Console.app
- **Permission Denied**: Check user privileges, verify disk permissions
- **Disk Space**: Ensure sufficient space for installation
- **Conflicting Installation**: Remove previous versions completely

#### Runtime Issues
- **Server Won't Start**: Check port availability, firewall settings, Console.app logs
- **Menu Bar Missing**: Check menu bar settings, restart system if needed
- **High Memory Usage**: Monitor with Activity Monitor, check for memory leaks
- **Slow Startup**: Profile with Instruments, optimize initialization

#### macOS-Specific Issues
- **Launch Agent Problems**: Check ~/Library/LaunchAgents/, verify permissions
- **Notification Issues**: Check System Settings > Notifications, verify permissions
- **Accessibility Problems**: Grant accessibility permissions in System Settings
- **Keychain Access**: Verify keychain permissions, check Keychain Access.app

### Debug Information Collection
```bash
# Application logs
tail -f ~/Library/Logs/TunnelForge/tunnelforge.log

# Console app logs
open /Applications/Utilities/Console.app

# System logs
log show --predicate 'process == "tunnelforge"' --info

# Process information
ps aux | grep tunnelforge

# Activity Monitor
open /Applications/Utilities/ActivityMonitor.app

# System Information
system_profiler SPSoftwareDataType SPHardwareDataType
```

## Success Metrics and Exit Criteria

### Technical Success Criteria
- [ ] DMG installation works on all target macOS versions
- [ ] Code signing and notarization successful
- [ ] Core functionality operates correctly on all platforms
- [ ] Performance meets or exceeds targets
- [ ] No critical or high-severity bugs found
- [ ] All automated tests pass
- [ ] Documentation is complete and accurate

### User Experience Criteria
- [ ] Installation process is smooth and intuitive
- [ ] Application integrates naturally with macOS
- [ ] All features work as expected
- [ ] Performance is acceptable for typical usage
- [ ] Error messages are clear and helpful
- [ ] Migration from SwiftUI version is seamless

### Apple Ecosystem Criteria
- [ ] Compatible with all target macOS versions
- [ ] Proper code signing and notarization
- [ ] Gatekeeper compatibility
- [ ] Native macOS integration
- [ ] Apple Silicon optimization
- [ ] Compatible with macOS security model

## Test Reporting and Documentation

### Daily Test Reports
- Test execution status and results
- Issues found and resolution status
- Performance metrics and benchmarks
- Screenshots and logs for significant issues

### Final Test Report
- Comprehensive test coverage summary
- Performance benchmarking results
- macOS compatibility matrix
- Known issues and workarounds
- Recommendations for production release

### Documentation Updates
- Installation guide for macOS
- Migration guide from SwiftUI version
- Troubleshooting guide updates
- Performance optimization recommendations
- Code signing and notarization documentation

## Next Steps After Testing

1. **Bug Fixes**: Address any critical issues found during testing
2. **Performance Optimization**: Implement performance improvements based on benchmarks
3. **Documentation Completion**: Finalize all macOS-specific documentation
4. **Build System Refinement**: Optimize build and packaging processes
5. **Migration Preparation**: Prepare migration path from SwiftUI version
6. **Beta Testing**: Conduct user testing with real users

---

**Testing Status**: Ready for execution in macOS environment  
**Estimated Duration**: 2 days for comprehensive testing  
**Risk Level**: Low - Implementation is mature and well-tested  
**Confidence Level**: High - Extensive testing plan covers all scenarios

This testing plan ensures TunnelForge provides a high-quality, native macOS experience that meets Apple's standards and user expectations.
