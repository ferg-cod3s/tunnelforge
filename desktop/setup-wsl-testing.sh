#!/bin/bash

# WSL Testing Setup Script for TunnelForge Tauri Desktop App
# This script sets up the WSL environment for Tauri desktop testing

set -e

echo "🚀 Setting up WSL environment for TunnelForge Tauri testing..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running in WSL
check_wsl() {
    if [[ ! -f /proc/version ]] || ! grep -q "Microsoft\|WSL" /proc/version; then
        print_error "This script must be run in WSL"
        exit 1
    fi
    
    print_success "WSL environment detected"
}

# Install system dependencies
install_dependencies() {
    print_status "Installing system dependencies..."
    
    # Update package list
    sudo apt-get update
    
    # Install required packages
    sudo apt-get install -y \
        xvfb \
        x11-utils \
        x11-xserver-utils \
        dbus-x11 \
        xfonts-base \
        xfonts-100dpi \
        xfonts-75dpi \
        xfonts-scalable \
        xfonts-cyrillic \
        x11-apps \
        net-tools \
        curl \
        wget \
        git \
        build-essential \
        pkg-config \
        libssl-dev \
        libgtk-3-dev \
        libayatana-appindicator3-dev \
        librsvg2-dev
    
    print_success "System dependencies installed"
}

# Setup display environment
setup_display() {
    print_status "Setting up display environment..."
    
    # Set display variable
    export DISPLAY=${DISPLAY:-:99}
    echo "export DISPLAY=$DISPLAY" >> ~/.bashrc
    
    # Set XDG runtime directory
    export XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-/tmp}
    echo "export XDG_RUNTIME_DIR=$XDG_RUNTIME_DIR" >> ~/.bashrc
    
    # Create XDG runtime directory if it doesn't exist
    mkdir -p "$XDG_RUNTIME_DIR"
    
    print_success "Display environment configured"
}

# Start Xvfb (virtual display)
start_xvfb() {
    print_status "Starting Xvfb virtual display..."
    
    # Kill any existing Xvfb process
    pkill -f "Xvfb $DISPLAY" || true
    sleep 1
    
    # Start Xvfb
    Xvfb "$DISPLAY" -screen 0 1280x800x24 -ac -nolisten tcp -extension GLX +render -noreset -dpi 96 &
    XVFB_PID=$!
    
    # Wait for Xvfb to start
    sleep 3
    
    # Verify Xvfb is running
    if xdpyinfo -display "$DISPLAY" > /dev/null 2>&1; then
        print_success "Xvfb started successfully (PID: $XVFB_PID)"
        echo $XVFB_PID > /tmp/xvfb.pid
    else
        print_error "Failed to start Xvfb"
        exit 1
    fi
}

# Install Node.js and Bun
install_nodejs() {
    print_status "Installing Node.js and Bun..."
    
    # Install Node.js if not present
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    
    # Install Bun if not present
    if ! command -v bun &> /dev/null; then
        curl -fsSL https://bun.sh/install | bash
        export BUN_INSTALL="$HOME/.bun"
        export PATH="$BUN_INSTALL/bin:$PATH"
        echo 'export BUN_INSTALL="$HOME/.bun"' >> ~/.bashrc
        echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> ~/.bashrc
    fi
    
    print_success "Node.js and Bun installed"
}

# Install Rust and Tauri CLI
install_rust() {
    print_status "Installing Rust and Tauri CLI..."
    
    # Install Rust if not present
    if ! command -v cargo &> /dev/null; then
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source ~/.cargo/env
        echo 'source ~/.cargo/env' >> ~/.bashrc
    fi
    
    # Install Tauri CLI
    source ~/.cargo/env
    cargo install @tauri-apps/cli
    
    print_success "Rust and Tauri CLI installed"
}

# Install Playwright browsers
install_playwright() {
    print_status "Installing Playwright browsers..."
    
    # Install project dependencies
    bun install
    
    # Install Playwright browsers
    bunx playwright install chromium firefox webkit
    
    # Install Playwright system dependencies
    bunx playwright install-deps
    
    print_success "Playwright browsers installed"
}

# Setup Windows integration
setup_windows_integration() {
    print_status "Setting up Windows integration..."
    
    # Create Windows mount points if they don't exist
    if [[ ! -d /mnt/c ]]; then
        print_warning "Windows C: drive not mounted at /mnt/c"
        print_status "You may need to manually mount Windows drives"
    fi
    
    # Check for Windows browsers
    WINDOWS_BROWSERS=(
        "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe"
        "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
        "/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe"
        "/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
    )
    
    for browser in "${WINDOWS_BROWSERS[@]}"; do
        if [[ -f "$browser" ]]; then
            print_success "Found Windows browser: $browser"
            export WINDOWS_BROWSER="$browser"
            echo "export WINDOWS_BROWSER=\"$browser\"" >> ~/.bashrc
            break
        fi
    done
    
    print_success "Windows integration configured"
}

# Create test directories
create_test_dirs() {
    print_status "Creating test directories..."
    
    mkdir -p test-results/tauri-screenshots
    mkdir -p test-results/tauri-videos
    mkdir -p test-results/tauri-traces
    mkdir -p test-results/tauri-logs
    mkdir -p test-results/tauri-output
    
    print_success "Test directories created"
}

# Setup environment variables
setup_env_vars() {
    print_status "Setting up environment variables..."
    
    cat >> ~/.bashrc << 'EOF'

# TunnelForge Tauri Testing Environment
export TUNNELFORGE_TEST_MODE=true
export TAURI_DEBUG=1
export RUST_LOG=debug
export RUST_BACKTRACE=1
export PLAYWRIGHT_BROWSERS_PATH=0
export LIBGL_ALWAYS_SOFTWARE=1
export MESA_GL_VERSION_OVERRIDE=4.5

# WSL Graphics Workarounds
export ELECTRON_DISABLE_GPU=1
export ELECTRON_DISABLE_SANDBOX=1
export CHROME_DISABLE_GPU=1

EOF
    
    # Source the updated bashrc
    source ~/.bashrc
    
    print_success "Environment variables configured"
}

# Validate setup
validate_setup() {
    print_status "Validating setup..."
    
    # Check required commands
    local required_commands=("xvfb" "xdpyinfo" "node" "bun" "cargo" "tauri")
    local missing_commands=()
    
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            missing_commands+=("$cmd")
        fi
    done
    
    if [[ ${#missing_commands[@]} -gt 0 ]]; then
        print_error "Missing commands: ${missing_commands[*]}"
        exit 1
    fi
    
    # Check display
    if ! xdpyinfo -display "$DISPLAY" &> /dev/null; then
        print_error "Display $DISPLAY is not working"
        exit 1
    fi
    
    # Check Playwright
    if ! bunx playwright --version &> /dev/null; then
        print_error "Playwright is not properly installed"
        exit 1
    fi
    
    print_success "Setup validation passed"
}

# Create cleanup script
create_cleanup_script() {
    print_status "Creating cleanup script..."
    
    cat > cleanup-wsl-testing.sh << 'EOF'
#!/bin/bash

echo "🧹 Cleaning up WSL testing environment..."

# Kill Xvfb
if [[ -f /tmp/xvfb.pid ]]; then
    XVFB_PID=$(cat /tmp/xvfb.pid)
    if kill -0 "$XVFB_PID" 2>/dev/null; then
        kill "$XVFB_PID"
        echo "✅ Xvfb process terminated"
    fi
    rm -f /tmp/xvfb.pid
fi

# Kill any remaining Xvfb processes
pkill -f "Xvfb" || true

# Clean up test artifacts
rm -rf test-results/tauri-*
rm -rf /tmp/.X99-lock
rm -rf /tmp/.X11-unix/X99

echo "✅ WSL testing environment cleaned up"
EOF
    
    chmod +x cleanup-wsl-testing.sh
    print_success "Cleanup script created"
}

# Main execution
main() {
    print_status "Starting WSL testing setup..."
    
    check_wsl
    install_dependencies
    setup_display
    start_xvfb
    install_nodejs
    install_rust
    install_playwright
    setup_windows_integration
    create_test_dirs
    setup_env_vars
    validate_setup
    create_cleanup_script
    
    print_success "WSL testing setup completed successfully!"
    echo
    print_status "To run tests:"
    echo "  bun run test:wsl                    # Headless tests"
    echo "  bun run test:wsl:headed            # Headed tests"
    echo "  bun run test:desktop               # Desktop app tests"
    echo "  bun run test:desktop:headed        # Desktop app tests headed"
    echo
    print_status "To cleanup:"
    echo "  ./cleanup-wsl-testing.sh"
    echo
    print_warning "Remember to source ~/.bashrc or restart your terminal"
}

# Run main function
main "$@"