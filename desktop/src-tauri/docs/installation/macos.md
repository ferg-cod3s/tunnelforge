# TunnelForge macOS Installation Guide

## System Requirements

- macOS 11 (Big Sur) or later
- Apple Silicon (M1/M2) or Intel 64-bit processor
- 4GB RAM minimum
- 500MB free disk space
- Internet connection for installation

## Installation Methods

### Method 1: DMG Installer (Recommended)

1. Download the latest DMG from [TunnelForge Releases](https://github.com/tunnelforge/desktop/releases)
2. Mount the DMG by double-clicking
3. Drag TunnelForge.app to Applications folder
4. Eject the DMG
5. Launch TunnelForge from Applications

Note: On first launch, macOS may show security prompts:
- "TunnelForge.app is an app downloaded from the Internet"
- System extension blocking warning
- Accessibility permissions request

### Method 2: Homebrew (Developer)

```bash
# Add TunnelForge tap
brew tap tunnelforge/desktop

# Install TunnelForge
brew install --cask tunnelforge
```

## Post-Installation

### First Run
1. Launch TunnelForge from:
   - Applications folder
   - Spotlight (⌘ + Space)
   - Dock (if added)

2. Initial Setup:
   - Grant required permissions
   - Configure auto-start preference
   - Set up authentication (optional)

### Launch Agent
TunnelForge installs a Launch Agent for background operation:

- Agent Name: `dev.tunnelforge.desktop.plist`
- Location: `~/Library/LaunchAgents/`

Agent Management:
```bash
# Load agent
launchctl load ~/Library/LaunchAgents/dev.tunnelforge.desktop.plist

# Unload agent
launchctl unload ~/Library/LaunchAgents/dev.tunnelforge.desktop.plist

# Check status
launchctl list | grep tunnelforge
```

### System Integration

TunnelForge integrates with macOS in several ways:

1. **Auto-start**: 
   - Launch Agent configuration
   - System Preferences → Users & Groups → Login Items

2. **Menu Bar**:
   - Status item with quick actions
   - Dark mode support
   - System appearance integration

3. **Security & Privacy**:
   - Accessibility permissions
   - Full disk access (optional)
   - Network access

4. **Notifications**:
   - Native notification center
   - Badge app icon
   - Action buttons

## Configuration

### Main Configuration
Location: `~/Library/Application Support/dev.tunnelforge.desktop/config.toml`

```toml
[server]
port = 4021
host = "127.0.0.1"

[ui]
theme = "system"
minimize_to_tray = true
start_minimized = false

[security]
enable_audit_log = true
```

### Launch Agent Configuration
Location: `~/Library/LaunchAgents/dev.tunnelforge.desktop.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>dev.tunnelforge.desktop</string>
    <key>ProgramArguments</key>
    <array>
        <string>/Applications/TunnelForge.app/Contents/MacOS/tunnelforge</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>~/Library/Logs/TunnelForge/tunnelforge.log</string>
    <key>StandardErrorPath</key>
    <string>~/Library/Logs/TunnelForge/tunnelforge.error.log</string>
</dict>
</plist>
```

### Environment Variables
- `TUNNELFORGE_HOME`: Application bundle path
- `TUNNELFORGE_CONFIG`: Configuration directory
- `TUNNELFORGE_LOG_LEVEL`: Log verbosity
- `TUNNELFORGE_AGENT_ENABLED`: Launch agent control

## Troubleshooting

### Common Issues

1. **App "is damaged and can't be opened"**
   - Right-click app → Open
   - Check Gatekeeper settings:
     ```bash
     sudo spctl --master-disable  # Temporarily disable
     sudo spctl --master-enable   # Re-enable after
     ```

2. **Missing Permissions**
   - System Preferences → Security & Privacy
   - Check required permissions:
     - Accessibility
     - Full Disk Access (if needed)
     - Network access

3. **Launch Agent Issues**
   ```bash
   # Check agent status
   launchctl list | grep tunnelforge

   # Check system log
   log show --predicate 'subsystem == "dev.tunnelforge.desktop"'

   # Reset agent
   launchctl unload ~/Library/LaunchAgents/dev.tunnelforge.desktop.plist
   launchctl load ~/Library/LaunchAgents/dev.tunnelforge.desktop.plist
   ```

4. **Network Problems**
   - Check firewall settings
   - Verify port availability:
     ```bash
     lsof -i :4021
     ```
   - Test localhost connection

### Log Files

1. **Application Logs**:
   ```
   ~/Library/Logs/TunnelForge/tunnelforge.log
   ```

2. **Launch Agent Logs**:
   ```
   ~/Library/Logs/TunnelForge/agent.log
   ```

3. **System Logs**:
   ```bash
   # View TunnelForge logs
   log show --predicate 'subsystem == "dev.tunnelforge.desktop"'

   # Stream logs
   log stream --predicate 'subsystem == "dev.tunnelforge.desktop"'
   ```

### Support Resources

- [Documentation](https://docs.tunnelforge.dev)
- [GitHub Issues](https://github.com/tunnelforge/desktop/issues)
- [Community Forum](https://community.tunnelforge.dev)
- Email: support@tunnelforge.dev

## Uninstallation

### Method 1: Manual Removal
1. Quit TunnelForge
2. Unload Launch Agent:
   ```bash
   launchctl unload ~/Library/LaunchAgents/dev.tunnelforge.desktop.plist
   ```
3. Remove application:
   ```bash
   rm -rf /Applications/TunnelForge.app
   ```
4. Remove configuration:
   ```bash
   rm -rf ~/Library/Application\ Support/dev.tunnelforge.desktop
   rm -rf ~/Library/Caches/dev.tunnelforge.desktop
   rm -rf ~/Library/Logs/TunnelForge
   rm ~/Library/LaunchAgents/dev.tunnelforge.desktop.plist
   ```

### Method 2: Homebrew
```bash
brew uninstall --cask tunnelforge
```

### Additional Cleanup
```bash
# Remove preferences
defaults delete dev.tunnelforge.desktop

# Remove keychain items
security delete-generic-password -s "TunnelForge"
```

## Security Notes

1. **Code Signing**
   - Apple Developer ID signed
   - Notarized for Gatekeeper
   - Hardened Runtime enabled
   - App Sandbox configured

2. **Network Security**
   - Default localhost-only binding
   - TLS 1.2+ for all connections
   - Certificate validation enabled

3. **Data Protection**
   - Keychain integration
   - Secure file permissions
   - Audit logging capability

4. **Privacy**
   - Minimal permissions model
   - Data confined to app container
   - Clear data removal on uninstall

## Updates

TunnelForge includes automatic update checking:

1. **Automatic Updates**
   - Checks daily for new versions
   - Downloads updates in background
   - Prompts for installation

2. **Manual Updates**
   - Check: TunnelForge → Check for Updates
   - Download from releases page
   - Replace application bundle

3. **Update Settings**
   - Configure in Preferences → Updates
   - Set check frequency
   - Enable/disable automatic downloads

## Enterprise Deployment

For enterprise environments:

1. **Silent Installation**
   ```bash
   # Install DMG
   hdiutil attach TunnelForge.dmg
   cp -R "/Volumes/TunnelForge/TunnelForge.app" /Applications/
   hdiutil detach "/Volumes/TunnelForge"
   ```

2. **MDM Integration**
   - Profile configuration
   - Managed preferences
   - Volume licensing

3. **Network Requirements**
   - Inbound: TCP 4021 (default)
   - Outbound: HTTPS (443)
   - Optional: LDAP integration

4. **Security Considerations**
   - Code signing verification
   - Network policy configuration
   - Audit logging integration
   - Access control policies

---

For additional help or enterprise support, contact support@tunnelforge.dev
