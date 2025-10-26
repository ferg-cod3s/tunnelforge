#!/bin/bash

#
# TunnelForge Comprehensive Test Suite
# Runs all tests across server, web UI, and desktop app
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track test results
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
    ((TESTS_PASSED++))
}

log_error() {
    echo -e "${RED}✗${NC} $1"
    ((TESTS_FAILED++))
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_skip() {
    echo -e "${YELLOW}⊘${NC} $1"
    ((TESTS_SKIPPED++))
}

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

log_info "Starting TunnelForge Comprehensive Test Suite"
log_info "Project Root: $PROJECT_ROOT"
echo ""

# Create test results directory
RESULTS_DIR="$PROJECT_ROOT/test-results"
mkdir -p "$RESULTS_DIR"

# Check for Bun
USING_BUN=false
if command -v bun &> /dev/null; then
    USING_BUN=true
    log_info "✓ Bun detected - will use for web and desktop tests"
else
    log_warning "Bun not found - falling back to npm for some operations"
fi

#===============================================================================
# 1. SERVER (GO) TESTS
#===============================================================================

log_info "===== 1. SERVER (GO) TESTS ====="
echo ""

if [ -d "$PROJECT_ROOT/server" ]; then
    cd "$PROJECT_ROOT/server"

    log_info "Running Go server tests..."
    if make test > "$RESULTS_DIR/server-tests.log" 2>&1; then
        log_success "Server tests passed"
    else
        log_error "Server tests failed (see test-results/server-tests.log)"
    fi

    log_info "Generating server test coverage..."
    if make test-coverage > "$RESULTS_DIR/server-coverage.log" 2>&1; then
        log_success "Server coverage report generated"
        # Extract coverage percentage
        if [ -f "coverage.out" ]; then
            COVERAGE=$(go tool cover -func=coverage.out | tail -1 | awk '{print $3}')
            echo "  Total Coverage: $COVERAGE"
        fi
    else
        log_warning "Server coverage generation failed"
    fi

    cd "$PROJECT_ROOT"
else
    log_skip "Server directory not found"
fi

echo ""

#===============================================================================
# 2. WEB UI (ASTRO/SVELTE) TESTS
#===============================================================================

log_info "===== 2. WEB UI (ASTRO/SVELTE) TESTS ====="
echo ""

if [ -d "$PROJECT_ROOT/web" ]; then
    cd "$PROJECT_ROOT/web"

    # Check if server is running
    log_info "Checking if Go server is running on port 4021..."
    if ! curl -s http://localhost:4021/health > /dev/null 2>&1; then
        log_warning "Go server not running. Starting server..."
        cd "$PROJECT_ROOT/server"
        go run cmd/server/main.go > "$RESULTS_DIR/server.log" 2>&1 &
        SERVER_PID=$!
        echo "$SERVER_PID" > "$RESULTS_DIR/server.pid"
        log_info "Server started (PID: $SERVER_PID)"
        sleep 5
        cd "$PROJECT_ROOT/web"
    else
        log_info "Server already running ✓"
        SERVER_PID=""
    fi

    log_info "Installing web dependencies..."
    if $USING_BUN; then
        bun install > "$RESULTS_DIR/web-install.log" 2>&1
    else
        npm install > "$RESULTS_DIR/web-install.log" 2>&1
    fi

    log_info "Running web UI E2E tests..."
    if $USING_BUN; then
        if bun run test:e2e > "$RESULTS_DIR/web-e2e.log" 2>&1; then
            log_success "Web UI E2E tests passed"
        else
            log_error "Web UI E2E tests failed (see test-results/web-e2e.log)"
        fi
    else
        if npm run test:e2e > "$RESULTS_DIR/web-e2e.log" 2>&1; then
            log_success "Web UI E2E tests passed"
        else
            log_error "Web UI E2E tests failed (see test-results/web-e2e.log)"
        fi
    fi

    # Stop server if we started it
    if [ -n "$SERVER_PID" ]; then
        log_info "Stopping server (PID: $SERVER_PID)..."
        kill $SERVER_PID 2>/dev/null || true
        rm -f "$RESULTS_DIR/server.pid"
    fi

    cd "$PROJECT_ROOT"
else
    log_skip "Web directory not found"
fi

echo ""

#===============================================================================
# 3. DESKTOP APP TESTS
#===============================================================================

log_info "===== 3. DESKTOP APP TESTS ====="
echo ""

if [ -d "$PROJECT_ROOT/desktop" ]; then
    cd "$PROJECT_ROOT/desktop"

    log_info "Installing desktop dependencies..."
    if $USING_BUN; then
        bun install > "$RESULTS_DIR/desktop-install.log" 2>&1
        log_info "Using Bun for desktop tests ✓"
    else
        npm install > "$RESULTS_DIR/desktop-install.log" 2>&1
        log_warning "Using npm for desktop tests"
    fi

    log_info "Running desktop tests..."
    if $USING_BUN; then
        if bun run test > "$RESULTS_DIR/desktop-tests.log" 2>&1; then
            log_success "Desktop tests passed"
        else
            log_error "Desktop tests failed (see test-results/desktop-tests.log)"
        fi
    else
        if npm test > "$RESULTS_DIR/desktop-tests.log" 2>&1; then
            log_success "Desktop tests passed"
        else
            log_error "Desktop tests failed (see test-results/desktop-tests.log)"
        fi
    fi

    cd "$PROJECT_ROOT"
else
    log_skip "Desktop directory not found"
fi

echo ""

#===============================================================================
# SUMMARY
#===============================================================================

log_info "===== TEST SUMMARY ====="
echo ""
echo "Tests Passed:  $TESTS_PASSED"
echo "Tests Failed:  $TESTS_FAILED"
echo "Tests Skipped: $TESTS_SKIPPED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    log_success "All tests passed! ✓"
    echo ""
    echo "Test results saved to: $RESULTS_DIR/"
    echo ""
    echo "Coverage reports:"
    [ -f "$PROJECT_ROOT/server/coverage.html" ] && echo "  - Server: server/coverage.html"
    [ -f "$PROJECT_ROOT/web/playwright-report/index.html" ] && echo "  - Web UI: web/playwright-report/index.html"
    [ -f "$PROJECT_ROOT/desktop/test-results/index.html" ] && echo "  - Desktop: desktop/test-results/index.html"
    exit 0
else
    log_error "Some tests failed. Check test-results/ for details."
    exit 1
fi
