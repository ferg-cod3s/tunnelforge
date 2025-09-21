# macOS Testing Checklist

## Pre-Testing Setup
- [ ] Verify macOS test environment is ready
- [ ] Install all required dependencies
- [ ] Prepare test data and scenarios
- [ ] Set up logging and monitoring tools
- [ ] Create system backup (recommended)

## Installation Testing Checklist

### DMG Installation Tests
- [ ] Clean install on macOS 12.7+ (Monterey)
- [ ] Clean install on macOS 13.6+ (Ventura)
- [ ] Clean install on macOS 14.6+ (Sonoma)
- [ ] Clean install on macOS 15.0+ (Sequoia)
- [ ] Upgrade installation from previous version
- [ ] Drag-and-drop installation from DMG
- [ ] Installation verification (files, Launch Services)
- [ ] Gatekeeper compatibility testing
- [ ] Quarantine attribute removal
- [ ] Complete uninstallation

### Code Signing and Notarization Tests
- [ ] Application code signature validation
- [ ] Gatekeeper compatibility
- [ ] Quarantine attribute handling
- [ ] Notarization ticket validation
- [ ] Developer ID verification
- [ ] Hardened runtime compatibility
- [ ] Library validation
- [ ] Entitlements verification

## Core Functionality Testing Checklist

### Application Launch Tests
- [ ] First-time launch (initial setup)
- [ ] Normal application launch
- [ ] Launch with existing configuration
- [ ] Launch after system reboot
- [ ] Launch as different user types
- [ ] Launch with command line arguments
- [ ] Startup time measurement
- [ ] Dock icon appearance and behavior
- [ ] Menu bar integration

### System Tray Integration Tests
- [ ] Menu bar icon appearance
- [ ] Menu bar icon behavior (click to toggle)
- [ ] Context menu functionality
- [ ] Menu item actions (Open, New Session, Settings, etc.)
- [ ] Server status display in menu
- [ ] Copy URL functionality
- [ ] Quit/exit functionality
- [ ] Menu bar persistence across restarts
- [ ] Multiple display compatibility

### Server Management Tests
- [ ] Automatic server startup
- [ ] Server health monitoring
- [ ] Server restart functionality
- [ ] Server shutdown on application exit
- [ ] Server status UI updates
- [ ] Server logs accessibility
- [ ] Server port configuration (default 4021)
- [ ] Multiple instance prevention
- [ ] Server process management

## macOS Integration Testing Checklist

### Launch Agent Tests
- [ ] Launch agent installation
- [ ] Launch agent configuration
- [ ] Auto-start functionality
- [ ] Login item registration
- [ ] Launch agent permissions
- [ ] Launch agent debugging
- [ ] Multi-user compatibility
- [ ] System restart behavior

### Notification System Tests
- [ ] Server status change notifications
- [ ] Session event notifications
- [ ] Error/warning notifications
- [ ] Notification Center integration
- [ ] Notification permissions
- [ ] Notification settings and preferences
- [ ] Multiple notification handling
- [ ] Notification sound and visual feedback

### Accessibility and Permissions Tests
- [ ] Accessibility permissions
- [ ] Screen recording permissions
- [ ] Automation permissions
- [ ] Keychain access permissions
- [ ] File system permissions
- [ ] Network permissions
- [ ] Permission request dialogs
- [ ] Graceful handling of denied permissions

## Performance Testing Checklist

### Memory Usage Tests
- [ ] Baseline memory usage (< 100MB target)
- [ ] 10 concurrent sessions memory usage
- [ ] 50 concurrent sessions memory usage
- [ ] 100 concurrent sessions memory usage
- [ ] Memory leak detection (24h test)
- [ ] Memory usage across different macOS versions
- [ ] Memory usage on Intel vs Apple Silicon

### Startup Time Tests
- [ ] Cold start time (< 2s target)
- [ ] Warm start time (< 1s target)
- [ ] Server startup time (< 3s target)
- [ ] WebView initialization time
- ] Menu bar initialization time
- [ ] Time to interactive
- [ ] Startup time on Intel vs Apple Silicon
- [ ] Startup time across different macOS versions

### Stability Tests
- [ ] 24+ hour continuous operation
- [ ] System sleep/wake cycle handling
- [ ] Network connectivity changes
- [ ] High CPU usage scenarios
- [ ] Low memory conditions
- [ ] Multiple user sessions
- [ ] Concurrent application instances
- [ ] Display arrangement changes
- [ ] System software updates

## Apple Silicon and Migration Testing Checklist

### Apple Silicon Tests
- [ ] Native ARM64 performance
- [ ] Rosetta 2 compatibility (if needed)
- [ ] Universal binary functionality
- [ ] Apple Silicon-specific optimizations
- [ ] Memory management on Apple Silicon
- [ ] Graphics performance
- [ ] Power management
- [ ] Thermal performance

### Migration Tests
- [ ] Feature parity with SwiftUI version
- [ ] Settings migration
- [ ] User data migration
- [ ] Configuration compatibility
- [ ] User experience comparison
- [ ] Performance comparison
- [ ] Stability comparison

## Build and Deployment Testing Checklist

### Build Verification Tests
- [ ] x64 build compilation
- [ ] ARM64 build compilation
- [ ] Universal binary creation
- [ ] DMG generation
- [ ] Build artifact integrity

### DMG and Notarization Validation Tests
- [ ] DMG file size (< 100MB)
- [ ] DMG layout and appearance
- [ ] Code signing verification
- [ ] Notarization ticket validation
- [ ] Gatekeeper compatibility
- [ ] Installation script testing
- [ ] Background image and layout
- [ ] EULA and licensing

## Issue Tracking and Resolution Checklist

### Debug Information Collection
- [ ] Application logs review
- [ ] Console app logs analysis
- [ ] System logs analysis
- [ ] Process monitoring data
- [ ] Activity Monitor data
- [ ] System Information capture

### Common Issue Resolution
- [ ] Gatekeeper and notarization issues
- [ ] Permission/privilege problems
- [ ] Launch agent problems
- [ ] Notification issues
- [ ] Server startup failures
- [ ] Menu bar problems
- [ ] Memory usage issues
- [ ] Performance degradation

## Post-Testing Checklist

### Documentation Updates
- [ ] Installation guide updates
- [ ] Migration guide updates
- [ ] Troubleshooting guide updates
- [ ] Known issues documentation
- [ ] Performance recommendations
- [ ] Code signing and notarization documentation

### Final Validation
- [ ] All critical tests passed
- [ ] No high-severity issues
- [ ] Performance meets targets
- [ ] Documentation complete
- [ ] Ready for beta testing

---

**Testing Status**: [ ] Not Started | [ ] In Progress | [ ] Completed  
**Last Updated**: $(date)  
**Tester**: _______________________  
**Environment**: ____________________

This checklist ensures comprehensive testing of TunnelForge on macOS platforms.
