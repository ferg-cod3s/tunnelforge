# Changelog

## [1.0.0-beta.13] - 2025-07-19

### **Terminal Performance Mode (Experimental) **
- New binary WebSocket mode for terminal sessions dramatically improves performance for high-throughput operations (#412)
- Toggle between standard SSE mode and high-performance binary mode in terminal settings
- Binary mode significantly reduces latency and CPU usage when running commands with heavy output
- Seamless switching between modes without losing your session

### **Enhanced Terminal Control** 
- Uninstall option for the `vt` command line tool now available in settings (#407)
- Simple trash icon button to cleanly remove the CLI tool when needed
- Proper cleanup of both standard and Homebrew installation paths

### **Screen Sharing Removed**
- Removed screen sharing feature to focus on core terminal functionality (#415)
- Eliminated ~17,000 lines of WebRTC and screen capture code
- No longer requests screen recording permissions
- Screen Sharing is out of scope for the 1.0 release

### 🐛 Bug Fixes
- Fixed server crashes when using special characters (like `*`) in terminal status messages (#398)
- Resolved "Kill All Sessions" button failing silently in compact/sidebar view (#418)
- Fixed network bind address reverting to localhost after server restarts (#404)
- Ghostty terminal now properly spawns and executes commands if there are no windows (#408)

### 📚 Documentation
- Added complete HQ mode documentation covering distributed deployments
- Organized all documentation into logical categories with Mintlify

## [1.0.0-beta.12] - 2025-07-17

#### **Welcome Screen Performance**
- Background folder scanning eliminates UI freeze when opening the welcome screen (#394)
- Improved startup performance with optimized web directory structure
- Much smoother experience when working with large project directories

#### **SSH Agent Reliability**
- Fixed SSH key generation errors on non-localhost HTTP connections (#392)
- SSH agent now works correctly when accessing VibeTunnel via ngrok or from another device
- Improved security and reliability for remote access scenarios

#### **npm Package Stability**
- Fixed critical installation issues on Linux systems (#393)
- `authenticate-pam` now properly handled as optional dependency
- Enhanced cross-platform compatibility for Ubuntu and other distributions
- Comprehensive vt command tests ensure reliability across environments

#### **Developer Experience**
- Fixed missing public directory in Mac app bundle (#392)
- Resolved TypeScript type annotations throughout codebase
- Improved lint compliance and code quality
- Streamlined CI/CD workflow for more reliable builds

### 🐛 Bug Fixes

- Fixed vt command syntax errors on Linux systems (#393)
- Fixed welcome screen lag during folder scanning (#394)
- Resolved missing icons and resources in Mac app
- Fixed lint and type errors across the codebase
- Cleaned up duplicate and stray files from web directory

## [1.0.0-beta.11] - 2025-07-17

#### **Better Settings Organization**
- Reorganized settings into logical tabs for easier navigation (#359)
- Repository base path now syncs automatically between Mac app and web UI (#358)
- Simplified welcome screen repository display (#372)

#### **UI Context Awareness**
- Spawn window toggle shows only when relevant (#357)

#### **NPM Package Now Available**
- vibetunnel (server) is now available as an npm package for easy installation on macOS and Linux (#360, #377)
- Install with `npm install -g vibetunnel` - no build tools required!
- Includes prebuilt binaries for Node.js 20, 22, 23, and 24
- Supports macOS (Intel and Apple Silicon) and Linux (x64 and arm64) (#344)

#### **Enhanced Git Diff Tool Support**
- Added JuxtaCode to the list of supported Git diff tools with automatic detection

#### **Improved `vt` Command**
- Added verbosity control with `-q` (quiet), `-v` (verbose), `-vv` (extra verbose) flags (#356)
- New `vt title` command to update session names from within a VibeTunnel session

### 🐛 Bug Fixes

- Fixed npm package installation issues (#360, #377)
- Fixed control message processing loop (#372)
- Fixed file browser constant refresh issue (#354)
- Replaced bell icon with settings icon for better clarity (#366)
- Resolved Tailwind CSS performance warning

## [1.0.0-beta.10] - 2025-07-15

#### **Repository Discovery**
- Automatic Git repository detection when creating new sessions (#301)
- Recently modified repositories displayed in new session dialog
- Quick project access with one-click repository selection

#### **Keyboard Shortcut Handling**
- Redesigned keyboard capture system with intelligent priority handling (#298)
- Browser shortcuts work naturally: Cmd+Shift+A (tab search), Cmd+1-9 (tab switching), Alt+Arrow keys
- Visual keyboard capture indicator with detailed tooltips
- Double-Escape toggle for switching between browser and terminal keyboard modes

#### **Theme System**
- Dracula theme is now the default for new users (#349)
- Professional light mode with improved contrast (#314)
- Easy theme switching between light and dark modes
- Enhanced terminal color schemes (#332)

#### **Development Server Mode**
- New "Development Server" mode in Debug Settings enables hot reload (#316)
- Significantly faster iteration when developing the web interface
- Hot reload works with full VibeTunnel functionality

### 🐛 Bug Fixes

- Fixed Safari clipboard paste on iOS and macOS (#336)
- Fixed duplicate session creation with intelligent detection (#345)
- Added keyboard navigation in session grid (arrow keys, Enter, etc.) (#322)
- Fixed race conditions in network access mode (#347)
- Improved SSH key manager modal layout (#325)
- Updated all dependencies to latest stable versions
- Enhanced TypeScript configuration with better type safety

## [1.0.0-beta.9] - 2025-07-11

#### **Terminal Crash Fix**
- Replaced Microsoft's node-pty with custom fork to resolve random terminal crashes (#304)
- Improved thread-safe operations and resource management
- Addresses stability issues affecting VS Code and other Electron applications

#### **Server Crash Detection**
- Added crash detection and recovery system for server failures (#308)
- Provides immediate feedback with specific error codes
- Improved troubleshooting and error reporting

#### **Mobile Experience**
- Fixed continuous resize loop on mobile devices (#305)
- Improved mobile terminal width management
- Added support for smaller grid sizes on compact devices
- Added Alt+Delete/Left/Right keyboard shortcuts for mobile users (#290)
- Fixed mobile header overflow when using dropdown menus (#295)

#### **Cloudflare Integration**
- Improved tunnel setup with stream-based monitoring (#306)
- Enhanced error handling and more reliable setup process

#### **Git Repository Discovery**
- Enhanced folder selection when creating new sessions (#274)
- Added intelligent Git repository discovery in selected folders
- Fixed multiple bugs in repository discovery (#282)

### 🐛 Bug Fixes

- Fixed terminal titles jumping due to activity indicators (#309)
- Consolidated z-index management to prevent UI layer conflicts (#291)
- Enhanced event handling for better cross-platform compatibility
- Improved file browser functionality with better click handling

## [1.0.0-beta.8] - 2025-07-08

### 🐛 Bug Fixes

- Fixed release builds to correctly bundle all Homebrew library dependencies (#269)
- Fixed app launch on systems without developer tools installed
- Fixed file browser going dark due to event bubbling issues with modal handling
- Updated build scripts to handle dynamic library dependencies properly

## [1.0.0-beta.7] - 2025-07-08

#### **AI Session Context Injection**
- Inject project context into Claude.ai sessions with a single click (#210, #218)
- Automatically detects Claude browser windows
- Includes git repository details, current branch, and recent commits
- Configurable prompts to match workflow

#### **Terminal Performance**
- Fixed critical flow control issue causing xterm.js buffer overflow (#223)
- Fixed infinite scroll loop that could freeze the browser
- Fixed race conditions in terminal output handling
- Improved memory management for long-running sessions
- Better handling of high-volume terminal output

#### **UI Performance**
- Removed UI animations causing 1-2 second delays
- Disabled View Transitions API for instant session navigation
- Fixed modal backdrop pointer-events issues (#195)
- Smoother menu bar UI without jumping

#### **Touch Device & Mobile**
- Unified keyboard layout for all mobile devices
- Universal touch device detection
- Inline-edit pencil always visible on touch devices
- New compact keyboard layout optimized for tablets
- Fixed touch interaction issues with modals

#### **Fish Shell Integration**
- Full support for Fish shell command expansion and completions (#228, #242)
- Proper handling of Fish-specific syntax
- Fixed shell configuration files not being loaded

#### **Developer Experience**
- Preserve Swift package resolution for faster builds
- Better Node.js detection handling fnm/homebrew conflicts (#246, #253)
- Hash-based vt script version detection
- Delete old sessions when VibeTunnel version changes (#254)

### 🐛 Bug Fixes

- Fixed session state synchronization between web and native clients
- Resolved memory leaks in long-running sessions
- Fixed connection timeout issues on slower networks
- Better cleanup of terminal processes and resources
- Fixed various UI glitches and visual artifacts
- Resolved sidebar animation issues
- Fixed file browser problems
- Unified control protocol for terminal sessions (#239)
- Improved Unix socket handling with better error recovery

## [1.0.0-beta.6] - 2025-07-03

#### **Git Repository Monitoring**
- Real-time Git status in session rows with branch name and change counts (#200)
- Color-coded status: orange for branches, yellow for uncommitted changes
- Click folder icons to open repositories in Finder
- Context menu option to open repositories on GitHub
- 5-second cache prevents excessive git commands
- Automatically finds git repositories in parent directories

#### **Enhanced Command-Line Tool**
- `vt title` can set terminal title - even Claude can use it! (#153)
- `vt help` displays binary path, version, build date, and platform info
- Automatic detection of Homebrew installations on ARM Macs

#### **Menu Bar Enhancements**
- Powerful menu bar with visual activity indicators (#176)
- See all terminal sessions and Claude Code status (#160)
- Mac stays awake when running terminal sessions

#### **Web Interface Improvements**
- Complete UI overhaul with improved color scheme and animations (#179)
- Collapsible sidebar to maximize terminal viewing space (#175)
- Fixed race conditions causing sessions to appear as "missing"
- Improved responsive design with better touch targets

### 🐛 Bug Fixes

- Fixed terminal output corruption from race conditions
- Fixed terminal titles jumping or getting stuck
- Fixed double logger initialization deleting log files
- Improved PTY manager cleanup and timer management
- Enhanced error handling throughout server stack

#### **Simplified Tailscale Setup**
- Switched to Tailscale's local API for easier configuration (#184)
- Removed manual token management requirements
- Streamlined connection UI

## [1.0.0-beta.5] - 2025-06-29

#### **UI Improvements**
- Web interface now shows full version including beta suffix
- Cleaner build output by filtering non-actionable Xcode warnings
- Fixed scrolling issues on mobile web browsers

#### **Infrastructure**
- Web version automatically reads from package.json at build time
- Build process validates version consistency between macOS and web
- Tests only run when relevant files change (iOS/Mac/Web)
- Comprehensive Playwright tests for web frontend reliability (#120)

### 🐛 Bug Fixes

- Fixed authentication-related error messages when running with `--no-auth`
- Fixed frontend log streaming in no-auth mode
- Resolved flaky tests and improved test infrastructure (#205)
- Enhanced release process documentation with version sync requirements
- Better test fixtures, helpers, and debugging capabilities (#73)
- Cleaner logs when running in development mode

## [1.0.0-beta.4] - 2025-06-25

- We replaced HTTP Basic auth with System Login or SSH Keys for better security (#43).
- Sessions now show exited terminals by default - no more hunting for terminated sessions
- Reorganized sidebar with cleaner, more compact header and better button placement
- Added user menu in sidebar for quick access to settings and logout
- Enhanced responsive design with better adaptation to different screen sizes
- Improved touch targets and spacing for mobile users
- Leverages View Transitions API for smoother animations with CSS fallbacks
- More intuitive default settings for better out-of-box experience

## [1.0.0-beta.3] - 2025-06-23

There's too much to list! This is the version you've been waiting for. 

- Redesigned, responsive, animated frontend.
- Improved terminal width spanning and layout optimization
- File-Picker to see files on-the-go.
- Creating new Terminals is now much more reliable.
- Added terminal font size adjustment in the settings dropdown
- Fresh new icon for Progressive Web App installations
- Refined bounce animations for a more subtle, professional feel
- Added retro CRT-style phosphor decay visual effect for closed terminals
- Fixed buffer aggregator message handling for smoother terminal updates
- Better support for shell aliases and improved debug logging
- Enhanced Unix socket server implementation for faster local communication
- Special handling for Warp terminal with custom enter key behavior
- New dock menu with quick actions when right-clicking the app icon
- More resilient vt command-line tool with better error handling
- Ensured vibetunnel server properly terminates when Mac app is killed

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
- Fixed race condition in session creation that caused frontend to open previous session

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