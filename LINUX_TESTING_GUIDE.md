# Linux Testing Guide for TunnelForge

*Comprehensive guide for testing TunnelForge desktop app on Linux distributions*

## Overview

This guide walks you through testing the TunnelForge Linux desktop packages on various distributions. We have builds for:
- **AppImage** - Universal, works on all distros (recommended for testing)
- **DEB** - Debian, Ubuntu, Pop!_OS, Linux Mint, elementary OS
- **RPM** - Fedora, RHEL, CentOS, openSUSE, Mageia

## Quick Start

### Get Test Builds

**Option 1: Download from CI Artifacts** (recommended for testing)
```bash
# Install GitHub CLI
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh

# Login and download latest build
gh auth login
gh run list --workflow=build-linux.yml --limit 1
gh run download LATEST_RUN_ID

# Builds downloaded to current directory
```

**Option 2: Use Local Build**
```bash
# Navigate to your build directory
cd linux/src-tauri/target/debug/bundle/

# Builds are in:
# - deb/TunnelForge_1.0.0_amd64.deb
# - rpm/TunnelForge-1.0.0-1.x86_64.rpm
# - appimage/TunnelForge_1.0.0_amd64.AppImage
```

## Testing Matrix

Test on these distributions (ordered by priority):

### Tier 1 (Must Test)
- ✅ Ubuntu 22.04 LTS (most popular)
- ✅ Ubuntu 24.04 LTS (latest LTS)
- ✅ Fedora 39 (latest stable)

### Tier 2 (Should Test)
- ⚪ Pop!_OS 22.04 (popular with developers)
- ⚪ Debian 12 (stable)
- ⚪ Linux Mint 21 (Ubuntu-based, popular)

### Tier 3 (Nice to Test)
- ⚪ Arch Linux (rolling release, cutting edge)
- ⚪ openSUSE Tumbleweed (rolling, RPM-based)
- ⚪ Manjaro (Arch-based, popular)

---

## Installation Testing

### AppImage (Universal)

**Test on any distro:**

```bash
# Make executable
chmod +x TunnelForge_1.0.0_amd64.AppImage

# Run directly
./TunnelForge_1.0.0_amd64.AppImage

# Check if it runs
ps aux | grep TunnelForge

# Optional: Integrate with system
# Install AppImageLauncher for system integration
# https://github.com/TheAssassin/AppImageLauncher
```

**Expected behavior:**
- ✅ Launches without errors
- ✅ System tray icon appears
- ✅ Web UI opens at http://localhost:4021
- ✅ No dependency errors

**AppImage advantages:**
- No installation required
- No root privileges needed
- Works on all distros
- Self-contained, includes all dependencies

---

### DEB Package (Debian/Ubuntu)

**Test on Ubuntu 22.04/24.04, Debian 12, Pop!_OS, Mint:**

```bash
# Install
sudo dpkg -i tunnelforge_1.0.0_amd64.deb

# Fix dependencies if needed
sudo apt-get install -f

# Verify installation
dpkg -l | grep tunnelforge
which tunnelforge

# Check installed files
dpkg -L tunnelforge

# Run application
tunnelforge
# Or from applications menu

# Check service status (if systemd service installed)
systemctl --user status tunnelforge

# Uninstall
sudo dpkg -r tunnelforge

# Purge (remove config files)
sudo dpkg -P tunnelforge
```

**Expected installed files:**
```
/usr/bin/tunnelforge                    # Main binary
/usr/share/applications/tunnelforge.desktop  # Desktop entry
/usr/share/icons/hicolor/*/apps/tunnelforge.png  # Icons
/usr/lib/tunnelforge/                   # App resources
```

**Expected behavior:**
- ✅ Installs without errors
- ✅ Appears in application menu
- ✅ Desktop file validates: `desktop-file-validate /usr/share/applications/tunnelforge.desktop`
- ✅ Icons appear in system
- ✅ Binary is in PATH
- ✅ Uninstalls cleanly

---

### RPM Package (Fedora/RHEL)

**Test on Fedora 39, RHEL 9, CentOS Stream 9:**

```bash
# Install
sudo rpm -i TunnelForge-1.0.0-1.x86_64.rpm

# Or with dnf (resolves dependencies)
sudo dnf install ./TunnelForge-1.0.0-1.x86_64.rpm

# Verify installation
rpm -q tunnelforge
rpm -qi tunnelforge

# Check installed files
rpm -ql tunnelforge

# Run application
tunnelforge

# Uninstall
sudo rpm -e tunnelforge
```

**Expected behavior:**
- ✅ Installs without errors
- ✅ Appears in application menu
- ✅ Desktop entry works
- ✅ Uninstalls cleanly

---

## Functional Testing

### 1. Application Launch

**Test Steps:**
1. Launch TunnelForge from terminal: `tunnelforge`
2. Launch from application menu (GNOME/KDE)
3. Launch from desktop shortcut (if created)

**Expected:**
- ✅ Application window appears
- ✅ System tray icon appears
- ✅ No error dialogs
- ✅ Web UI loads at http://localhost:4021

**Check logs:**
```bash
# Application logs (if configured)
journalctl --user -u tunnelforge -f

# Or check stdout/stderr
tunnelforge 2>&1 | tee tunnelforge.log
```

---

### 2. System Tray Integration

**Test Steps:**
1. Look for TunnelForge icon in system tray
2. Click tray icon
3. Right-click tray icon for context menu
4. Test "Quit" option

**Expected:**
- ✅ Icon appears in tray
- ✅ Left-click opens/focuses app
- ✅ Right-click shows menu
- ✅ Menu options work (Show/Hide, Quit)
- ✅ Icon updates based on app state

**Desktop Environments to Test:**
- GNOME (Ubuntu default)
- KDE Plasma (Fedora KDE spin)
- XFCE (lightweight)
- Cinnamon (Linux Mint)

---

### 3. Auto-Start Configuration

**Test Steps:**
1. Open TunnelForge settings
2. Enable "Start on login"
3. Restart system
4. Check if TunnelForge auto-starts

**Expected:**
- ✅ Setting saves correctly
- ✅ Desktop entry created in `~/.config/autostart/`
- ✅ App starts automatically on login
- ✅ System tray icon appears after login

**Verify autostart file:**
```bash
cat ~/.config/autostart/tunnelforge.desktop
# Should have: X-GNOME-Autostart-enabled=true
```

---

### 4. Server Management

**Test Steps:**
1. Start TunnelForge server from UI
2. Check server status: `curl http://localhost:4021/api/health`
3. Stop server from UI
4. Verify server stopped

**Expected:**
- ✅ Server starts successfully
- ✅ Health endpoint responds
- ✅ Server stops cleanly
- ✅ Port 4021 released after stop

**Check server process:**
```bash
# While running
ps aux | grep tunnelforge-server
netstat -tlnp | grep 4021

# After stop
ps aux | grep tunnelforge-server  # Should be empty
```

---

### 5. Web UI Access

**Test Steps:**
1. Open http://localhost:4021 in browser
2. Navigate through UI
3. Test terminal functionality
4. Test settings

**Expected:**
- ✅ Web UI loads correctly
- ✅ All assets load (CSS, JS)
- ✅ Terminal sessions work
- ✅ WebSocket connections stable
- ✅ Settings persist

**Browsers to Test:**
- Firefox (default on many distros)
- Chromium/Chrome
- GNOME Web (Epiphany)

---

### 6. Terminal Session Management

**Test Steps:**
1. Create new terminal session
2. Run some commands: `ls`, `echo "test"`, `top`
3. Create multiple sessions
4. Switch between sessions
5. Close sessions

**Expected:**
- ✅ Sessions create successfully
- ✅ Commands execute correctly
- ✅ Output displays properly
- ✅ Multiple sessions work independently
- ✅ Sessions close cleanly

---

### 7. File System Operations

**Test Steps:**
1. Browse file system in UI
2. Navigate directories
3. Upload a file
4. Download a file
5. Delete a file

**Expected:**
- ✅ File browser works
- ✅ Navigation smooth
- ✅ Upload/download successful
- ✅ Permissions respected
- ✅ No file corruption

---

### 8. Performance Testing

**System Resource Usage:**
```bash
# Monitor while running
top -p $(pgrep tunnelforge)

# Memory usage
ps aux | grep tunnelforge | awk '{print $4, $11}'

# Check with htop
htop -p $(pgrep tunnelforge)
```

**Expected metrics:**
- ✅ Memory usage: < 100MB idle, < 200MB active
- ✅ CPU usage: < 5% idle, < 20% active
- ✅ Startup time: < 3 seconds
- ✅ No memory leaks after 1 hour

---

### 9. Update Mechanism

**Test Steps:**
1. Check for updates in UI
2. Verify update notification (if available)
3. Test update process

**Expected:**
- ✅ Update check works
- ✅ Notifications appear
- ✅ Update downloads correctly
- ✅ Update installs successfully

---

### 10. Uninstall Testing

**Test Steps:**
```bash
# DEB uninstall
sudo dpkg -r tunnelforge
# Check leftover files
ls ~/.config/tunnelforge/  # Should remain (config)
ls ~/.local/share/tunnelforge/  # Should remain (data)

# Purge (removes config)
sudo dpkg -P tunnelforge
ls ~/.config/tunnelforge/  # Should be gone

# RPM uninstall
sudo rpm -e tunnelforge

# AppImage
rm TunnelForge_*.AppImage
rm ~/.local/share/applications/appimagekit-tunnelforge.desktop
```

**Expected:**
- ✅ Binary removed
- ✅ Desktop files removed
- ✅ Icons removed
- ✅ Config preserved on uninstall
- ✅ Config removed on purge
- ✅ No broken system dependencies

---

## Security Testing

### 1. File Permissions

```bash
# Check binary permissions
ls -la /usr/bin/tunnelforge
# Should be: -rwxr-xr-x (755)

# Check desktop file
ls -la /usr/share/applications/tunnelforge.desktop
# Should be: -rw-r--r-- (644)

# Check config directory
ls -la ~/.config/tunnelforge/
# Should be: drwx------ (700) - only user access
```

### 2. Network Security

```bash
# Check listening ports
sudo netstat -tlnp | grep tunnelforge
# Should only listen on localhost:4021

# Verify no external access
curl http://192.168.1.100:4021  # Should fail
curl http://localhost:4021       # Should work
```

### 3. AppArmor/SELinux

**Fedora (SELinux):**
```bash
# Check SELinux status
sestatus

# Check for denials
sudo ausearch -m avc -ts recent | grep tunnelforge

# If denials found, might need policy module
```

**Ubuntu (AppArmor):**
```bash
# Check AppArmor status
sudo aa-status

# Check for denials
sudo dmesg | grep -i "apparmor.*tunnelforge"
```

---

## Accessibility Testing

### 1. Keyboard Navigation

**Test Steps:**
1. Navigate UI using only keyboard (Tab, Arrow keys)
2. Test all menu items
3. Test terminal with screen reader

**Expected:**
- ✅ All UI elements reachable via keyboard
- ✅ Focus indicators visible
- ✅ Shortcuts work (Ctrl+T, Ctrl+W, etc.)

### 2. Screen Reader Compatibility

**Test with Orca (GNOME screen reader):**
```bash
# Start Orca
orca

# Launch TunnelForge and test
```

**Expected:**
- ✅ UI elements announced correctly
- ✅ Buttons have descriptive labels
- ✅ Status messages readable

---

## Bug Reporting Template

Found an issue? Report it with this template:

```markdown
## Environment
- **Distribution**: Ubuntu 22.04.3 LTS
- **Desktop Environment**: GNOME 42.5
- **Package Type**: DEB / RPM / AppImage
- **TunnelForge Version**: 1.0.0
- **Kernel**: 5.15.0-91-generic

## Bug Description
Clear description of what went wrong

## Steps to Reproduce
1. Launch TunnelForge
2. Click on...
3. Observe error

## Expected Behavior
What should have happened

## Actual Behavior
What actually happened

## Logs
```bash
# Include relevant logs
journalctl --user -u tunnelforge -n 50
```

## Screenshots
(Attach if applicable)

## Additional Context
Any other relevant information
```

---

## Test Results Template

Document your test results:

```markdown
# TunnelForge Linux Testing Results

**Tester**: Your Name
**Date**: 2025-01-27
**Version**: 1.0.0

## Environment
- Distribution: Ubuntu 22.04.3 LTS
- Desktop: GNOME 42.5
- Package: DEB

## Test Results

| Test | Status | Notes |
|------|--------|-------|
| Installation | ✅ PASS | Installed cleanly |
| Launch | ✅ PASS | Started in 2.1s |
| System Tray | ✅ PASS | Icon visible |
| Auto-start | ✅ PASS | Works after reboot |
| Server Start | ✅ PASS | Port 4021 bound |
| Web UI | ✅ PASS | All assets loaded |
| Terminal | ✅ PASS | Commands work |
| File Browser | ✅ PASS | Upload/download OK |
| Performance | ✅ PASS | 85MB RAM, <2% CPU |
| Uninstall | ✅ PASS | Clean removal |

## Issues Found
- None / [List any issues with details]

## Overall Assessment
**PASS** / **FAIL** / **NEEDS WORK**

Summary of findings...
```

---

## Automated Testing Scripts

### Quick Test Script

Save as `test-tunnelforge.sh`:
```bash
#!/bin/bash
set -e

echo "🧪 TunnelForge Linux Test Suite"
echo "================================"

# Check if installed
if ! command -v tunnelforge &> /dev/null; then
    echo "❌ TunnelForge not found in PATH"
    exit 1
fi
echo "✅ Binary found: $(which tunnelforge)"

# Check desktop file
if [ ! -f /usr/share/applications/tunnelforge.desktop ]; then
    echo "⚠️  Desktop file not found"
else
    echo "✅ Desktop file exists"
    desktop-file-validate /usr/share/applications/tunnelforge.desktop && echo "✅ Desktop file valid"
fi

# Check icons
icon_sizes=(16 32 48 64 128 256)
for size in "${icon_sizes[@]}"; do
    icon_path="/usr/share/icons/hicolor/${size}x${size}/apps/tunnelforge.png"
    if [ -f "$icon_path" ]; then
        echo "✅ Icon ${size}x${size} exists"
    else
        echo "⚠️  Icon ${size}x${size} missing"
    fi
done

# Test launch
echo "🚀 Testing application launch..."
timeout 10s tunnelforge &
TFORGE_PID=$!
sleep 5

if ps -p $TFORGE_PID > /dev/null; then
    echo "✅ Application launched successfully"
    
    # Test web UI
    if curl -s http://localhost:4021 > /dev/null; then
        echo "✅ Web UI responding"
    else
        echo "❌ Web UI not responding"
    fi
    
    # Kill process
    kill $TFORGE_PID
    echo "✅ Application stopped"
else
    echo "❌ Application failed to start"
    exit 1
fi

echo ""
echo "✅ All tests passed!"
```

```bash
chmod +x test-tunnelforge.sh
./test-tunnelforge.sh
```

---

## Next Steps

1. **Test on Tier 1 distros** (Ubuntu, Fedora)
2. **Report any issues** found
3. **Document results** using template above
4. **Test on Tier 2/3 distros** if time permits
5. **Share results** with development team

---

## Resources

- **AppImage Docs**: https://docs.appimage.org/
- **Debian Policy**: https://www.debian.org/doc/debian-policy/
- **RPM Packaging**: https://rpm-packaging-guide.github.io/
- **Desktop Entry Spec**: https://specifications.freedesktop.org/desktop-entry-spec/latest/
- **Linux Testing Guide**: https://wiki.archlinux.org/title/AppImage

---

*Last Updated: 2025-01-27*
*For questions: Open an issue at https://github.com/YOUR_USERNAME/tunnelforge/issues*
