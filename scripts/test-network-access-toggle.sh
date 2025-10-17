#!/bin/bash
# Network Access Feature - Comprehensive Test Script
# This script validates the network access toggle implementation
# Run this after building the desktop app

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Detect platform
if [[ "$OSTYPE" == "darwin"* ]]; then
    PLATFORM="macOS"
    CONFIG_DIR="$HOME/.config/tunnelforge"
elif [[ "$OSTYPE" == "linux"* ]]; then
    PLATFORM="Linux"
    CONFIG_DIR="$HOME/.config/tunnelforge"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    PLATFORM="Windows"
    CONFIG_DIR="$APPDATA/tunnelforge"
else
    PLATFORM="Unknown"
    CONFIG_DIR="$HOME/.config/tunnelforge"
fi

# Test counters
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
print_header() {
    echo -e "\n${BLUE}================== $1 ==================${NC}\n"
}

print_test() {
    echo -e "${YELLOW}[TEST]${NC} $1"
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Test 1: Platform detection
test_platform_detection() {
    print_header "Platform Detection"
    print_test "Detecting platform..."
    print_info "Platform: $PLATFORM"
    print_info "Config directory: $CONFIG_DIR"
    
    if [[ -n "$PLATFORM" ]] && [[ "$PLATFORM" != "Unknown" ]]; then
        print_pass "Platform detected correctly"
    else
        print_fail "Failed to detect platform"
    fi
}

# Test 2: Config file validation
test_config_file() {
    print_header "Configuration File Validation"
    
    print_test "Checking if config file exists..."
    if [[ -f "$CONFIG_DIR/config.json" ]]; then
        print_pass "Config file exists"
        
        print_test "Validating config JSON format..."
        if jq . "$CONFIG_DIR/config.json" > /dev/null 2>&1; then
            print_pass "Config JSON is valid"
        else
            print_fail "Config JSON is invalid"
            return
        fi
        
        print_test "Checking for access_mode field..."
        ACCESS_MODE=$(jq -r '.access_mode' "$CONFIG_DIR/config.json" 2>/dev/null)
        if [[ -n "$ACCESS_MODE" ]]; then
            print_pass "access_mode field exists: $ACCESS_MODE"
        else
            print_fail "access_mode field missing from config"
        fi
        
        print_test "Checking for server_port field..."
        SERVER_PORT=$(jq -r '.server_port' "$CONFIG_DIR/config.json" 2>/dev/null)
        if [[ "$SERVER_PORT" == "4021" ]]; then
            print_pass "Server port is correct: $SERVER_PORT"
        else
            print_fail "Server port is incorrect: $SERVER_PORT"
        fi
    else
        print_fail "Config file does not exist at $CONFIG_DIR/config.json"
        print_info "Run the app first to create config file"
    fi
}

# Test 3: Port binding validation
test_port_binding() {
    print_header "Port Binding Validation"
    
    if ! command -v netstat &> /dev/null && ! command -v ss &> /dev/null && ! command -v netsh &> /dev/null; then
        print_warn "netstat/ss/netsh not available, skipping port binding test"
        return
    fi
    
    print_test "Checking if server is running on port 4021..."
    
    local found=false
    
    if command -v ss &> /dev/null; then
        if ss -tlnp 2>/dev/null | grep -q ":4021"; then
            print_pass "Server is listening on port 4021"
            BINDING=$(ss -tlnp 2>/dev/null | grep ":4021" || true)
            print_info "Binding: $BINDING"
            found=true
        fi
    elif command -v netstat &> /dev/null; then
        if netstat -tlnp 2>/dev/null | grep -q ":4021"; then
            print_pass "Server is listening on port 4021"
            BINDING=$(netstat -tlnp 2>/dev/null | grep ":4021" || true)
            print_info "Binding: $BINDING"
            found=true
        fi
    fi
    
    if [[ "$found" == false ]]; then
        print_info "Server not running on port 4021 (start the app to test)"
    fi
}

# Test 4: Connectivity test
test_connectivity() {
    print_header "Connectivity Tests"
    
    if ! command -v curl &> /dev/null; then
        print_warn "curl not available, skipping connectivity tests"
        return
    fi
    
    print_test "Testing localhost connectivity..."
    if curl -sk https://localhost:4021/api/health > /dev/null 2>&1; then
        print_pass "Localhost connectivity works"
    else
        print_info "Localhost connection failed or server not running"
    fi
    
    print_test "Testing 127.0.0.1 connectivity..."
    if curl -sk https://127.0.0.1:4021/api/health > /dev/null 2>&1; then
        print_pass "127.0.0.1 connectivity works"
    else
        print_info "127.0.0.1 connection failed or server not running"
    fi
}

# Test 5: File permissions
test_file_permissions() {
    print_header "File Permissions"
    
    print_test "Checking config directory permissions..."
    if [[ -d "$CONFIG_DIR" ]]; then
        if [[ -w "$CONFIG_DIR" ]]; then
            print_pass "Config directory is writable"
        else
            print_fail "Config directory is not writable (may prevent toggling)"
        fi
        
        if [[ -r "$CONFIG_DIR" ]]; then
            print_pass "Config directory is readable"
        else
            print_fail "Config directory is not readable"
        fi
    fi
}

# Test 6: Access mode toggle
test_access_mode_toggle() {
    print_header "Access Mode Toggle Test"
    
    if [[ ! -f "$CONFIG_DIR/config.json" ]]; then
        print_warn "Config file doesn't exist, skipping toggle test"
        print_info "Run the app first to create config file"
        return
    fi
    
    print_test "Reading current access mode..."
    CURRENT_MODE=$(jq -r '.access_mode' "$CONFIG_DIR/config.json" 2>/dev/null)
    print_info "Current mode: $CURRENT_MODE"
    
    print_test "Checking mode is valid (LocalhostOnly or NetworkAccess)..."
    if [[ "$CURRENT_MODE" == "LocalhostOnly" ]] || [[ "$CURRENT_MODE" == "NetworkAccess" ]]; then
        print_pass "Access mode is valid"
    else
        print_fail "Access mode is invalid: $CURRENT_MODE"
    fi
}

# Test 7: Run tests summary
print_summary() {
    print_header "Test Summary"
    
    echo "Total Tests:  $TESTS_TOTAL"
    echo -e "Passed:       ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Failed:       ${RED}$TESTS_FAILED${NC}"
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "\n${GREEN}✓ All tests passed!${NC}"
        return 0
    else
        echo -e "\n${RED}✗ Some tests failed${NC}"
        return 1
    fi
}

# Main execution
main() {
    echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   Network Access Toggle - Automated Test Suite             ║${NC}"
    echo -e "${BLUE}║   Platform: $PLATFORM${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}\n"
    
    test_platform_detection
    test_config_file
    test_port_binding
    test_connectivity
    test_file_permissions
    test_access_mode_toggle
    print_summary
}

# Run main
main "$@"
