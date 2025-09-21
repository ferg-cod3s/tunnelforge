# Windows Installation Guide

This guide explains how to install TunnelForge on Windows 10, Windows 11, and Windows Server systems.

## System Requirements

### Minimum Requirements
- **OS**: Windows 10 version 1903 (19H1) or later
- **RAM**: 4 GB
- **Storage**: 500 MB free space
- **Network**: Internet connection for initial setup

### Recommended Requirements
- **OS**: Windows 11 22H2 or later
- **RAM**: 8 GB
- **Storage**: 1 GB free space
- **Network**: Broadband internet connection

## Installation Methods

### Method 1: MSI Installer (Recommended)

1. **Download the MSI installer**
   ```bash
   # Download from GitHub releases
   curl -L -o TunnelForge-latest.msi https://github.com/ferg-cod3s/tunnelforge/releases/latest/download/TunnelForge-x86_64.msi
   ```

2. **Run the installer**
   ```cmd
   # Double-click the downloaded MSI file
   # OR run from command line:
   msiexec /i TunnelForge-latest.msi /quiet /norestart
   ```

3. **Verify installation**
   ```cmd
   # Check installed programs
   wmic product where "Name like '%%TunnelForge%%'" get Name, Version
   
   # Check if service is running
   sc query TunnelForgeService
   ```

### Method 2: NSIS Installer

1. **Download the NSIS installer**
   ```bash
   curl -L -o TunnelForge-setup.exe https://github.com/ferg-cod3s/tunnelforge/releases/latest/download/TunnelForge-setup-x86_64.exe
   ```

2. **Run the installer**
   ```cmd
   TunnelForge-setup.exe
   ```

3. **Follow the installation wizard**
   - Choose installation directory (default: `C:\Program Files\TunnelForge`)
   - Select Start Menu folder
   - Choose whether to create desktop shortcuts
   - Select additional tasks (recommended: all)

### Method 3: Portable Installation

1. **Download the portable archive**
   ```bash
   curl -L -o TunnelForge-portable.zip https://github.com/ferg-cod3s/tunnelforge/releases/latest/download/TunnelForge-portable-x86_64.zip
   ```

2. **Extract the archive**
   ```cmd
   # Extract to desired location
   tar -xf TunnelForge-portable.zip -C "C:\TunnelForge"
   ```

3. **Run the application**
   ```cmd
   cd "C:\TunnelForge"
   TunnelForge.exe
   ```

## Post-Installation Setup

### Initial Configuration

1. **Launch TunnelForge**
   ```cmd
   # From Start Menu or desktop shortcut
   # OR run directly:
   "C:\Program Files\TunnelForge\TunnelForge.exe"
   ```

2. **Complete first-time setup**
   - Choose data directory (default: `%APPDATA%\TunnelForge`)
   - Configure server settings
   - Set up authentication
   - Choose theme and preferences

### Windows Services Integration

TunnelForge can integrate with Windows Services for automatic startup:

```cmd
# Install as Windows Service
sc create TunnelForgeService binPath= "C:\Program Files\TunnelForge\TunnelForge.exe --service" start= auto

# Start the service
sc start TunnelForgeService

# Check service status
sc query TunnelForgeService
```

### System Tray Integration

- TunnelForge appears in the system tray after installation
- Right-click the tray icon for quick access to:
  - Open main window
  - Start/stop server
  - Settings
  - Exit application

## Configuration

### Settings Location
- **Application data**: `%APPDATA%\TunnelForge\`
- **Configuration file**: `config.json`
- **Logs**: `logs\` directory
- **Sessions**: `sessions\` directory

### Environment Variables

```cmd
# Set custom data directory
set TUNNELFORGE_DATA_DIR=C:\TunnelForgeData

# Set custom port
set TUNNELFORGE_PORT=8080

# Enable debug mode
set TUNNELFORGE_DEBUG=1
```

### Registry Settings

TunnelForge stores some settings in the Windows Registry:

```
HKEY_CURRENT_USER\Software\TunnelForge\
  DataDirectory = C:\Users\%USERNAME%\AppData\Roaming\TunnelForge
  AutoStart = 1
  Theme = dark
```

## Troubleshooting

### Installation Issues

**Problem**: MSI installer fails with error 1603
```cmd
# Solution: Run installer as administrator
# Right-click MSI file > Run as administrator

# Alternative: Use command line with logging
msiexec /i TunnelForge.msi /l*v install.log /quiet
```

**Problem**: NSIS installer shows "Installation directory is invalid"
```cmd
# Solution: Choose a directory without special characters
# Avoid paths with spaces or Unicode characters
```

**Problem**: Windows Defender blocks installation
```cmd
# Solution: Add exception for TunnelForge installer
# Windows Security > Virus & threat protection > Manage settings > Exclusions
```

### Runtime Issues

**Problem**: Application won't start
```cmd
# Check Windows Event Viewer for errors
eventvwr.msc

# Check if required ports are available
netstat -an | findstr :4021

# Run with debug logging
TunnelForge.exe --debug
```

**Problem**: System tray icon doesn't appear
```cmd
# Check Task Manager for running processes
taskmgr

# Restart Windows Explorer
taskkill /f /im explorer.exe && start explorer.exe
```

**Problem**: Web interface not accessible
```cmd
# Check if server is running
curl http://localhost:4021/api/health

# Check firewall settings
netsh advfirewall firewall show rule name="TunnelForge"

# Add firewall rule if missing
netsh advfirewall firewall add rule name="TunnelForge" dir=in action=allow program="C:\Program Files\TunnelForge\TunnelForge.exe" enable=yes
```

### Performance Issues

**Problem**: High CPU usage
```cmd
# Check for multiple instances
tasklist | findstr TunnelForge

# Kill duplicate processes
taskkill /f /im TunnelForge.exe
```

**Problem**: Slow startup
```cmd
# Check antivirus exclusions
# Add TunnelForge directories to antivirus exclusions

# Disable unnecessary startup programs
msconfig
```

## Uninstallation

### Using Windows Settings

1. **Open Settings**
   ```cmd
   # Windows 10/11 Settings
   start ms-settings:appsfeatures
   ```

2. **Find TunnelForge**
   - Search for "TunnelForge"
   - Click "Uninstall"
   - Follow the uninstaller

### Using Command Line

```cmd
# MSI uninstall
wmic product where name="TunnelForge" call uninstall

# NSIS uninstall
"C:\Program Files\TunnelForge\Uninstall.exe" /S
```

### Manual Cleanup

```cmd
# Remove application files
rmdir /s "C:\Program Files\TunnelForge"

# Remove user data
rmdir /s "%APPDATA%\TunnelForge"

# Remove registry entries
reg delete "HKCU\Software\TunnelForge" /f

# Remove Start Menu shortcuts
rmdir /s "%APPDATA%\Microsoft\Windows\Start Menu\Programs\TunnelForge"

# Remove desktop shortcuts
del "%PUBLIC%\Desktop\TunnelForge.lnk"
```

## Security Considerations

### Windows Security Features

- **Windows Defender**: TunnelForge is signed and whitelisted
- **SmartScreen**: May show warning on first run (click "Run anyway")
- **UAC**: May require administrator privileges for installation

### Firewall Configuration

```cmd
# Allow TunnelForge through Windows Firewall
netsh advfirewall firewall add rule name="TunnelForge HTTP" dir=in action=allow protocol=TCP localport=4021

# Allow WebSocket connections
netsh advfirewall firewall add rule name="TunnelForge WebSocket" dir=in action=allow protocol=TCP localport=4022
```

### Antivirus Exclusions

Add these directories to antivirus exclusions:
- `C:\Program Files\TunnelForge\`
- `%APPDATA%\TunnelForge\`
- `%LOCALAPPDATA%\TunnelForge\`

## Support

### Getting Help

1. **Check the logs**: `%APPDATA%\TunnelForge\logs\`
2. **Submit bug reports**: GitHub Issues
3. **Community support**: GitHub Discussions
4. **Documentation**: [TunnelForge Docs](https://tunnelforge.dev/docs)

### Log Files

Key log files for troubleshooting:
- `application.log` - Main application logs
- `server.log` - Server runtime logs
- `install.log` - Installation logs (if available)

## Advanced Configuration

### Custom Installation Paths

```cmd
# MSI custom installation
msiexec /i TunnelForge.msi INSTALLDIR="D:\Apps\TunnelForge" /quiet

# NSIS custom installation
TunnelForge-setup.exe /D=E:\TunnelForge
```

### Silent Installation

```cmd
# Silent MSI installation
msiexec /i TunnelForge.msi /quiet /norestart /log install.log

# Silent NSIS installation
TunnelForge-setup.exe /S /D=C:\TunnelForge
```

### Group Policy Deployment

For enterprise deployments, TunnelForge supports:
- MSI-based deployment
- Registry-based configuration
- Group Policy Objects (GPO)
- Microsoft Endpoint Configuration Manager (SCCM)

---

*For more information, visit [TunnelForge Documentation](https://tunnelforge.dev/docs)*
