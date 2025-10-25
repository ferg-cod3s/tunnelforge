# TunnelForge Tauri Desktop Testing

This directory contains comprehensive Playwright testing configuration for the TunnelForge Tauri desktop application, with special support for WSL/X11 environments.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Bun runtime
- Rust and Cargo
- Tauri CLI
- Playwright browsers

### WSL Setup (Required for WSL environments)

```bash
# Run the automated setup script
./setup-wsl-testing.sh

# Or manually set up
export DISPLAY=:99
Xvfb :99 -screen 0 1280x800x24 -ac -nolisten tcp &
```

### Running Tests

```bash
# Install dependencies
bun install

# Install Playwright browsers
bunx playwright install

# Run Tauri desktop tests (headless)
bun run test:tauri

# Run Tauri desktop tests (headed - with browser window)
bun run test:tauri:headed

# Run desktop-specific tests
bun run test:desktop

# Run tests in WSL environment
bun run test:wsl

# Run tests with UI mode
bun run test:tauri:ui

# Debug tests
bun run test:tauri:debug
```

## 📁 Test Structure

```
tests/e2e-desktop/
├── helpers/
│   ├── tauri-desktop-helpers.ts    # Main Tauri testing utilities
│   └── wsl-helpers.ts              # WSL-specific helpers
├── fixtures/                       # Test fixtures and data
├── tauri-app-lifecycle.spec.ts     # App lifecycle tests
├── tauri-tunnelforge-integration.spec.ts  # TunnelForge integration tests
├── global-setup.ts                 # Global test setup
└── global-teardown.ts              # Global test cleanup
```

## 🔧 Configuration Files

### Main Configuration Files

- `playwright.config.tauri.enhanced.ts` - Enhanced Tauri configuration
- `playwright.config.tauri.ts` - Basic Tauri configuration
- `playwright.config.ts` - Web frontend configuration

### Key Features

#### WSL/X11 Support
- Virtual display setup with Xvfb
- Graphics acceleration workarounds
- Windows integration from WSL
- Network configuration for WSL2

#### Tauri Integration
- Remote debugging via Chrome DevTools Protocol
- Tauri command execution and IPC testing
- Desktop-specific functionality testing
- Cross-platform compatibility

#### Advanced Debugging
- Comprehensive logging and error capture
- Screenshot and video recording
- Trace collection for performance analysis
- Failure state documentation

## 🧪 Test Categories

### 1. App Lifecycle Tests
- Tauri app initialization
- Window operations
- System integration
- Error handling

### 2. TunnelForge Integration Tests
- Backend connectivity
- Terminal session management
- File browser integration
- Tunnel management (Ngrok, Tailscale, Cloudflare)
- Git integration
- Settings management

### 3. Platform-Specific Tests
- Windows features
- macOS features
- Linux features
- WSL-specific functionality

### 4. Performance and Stability Tests
- Rapid command execution
- Timeout handling
- Extended operations
- Memory management

## 🖥️ WSL Environment Setup

### Automated Setup

The `setup-wsl-testing.sh` script handles:

1. **System Dependencies**
   - Xvfb (virtual display)
   - X11 utilities
   - Graphics libraries
   - Build tools

2. **Runtime Environment**
   - Node.js and Bun
   - Rust and Tauri CLI
   - Playwright browsers

3. **Display Configuration**
   - Virtual display setup
   - Environment variables
   - Graphics workarounds

4. **Windows Integration**
   - Windows browser detection
   - Filesystem access
   - Network configuration

### Manual WSL Setup

If you prefer manual setup:

```bash
# Install system dependencies
sudo apt-get update
sudo apt-get install -y xvfb x11-utils x11-xserver-utils dbus-x11

# Set up display
export DISPLAY=:99
export XDG_RUNTIME_DIR=/tmp

# Start Xvfb
Xvfb :99 -screen 0 1280x800x24 -ac -nolisten tcp &

# Install runtimes
curl -fsSL https://bun.sh/install | bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Tauri CLI
cargo install @tauri-apps/cli

# Install Playwright
bun install
bunx playwright install chromium firefox webkit
```

## 🔍 Debugging and Troubleshooting

### Common Issues

#### 1. Display Issues
```bash
# Check if Xvfb is running
ps aux | grep Xvfb

# Check display
xdpyinfo -display :99

# Restart Xvfb
pkill -f Xvfb
Xvfb :99 -screen 0 1280x800x24 -ac -nolisten tcp &
```

#### 2. Tauri App Not Starting
```bash
# Check Tauri process
ps aux | grep tauri

# Check ports
netstat -tlnp | grep -E ":(1420|4021|9222)"

# Restart Tauri dev server
bun run tauri dev
```

#### 3. Playwright Browser Issues
```bash
# Reinstall browsers
bunx playwright install --force

# Check browser installation
bunx playwright install-deps

# Run with debug
DEBUG=pw:browser bun run test:tauri:debug
```

### Debug Mode

Enable comprehensive debugging:

```bash
# Environment variables
export DEBUG=true
export RUST_LOG=debug
export TAURI_DEBUG=1

# Run with debug
bun run test:tauri:debug

# Or with Playwright UI
bun run test:tauri:ui
```

### Logs and Artifacts

Test artifacts are stored in:
- `test-results/tauri-screenshots/` - Screenshots
- `test-results/tauri-videos/` - Video recordings
- `test-results/tauri-traces/` - Performance traces
- `test-results/tauri-logs/` - Console logs
- `test-results/tauri-html-report/` - HTML reports

## 🌐 Network Configuration

### Port Forwarding (WSL2)

For WSL2, you may need to set up port forwarding from Windows:

```powershell
# In Windows PowerShell (as Administrator)
netsh interface portproxy add v4tov4 listenport=1420 listenaddress=0.0.0.0 connectport=1420 connectaddress=<WSL2_IP>
netsh interface portproxy add v4tov4 listenport=4021 listenaddress=0.0.0.0 connectport=4021 connectaddress=<WSL2_IP>
netsh interface portproxy add v4tov4 listenport=9222 listenaddress=0.0.0.0 connectport=9222 connectaddress=<WSL2_IP>
```

### Firewall Configuration

Ensure Windows Firewall allows connections on the required ports:
- 1420 (Tauri dev server)
- 4021 (TunnelForge backend)
- 9222 (Chrome remote debugging)

## 📊 Test Reports

### HTML Reports
```bash
# View HTML report
open test-results/tauri-html-report/index.html

# Or serve locally
bun run serve test-results/tauri-html-report
```

### JSON Reports
```bash
# View JSON results
cat test-results/tauri-results.json | jq .
```

### JUnit Reports
```bash
# For CI/CD integration
cat test-results/tauri-junit.xml
```

## 🔄 CI/CD Integration

### GitHub Actions Example

```yaml
name: Tauri Desktop Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup WSL
        run: |
          wsl --install
          
      - name: Setup Tauri Testing
        run: |
          cd desktop
          ./setup-wsl-testing.sh
          
      - name: Run Tests
        run: |
          cd desktop
          bun run test:wsl
          
      - name: Upload Test Results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: desktop/test-results/
```

## 🛠️ Customization

### Adding New Tests

1. Create test file in `tests/e2e-desktop/`
2. Use the helper functions:

```typescript
import { test, expect } from '@playwright/test';
import { createTauriDesktopHelper } from './helpers/tauri-desktop-helpers';

test('my custom test', async ({ page, context }, testInfo) => {
  const helper = createTauriDesktopHelper(page, context, testInfo);
  await helper.waitForTauriApp();
  
  // Your test code here
  await helper.invokeTauriCommand('my_command', { arg: 'value' });
});
```

### Custom Helpers

Add custom helpers in `tests/e2e-desktop/helpers/`:

```typescript
export class CustomHelper {
  constructor(private helper: TauriDesktopHelper) {}
  
  async customOperation() {
    return await this.helper.invokeTauriCommand('custom_command');
  }
}
```

## 📚 Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [Tauri Documentation](https://tauri.app/)
- [WSL Documentation](https://docs.microsoft.com/en-us/windows/wsl/)
- [Xvfb Documentation](https://www.x.org/releases/X11R7.7/doc/man/man1/Xvfb.1.xhtml)

## 🤝 Contributing

When adding new tests:

1. Follow the existing test structure
2. Use the provided helper functions
3. Add comprehensive error handling
4. Include WSL compatibility checks
5. Update documentation as needed

## 📝 License

This testing framework is part of the TunnelForge project and follows the same license terms.