# macOS Installation Guide

This guide explains how to install TunnelForge on macOS Monterey (12.0+), Ventura (13.0+), Sonoma (14.0+), and Sequoia (15.0+).

## System Requirements

### Minimum Requirements
- **OS**: macOS 12.0 (Monterey) or later
- **RAM**: 4 GB
- **Storage**: 500 MB free space
- **Network**: Internet connection for initial setup
- **Apple Silicon**: M1/M2/M3 Macs supported
- **Intel**: Intel Macs with 64-bit support

### Recommended Requirements
- **OS**: macOS 14.0 (Sonoma) or later
- **RAM**: 8 GB
- **Storage**: 1 GB free space
- **Network**: Broadband internet connection

## Installation Methods

### Method 1: DMG Installer (Recommended)

1. **Download the DMG file**
   ```bash
   # Download from GitHub releases
   curl -L -o TunnelForge-latest.dmg https://github.com/ferg-cod3s/tunnelforge/releases/latest/download/TunnelForge-universal.dmg
   ```

2. **Mount and install**
   ```bash
   # Mount the DMG
   hdiutil attach TunnelForge-latest.dmg
   
   # Copy the app to Applications
   cp -R "/Volumes/TunnelForge/TunnelForge.app" "/Applications/"
   
   # Eject the DMG
   hdiutil eject "/Volumes/TunnelForge"
   ```

3. **Verify installation**
   ```bash
   # Check if app is installed
   ls -la "/Applications/TunnelForge.app"
   
   # Check if app runs
   open "/Applications/TunnelForge.app"
   ```

## Post-Installation Setup

### Initial Configuration

1. **Launch TunnelForge**
   ```bash
   # From Launchpad or Spotlight
   # OR run directly:
   open "/Applications/TunnelForge.app"
   ```

2. **Complete first-time setup**
   - Choose data directory (default: ~/Library/Application Support/TunnelForge)
   - Configure server settings
   - Set up authentication
   - Choose theme and preferences

## Troubleshooting

### Installation Issues

**Problem**: DMG won't mount
```bash
# Check disk space
df -h

# Try mounting manually
hdiutil attach TunnelForge.dmg -mountpoint /tmp/tunnelforge
```

**Problem**: App won't copy to Applications
```bash
# Check permissions
ls -la /Applications/

# Fix permissions
sudo chown $USER /Applications/
```

## Uninstallation

### Using Finder

1. **Drag to Trash**
   ```bash
   # Move app to Trash
   mv "/Applications/TunnelForge.app" ~/.Trash/
   
   # Empty Trash
   rm -rf ~/.Trash/TunnelForge.app
   ```

2. **Remove user data**
   ```bash
   # Remove application support
   rm -rf "~/Library/Application Support/TunnelForge"
   ```

## Security Considerations

### macOS Security Features

- **Gatekeeper**: TunnelForge is notarized and signed
- **XProtect**: Automatic malware detection
- **MRT**: Malware Removal Tool integration
- **SIP**: System Integrity Protection

## Support

### Getting Help

1. **Check the logs**: ~/Library/Logs/TunnelForge/
2. **Submit bug reports**: GitHub Issues
3. **Community support**: GitHub Discussions
4. **Documentation**: [TunnelForge Docs](https://tunnelforge.dev/docs)

---

*For more information, visit [TunnelForge Documentation](https://tunnelforge.dev/docs)*
