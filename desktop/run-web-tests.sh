#!/bin/bash
set -e

echo "🧪 TunnelForge Web E2E Tests - Week 1 Setup"
echo "==========================================="
echo ""

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESKTOP_DIR="$PROJECT_ROOT/desktop"
SERVER_DIR="$PROJECT_ROOT/server"

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "❌ Go is not installed. Please install Go 1.21+"
    exit 1
fi

echo "✅ Go is available"

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Bun is not installed. Please install Bun"
    exit 1
fi

echo "✅ Bun is available"

# Check if Playwright is installed in desktop
if [ ! -d "$DESKTOP_DIR/node_modules/@playwright" ]; then
    echo "📦 Installing Playwright..."
    cd "$DESKTOP_DIR"
    bun install
fi

echo "✅ Playwright is installed"
echo ""

echo "🚀 Starting Go server on port 4021..."
# Kill any existing server on port 4021
lsof -ti:4021 | xargs kill -9 2>/dev/null || true

# Start Go server in background from server directory
cd "$SERVER_DIR"
go run ./cmd/server/main.go &
GO_SERVER_PID=$!

# Give server time to start
sleep 3

# Check if server started
if ! kill -0 $GO_SERVER_PID 2>/dev/null; then
    echo "❌ Failed to start Go server"
    exit 1
fi

echo "✅ Go server started (PID: $GO_SERVER_PID)"
echo ""

# Verify server is responding
echo "🔍 Verifying server is responding on port 4021..."
for i in {1..10}; do
    if curl -s http://localhost:4021 > /dev/null 2>&1; then
        echo "✅ Server is responding"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "❌ Server is not responding after 10 seconds"
        kill $GO_SERVER_PID 2>/dev/null || true
        exit 1
    fi
    sleep 1
done

echo ""
echo "🧪 Running Playwright web tests..."
echo "====================================="

# Go to desktop directory to run tests
cd "$DESKTOP_DIR"

# Run tests
bun exec playwright test tests/e2e-web --reporter=html,list 2>&1 || TEST_RESULT=$?

TEST_RESULT=${TEST_RESULT:-0}

echo ""
echo "====================================="
echo "🧹 Cleaning up..."

# Kill Go server
kill $GO_SERVER_PID 2>/dev/null || true

if [ $TEST_RESULT -eq 0 ]; then
    echo "✅ All tests passed!"
else
    echo "ℹ️  Tests completed (check results above)"
fi
echo "📊 View test results: $DESKTOP_DIR/test-results/index.html"

exit $TEST_RESULT
