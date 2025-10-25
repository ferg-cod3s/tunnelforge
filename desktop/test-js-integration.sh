#!/bin/bash
# TunnelForge Tauri v2 JavaScript Integration Test Script
# Run this on native Linux/macOS (NOT WSL) to verify JS→Rust communication

set -e

echo "🧪 TunnelForge Tauri v2 JavaScript Integration Test"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check platform
if grep -qi microsoft /proc/version 2>/dev/null; then
    echo -e "${YELLOW}⚠️  WARNING: You are running in WSL${NC}"
    echo "   This script should be run on native Linux/macOS for accurate results"
    echo "   Press Ctrl+C to cancel, or wait 5 seconds to continue anyway..."
    sleep 5
fi

echo "📋 Step 1: Checking prerequisites..."

# Check if running on a system with display
if [ -z "$DISPLAY" ] && [ -z "$WAYLAND_DISPLAY" ]; then
    echo -e "${RED}❌ No display detected${NC}"
    echo "   Set DISPLAY environment variable or run on a system with GUI"
    exit 1
fi
echo -e "${GREEN}✅ Display detected${NC}"

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo -e "${RED}❌ Bun not found${NC}"
    echo "   Install Bun: curl -fsSL https://bun.sh/install | bash"
    exit 1
fi
echo -e "${GREEN}✅ Bun installed${NC}"

# Check if we're in the right directory
if [ ! -f "src-tauri/Cargo.toml" ]; then
    echo -e "${RED}❌ Wrong directory${NC}"
    echo "   Run this script from the 'desktop' directory"
    exit 1
fi
echo -e "${GREEN}✅ Correct directory${NC}"

echo ""
echo "📋 Step 2: Cleaning up old diagnostic files..."
rm -f /tmp/tauri-*.json
echo -e "${GREEN}✅ Cleanup complete${NC}"

echo ""
echo "📋 Step 3: Building Tauri app..."
echo "   This may take a few minutes..."

# Build in release mode for best performance
if bun tauri build; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    echo "   Check the error messages above"
    exit 1
fi

echo ""
echo "📋 Step 4: Starting Go server (if not already running)..."

# Check if server is already running
if ss -tln | grep -q ':4021'; then
    echo -e "${GREEN}✅ Server already running on port 4021${NC}"
else
    # Try to start server from common locations
    SERVER_BINARY=""
    if [ -f "../../server/tunnelforge-server" ]; then
        SERVER_BINARY="../../server/tunnelforge-server"
    elif [ -f "../server/tunnelforge-server" ]; then
        SERVER_BINARY="../server/tunnelforge-server"
    fi
    
    if [ -n "$SERVER_BINARY" ]; then
        echo "   Starting server from: $SERVER_BINARY"
        nohup "$SERVER_BINARY" > /tmp/go-server.log 2>&1 &
        SERVER_PID=$!
        echo "   Server PID: $SERVER_PID"
        sleep 2
        
        if ss -tln | grep -q ':4021'; then
            echo -e "${GREEN}✅ Server started on port 4021${NC}"
        else
            echo -e "${YELLOW}⚠️  Server may not have started (check /tmp/go-server.log)${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Server binary not found, tests may fail${NC}"
    fi
fi

echo ""
echo "📋 Step 5: Running Tauri app..."
echo "   The app will start and run tests automatically"
echo "   Wait 10 seconds for tests to complete..."
echo ""

# Run the app in background
./src-tauri/target/release/tunnelforge > /tmp/tauri-app-output.log 2>&1 &
APP_PID=$!
echo "   App PID: $APP_PID"

# Wait for tests to complete
sleep 10

# Kill the app
kill $APP_PID 2>/dev/null || true
echo "   App stopped"

echo ""
echo "📋 Step 6: Checking results..."
echo ""

# Check for diagnostic files
PASSED=0
FAILED=0

check_file() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ PASS${NC}: $description"
        echo "   File: $file"
        echo "   Content preview:"
        head -5 "$file" | sed 's/^/   /'
        echo ""
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}❌ FAIL${NC}: $description"
        echo "   Expected file: $file"
        echo ""
        FAILED=$((FAILED + 1))
    fi
}

echo "Test Results:"
echo "============="
echo ""

check_file "/tmp/tauri-rust-init.json" "Rust initialization (window created)"
check_file "/tmp/tauri-rust-injected.json" "Rust JavaScript injection (immediate)"
check_file "/tmp/tauri-post-load.json" "Page load event injection"
check_file "/tmp/tauri-immediate-test.json" "HTML test page execution"
check_file "/tmp/tauri-immediate-test-final.json" "Final test results"

echo ""
echo "═══════════════════════════════════════════════════"
echo "Test Summary"
echo "═══════════════════════════════════════════════════"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    echo ""
    echo "JavaScript ↔ Rust communication is working correctly!"
    echo "The Tauri v2 desktop app is ready for production."
    exit 0
else
    echo -e "${RED}⚠️  SOME TESTS FAILED${NC}"
    echo ""
    
    if [ ! -f "/tmp/tauri-rust-init.json" ]; then
        echo "Issue: Rust initialization failed"
        echo "Likely cause: App didn't start properly"
        echo "Check: /tmp/tauri-app-output.log"
    elif [ ! -f "/tmp/tauri-immediate-test.json" ]; then
        echo "Issue: JavaScript didn't execute in WebView"
        echo "Possible causes:"
        echo "  1. Graphics/WebView rendering issues"
        echo "  2. immediate-test.html not loaded"
        echo "  3. __TAURI_INVOKE__ not available"
        echo ""
        echo "Next steps:"
        echo "  1. Check build includes immediate-test.html in dist/"
        echo "  2. Verify WebView logs: /tmp/tauri-app-output.log"
        echo "  3. Try running in dev mode: bun tauri dev"
    fi
    
    echo ""
    echo "Diagnostic logs:"
    echo "  - App output: /tmp/tauri-app-output.log"
    echo "  - Server log: /tmp/go-server.log"
    exit 1
fi
