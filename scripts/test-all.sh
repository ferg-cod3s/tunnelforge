#!/bin/bash

set -e

echo "🧪 TunnelForge - Comprehensive Test Suite"
echo "========================================"

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

# Test counter
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run test and track results
run_test() {
    local test_name="$1"
    local test_command="$2"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    print_status "Running $test_name..."

    if eval "$test_command"; then
        print_success "$test_name passed"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        print_error "$test_name failed"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    echo
}

# Check if required tools are installed
check_dependencies() {
    print_status "Checking dependencies..."

    local missing_deps=()

    if ! command -v cargo &> /dev/null; then
        missing_deps+=("cargo (Rust)")
    fi

    if ! command -v bun &> /dev/null; then
        missing_deps+=("bun")
    fi

    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
    fi

    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing dependencies: ${missing_deps[*]}"
        echo "Please install the missing dependencies and try again."
        exit 1
    fi

    print_success "All dependencies found"
}

# Rust Backend Tests
run_rust_tests() {
    print_status "Running Rust backend tests..."
    cd desktop/src-tauri

    run_test "Rust unit tests" "cargo test --lib"
    run_test "Rust integration tests" "cargo test --test integration_tests"
    run_test "Rust formatting check" "cargo fmt --check"
    run_test "Rust clippy linting" "cargo clippy -- -D warnings"
    run_test "Rust security audit" "cargo audit"

    cd ../..
}

# Frontend Tests
run_frontend_tests() {
    print_status "Running frontend tests..."
    cd web

    run_test "TypeScript type checking" "bun run typecheck"
    run_test "ESLint code quality" "bun run lint"
    run_test "Bun unit tests" "bun test"
    run_test "Production build" "bun run build"

    cd ..
}

# E2E Tests
run_e2e_tests() {
    print_status "Running E2E tests..."
    cd web

    # Install Playwright if not already installed
    if ! bun list @playwright/test &> /dev/null; then
        print_status "Installing Playwright..."
        bun add -d @playwright/test
    fi

    # Install browsers
    print_status "Installing Playwright browsers..."
    bunx playwright install --yes

    run_test "Playwright E2E tests" "bunx playwright test"

    cd ..
}

# Performance Tests
run_performance_tests() {
    print_status "Running performance tests..."
    cd web

    run_test "Code coverage" "bun run test:coverage"
    run_test "Build performance" "time bun run build"

    cd ..
}

# Documentation Tests
run_docs_tests() {
    print_status "Running documentation tests..."

    run_test "README validation" "find . -name 'README.md' -exec sh -c 'if [ ! -s \"\$1\" ]; then echo \"Empty README: \$1\"; exit 1; fi' _ {} \;"
    run_test "License check" "test -f LICENSE"

    # Check for broken links (if lychee is available)
    if command -v lychee &> /dev/null; then
        run_test "Link checking" "lychee --exclude 'localhost|127.0.0.1' README.md"
    else
        print_warning "lychee not installed, skipping link checks"
    fi
}

# Main test execution
main() {
    echo "Starting comprehensive test suite..."
    echo

    check_dependencies

    # Run all test suites
    run_rust_tests
    run_frontend_tests
    run_e2e_tests
    run_performance_tests
    run_docs_tests

    # Print summary
    echo "========================================"
    echo "Test Summary:"
    echo "Total tests: $TOTAL_TESTS"
    echo "Passed: $PASSED_TESTS"
    echo "Failed: $FAILED_TESTS"
    echo

    if [ $FAILED_TESTS -eq 0 ]; then
        print_success "All tests passed! 🎉"
        exit 0
    else
        print_error "$FAILED_TESTS test(s) failed"
        exit 1
    fi
}

# Run main function
main "$@"
