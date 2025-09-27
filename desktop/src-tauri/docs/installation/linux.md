# TunnelForge Linux Installation Guide

## System Requirements

- Modern Linux distribution (Ubuntu 20.04+, Fedora 35+, etc.)
- X11 or Wayland display server
- 4GB RAM minimum
- 500MB free disk space
- GTK 3.0+ and WebKit2GTK 4.0+

## Installation Methods

### Method 1: AppImage (Universal)

1. Download the latest AppImage from [TunnelForge Releases](https://github.com/tunnelforge/desktop/releases)
2. Make the AppImage executable:
   ```bash
   chmod +x TunnelForge-x86_64.AppImage
   ```
3. Run the AppImage:
   ```bash
   ./TunnelForge-x86_64.AppImage
   ```

Optional: Integrate with desktop
```bash
# Install desktop integration
./TunnelForge-x86_64.AppImage --install

# Create menu entry
mkdir -p ~/.local/share/applications
cat > ~/.local/share/applications/tunnelforge.desktop << EOL
[Desktop Entry]
Name=TunnelForge
Exec=/path/to/TunnelForge-x86_64.AppImage
Terminal=false
Type=Application
Icon=tunnelforge
Categories=Development;Network;
EOL
```

### Method 2: DEB Package (Debian/Ubuntu)

1. Download the latest .deb package
2. Install using apt:
   ```bash
   sudo apt install ./tunnelforge_1.0.0_amd64.deb
   ```
   Or using dpkg:
   ```bash
   sudo dpkg -i tunnelforge_1.0.0_amd64.deb
   sudo apt-get install -f  # Install dependencies
   ```

### Method 3: RPM Package (Fedora/RHEL)

1. Download the latest .rpm package
2. Install using dnf:
   ```bash
   sudo dnf install ./tunnelforge-1.0.0-1.x86_64.rpm
   ```
   Or using rpm:
   ```bash
   sudo rpm -i tunnelforge-1.0.0-1.x86_64.rpm
   ```

## Post-Installation

### First Run
1. Launch TunnelForge from:
   - Application menu
   - Command line: `tunnelforge`
   - Desktop shortcut (if created)

2. Initial Setup:
   - Accept any prompts for system integration
   - Configure auto-start preference
   - Set up authentication (optional)

### System Service
TunnelForge installs a systemd service for background operation:

- Service Name: `tunnelforge-agent.service`
- User Service: `~/.config/systemd/user/tunnelforge-agent.service`

Service Management:
```bash
# User service
systemctl --user status tunnelforge-agent
systemctl --user start tunnelforge-agent
systemctl --user enable tunnelforge-agent

# System service (if installed)
sudo systemctl status tunnelforge-agent
sudo systemctl start tunnelforge-agent
sudo systemctl enable tunnelforge-agent
```

### System Integration

TunnelForge integrates with Linux in several ways:

1. **Auto-start**: 
   ```bash
   # XDG autostart entry
   ~/.config/autostart/tunnelforge.desktop
   ```

2. **System Tray**:
   - Uses GTK status icon
   - Requires system tray support
   - Compatible with most desktop environments

3. **File Associations**:
   - `.tunnelforge` files
   - `tunnelforge://` URL handler
   - MIME type registration

4. **Desktop Integration**:
   - Application menu entry
   - Icon themes support
   - DBus integration

## Configuration

### Main Configuration
Location: `~/.config/tunnelforge/config.toml`

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

### System Configuration
Location: `/etc/tunnelforge/config.toml`

```toml
[system]
log_dir = "/var/log/tunnelforge"
data_dir = "/var/lib/tunnelforge"

[service]
user = "tunnelforge"
group = "tunnelforge"
```

### Environment Variables
- `TUNNELFORGE_HOME`: Installation directory
- `TUNNELFORGE_CONFIG`: User configuration directory
- `TUNNELFORGE_LOG_LEVEL`: Log verbosity
- `TUNNELFORGE_SYSTEM_CONFIG`: System configuration path

## Troubleshooting

### Common Issues

1. **Missing Dependencies**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install libgtk-3-0 libwebkit2gtk-4.0-37

   # Fedora
   sudo dnf install gtk3 webkit2gtk4.0

   # Arch Linux
   sudo pacman -S gtk3 webkit2gtk
   ```

2. **Permission Issues**
   ```bash
   # Fix home directory permissions
   chmod 755 ~
   chmod -R u+rw ~/.config/tunnelforge

   # Fix system permissions
   sudo chown -R $USER:$USER ~/.config/tunnelforge
   ```

3. **Service Problems**
   ```bash
   # Check service status
   systemctl --user status tunnelforge-agent

   # Check service logs
   journalctl --user -u tunnelforge-agent

   # Reset service
   systemctl --user restart tunnelforge-agent
   ```

4. **Display Issues**
   ```bash
   # Check Wayland/X11
   echo $XDG_SESSION_TYPE

   # Force X11 backend
   export GDK_BACKEND=x11
   ```

### Log Files

1. **Application Logs**:
   ```
   ~/.local/share/tunnelforge/logs/tunnelforge.log
   ```

2. **Service Logs**:
   ```
   ~/.local/share/tunnelforge/logs/service.log
   /var/log/tunnelforge/service.log (system service)
   ```

3. **System Journal**:
   ```bash
   # User service logs
   journalctl --user -u tunnelforge-agent

   # System service logs
   sudo journalctl -u tunnelforge-agent
   ```

### Support Resources

- [Documentation](https://docs.tunnelforge.dev)
- [GitHub Issues](https://github.com/tunnelforge/desktop/issues)
- [Community Forum](https://community.tunnelforge.dev)
- Email: support@tunnelforge.dev

## Uninstallation

### AppImage
1. Remove the AppImage file
2. Clean up integration (if installed):
   ```bash
   rm ~/.local/share/applications/tunnelforge.desktop
   rm -rf ~/.local/share/tunnelforge
   rm -rf ~/.config/tunnelforge
   ```

### DEB Package
```bash
sudo apt remove tunnelforge
sudo apt purge tunnelforge  # Remove configuration
```

### RPM Package
```bash
sudo dnf remove tunnelforge
sudo dnf erase tunnelforge  # Remove configuration
```

### Manual Cleanup
```bash
# Remove user data
rm -rf ~/.config/tunnelforge
rm -rf ~/.local/share/tunnelforge
rm -rf ~/.cache/tunnelforge

# Remove system data (if installed)
sudo rm -rf /etc/tunnelforge
sudo rm -rf /var/log/tunnelforge
sudo rm -rf /var/lib/tunnelforge
```

## Security Notes

1. **Package Verification**
   ```bash
   # Verify DEB signature
   dpkg-sig --verify tunnelforge_1.0.0_amd64.deb

   # Verify RPM signature
   rpm -K tunnelforge-1.0.0-1.x86_64.rpm

   # Verify AppImage signature
   gpg --verify TunnelForge-x86_64.AppImage.asc
   ```

2. **Network Security**
   - Default localhost-only binding
   - TLS 1.2+ for all connections
   - Certificate validation enabled

3. **Data Protection**
   - Configuration file permissions
   - Secure credential storage using libsecret
   - Audit logging capability

4. **Service Security**
   - Runs as user service by default
   - Minimal required capabilities
   - Sandboxed execution environment

## Updates

TunnelForge includes automatic update checking:

1. **Automatic Updates**
   - Checks daily for new versions
   - Downloads updates in background
   - Prompts for installation

2. **Manual Updates**
   - Check: Help → Check for Updates
   - Download from releases page
   - Install using package manager

3. **Update Settings**
   - Configure in Preferences → Updates
   - Set check frequency
   - Enable/disable automatic downloads

## Enterprise Deployment

For enterprise environments:

1. **Silent Installation**
   ```bash
   # DEB
   sudo DEBIAN_FRONTEND=noninteractive apt install ./tunnelforge.deb

   # RPM
   sudo rpm -i --quiet tunnelforge.rpm
   ```

2. **Configuration Management**
   - Ansible playbooks available
   - Puppet module support
   - Chef cookbook integration

3. **Network Requirements**
   - Inbound: TCP 4021 (default)
   - Outbound: HTTPS (443)
   - Optional: LDAP integration

4. **Security Considerations**
   - Package signature verification
   - SELinux/AppArmor profiles
   - Audit logging integration
   - Access control policies

---

For additional help or enterprise support, contact support@tunnelforge.dev
