# TunnelForge Linux Testing Plan

## Overview

This document outlines the comprehensive testing strategy for TunnelForge on Linux platforms. The Linux implementation is built with Tauri v2 and provides native Linux integration features including system tray, notifications, auto-start, and professional packaging for multiple distributions.

## Current Implementation Status

### ✅ Completed Features

**Core Functionality:**
- Tauri v2 application structure with Rust backend
- Go server process management and lifecycle
- WebSocket integration for real-time terminal sessions
- System tray integration with StatusNotifierItem protocol
- XDG-compliant configuration storage
- Auto-start functionality via XDG autostart
- Native Linux notifications via libnotify
- Professional packaging (AppImage, DEB, RPM)
- systemd service integration for enterprise environments

**Build System:**
- Cross-platform Tauri configuration
- AppImage generation with linuxdeploy
- DEB package creation with dpkg
- RPM package creation with rpmbuild
- GPG signing integration for packages
- Automated build pipeline configuration

### 🚧 Implementation Notes

**Linux-Specific Features:**
- XDG Base Directory compliance (`~/.config/tunnelforge/`)
- System tray with StatusNotifierItem protocol
- libnotify-based desktop notifications
- XDG autostart specification compliance
- Desktop file associations and MIME types
- AppArmor/SELinux profile compatibility
- systemd service integration

**Build Configuration:**
- Target distributions: Ubuntu 20.04+, Debian 11+, Fedora 35+, Arch Linux
- Architectures: x64 and ARM64
- Package formats: AppImage (universal), DEB (Ubuntu/Debian), RPM (Fedora/RHEL)
- GPG signing for package integrity

## Testing Environment Requirements

### Hardware Requirements
- **Minimum**: 4GB RAM, 2GB free disk space, x64 or ARM64 architecture
- **Recommended**: 8GB RAM, 5GB free disk space
- **Test Machines**: Multiple distributions for comprehensive testing

### Software Requirements
- **Operating Systems**: Ubuntu 20.04+, Debian 11+, Fedora 35+, Arch Linux
- **Desktop Environments**: GNOME, KDE, Xfce, Cinnamon (for GUI testing)
- **System Dependencies**: WebKit2GTK, GTK3, libappindicator3
- **Development Tools**: Build tools for native compilation

### Test Environment Setup

#### Development Environment
```bash
# Install system dependencies (Ubuntu/Debian)
sudo apt update
sudo apt install libwebkit2gtk-4.0-dev libgtk-3-dev libayatana-appindicator3-dev

# Install Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add x86_64-unknown-linux-gnu
rustup target add aarch64-unknown-linux-gnu

# Install Tauri CLI
cargo install tauri-cli
```

#### Test Environment Matrix
| Environment | Distribution | Version | Desktop | Architecture |
|-------------|--------------|---------|---------|--------------|
| **Desktop 1** | Ubuntu | 22.04 LTS | GNOME | x64 |
| **Desktop 2** | Ubuntu | 24.04 LTS | GNOME | x64 |
| **Desktop 3** | Debian | 12 | GNOME | x64 |
| **Desktop 4** | Fedora | 39 | KDE | x64 |
| **Desktop 5** | Arch Linux | Latest | KDE | x64 |
| **Desktop 6** | Ubuntu | 22.04 LTS | Xfce | ARM64 |
| **Server 1** | Ubuntu Server | 22.04 LTS | N/A | x64 |
| **Server 2** | Debian | 12 | N/A | x64 |

## Comprehensive Test Plan

### Phase 1: Package Installation Testing (Day 1)

#### 1.1 AppImage Testing
**Objective**: Verify AppImage functionality across different distributions

**Test Scenarios:**
- [ ] AppImage execution on Ubuntu 22.04+ (GNOME)
- [ ] AppImage execution on Ubuntu 24.04+ (GNOME)
- [ ] AppImage execution on Debian 12+ (GNOME)
- [ ] AppImage execution on Fedora 39+ (KDE)
- [ ] AppImage execution on Arch Linux (KDE)
- [ ] AppImage execution on Ubuntu ARM64
- [ ] AppImage with FUSE support
- [ ] AppImage without FUSE (using --appimage-extract)
- [ ] AppImage file permissions and execution
- [ ] AppImage desktop integration

**Success Criteria:**
- AppImage launches without external dependencies
- All features work correctly
- Desktop integration functions properly
- No crashes or missing functionality

#### 1.2 DEB Package Testing
**Objective**: Verify DEB package installation and functionality

**Test Scenarios:**
- [ ] Installation on Ubuntu 22.04 LTS
- [ ] Installation on Ubuntu 24.04 LTS
- [ ] Installation on Debian 12
- [ ] Installation on Linux Mint 21+
- [ ] Upgrade installation from previous version
- [ ] Installation with APT package manager
- [ ] Installation verification (files, desktop entries)
- [ ] Dependency resolution testing
- [ ] Post-install script execution
- [ ] Complete package removal

**Success Criteria:**
- Package installs without dependency issues
- All files installed to correct locations
- Desktop entries created properly
- Application launches after installation
- Package removal cleans up completely

#### 1.3 RPM Package Testing
**Objective**: Verify RPM package installation and functionality

**Test Scenarios:**
- [ ] Installation on Fedora 39+
- [ ] Installation on Fedora 40+
- [ ] Installation on RHEL 9+
- [ ] Installation on CentOS Stream 9+
- [ ] Installation on openSUSE Leap 15.5+
- [ ] Installation with DNF package manager
- [ ] Installation with RPM directly
- [ ] Installation verification
- [ ] Dependency resolution testing
- [ ] Package removal and cleanup

**Success Criteria:**
- Package installs without dependency conflicts
- All RPM database entries correct
- Application functions properly
- Package removal succeeds completely

### Phase 2: Core Functionality Testing (Day 1-2)

#### 2.1 Application Launch Testing
**Objective**: Verify application startup across different distributions

**Test Scenarios:**
- [ ] First-time launch on Ubuntu GNOME
- [ ] First-time launch on Debian GNOME
- [ ] First-time launch on Fedora KDE
- [ ] First-time launch on Arch Linux KDE
- [ ] Normal application launch
- [ ] Launch with existing configuration
- [ ] Launch after system reboot
- [ ] Launch as different user types
- [ ] Startup time measurement (< 3 seconds target)

**Success Criteria:**
- Application launches within target time
- Main window appears correctly
- System tray icon appears
- No startup crashes or errors
- Configuration loads properly

#### 2.2 System Tray Integration Testing
**Objective**: Verify system tray functionality across desktop environments

**Test Scenarios:**
- [ ] System tray icon appearance on GNOME
- [ ] System tray icon appearance on KDE
- [ ] System tray icon appearance on Xfce
- [ ] Right-click context menu functionality
- [ ] Left-click behavior (toggle window)
- [ ] Menu item actions (Open, New Session, Settings, etc.)
- [ ] Server status display in tray menu
- [ ] Copy URL functionality
- [ ] Quit/exit functionality
- [ ] Tray icon persistence across desktop sessions

**Success Criteria:**
- Tray icon displays correctly in all desktop environments
- All menu items function properly
- Server status updates in real-time
- No tray-related crashes
- Proper cleanup on application exit

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
- [ ] Server process isolation

**Success Criteria:**
- Server starts automatically
- Health checks work correctly
- No port conflicts or binding issues
- Proper process cleanup on exit
- Server logs accessible and informative

### Phase 3: Linux Integration Testing (Day 2)

#### 3.1 Desktop Integration Testing
**Objective**: Verify XDG compliance and desktop integration

**Test Scenarios:**
- [ ] Desktop file installation and validation
- [ ] MIME type associations
- [ ] Application menu integration
- [ ] Icon installation and display
- [ ] Desktop notification permissions
- [ ] File association testing
- [ ] URL scheme handling (tunnelforge://)
- [ ] Desktop environment compatibility

**Success Criteria:**
- Desktop files install to correct locations
- MIME types registered properly
- Application appears in correct menu categories
- Icons display correctly in all sizes
- File associations work as expected

#### 3.2 Auto-Start Testing
**Objective**: Verify XDG autostart functionality

**Test Scenarios:**
- [ ] Auto-start enabled in settings
- [ ] Auto-start disabled in settings
- [ ] XDG autostart file creation/deletion
- [ ] Startup after user login
- [ ] Startup behavior with multiple desktop environments
- [ ] Startup performance impact
- [ ] Multi-user environment testing
- [ ] Login manager integration

**Success Criteria:**
- Autostart files created/removed correctly
- Application starts with user session as configured
- No impact on login time
- Works with different login managers

#### 3.3 Notification System Testing
**Objective**: Verify libnotify integration

**Test Scenarios:**
- [ ] Server status change notifications
- [ ] Session creation notifications
- [ ] Error and warning notifications
- [ ] Notification persistence
- [ ] Notification settings and preferences
- [ ] Multiple notification handling
- [ ] Desktop environment notification compatibility
- [ ] Notification daemon compatibility

**Success Criteria:**
- Notifications appear in desktop environment
- Notification content displays correctly
- No notification-related crashes
- User can control notification settings
- Compatible with major notification daemons

### Phase 4: Performance and Stability Testing (Day 3)

#### 4.1 Memory Usage Testing
**Objective**: Verify memory usage meets targets

**Test Scenarios:**
- [ ] Baseline memory usage (target: < 100MB)
- [ ] Memory usage with 10 concurrent sessions
- [ ] Memory usage with 50 concurrent sessions
- [ ] Memory usage with 100 concurrent sessions
- [ ] Memory leak detection (long-running test)
- [ ] Memory usage across different desktop environments
- [ ] Memory usage with different distributions

**Success Criteria:**
- Memory usage within specified limits
- No memory leaks detected
- Stable memory usage over time
- Performance consistent across distributions

#### 4.2 Startup Time Testing
**Objective**: Verify application startup performance

**Test Scenarios:**
- [ ] Cold start time measurement (target: < 2 seconds)
- [ ] Warm start time measurement (target: < 1 second)
- [ ] Server startup time (target: < 3 seconds)
- [ ] WebView initialization time
- [ ] System tray initialization time
- [ ] Time to interactive
- [ ] Startup time across different distributions

**Success Criteria:**
- All startup times meet or exceed targets
- Consistent performance across reboots
- No startup failures or timeouts
- Performance comparable across distributions

#### 4.3 Stability Testing
**Objective**: Verify application stability under various conditions

**Test Scenarios:**
- [ ] Long-running test (24+ hours)
- [ ] System suspend/resume handling
- [ ] Network connectivity changes
- [ ] High CPU usage scenarios
- [ ] Low memory conditions
- [ ] Multiple user sessions
- [ ] Concurrent application instances
- [ ] Desktop environment switching
- [ ] Display server changes (X11/Wayland)

**Success Criteria:**
- No crashes or hangs during extended use
- Proper handling of system events
- Graceful degradation under resource pressure
- Clean recovery from error conditions
- Compatible with both X11 and Wayland

### Phase 5: Distribution-Specific Testing (Day 3)

#### 5.1 Ubuntu/Debian Testing
**Objective**: Comprehensive testing on Debian-based distributions

**Test Scenarios:**
- [ ] APT package installation and removal
- [ ] Package dependency resolution
- [ ] Ubuntu Software Center compatibility
- [ ] Snap package conflicts (if applicable)
- [ ] PPA installation testing
- [ ] System update compatibility
- [ ] GNOME Shell integration
- [ ] Unity desktop compatibility (if available)

**Success Criteria:**
- Seamless integration with APT ecosystem
- No conflicts with existing packages
- Proper integration with software centers
- Compatible with system updates

#### 5.2 Fedora/RHEL Testing
**Objective**: Comprehensive testing on Red Hat-based distributions

**Test Scenarios:**
- [ ] RPM package installation and removal
- [ ] DNF package manager integration
- [ ] SELinux compatibility
- [ ] Firewall configuration
- [ ] KDE Plasma integration
- [ ] GNOME on Fedora compatibility
- [ ] System update compatibility
- [ ] Enterprise environment testing

**Success Criteria:**
- Proper RPM package management
- SELinux policies work correctly
- Compatible with Red Hat security model
- Works in enterprise environments

#### 5.3 Arch Linux Testing
**Objective**: Testing on rolling release distribution

**Test Scenarios:**
- [ ] AUR package building and installation
- [ ] Rolling release compatibility
- [ ] KDE Plasma integration
- [ ] System update compatibility
- [ ] Development package conflicts
- [ ] User repository compatibility
- [ ] Desktop environment compatibility

**Success Criteria:**
- Compatible with rolling release model
- No conflicts with development packages
- Works with AUR ecosystem
- Stable across frequent updates

## Build and Deployment Testing

### Build Verification
```bash
# Build all Linux targets
cargo tauri build --target x86_64-unknown-linux-gnu
cargo tauri build --target aarch64-unknown-linux-gnu

# Create packages
npm run build:appimage  # Universal AppImage
npm run build:deb       # Ubuntu/Debian package
npm run build:rpm       # Red Hat/Fedora package
```

### Package Validation
- [ ] AppImage size check (< 50MB target)
- [ ] DEB package integrity
- [ ] RPM package integrity
- [ ] GPG signature validation
- [ ] Package metadata verification
- [ ] Installation script testing

## Troubleshooting and Issue Resolution

### Common Issues and Solutions

#### Installation Issues
- **Missing Dependencies**: Verify all system dependencies installed
- **Permission Denied**: Check user privileges and file permissions
- **Package Conflicts**: Resolve conflicting packages
- **Repository Issues**: Check package repository configuration

#### Runtime Issues
- **Server Won't Start**: Check port availability, firewall settings
- **System Tray Missing**: Install libappindicator3, restart desktop
- **High Memory Usage**: Monitor for memory leaks, check session cleanup
- **Slow Startup**: Profile startup process, optimize initialization

#### Distribution-Specific Issues
- **Ubuntu**: Check for snap conflicts, verify APT sources
- **Fedora**: Verify SELinux settings, check firewall configuration
- **Arch**: Check for AUR conflicts, verify package versions
- **Debian**: Verify backports configuration, check dependency versions

### Debug Information Collection
```bash
# Application logs
tail -f ~/.config/tunnelforge/logs/tunnelforge.log

# System logs
journalctl --user -f -u tunnelforge

# Process information
ps aux | grep tunnelforge

# Environment information
env | grep -i tunnel

# Desktop environment
echo $XDG_CURRENT_DESKTOP
echo $DESKTOP_SESSION
```

## Success Metrics and Exit Criteria

### Technical Success Criteria
- [ ] All package formats install correctly on target distributions
- [ ] Core functionality operates correctly on all platforms
- [ ] Performance meets or exceeds targets
- [ ] No critical or high-severity bugs found
- [ ] All automated tests pass
- [ ] Documentation is complete and accurate

### User Experience Criteria
- [ ] Installation process is smooth and intuitive
- [ ] Application integrates naturally with Linux desktop
- [ ] All features work as expected across distributions
- [ ] Performance is acceptable for typical usage
- [ ] Error messages are clear and helpful

### Distribution Compatibility Criteria
- [ ] Works correctly on all target distributions
- [ ] Compatible with major desktop environments
- [ ] Follows distribution packaging standards
- [ ] Integrates properly with system package managers
- [ ] Compatible with system update mechanisms

## Test Reporting and Documentation

### Daily Test Reports
- Test execution status and results
- Issues found and resolution status
- Performance metrics and benchmarks
- Screenshots and logs for significant issues

### Final Test Report
- Comprehensive test coverage summary
- Performance benchmarking results
- Distribution compatibility matrix
- Known issues and workarounds
- Recommendations for production release

### Documentation Updates
- Installation guide for Linux distributions
- Troubleshooting guide updates
- Distribution-specific notes
- Performance optimization recommendations
- Package management documentation

## Next Steps After Testing

1. **Bug Fixes**: Address any critical issues found during testing
2. **Performance Optimization**: Implement performance improvements based on benchmarks
3. **Documentation Completion**: Finalize all Linux-specific documentation
4. **Build System Refinement**: Optimize build and packaging processes
5. **Repository Setup**: Prepare for package repository distribution
6. **Beta Testing**: Conduct user testing with real users

---

**Testing Status**: Ready for execution in Linux environment  
**Estimated Duration**: 3 days for comprehensive testing  
**Risk Level**: Low - Implementation is mature and well-tested  
**Confidence Level**: High - Extensive testing plan covers all scenarios

This testing plan ensures TunnelForge provides a high-quality, native Linux experience across all major distributions and desktop environments.
