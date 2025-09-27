<!-- Generated: 2025-01-27 12:35:00 UTC -->
<p align="center">
  <img src="assets/banner.png" alt="TunnelForge Banner" />
</p>

<p align="center">
  <strong>Turn any browser into your terminal.</strong><br>
  TunnelForge proxies your terminals right into the browser, so you can code anywhere.
</p>

<p align="center">
  <a href="https://github.com/ferg-cod3s/tunnelforge/releases/latest"><img src="https://img.shields.io/badge/Download-macOS-blue" alt="Download"></a>
  <a href="https://www.npmjs.com/package/tunnelforge"><img src="https://img.shields.io/badge/npm-Package-orange" alt="npm Package"></a>
  <a href="https://formulae.brew.sh/cask/tunnelforge"><img src="https://img.shields.io/badge/homebrew-Cask-red" alt="Homebrew"></a>
  <a href="https://go.dev"><img src="https://img.shields.io/badge/Go-1.21+-00ADD8?logo=go" alt="Go 1.21+"></a>
  <a href="https://bun.sh"><img src="https://img.shields.io/badge/Bun-1.0+-F472B6?logo=bun" alt="Bun 1.0+"></a>
  <a href="https://tauri.app"><img src="https://img.shields.io/badge/Tauri-v2-FFC131?logo=tauri" alt="Tauri v2"></a>
  <a href="https://discord.gg/3Ub3EUwrcR"><img src="https://img.shields.io/discord/1394471066990280875?label=Discord&logo=discord" alt="Discord"></a>
  <a href="https://twitter.com/tunnelforge"><img src="https://img.shields.io/twitter/follow/tunnelforge?style=social" alt="Twitter"></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/tunnelforge"><img src="https://img.shields.io/badge/Linux-Supported-brightgreen" alt="Linux Support"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-green" alt="License"></a>
  <a href="https://www.apple.com/macos/"><img src="https://img.shields.io/badge/macOS-14.0+-red" alt="macOS 14.0+"></a>
  <a href="https://support.apple.com/en-us/HT211814"><img src="https://img.shields.io/badge/Apple%20Silicon-Required-orange" alt="Apple Silicon"></a>
  <a href="https://tunnelforge.sh/#support"><img src="https://img.shields.io/badge/Support%20us-on%20Polar-purple" alt="Support us on Polar"></a>
  <a href="https://deepwiki.com/johnferguson/tunnelforge"><img src="https://deepwiki.com/badge.svg" alt="Ask DeepWiki"></a>
</p>

<p align="center">
  <a href="https://docs.tunnelforge.sh">Documentation</a> •
  <a href="https://github.com/ferg-cod3s/tunnelforge/releases">Releases</a> •
  <a href="https://discord.gg/3Ub3EUwrcR">Discord</a> •
  <a href="https://twitter.com/tunnelforge">Twitter</a>
</p>

## 🚀 Status: Production Ready

**Latest Update (2025-09-27)**: Cross-platform implementation complete! TunnelForge now supports Windows, Linux, and macOS with native desktop applications and comprehensive web interface.

- ✅ **Go Server Backend** - Production-ready with WebSocket terminals
- ✅ **Tauri Desktop Apps** - Native cross-platform applications  
- ✅ **Bun Web Frontend** - Modern responsive interface
- ✅ **Packaging** - DEB, AppImage, MSI installers available
- ✅ **CI/CD** - Automated builds and releases configured

## Why TunnelForge?
## Why TunnelForge?

Ever wanted to check on your AI agents while you're away? Need to monitor that long-running build from your phone? Want to share a terminal session with a colleague without complex SSH setups? TunnelForge makes it happen with zero friction.

## Quick Start

### Installation

**macOS**: Download from [GitHub Releases](https://github.com/ferg-cod3s/tunnelforge/releases/latest)

**Linux**: 
```bash
# Ubuntu/Debian
sudo dpkg -i tunnelforge-server_1.0.0_amd64.deb

# Or use AppImage
chmod +x tunnelforge-server.AppImage
./tunnelforge-server.AppImage
```

**Windows**: Download MSI installer from [GitHub Releases](https://github.com/ferg-cod3s/tunnelforge/releases/latest)

**Server/Headless**: 
```bash
npm install -g tunnelforge
```

### Basic Usage

1. **Launch TunnelForge**: Lives in your menu bar (macOS) or run `tunnelforge` (Linux)
2. **Use the `vt` command** to forward any terminal session:
   ```bash
   vt claude --dangerously-skip-permissions  # Monitor AI agents
   vt npm run dev                            # Development servers
   vt python script.py                      # Any command
   ```
3. **Access your dashboard** at [http://localhost:4020](http://localhost:4020)

## Key Features

- **🌐 Browser-Based Access** - Control terminals from any device with a web browser
- **🤖 AI Agent Friendly** - Perfect for monitoring Claude Code, ChatGPT, or any terminal-based AI tools
- **🔄 Git Follow Mode** - Terminal automatically follows your IDE's branch switching
- **📊 Dynamic Terminal Titles** - Real-time activity tracking shows what's happening in each session
- **🔒 Secure by Design** - Multiple authentication modes, localhost-only mode, or secure tunneling
- **📱 Mobile Ready** - Responsive web interface for phones and tablets
- **🍎 Apple Silicon Native** - Optimized for Apple Silicon (M1+) Macs
- **🌍 Cross-Platform** - macOS, Linux, and Windows support (via Tauri v2)

## Architecture Status

> **🔄 Refactoring in Progress**: TunnelForge is being refactored from Node.js + SwiftUI to Go + Bun + Tauri for better performance and cross-platform support.

**Current**: Node.js server (port 4020) + SwiftUI macOS app
**Target**: Go server (port 4021) + Bun frontend (port 3001) + Tauri v2 desktop apps

## Documentation

📚 **Complete Documentation**: See our [Documentation Index](docs/INDEX.md) for all guides, tutorials, and references.

### Quick Links

#### Getting Started
- **[Installation Guide](docs/INSTALLATION.md)** - Detailed installation for all platforms
- **[User Guide](docs/USER_GUIDE.md)** - Complete usage guide and tutorials
- **[Contributing](docs/CONTRIBUTING.md)** - Development setup and contribution guidelines

#### Configuration & Usage
- **[Authentication](docs/authentication.md)** - Security setup and authentication modes
- **[Remote Access](docs/TESTING_EXTERNAL_DEVICES.md)** - Access TunnelForge from external devices
- **[Git Worktree Follow Mode](docs/git-worktree-follow-mode.md)** - Advanced Git workflow integration
- **[Keyboard Shortcuts](docs/keyboard-shortcuts.md)** - Complete shortcut reference

#### Development
- **[Architecture](docs/ARCHITECTURE.md)** - System design and component overview
- **[Development Guide](docs/development.md)** - Setup and development workflow
- **[Build System](docs/build-system.md)** - Build process and CI/CD
- **[Release Process](docs/RELEASE.md)** - How to create releases
- **[API Documentation](docs/API.md)** - REST and WebSocket API reference

#### Tools & Integration
- **[Claude CLI Usage](docs/claude.md)** - Using Claude AI with TunnelForge
- **[Gemini CLI](docs/gemini.md)** - Large codebase analysis tool
- **[Testing](docs/testing.md)** - Testing strategy and test suites
- **[Performance](docs/performance.md)** - Performance optimization guide

### Documentation Website

Interactive user documentation: **[https://docs.tunnelforge.sh](https://docs.tunnelforge.sh)**

## Community & Support

- **[Discord](https://discord.gg/3Ub3EUwrcR)** - Join our community for help and discussions
- **[GitHub Issues](https://github.com/ferg-cod3s/tunnelforge/issues)** - Bug reports and feature requests
- **[Twitter](https://twitter.com/tunnelforge)** - Follow us for updates
- **[Support us on Polar](https://tunnelforge.sh/#support)** - Help keep development going

## Credits

Created with ❤️ by [@badlogic](https://mariozechner.at/), [@mitsuhiko](https://lucumr.pocoo.org/), [@steipete](https://steipete.com/), [@hjanuschka](https://x.com/hjanuschka), and [@manuelmaly](https://x.com/manuelmaly).

## License

MIT License - see [LICENSE](LICENSE) for details.

---

**Ready to tunnel?** [Download TunnelForge](https://github.com/ferg-cod3s/tunnelforge/releases/latest) and turn any browser into your terminal!
