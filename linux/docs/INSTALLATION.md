# TunnelForge Installation Guide

This guide provides detailed installation instructions for TunnelForge across all supported platforms.

## Table of Contents

- [System Requirements](#system-requirements)
- [Windows Installation](#windows-installation)
- [macOS Installation](#macos-installation)
- [Linux Installation](#linux-installation)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Uninstallation](#uninstallation)

## System Requirements

### Windows
- **OS**: Windows 10 (1903) or later
- **Architecture**: x64 (64-bit)
- **Memory**: 4 GB RAM minimum
- **Storage**: 100 MB free space
- **Permissions**: Administrator access for installation

### macOS
- **OS**: macOS 10.15 (Catalina) or later
- **Architecture**: Intel x64 or Apple Silicon (M1/M2)
- **Memory**: 4 GB RAM minimum
- **Storage**: 100 MB free space
- **Permissions**: Standard user account

### Linux
- **OS**: Ubuntu 18.04+, Debian 10+, Fedora 30+, RHEL 8+, or equivalent
- **Architecture**: x64 (64-bit)
- **Memory**: 4 GB RAM minimum
- **Storage**: 100 MB free space
- **Dependencies**: glibc 2.17 or later

## Windows Installation

### Method 1: MSI Installer (Recommended)

1. **Download the installer**
   ```
   Download: TunnelForge-{version}-msi.msi
   ```

2. **Run the installer**
   - Double-click the `.msi` file
   - Click "Yes" on the User Account Control prompt
   - Follow the installation wizard
   - Choose installation directory (default: `C:\Program Files\TunnelForge`)
   - Select "Install for all users" or "Just for me"

3. **Launch TunnelForge**
   - From Start Menu: `TunnelForge`
   - Or run directly: `C:\Program Files\TunnelForge\TunnelForge.exe`

4. **Windows Service (Optional)**
   The installer can optionally install TunnelForge as a Windows service:
   - Check "Install as Windows Service" during installation
   - Service name: `TunnelForge`
   - Starts automatically with Windows

### Method 2: Portable ZIP

1. **Download the portable package**
   ```
   Download: TunnelForge-{version}-windows-x64.zip
   ```

2. **Extract the archive**
   - Right-click → "Extract All..."
   - Choose destination folder
   - Example: `C:\TunnelForge\`

3. **Run TunnelForge**
   - Double-click `TunnelForge.exe`
   - Or from Command Prompt: `C:\TunnelForge\TunnelForge.exe`

### Method 3: Chocolatey

```powershell
# Install TunnelForge
choco install tunnelforge

# Run TunnelForge
tunnelforge
```

### Method 4: Winget

```cmd
# Install TunnelForge
winget install TunnelForge.TunnelForge

# Run TunnelForge
tunnelforge
```

## macOS Installation

### Method 1: DMG Installer (Recommended)

1. **Download the DMG**
   ```
   Download: TunnelForge-{version}-dmg.dmg
   ```

2. **Open the DMG**
   - Double-click the `.dmg` file
   - The installer window will open

3. **Install TunnelForge**
   - Drag `TunnelForge.app` to `Applications` folder
   - Wait for copy to complete

4. **Launch TunnelForge**
   - From Launchpad: `TunnelForge`
   - From Applications folder: `TunnelForge.app`
   - Or from Terminal: `open /Applications/TunnelForge.app`

5. **Gatekeeper Approval**
   - On first launch, macOS may show a security dialog
   - Click "Open" if you trust the application
   - Or go to `System Preferences → Security & Privacy → General` and click "Open Anyway"

### Method 2: Homebrew

```bash
# Install TunnelForge
brew install --cask tunnelforge

# Run TunnelForge
open /Applications/TunnelForge.app
```

### Method 3: Manual Installation

1. **Download the tarball**
   ```
   Download: TunnelForge-{version}-macos-x64.tar.gz
   ```

2. **Extract and install**
   ```bash
   tar -xzf TunnelForge-{version}-macos-x64.tar.gz
   sudo mv TunnelForge.app /Applications/
   ```

3. **Launch TunnelForge**
   ```bash
   open /Applications/TunnelForge.app
   ```

## Linux Installation

### Method 1: DEB Package (Ubuntu/Debian)

1. **Download the DEB package**
   ```bash
   wget https://github.com/ferg-cod3s/tunnelforge/releases/download/v{version}/TunnelForge-{version}-deb.deb
   ```

2. **Install the package**
   ```bash
   sudo dpkg -i TunnelForge-{version}-deb.deb
   sudo apt-get install -f  # Fix dependencies if needed
   ```

3. **Launch TunnelForge**
   ```bash
   tunnelforge
   # Or from applications menu
   ```

### Method 2: RPM Package (Red Hat/Fedora)

1. **Download the RPM package**
   ```bash
   wget https://github.com/ferg-cod3s/tunnelforge/releases/download/v{version}/TunnelForge-{version}-rpm.rpm
   ```

2. **Install the package**
   ```bash
   sudo rpm -i TunnelForge-{version}-rpm.rpm
   # Or with dnf (Fedora)
   sudo dnf install TunnelForge-{version}-rpm.rpm
   ```

3. **Launch TunnelForge**
   ```bash
   tunnelforge
   ```

### Method 3: AppImage (Universal Linux)

1. **Download the AppImage**
   ```bash
   wget https://github.com/ferg-cod3s/tunnelforge/releases/download/v{version}/TunnelForge-{version}-x86_64.AppImage
   ```

2. **Make it executable**
   ```bash
   chmod +x TunnelForge-{version}-x86_64.AppImage
   ```

3. **Run TunnelForge**
   ```bash
   ./TunnelForge-{version}-x86_64.AppImage
   ```

4. **Install system-wide (Optional)**
   ```bash
   sudo mv TunnelForge-{version}-x86_64.AppImage /opt/tunnelforge.AppImage
   sudo ln -s /opt/tunnelforge.AppImage /usr/local/bin/tunnelforge
   ```

### Method 4: Snap Package

```bash
# Install TunnelForge
sudo snap install tunnelforge

# Run TunnelForge
tunnelforge
```

### Method 5: AUR (Arch Linux)

```bash
# Install from AUR
yay -S tunnelforge

# Run TunnelForge
tunnelforge
```

## Verification

### Verify Package Integrity

All packages are signed to ensure authenticity:

#### Windows
```cmd
signtool verify /pa TunnelForge.msi
```

#### macOS
```bash
codesign --verify --verbose /Applications/TunnelForge.app
spctl -a -v /Applications/TunnelForge.app
```

#### Linux
```bash
# Download and verify GPG signature
wget https://github.com/ferg-cod3s/tunnelforge/releases/download/v{version}/SHA256SUMS
wget https://github.com/ferg-cod3s/tunnelforge/releases/download/v{version}/SHA256SUMS.sig
gpg --verify SHA256SUMS.sig SHA256SUMS

# Verify package checksum
sha256sum -c SHA256SUMS
```

### Verify Installation

1. **Check version**
   ```bash
   tunnelforge --version
   ```

2. **Test basic functionality**
   ```bash
   tunnelforge --help
   tunnelforge --test
   ```

3. **Access web interface**
   - Open browser: `http://localhost:4021`
   - Should show TunnelForge web interface

## Configuration

### Default Configuration File Locations

- **Windows**: `%APPDATA%\TunnelForge\config.json`
- **macOS**: `~/Library/Application Support/TunnelForge/config.json`
- **Linux**: `~/.config/TunnelForge/config.json`

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TUNNELFORGE_PORT` | Server port | `4021` |
| `TUNNELFORGE_HOST` | Server host | `127.0.0.1` |
| `TUNNELFORGE_DATA_DIR` | Data directory | Platform-specific |
| `TUNNELFORGE_LOG_LEVEL` | Log level | `info` |

### Command Line Options

```bash
tunnelforge [OPTIONS]

Options:
  -p, --port <PORT>         Set server port [default: 4021]
  -h, --host <HOST>         Set server host [default: 127.0.0.1]
  -d, --data-dir <DIR>      Set data directory
  -l, --log-level <LEVEL>   Set log level [trace, debug, info, warn, error]
  -c, --config <FILE>       Configuration file path
  --test                    Run self-tests and exit
  --version                 Show version information
  --help                    Show help
```

## Troubleshooting

### Windows Issues

#### Installation Fails
- **Cause**: Insufficient permissions
- **Solution**: Run installer as Administrator
- **Command**: Right-click installer → "Run as administrator"

#### Firewall Blocks Connection
- **Cause**: Windows Firewall blocking TunnelForge
- **Solution**: Add firewall exception
- **Steps**:
  1. Open Windows Defender Firewall
  2. Click "Allow an app or feature through Windows Defender Firewall"
  3. Add `TunnelForge.exe`
  4. Check both "Private" and "Public" networks

#### Antivirus Flags TunnelForge
- **Cause**: False positive from antivirus software
- **Solution**: Add TunnelForge to antivirus exclusions
- **Steps**: Add installation directory to antivirus whitelist

### macOS Issues

#### "Unidentified Developer" Error
- **Cause**: Gatekeeper blocking unsigned app
- **Solution**: Allow app to run
- **Steps**:
  1. Go to `System Preferences → Security & Privacy → General`
  2. Click "Open Anyway" next to TunnelForge message
  3. Click "Open" in confirmation dialog

#### App Crashes on Launch
- **Cause**: Missing permissions or corrupted installation
- **Solution**: Reset permissions and reinstall
- **Steps**:
  ```bash
  # Remove app and preferences
  rm -rf /Applications/TunnelForge.app
  rm -rf ~/Library/Preferences/com.tunnelforge.plist
  rm -rf ~/Library/Application\ Support/TunnelForge
  
  # Reinstall
  # (Follow installation steps)
  ```

### Linux Issues

#### Permission Denied
- **Cause**: Insufficient permissions to bind port 4021
- **Solution**: Use port > 1024 or run with sudo
- **Commands**:
  ```bash
  # Use higher port
  tunnelforge --port 8421
  
  # Or run with sudo (not recommended)
  sudo tunnelforge
  ```

#### Missing Dependencies
- **Cause**: Required system libraries not installed
- **Solution**: Install dependencies
- **Ubuntu/Debian**:
  ```bash
  sudo apt-get update
  sudo apt-get install libssl1.1 libgtk-3-0 libwebkit2gtk-4.0-37
  ```
- **Fedora/RHEL**:
  ```bash
  sudo dnf install openssl-libs gtk3 webkit2gtk3
  ```

#### AppImage Won't Run
- **Cause**: Missing FUSE support
- **Solution**: Install FUSE or extract AppImage
- **Commands**:
  ```bash
  # Install FUSE (Ubuntu/Debian)
  sudo apt-get install libfuse2
  
  # Or extract AppImage
  ./TunnelForge.AppImage --appimage-extract
  ./squashfs-root/AppRun
  ```

## Uninstallation

### Windows

#### Method 1: Control Panel
1. Open "Control Panel → Programs and Features"
2. Find "TunnelForge" in the list
3. Click "Uninstall"
4. Follow the uninstall wizard

#### Method 2: Command Line
```cmd
# Find installed version
wmic product where "name like '%TunnelForge%'" get name,version

# Uninstall (replace with actual version)
msiexec /x TunnelForge.msi
```

#### Method 3: Manual Cleanup
```cmd
# Remove program files
rmdir /s /q "C:\Program Files\TunnelForge"

# Remove user data
rmdir /s /q "%APPDATA%\TunnelForge"

# Remove registry entries
reg delete "HKCU\Software\TunnelForge" /f
```

### macOS

#### Method 1: Drag to Trash
1. Open `Applications` folder
2. Drag `TunnelForge.app` to Trash
3. Empty Trash

#### Method 2: Command Line
```bash
# Remove app
sudo rm -rf /Applications/TunnelForge.app

# Remove user data
rm -rf ~/Library/Application\ Support/TunnelForge
rm -rf ~/Library/Preferences/com.tunnelforge.plist
rm -rf ~/Library/Caches/com.tunnelforge

# Remove configuration
rm -rf ~/.config/TunnelForge
```

### Linux

#### Method 1: Package Manager
```bash
# Ubuntu/Debian
sudo apt-get remove tunnelforge
sudo apt-get autoremove

# Red Hat/Fedora
sudo dnf remove tunnelforge

# Snap
sudo snap remove tunnelforge
```

#### Method 2: Manual Removal
```bash
# Remove AppImage
rm /opt/tunnelforge.AppImage
rm /usr/local/bin/tunnelforge

# Remove user data
rm -rf ~/.config/TunnelForge
rm -rf ~/.local/share/TunnelForge

# Remove desktop entry
rm ~/.local/share/applications/tunnelforge.desktop
```

## Getting Help

If you encounter issues not covered in this guide:

1. **Check the logs**:
   - Windows: `%APPDATA%\TunnelForge\logs\`
   - macOS: `~/Library/Logs/TunnelForge/`
   - Linux: `~/.local/share/TunnelForge/logs/`

2. **Visit the documentation**: https://docs.tunnelforge.com

3. **Search existing issues**: https://github.com/ferg-cod3s/tunnelforge/issues

4. **Create a new issue**: Include:
   - Operating system and version
   - TunnelForge version
   - Error messages or logs
   - Steps to reproduce

5. **Community support**: https://discord.gg/tunnelforge

## Next Steps

After successful installation:

1. [Configure TunnelForge](CONFIGURATION.md)
2. [Set up authentication](AUTHENTICATION.md)
3. [Explore advanced features](ADVANCED.md)
4. [Deploy to production](DEPLOYMENT.md)