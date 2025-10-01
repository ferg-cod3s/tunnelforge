# TunnelForge Installation Guide

Complete installation instructions for TunnelForge across all platforms.

## Quick Start

Choose your platform:
- [macOS](#macos)
- [Linux](#linux)
  - [Debian/Ubuntu](#debianubuntu)
  - [Fedora/RHEL](#fedorarhel)
  - [Arch Linux](#arch-linux)
  - [AppImage](#appimage-universal-linux)
  - [Snap](#snap)
- [Windows](#windows)
  - [Chocolatey](#chocolatey)
  - [winget](#winget)
  - [MSI Installer](#msi-installer)
- [Docker](#docker)
- [From Source](#building-from-source)

---

## macOS

### Homebrew (Recommended)

```bash
# Add TunnelForge tap
brew tap tunnelforge/tap

# Install TunnelForge
brew install tunnelforge

# Launch the desktop app
open /Applications/TunnelForge.app

# Or start the server directly
tunnelforge-server
```

### DMG Installer

1. Download the latest DMG from [Releases](https://github.com/tunnelforge/tunnelforge/releases)
   - **Apple Silicon (M1/M2/M3)**: `TunnelForge-arm64.dmg`
   - **Intel**: `TunnelForge-x86_64.dmg`
2. Open the DMG file
3. Drag **TunnelForge.app** to Applications folder
4. Launch from Applications or Spotlight

### First Launch on macOS

macOS may show a security warning for unsigned applications:

```bash
# Allow the app to run
xattr -d com.apple.quarantine /Applications/TunnelForge.app
```

Or: System Preferences → Security & Privacy → Click "Open Anyway"

---

## Linux

### Debian/Ubuntu

#### APT Repository (Recommended)

```bash
# Add GPG key
curl -fsSL https://apt.tunnelforge.dev/gpg.key | sudo gpg --dearmor -o /usr/share/keyrings/tunnelforge-archive-keyring.gpg

# Add repository
echo "deb [signed-by=/usr/share/keyrings/tunnelforge-archive-keyring.gpg] https://apt.tunnelforge.dev/debian stable main" | sudo tee /etc/apt/sources.list.d/tunnelforge.list

# Update and install
sudo apt update
sudo apt install tunnelforge
```

#### DEB Package

```bash
# Download DEB from releases
wget https://github.com/tunnelforge/tunnelforge/releases/latest/download/tunnelforge_amd64.deb

# Install
sudo dpkg -i tunnelforge_amd64.deb
sudo apt-get install -f  # Install dependencies if needed

# Launch
tunnelforge
```

### Fedora/RHEL

```bash
# Download RPM from releases
wget https://github.com/tunnelforge/tunnelforge/releases/latest/download/tunnelforge-1.0.0-1.x86_64.rpm

# Install
sudo dnf install ./tunnelforge-1.0.0-1.x86_64.rpm

# Or with yum
sudo yum localinstall tunnelforge-1.0.0-1.x86_64.rpm

# Launch
tunnelforge
```

### Arch Linux

```bash
# Install from AUR (coming soon)
yay -S tunnelforge

# Or build from source
git clone https://aur.archlinux.org/tunnelforge.git
cd tunnelforge
makepkg -si
```

### AppImage (Universal Linux)

Works on any Linux distribution:

```bash
# Download AppImage
wget https://github.com/tunnelforge/tunnelforge/releases/latest/download/TunnelForge-x86_64.AppImage

# Make executable
chmod +x TunnelForge-x86_64.AppImage

# Run
./TunnelForge-x86_64.AppImage
```

**Optional**: Integrate with system:

```bash
# Move to a permanent location
sudo mv TunnelForge-x86_64.AppImage /opt/tunnelforge/

# Create desktop entry
cat > ~/.local/share/applications/tunnelforge.desktop <<EOF
[Desktop Entry]
Name=TunnelForge
Exec=/opt/tunnelforge/TunnelForge-x86_64.AppImage
Icon=tunnelforge
Type=Application
Categories=Development;Network;
EOF
```

### Snap

```bash
# Install from Snap Store
sudo snap install tunnelforge

# Grant necessary permissions
sudo snap connect tunnelforge:network-control
sudo snap connect tunnelforge:system-observe

# Launch
tunnelforge
```

---

## Windows

### Chocolatey

```powershell
# Install Chocolatey if not installed
# See: https://chocolatey.org/install

# Install TunnelForge
choco install tunnelforge

# Launch
tunnelforge
```

### winget

```powershell
# Install TunnelForge
winget install TunnelForge.TunnelForge

# Launch from Start Menu or:
tunnelforge
```

### MSI Installer

1. Download `TunnelForge-x64.msi` from [Releases](https://github.com/tunnelforge/tunnelforge/releases)
2. Double-click the MSI file
3. Follow installation wizard
4. TunnelForge will be installed to `C:\Program Files\TunnelForge`
5. Launch from Start Menu or Desktop shortcut

**Note**: Windows may show SmartScreen warning for unsigned installers:
- Click "More info" → "Run anyway"

---

## Docker

### Run with Docker

```bash
# Pull the latest image
docker pull ghcr.io/tunnelforge/tunnelforge:latest

# Run TunnelForge server
docker run -d \
  --name tunnelforge \
  -p 4021:4021 \
  -p 3001:3001 \
  -v tunnelforge-data:/data \
  ghcr.io/tunnelforge/tunnelforge:latest

# Access web UI
open http://localhost:3001
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  tunnelforge:
    image: ghcr.io/tunnelforge/tunnelforge:latest
    container_name: tunnelforge
    ports:
      - "4021:4021"  # API server
      - "3001:3001"  # Web UI
    volumes:
      - tunnelforge-data:/data
      - /var/run/docker.sock:/var/run/docker.sock  # Optional: Docker integration
    environment:
      - TUNNELFORGE_PORT=4021
      - TUNNELFORGE_WEB_PORT=3001
      - TUNNELFORGE_NO_AUTH=false
    restart: unless-stopped

volumes:
  tunnelforge-data:
```

Run:

```bash
docker-compose up -d
```

---

## Building from Source

### Prerequisites

- **Go** 1.21+ (for server)
- **Bun** 1.0+ (for web frontend)
- **Rust** 1.70+ (for desktop app)
- **Node.js** 18+ (for Tauri CLI)

### Clone Repository

```bash
git clone https://github.com/tunnelforge/tunnelforge.git
cd tunnelforge
```

### Build Go Server

```bash
cd server

# Build for your platform
go build -o tunnelforge-server ./cmd/server

# Or build for all platforms
make build-all

# Run server
./tunnelforge-server
```

### Build Web Frontend

```bash
cd web

# Install dependencies
bun install

# Build production bundle
bun run build

# Run development server
bun run dev
```

### Build Desktop App

```bash
cd desktop

# Install dependencies
bun install

# Build for your platform
bun run tauri build

# Or build for specific platform
bun run tauri build --target x86_64-pc-windows-msvc      # Windows
bun run tauri build --target x86_64-unknown-linux-gnu    # Linux
bun run tauri build --target x86_64-apple-darwin         # macOS Intel
bun run tauri build --target aarch64-apple-darwin        # macOS Apple Silicon
```

Built files will be in `desktop/src-tauri/target/release/bundle/`

---

## Configuration

### Server Configuration

TunnelForge looks for configuration in these locations (in order):

1. `./tunnelforge.yml` (current directory)
2. `~/.config/tunnelforge/config.yml` (Linux/macOS)
3. `%APPDATA%\TunnelForge\config.yml` (Windows)

Example `tunnelforge.yml`:

```yaml
server:
  port: 4021
  host: "0.0.0.0"
  
web:
  port: 3001
  enable: true
  
auth:
  enabled: true
  jwt_secret: "your-secret-key"
  
sessions:
  persistence: true
  save_interval: 30s
  
tunnels:
  cloudflare:
    enabled: true
  ngrok:
    enabled: true
    auth_token: "your-ngrok-token"
  tailscale:
    enabled: true
```

### Environment Variables

```bash
# Server settings
export TUNNELFORGE_PORT=4021
export TUNNELFORGE_HOST=0.0.0.0

# Authentication
export TUNNELFORGE_NO_AUTH=false
export TUNNELFORGE_JWT_SECRET=your-secret-key

# Logging
export TUNNELFORGE_LOG_LEVEL=info

# Tunnels
export NGROK_AUTH_TOKEN=your-ngrok-token
```

### Auto-Start Configuration

#### macOS

```bash
# Create Launch Agent
mkdir -p ~/Library/LaunchAgents
cat > ~/Library/LaunchAgents/dev.tunnelforge.server.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>dev.tunnelforge.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/tunnelforge-server</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF

# Load service
launchctl load ~/Library/LaunchAgents/dev.tunnelforge.server.plist
```

#### Linux (systemd)

```bash
# Create systemd service
sudo tee /etc/systemd/system/tunnelforge.service <<EOF
[Unit]
Description=TunnelForge Server
After=network.target

[Service]
Type=simple
User=$USER
ExecStart=/usr/bin/tunnelforge-server
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable tunnelforge
sudo systemctl start tunnelforge
```

#### Windows (Task Scheduler)

```powershell
# Create scheduled task
$action = New-ScheduledTaskAction -Execute "C:\Program Files\TunnelForge\tunnelforge-server.exe"
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -LogonType Interactive
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName "TunnelForge Server" -Action $action -Trigger $trigger -Principal $principal -Settings $settings
```

---

## Verification

After installation, verify TunnelForge is working:

```bash
# Check server version
tunnelforge-server --version

# Check server health
curl http://localhost:4021/health

# Check web UI
curl http://localhost:3001
```

Expected output:
```json
{"status":"ok","version":"1.0.0"}
```

---

## Updating

### Homebrew

```bash
brew update
brew upgrade tunnelforge
```

### APT (Debian/Ubuntu)

```bash
sudo apt update
sudo apt upgrade tunnelforge
```

### Chocolatey

```powershell
choco upgrade tunnelforge
```

### winget

```powershell
winget upgrade TunnelForge.TunnelForge
```

### Snap

```bash
sudo snap refresh tunnelforge
```

---

## Uninstallation

### macOS

```bash
# Homebrew
brew uninstall tunnelforge
brew untap tunnelforge/tap

# DMG installation
rm -rf /Applications/TunnelForge.app
```

### Linux

```bash
# APT
sudo apt remove tunnelforge

# DNF/YUM
sudo dnf remove tunnelforge

# Snap
sudo snap remove tunnelforge

# AppImage
rm ~/TunnelForge-x86_64.AppImage
```

### Windows

```powershell
# Chocolatey
choco uninstall tunnelforge

# winget
winget uninstall TunnelForge.TunnelForge

# MSI: Use "Add or Remove Programs" in Windows Settings
```

---

## Troubleshooting

### Port Already in Use

If ports 4021 or 3001 are already in use:

```bash
# Change default ports
tunnelforge-server --port 5021 --web-port 5001

# Or set environment variables
export TUNNELFORGE_PORT=5021
export TUNNELFORGE_WEB_PORT=5001
```

### Permission Errors (Linux/macOS)

```bash
# Fix file permissions
chmod +x tunnelforge-server

# Or use sudo for system-wide installation
sudo mv tunnelforge-server /usr/local/bin/
```

### Firewall Issues

Ensure ports 4021 and 3001 are open:

```bash
# Linux (ufw)
sudo ufw allow 4021
sudo ufw allow 3001

# macOS
# System Preferences → Security & Privacy → Firewall → Firewall Options
# Add TunnelForge to allowed applications

# Windows
# Windows Defender Firewall → Advanced Settings → Inbound Rules
# Add rules for ports 4021 and 3001
```

### Tunnel Integration Issues

**Cloudflare Tunnel**:
```bash
# Install cloudflared
# macOS
brew install cloudflare/cloudflare/cloudflared

# Linux
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared

# Windows
# Download from: https://github.com/cloudflare/cloudflared/releases
```

**ngrok**:
```bash
# Install ngrok and authenticate
ngrok authtoken YOUR_TOKEN
```

---

## Support

- **Documentation**: https://tunnelforge.dev/docs
- **Issues**: https://github.com/tunnelforge/tunnelforge/issues
- **Discussions**: https://github.com/tunnelforge/tunnelforge/discussions
- **Discord**: https://discord.gg/tunnelforge

---

## Next Steps

1. [Quick Start Guide](docs/QUICKSTART.md)
2. [Configuration Reference](docs/CONFIGURATION.md)
3. [API Documentation](docs/API.md)
4. [Tunnel Integration Guide](docs/TUNNELS.md)

---

*Last Updated: 2025-10-01*
