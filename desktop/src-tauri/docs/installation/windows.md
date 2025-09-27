# TunnelForge Windows Installation Guide

## System Requirements

- Windows 10 or later (64-bit)
- 4GB RAM minimum
- 500MB free disk space
- Administrator privileges for installation

## Installation Methods

### Method 1: MSI Installer (Recommended)

1. Download the latest MSI installer from [TunnelForge Releases](https://github.com/tunnelforge/desktop/releases)
2. Double-click the downloaded `TunnelForge-Setup.msi` file
3. Follow the installation wizard:
   - Accept the license agreement
   - Choose installation directory (default: `C:\Program Files\TunnelForge`)
   - Select additional components (recommended: all)
   - Click "Install"
4. Windows may show a security prompt - click "Yes" to proceed
5. Wait for installation to complete
6. Click "Finish" to exit the installer

### Method 2: NSIS Installer (Portable)

1. Download the NSIS installer (`TunnelForge-Portable.exe`)
2. Run the installer executable
3. Choose installation options:
   - Installation directory
   - Start menu shortcuts
   - Desktop shortcut
4. Click "Install" to proceed
5. Wait for installation to complete

## Post-Installation

### First Run
1. Launch TunnelForge from:
   - Start menu shortcut
   - Desktop shortcut (if selected)
   - System tray icon (if auto-start enabled)

2. Initial Setup:
   - Accept firewall prompt if shown
   - Configure auto-start preference
   - Set up authentication (optional)

### Windows Service
TunnelForge installs a Windows service for background operation:

- Service Name: `TunnelForgeService`
- Display Name: "TunnelForge Terminal Service"
- Startup Type: Automatic
- Log Files: `C:\ProgramData\TunnelForge\logs\`

To manage the service:
1. Open Services (services.msc)
2. Find "TunnelForge Terminal Service"
3. Use Start/Stop/Restart as needed

### System Integration

TunnelForge integrates with Windows in several ways:

1. **Auto-start**: 
   - Registry: `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run`
   - Can be enabled/disabled in settings

2. **System Tray**:
   - Right-click for quick actions
   - Left-click to show/hide main window

3. **Firewall Rules**:
   - Inbound: TCP port 4021 (configurable)
   - Application rules for TunnelForge.exe

4. **File Associations**:
   - `.tunnelforge` files for session sharing
   - Protocol handler: `tunnelforge://`

## Configuration

### Main Configuration
Location: `%APPDATA%\TunnelForge\config.toml`

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

### Environment Variables
- `TUNNELFORGE_HOME`: Installation directory
- `TUNNELFORGE_CONFIG`: Configuration directory
- `TUNNELFORGE_LOG_LEVEL`: Log verbosity (default: "info")

## Troubleshooting

### Common Issues

1. **Installation Fails**
   - Ensure you have administrator privileges
   - Check Windows Event Viewer for errors
   - Verify system requirements
   - Try running installer in compatibility mode

2. **Service Won't Start**
   - Check service dependencies
   - Verify port 4021 is available
   - Check service account permissions
   - Review service logs

3. **Application Won't Launch**
   - Check Event Viewer for application errors
   - Verify file permissions
   - Run as administrator once
   - Check antivirus exclusions

4. **Network Connection Issues**
   - Verify firewall rules
   - Check port availability
   - Test with localhost connections
   - Review network logs

### Log Files

1. **Application Logs**:
   ```
   %APPDATA%\TunnelForge\logs\tunnelforge.log
   ```

2. **Service Logs**:
   ```
   C:\ProgramData\TunnelForge\logs\service.log
   ```

3. **Installation Logs**:
   ```
   %TEMP%\TunnelForge_Install.log
   ```

### Support Resources

- [Documentation](https://docs.tunnelforge.dev)
- [GitHub Issues](https://github.com/tunnelforge/desktop/issues)
- [Community Forum](https://community.tunnelforge.dev)
- Email: support@tunnelforge.dev

## Uninstallation

### Method 1: Windows Settings
1. Open Windows Settings
2. Go to "Apps & features"
3. Find "TunnelForge"
4. Click "Uninstall"
5. Follow the uninstallation wizard

### Method 2: Control Panel
1. Open Control Panel
2. Go to "Programs and Features"
3. Select "TunnelForge"
4. Click "Uninstall"
5. Follow the prompts

### Manual Cleanup (if needed)
1. Stop TunnelForge service
2. Remove installation directory
3. Delete configuration:
   ```
   %APPDATA%\TunnelForge
   %LOCALAPPDATA%\TunnelForge
   C:\ProgramData\TunnelForge
   ```
4. Remove registry entries:
   ```
   HKEY_LOCAL_MACHINE\SOFTWARE\TunnelForge
   HKEY_CURRENT_USER\Software\TunnelForge
   ```

## Security Notes

1. **Code Signing**
   - All executables are signed with DigiCert code signing certificate
   - Verify signature using:
     ```powershell
     Get-AuthenticodeSignature "C:\Program Files\TunnelForge\TunnelForge.exe"
     ```

2. **Network Security**
   - Default localhost-only binding
   - TLS 1.2+ for all connections
   - Certificate validation enabled

3. **Data Protection**
   - Configuration encrypted at rest
   - Secure credential storage using Windows Credential Manager
   - Audit logging for security events

4. **Service Security**
   - Runs under dedicated service account
   - Minimal required privileges
   - Protected service configuration

## Updates

TunnelForge includes automatic update checking:

1. **Automatic Updates**
   - Checks daily for new versions
   - Downloads updates in background
   - Prompts for installation

2. **Manual Updates**
   - Check: Help → Check for Updates
   - Download from releases page
   - Run installer to upgrade

3. **Update Settings**
   - Configure in Preferences → Updates
   - Set check frequency
   - Enable/disable automatic downloads

## Enterprise Deployment

For enterprise environments:

1. **Silent Installation**
   ```powershell
   msiexec /i TunnelForge-Setup.msi /quiet
   ```

2. **Configuration Management**
   - Group Policy support
   - SCCM deployment ready
   - Enterprise configuration templates

3. **Network Requirements**
   - Inbound: TCP 4021 (default)
   - Outbound: HTTPS (443)
   - Optional: LDAP/AD integration

4. **Security Considerations**
   - Code signing verification
   - Network isolation options
   - Audit logging integration
   - Access control policies

---

For additional help or enterprise support, contact support@tunnelforge.dev
