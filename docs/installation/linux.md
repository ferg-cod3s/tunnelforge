# Linux Installation Guide

This guide explains how to install TunnelForge on various Linux distributions including Ubuntu, Debian, Fedora, Arch Linux, and others.

## System Requirements

### Minimum Requirements
- **Distribution**: Ubuntu 20.04+, Debian 11+, Fedora 35+, Arch Linux
- **RAM**: 4 GB
- **Storage**: 500 MB free space
- **Network**: Internet connection for initial setup
- **Dependencies**: WebKit2GTK 4.0+, GTK 3.0+

### Recommended Requirements
- **Distribution**: Ubuntu 22.04+, Fedora 37+, Arch Linux (latest)
- **RAM**: 8 GB
- **Storage**: 1 GB free space
- **Network**: Broadband internet connection

## Installation Methods

### Method 1: AppImage (Universal, Recommended)

1. **Download the AppImage**
   ```bash
   # Download from GitHub releases
   curl -L -o TunnelForge-latest.AppImage https://github.com/ferg-cod3s/tunnelforge/releases/latest/download/TunnelForge-x86_64.AppImage
   ```

2. **Make executable and run**
   ```bash
   # Make executable
   chmod +x TunnelForge-latest.AppImage
   
   # Run directly
   ./TunnelForge-latest.AppImage
   
   # Optional: Create desktop shortcut
   ./TunnelForge-latest.AppImage --appimage-extract
   sudo mv squashfs-root /opt/TunnelForge
   sudo ln -s /opt/TunnelForge/AppRun /usr/local/bin/tunnelforge
   ```

3. **Verify installation**
   ```bash
   # Check if running
   ps aux | grep TunnelForge
   
   # Check version
   ./TunnelForge-latest.AppImage --version
   ```

### Method 2: Debian/Ubuntu Package (.deb)

1. **Download the .deb package**
   ```bash
   curl -L -o tunnelforge_amd64.deb https://github.com/ferg-cod3s/tunnelforge/releases/latest/download/tunnelforge_*_amd64.deb
   ```

2. **Install the package**
   ```bash
   # Install with apt
   sudo apt update
   sudo apt install -y ./tunnelforge_amd64.deb
   
   # Fix any missing dependencies
   sudo apt install -f -y
   ```

3. **Verify installation**
   ```bash
   # Check installed package
   dpkg -l | grep tunnelforge
   
   # Check if service is running
   systemctl status tunnelforge
   ```

### Method 3: Red Hat/Fedora Package (.rpm)

1. **Download the .rpm package**
   ```bash
   curl -L -o tunnelforge.x86_64.rpm https://github.com/ferg-cod3s/tunnelforge/releases/latest/download/tunnelforge-*.x86_64.rpm
   ```

2. **Install the package**
   ```bash
   # Install with dnf (Fedora)
   sudo dnf install -y ./tunnelforge.x86_64.rpm
   
   # OR install with yum (CentOS/RHEL)
   sudo yum localinstall -y ./tunnelforge.x86_64.rpm
   ```

3. **Verify installation**
   ```bash
   # Check installed package
   rpm -q tunnelforge
   
   # Check if service is running
   systemctl status tunnelforge
   ```

### Method 4: Arch Linux (AUR)

1. **Install from AUR**
   ```bash
   # Using yay
   yay -S tunnelforge
   
   # OR using paru
   paru -S tunnelforge
   ```

2. **Verify installation**
   ```bash
   # Check installed package
   pacman -Q tunnelforge
   
   # Check if service is running
   systemctl status tunnelforge
   ```

## Post-Installation Setup

### Initial Configuration

1. **Launch TunnelForge**
   ```bash
   # From application menu or desktop shortcut
   # OR run directly:
   tunnelforge
   
   # OR run AppImage:
   ./TunnelForge-latest.AppImage
   ```

2. **Complete first-time setup**
   - Choose data directory (default: `~/.config/TunnelForge`)
   - Configure server settings
   - Set up authentication
   - Choose theme and preferences

### Systemd Integration

TunnelForge integrates with systemd for automatic startup:

```bash
# Enable TunnelForge service
sudo systemctl enable tunnelforge

# Start the service
sudo systemctl start tunnelforge

# Check service status
systemctl status tunnelforge

# View logs
journalctl -u tunnelforge -f
```

### Desktop Integration

- **Desktop file**: Installed to `/usr/share/applications/tunnelforge.desktop`
- **Icons**: Installed to `/usr/share/icons/hicolor/*/apps/tunnelforge.png`
- **MIME types**: Associated with terminal and session files

## Configuration

### Settings Location
- **User data**: `~/.config/TunnelForge/`
- **Configuration file**: `config.json`
- **Logs**: `logs/` directory
- **Sessions**: `sessions/` directory

### Environment Variables

```bash
# Set custom data directory
export TUNNELFORGE_DATA_DIR="$HOME/TunnelForgeData"

# Set custom port
export TUNNELFORGE_PORT=8080

# Enable debug mode
export TUNNELFORGE_DEBUG=1

# Add to shell profile for persistence
echo 'export TUNNELFORGE_DATA_DIR="$HOME/TunnelForgeData"' >> ~/.bashrc
```

### System Configuration

```bash
# Create systemd user service for auto-start
mkdir -p ~/.config/systemd/user/
cat > ~/.config/systemd/user/tunnelforge.service << 'EOF'
[Unit]
Description=TunnelForge Terminal Sharing
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/tunnelforge
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
