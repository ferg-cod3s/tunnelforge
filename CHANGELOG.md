# Changelog

## [1.0.0-beta.2] - 2025-06-19

### 🎨 Improvements
- Redesigned slick new web frontend
- Faster terminal rendering in the web frontend
- New Sessions spawn new Terminal windows. (This needs Applescript and Accessibility permissions)
- Enhanced font handling with system font priority
- Better async operations in PTY service for improved performance
- Improved window activation when showing the welcome and settings windows
- Preparations for Linux support

### 🐛 Bug Fixes
- Fixed window front order when dock icon is hidden
- Fixed PTY service enhancements with proper async operations

## [1.0.0-beta.1] - 2025-06-17

### 🎉 First Public Beta Release

This is the first public beta release of VibeTunnel, ready for testing by early adopters.

### ✨ What's Included
- Complete terminal session proxying to web browsers
- Support for multiple concurrent sessions
- Real-time terminal rendering with full TTY support
- Secure password-protected dashboard
- Tailscale and ngrok integration for remote access
- Automatic updates via Sparkle framework
- Native macOS menu bar application

### 🐛 Bug Fixes Since Internal Testing
- Fixed visible circle spacer in menu (now uses Color.clear)
- Removed development files from app bundle
- Enhanced build process with automatic cleanup
- Fixed Sparkle API compatibility for v2.7.0

### 📝 Notes
- This is a beta release - please report any issues on GitHub
- Auto-update functionality is fully enabled
- All core features are stable and ready for daily use

### ✨ What's New Since Internal Testing
- Improved stability and performance
- Enhanced error handling for edge cases
- Refined UI/UX based on internal feedback
- Better session cleanup and resource management
- Optimized for macOS Sonoma and Sequoia

### 🐛 Known Issues
- Occasional connection drops with certain terminal applications
- Performance optimization needed for very long sessions
- Some terminal escape sequences may not render perfectly

### 📝 Notes
- This is a beta release - please report any issues on GitHub
- Auto-update functionality is fully enabled
- All core features are stable and ready for daily use

## [1.0.0] - 2025-06-16

### 🎉 Initial Release

VibeTunnel is a native macOS application that proxies terminal sessions to web browsers, allowing you to monitor and control terminals from any device.

### ✨ Core Features

#### Terminal Management
- **Terminal Session Proxying** - Run any command with `vt` prefix to make it accessible via web browser
- **Multiple Concurrent Sessions** - Support for multiple terminal sessions running simultaneously
- **Session Recording** - All sessions automatically recorded in asciinema format for later playback
- **Full TTY Support** - Proper handling of terminal control sequences, colors, and special characters
- **Interactive Commands** - Support for interactive applications like vim, htop, and more
- **Shell Integration** - Direct shell access with `vt --shell` or `vt -i`

#### Web Interface
- **Browser-Based Dashboard** - Access all terminal sessions at http://localhost:4020
- **Real-time Terminal Rendering** - Live terminal output using asciinema player
- **WebSocket Streaming** - Low-latency real-time updates for terminal I/O
- **Mobile Responsive** - Fully functional on phones, tablets, and desktop browsers
- **Session Management UI** - Create, view, kill, and manage sessions from the web interface

#### Security & Access Control
- **Password Protection** - Optional password authentication for dashboard access
- **Keychain Integration** - Secure password storage using macOS Keychain
- **Access Modes** - Choose between localhost-only, network, or secure tunneling
- **Basic Authentication** - HTTP Basic Auth support for network access

#### Remote Access Options
- **Tailscale Integration** - Access VibeTunnel through your Tailscale network
- **ngrok Support** - Built-in ngrok tunneling for public access with authentication
- **Network Mode** - Local network access with IP-based connections

#### macOS Integration
- **Menu Bar Application** - Lives in the system menu bar with optional dock mode
- **Launch at Login** - Automatic startup with macOS
- **Auto Updates** - Sparkle framework integration for seamless updates
- **Native Swift/SwiftUI** - Built with modern macOS technologies
- **Universal Binary** - Native support for both Intel and Apple Silicon Macs

#### CLI Tool (`vt`)
- **Command Wrapper** - Prefix any command with `vt` to tunnel it
- **Claude Integration** - Special support for AI assistants with `vt --claude` and `vt --claude-yolo`
- **Direct Execution** - Bypass shell with `vt -S` for direct command execution
- **Automatic Installation** - CLI tool automatically installed to /usr/local/bin

#### Server Implementation
- **Dual Server Architecture** - Choose between Rust (default) or Swift server backends
- **High Performance** - Rust server for efficient TTY forwarding and process management
- **RESTful APIs** - Clean API design for session management
- **Health Monitoring** - Built-in health check endpoints

#### Developer Features
- **Server Console** - Debug view showing server logs and diagnostics
- **Configurable Ports** - Change server port from default 4020
- **Session Cleanup** - Automatic cleanup of stale sessions on startup
- **Comprehensive Logging** - Detailed logs for debugging

### 🛠️ Technical Details

- **Minimum macOS Version**: 14.0 (Sonoma)
- **Architecture**: Universal Binary (Intel + Apple Silicon)
- **Languages**: Swift 6.0, Rust, TypeScript
- **UI Framework**: SwiftUI
- **Web Technologies**: TypeScript, Tailwind CSS, WebSockets
- **Build System**: Xcode, Swift Package Manager, Cargo, npm

### 📦 Installation

- Download DMG from GitHub releases
- Drag VibeTunnel to Applications folder
- Launch from Applications or Spotlight
- CLI tool (`vt`) automatically installed on first launch

### 🚀 Quick Start

```bash
# Monitor AI agents
vt claude

# Run development servers  
vt npm run dev

# Watch long-running processes
vt python train_model.py

# Open interactive shell
vt --shell
```

### 👥 Contributors

Created by:
- [@badlogic](https://mariozechner.at/) - Mario Zechner
- [@mitsuhiko](https://lucumr.pocoo.org/) - Armin Ronacher  
- [@steipete](https://steipete.com/) - Peter Steinberger

### 📄 License

VibeTunnel is open source software licensed under the MIT License.

---

## Version History

### Pre-release Development

The project went through extensive development before the 1.0.0 release, including:

- Initial TTY forwarding implementation using Rust
- macOS app foundation with SwiftUI
- Integration of asciinema format for session recording
- Web frontend development with real-time terminal rendering
- Hummingbird HTTP server implementation
- ngrok integration for secure tunneling
- Sparkle framework integration for auto-updates
- Comprehensive testing and bug fixes
- UI/UX refinements and mobile optimizations