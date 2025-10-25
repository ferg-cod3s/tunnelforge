#!/bin/bash

# TunnelForge Cross-Platform Test Runner
# This script runs comprehensive tests across all platforms and components

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TEST_TIMEOUT=${TEST_TIMEOUT:-300}
PARALLEL_TESTS=${PARALLEL_TESTS:-4}
COVERAGE=${COVERAGE:-false}
VERBOSE=${VERBOSE:-false}

# Logging
LOG_DIR="test_logs"
mkdir -p "$LOG_DIR"

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
}

# Cleanup function
cleanup() {
    log "Cleaning up test environment..."
    
    # Kill any remaining test processes
    pkill -f "tunnelforge-server" || true
    pkill -f "tunnelforge-tests" || true
    
    # Clean up test data
    rm -rf /tmp/tunnelforge_test_* || true
    rm -f /tmp/tunnelforge_permission_test.txt || true
    
    log "Cleanup completed"
}

# Set up trap for cleanup
trap cleanup EXIT INT TERM

# Check dependencies
check_dependencies() {
    log "Checking dependencies..."
    
    local deps=("cargo" "node" "npm" "go" "git")
    local missing=()
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            missing+=("$dep")
        fi
    done
    
    if [ ${#missing[@]} -ne 0 ]; then
        error "Missing dependencies: ${missing[*]}"
        exit 1
    fi
    
    success "All dependencies found"
}

# Build test components
build_components() {
    log "Building test components..."
    
    # Build Go server
    log "Building Go server..."
    cd ../../development/go-server
    go build -o tunnelforge-server .
    cd - > /dev/null
    
    # Build Rust tests
    log "Building Rust tests..."
    if [ "$COVERAGE" = "true" ]; then
        cargo test --no-run --message-format=json | jq -r 'select(.profile.test == true) | .filenames[]' | sort -u > "$LOG_DIR/test_files.txt"
    else
        cargo test --no-run
    fi
    
    # Build web frontend
    log "Building web frontend..."
    cd ../web
    npm install
    npm run build
    cd - > /dev/null
    
    success "All components built successfully"
}

# Run unit tests
run_unit_tests() {
    log "Running unit tests..."
    
    # Rust unit tests
    log "Running Rust unit tests..."
    if [ "$COVERAGE" = "true" ]; then
        cargo test --lib --bins --tests --coverage --coverage-dir "$LOG_DIR/coverage" 2>&1 | tee "$LOG_DIR/rust_unit_tests.log"
    else
        cargo test --lib --bins --tests 2>&1 | tee "$LOG_DIR/rust_unit_tests.log"
    fi
    
    # Go unit tests (if available)
    if [ -d "../../development/go-server/tests" ]; then
        log "Running Go unit tests..."
        cd ../../development/go-server
        go test ./... -v 2>&1 | tee "../../linux/$LOG_DIR/go_unit_tests.log"
        cd - > /dev/null
    fi
    
    success "Unit tests completed"
}

# Run integration tests
run_integration_tests() {
    log "Running integration tests..."
    
    # Start the server in background
    log "Starting test server..."
    cd ../../development/go-server
    ./tunnelforge-server &
    SERVER_PID=$!
    cd - > /dev/null
    
    # Wait for server to be ready
    log "Waiting for server to be ready..."
    for i in {1..30}; do
        if curl -s http://127.0.0.1:4021/health > /dev/null 2>&1; then
            success "Server is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            error "Server failed to start"
            exit 1
        fi
        sleep 1
    done
    
    # Run Rust integration tests
    log "Running Rust integration tests..."
    if [ "$COVERAGE" = "true" ]; then
        cargo test --test integration_tests --coverage --coverage-dir "$LOG_DIR/coverage" 2>&1 | tee "$LOG_DIR/integration_tests.log"
    else
        cargo test --test integration_tests 2>&1 | tee "$LOG_DIR/integration_tests.log"
    fi
    
    # Stop the server
    log "Stopping test server..."
    kill $SERVER_PID || true
    wait $SERVER_PID 2>/dev/null || true
    
    success "Integration tests completed"
}

# Run platform tests
run_platform_tests() {
    log "Running platform-specific tests..."
    
    # Run platform tests
    if [ "$COVERAGE" = "true" ]; then
        cargo test --test platform_tests --coverage --coverage-dir "$LOG_DIR/coverage" 2>&1 | tee "$LOG_DIR/platform_tests.log"
    else
        cargo test --test platform_tests 2>&1 | tee "$LOG_DIR/platform_tests.log"
    fi
    
    success "Platform tests completed"
}

# Run server tests
run_server_tests() {
    log "Running server tests..."
    
    # Start the server in background
    log "Starting test server..."
    cd ../../development/go-server
    ./tunnelforge-server &
    SERVER_PID=$!
    cd - > /dev/null
    
    # Wait for server to be ready
    log "Waiting for server to be ready..."
    for i in {1..30}; do
        if curl -s http://127.0.0.1:4021/health > /dev/null 2>&1; then
            success "Server is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            error "Server failed to start"
            exit 1
        fi
        sleep 1
    done
    
    # Run server tests
    log "Running server API tests..."
    if [ "$COVERAGE" = "true" ]; then
        cargo test --test server_tests --coverage --coverage-dir "$LOG_DIR/coverage" 2>&1 | tee "$LOG_DIR/server_tests.log"
    else
        cargo test --test server_tests 2>&1 | tee "$LOG_DIR/server_tests.log"
    fi
    
    # Stop the server
    log "Stopping test server..."
    kill $SERVER_PID || true
    wait $SERVER_PID 2>/dev/null || true
    
    success "Server tests completed"
}

# Run performance tests
run_performance_tests() {
    log "Running performance tests..."
    
    # Load testing
    log "Running load tests..."
    if command -v wrk &> /dev/null; then
        wrk -t12 -c400 -d30s http://127.0.0.1:4021/health 2>&1 | tee "$LOG_DIR/load_test.log"
    else
        warning "wrk not found, skipping load tests"
    fi
    
    # Memory leak testing
    log "Running memory tests..."
    if command -valgrind &> /dev/null; then
        # This would require more setup
        warning "Valgrind testing not configured"
    fi
    
    success "Performance tests completed"
}

# Run security tests
run_security_tests() {
    log "Running security tests..."
    
    # Basic security checks
    log "Running basic security checks..."
    
    # Check for common vulnerabilities
    if command -v curl &> /dev/null; then
        # Test for unauthenticated access
        if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:4021/api/sessions | grep -q "401"; then
            success "Authentication required for API endpoints"
        else
            warning "API endpoints may not require authentication"
        fi
        
        # Test for CORS headers
        if curl -s -I http://127.0.0.1:4021/health | grep -i "access-control"; then
            success "CORS headers present"
        else
            warning "CORS headers may be missing"
        fi
    fi
    
    success "Security tests completed"
}

# Generate test report
generate_report() {
    log "Generating test report..."
    
    local report_file="$LOG_DIR/test_report_$(date +%Y%m%d_%H%M%S).md"
    
    cat > "$report_file" << EOF
# TunnelForge Test Report

**Generated:** $(date)
**Platform:** $(uname -a)
**Test Timeout:** ${TEST_TIMEOUT}s
**Coverage:** ${COVERAGE}

## Test Results

### Unit Tests
- Rust: $(grep -c "test result" "$LOG_DIR/rust_unit_tests.log" || echo "0") tests
- Go: $(grep -c "PASS" "$LOG_DIR/go_unit_tests.log" 2>/dev/null || echo "0") tests

### Integration Tests
- Status: $(grep -q "FAILED" "$LOG_DIR/integration_tests.log" && echo "FAILED" || echo "PASSED")
- Details: See $LOG_DIR/integration_tests.log

### Platform Tests
- Status: $(grep -q "FAILED" "$LOG_DIR/platform_tests.log" && echo "FAILED" || echo "PASSED")
- Details: See $LOG_DIR/platform_tests.log

### Server Tests
- Status: $(grep -q "FAILED" "$LOG_DIR/server_tests.log" && echo "FAILED" || echo "PASSED")
- Details: See $LOG_DIR/server_tests.log

### Performance Tests
- Load Test: See $LOG_DIR/load_test.log

### Security Tests
- Basic Security: See $LOG_DIR/security_tests.log

## Coverage Report
EOF

    if [ "$COVERAGE" = "true" ] && [ -d "$LOG_DIR/coverage" ]; then
        echo "Coverage data generated in $LOG_DIR/coverage" >> "$report_file"
    fi
    
    success "Test report generated: $report_file"
}

# Main execution
main() {
    log "Starting TunnelForge comprehensive test suite..."
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --unit-only)
                UNIT_ONLY=true
                shift
                ;;
            --integration-only)
                INTEGRATION_ONLY=true
                shift
                ;;
            --coverage)
                COVERAGE=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --timeout)
                TEST_TIMEOUT="$2"
                shift 2
                ;;
            *)
                error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Run tests
    check_dependencies
    build_components
    
    if [ "${UNIT_ONLY:-false}" = "true" ]; then
        run_unit_tests
    elif [ "${INTEGRATION_ONLY:-false}" = "true" ]; then
        run_integration_tests
    else
        run_unit_tests
        run_integration_tests
        run_platform_tests
        run_server_tests
        run_performance_tests
        run_security_tests
    fi
    
    generate_report
    
    success "All tests completed successfully!"
}

# Run main function with all arguments
main "$@"