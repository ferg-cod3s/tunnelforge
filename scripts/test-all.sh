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
            go tool cover -func=coverage.out | tail -1 | awk '{print "  Total Coverage: "$3}'
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
    exit 0
else
    log_error "Some tests failed. Check test-results/ for details."
    exit 1
fi
