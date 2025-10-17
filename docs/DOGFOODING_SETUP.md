# TunnelForge Dogfooding Setup Guide

## Overview

This guide walks you through setting up TunnelForge for dogfooding (internal testing and self-hosting) on your machine. Dogfooding allows you to use and validate TunnelForge in real-world scenarios before broader release.

## What is Dogfooding?

Dogfooding ("eating your own dog food") means using your own software for its intended purpose. For TunnelForge, this means:
- Running the desktop app on your machine
- Hosting the server for your own use
- Testing all features in real-world scenarios
- Identifying bugs and UX issues early

## Prerequisites

### System Requirements

**macOS:**
- macOS 11 (Big Sur) or later
- Apple Silicon (M1/M2+) or Intel processor
- 2GB RAM minimum (4GB recommended)
- Homebrew (optional, for easy installation)

**Linux:**
- Ubuntu 20.04 LTS or later (or equivalent distribution)
- 2GB RAM minimum (4GB recommended)
- systemd for service management

**Windows:**
- Windows 10 or later
- 2GB RAM minimum (4GB recommended)
- Administrator access for some features

### Required Software

- Git
- Rust (for building from source)
- Node.js 18+ (for web frontend development)
- Go 1.21+ (if building server from source)

## Installation Options

### Option 1: Binary Installation (Recommended for Most Users)

#### macOS

```bash
# Download the latest DMG from releases
# Or use Homebrew (if available)
brew install tunnelforge

# Start the app
open -a TunnelForge

# Verify installation
tunnelforge --version
```

#### Linux (AppImage)

```bash
# Download the latest AppImage from releases
chmod +x TunnelForge-*.AppImage

# Run directly
./TunnelForge-*.AppImage

# Or install the DEB package
sudo dpkg -i tunnelforge_*.deb
```

#### Windows

```powershell
# Download the MSI installer from releases
# Run the installer (or use command line)
msiexec /i TunnelForge-Setup-*.msi

# Or use Windows Package Manager
winget install tunnelforge
```

### Option 2: Building from Source

```bash
# Clone repository
git clone https://github.com/yourusername/tunnelforge.git
cd tunnelforge

# Build desktop app (macOS/Linux)
cd desktop/src-tauri
cargo build --release

# Build server
cd ../../server
go build -o tunnelforge ./cmd/...

# Build web frontend
cd ../../web-astro
npm install
npm run build
```

## Initial Setup

### 1. First Launch

On first launch, TunnelForge will:
- Create a configuration directory (~/.config/tunnelforge)
- Generate default configuration
- Create a system tray icon (macOS/Windows)

### 2. Authentication

1. **Generate Initial Credentials:**
   - TunnelForge requires JWT tokens for authentication
   - On first launch, a setup wizard may appear
   - Create your initial credentials

2. **Access the Dashboard:**
   - Open your browser to http://localhost:4021
   - You should see the TunnelForge dashboard
   - Default behavior: localhost-only access

### 3. Basic Configuration

The configuration file is located at:
- **macOS:** ~/.config/tunnelforge/config.json
- **Linux:** ~/.config/tunnelforge/config.json
- **Windows:** %APPDATA%\tunnelforge\config.json

Example configuration:
```json
{
  "server_port": 4021,
  "theme": "dark",
  "auto_start": true,
  "access_mode": "LocalhostOnly",
  "enable_notifications": true
}
```

## Features to Test

### 1. Network Access Settings

TunnelForge provides two network access modes:

#### Localhost Only (🔒 Secure - Default)
- Access Mode: Localhost Only
- Binding Address: 127.0.0.1
- Network Accessible: No
- Use Case: Single machine, local development

To enable from UI:
1. Open TunnelForge desktop app
2. Click the hamburger menu → Settings
3. Scroll to "Network Access Settings"
4. See current status (should show 🔒 Localhost)
5. Network access is DISABLED (secure by default)

#### Network Access (🌐 Allow Remote Connections)
- Access Mode: Network Access
- Binding Address: 0.0.0.0
- Network Accessible: Yes
- Use Case: Team collaboration, remote testing

To enable from UI:
1. Open Settings (as above)
2. Under "Network Access Settings," click the toggle
3. Status changes to 🌐 Network
4. Server is now accessible from other machines

To enable from System Tray:
1. Click TunnelForge icon in menu bar/system tray
2. Select "Toggle Network Access"
3. Access mode updates immediately

Testing Network Access:

```bash
# From same machine (localhost)
curl http://localhost:4021

# From another machine on the same network (after enabling network access)
curl http://<your-machine-ip>:4021

# List available network interfaces
# macOS/Linux
ifconfig | grep "inet "

# Windows
ipconfig
```

### 2. Testing the Desktop App

#### macOS System Tray
1. Open TunnelForge desktop app
2. Notice the TunnelForge icon in the menu bar
3. Click it to see the menu
4. Menu items:
   - Show/Hide TunnelForge
   - Settings
   - Server Status (Running/Stopped)
   - Session Count
   - Access Mode (🔒 Localhost or 🌐 Network)
   - Toggle Network Access (new!)
   - Start/Stop/Restart Server
   - Quit

#### Linux System Tray
- Depends on your desktop environment (GNOME, KDE, etc.)
- TunnelForge should appear in your system tray/notification area
- Same menu options as macOS

#### Windows Taskbar
1. TunnelForge appears in the system tray (bottom-right)
2. Right-click to see menu options
3. Same menu items as other platforms

### 3. Terminal Sessions

Create and manage terminal sessions:

```bash
# Via web UI
1. Open http://localhost:4021
2. Click "New Session"
3. Select a shell (bash, zsh, etc.)
4. Start typing commands

# Via API
curl -H "Authorization: Bearer <token>" \
  http://localhost:4021/api/sessions
```

### 4. Settings & Configuration

Available settings:
- **Theme:** Light/Dark mode
- **Server Port:** Custom port (default: 4021)
- **Auto-Start:** Launch TunnelForge on system startup
- **Network Access:** Localhost-only vs. Network accessible
- **Notifications:** Enable/disable system notifications

## Dogfooding Workflow

### Daily Usage

1. **Start Your Workday**
   ```bash
   # Ensure server is running
   tunnelforge start
   
   # Or use the desktop app's Start Server button
   ```

2. **Access Terminal Sessions**
   - Open browser to http://localhost:4021
   - Create sessions as needed
   - Monitor active sessions

3. **Test Network Access** (if enabled)
   - From another machine: curl http://<ip>:4021
   - Verify connectivity
   - Test session management from remote

4. **Toggle Access Modes**
   - Test switching between 🔒 Localhost and 🌐 Network
   - Verify settings persist across restarts
   - Check tray menu updates correctly

### Reporting Issues

When you find issues, please report them with:

Title: Brief description of issue

Platform: macOS/Linux/Windows (with version)

Steps to Reproduce:
1. First step
2. Second step
3. Etc.

Expected Behavior:
What should happen

Actual Behavior:
What actually happens

Access Mode at Time of Issue: Localhost Only / Network Access

## Environment Variables

Configure TunnelForge behavior with environment variables:

```bash
# Enable debug logging
export TUNNELFORGE_LOG_LEVEL=debug

# Set custom config directory
export TUNNELFORGE_CONFIG_DIR=~/.tunnelforge-dev

# Enable Sentry error tracking (optional)
export SENTRY_DSN="your-sentry-dsn"
export SENTRY_ENVIRONMENT=dogfooding
```

## Common Issues & Troubleshooting

### Issue: Server won't start

```bash
# Check if port 4021 is already in use
# macOS/Linux
lsof -i :4021

# Windows
netstat -ano | findstr :4021

# Solution: Change port in settings
# Or kill the process using the port
```

### Issue: Cannot access from another machine

```bash
# Verify Network Access is enabled
# Check the tray icon shows 🌐 Network

# Verify firewall allows port 4021
# macOS: System Preferences → Security & Privacy → Firewall

# Verify your network interface IP
# macOS/Linux: ifconfig
# Windows: ipconfig

# Test connectivity
curl http://<your-ip>:4021
```

### Issue: Desktop app doesn't appear

```bash
# Try relaunching
# macOS
open -a TunnelForge

# Linux (depends on installation)
tunnelforge &

# Windows
Start-Process TunnelForge
```

### Issue: Configuration not persisting

```bash
# Check permissions on config directory
# macOS/Linux
ls -la ~/.config/tunnelforge/

# Check logs for errors
tail -f ~/.config/tunnelforge/logs/tunnelforge.log
```

## Uninstallation

### macOS

```bash
# If installed via DMG
rm -rf /Applications/TunnelForge.app

# If installed via Homebrew
brew uninstall tunnelforge
```

### Linux (DEB)

```bash
sudo apt remove tunnelforge
sudo apt autoremove
```

### Windows

```powershell
# Via Control Panel
# Settings → Apps → Apps & Features → TunnelForge → Uninstall

# Or via command line
winget uninstall tunnelforge
```

## Data & Privacy

### Configuration Storage
- Configuration is stored locally only
- No cloud sync by default
- Full control over settings

### Logs
- Stored locally in ~/.config/tunnelforge/logs/
- Contain session history and server logs
- Delete manually when desired

### Sessions
- Terminal session data stored locally
- Sessions are ephemeral by default
- No persistent session storage without explicit configuration

## Advanced Features

### Running Multiple Instances

```bash
# Use different ports
export TUNNELFORGE_CONFIG_DIR=~/.tunnelforge-test
tunnelforge start --port 4022
```

### Docker Development

```bash
# Build and run in Docker
docker build -t tunnelforge .
docker run -p 4021:4021 tunnelforge

# For network access
docker run --network host -p 4021:4021 tunnelforge
```

## Feedback & Support

### Reporting Issues
1. Check existing issues: https://github.com/yourusername/tunnelforge/issues
2. Provide detailed reproduction steps
3. Include relevant configuration and logs
4. Mention access mode at time of issue

### Feature Requests
1. Open an issue with [FEATURE] prefix
2. Describe use case and expected behavior
3. Include relevant access mode context

### Discussion
- Join our Discord/Slack (if available)
- Participate in discussions
- Share your dogfooding experience

## Next Steps

After successful dogfooding setup:

1. **Day 1-3:** Basic functionality testing
   - Server start/stop
   - Terminal session creation
   - Web dashboard access

2. **Day 4-7:** Feature testing
   - Network access toggle
   - Settings persistence
   - Tray menu interactions
   - Multiple sessions

3. **Week 2+:** Advanced testing
   - Remote machine access
   - Error scenarios
   - Performance monitoring
   - Stress testing

## Support Resources

- **Documentation:** ARCHITECTURE.md
- **API Reference:** API.md
- **Troubleshooting:** TESTING.md
- **Issues:** GitHub Issues

---

**Version:** 1.0  
**Last Updated:** 2025-01-27  
**Status:** Active
