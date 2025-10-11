#!/bin/bash
set -euo pipefail

# TunnelForge Build Validation Script
# Tests unsigned builds across all platforms to verify configuration

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

echo "==================================="
echo "TunnelForge Build Validation"
echo "==================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track results
PASSED=0
FAILED=0
SKIPPED=0

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED++))
}

log_error() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED++))
}

log_skip() {
    echo -e "${YELLOW}[SKIP]${NC} $1"
    ((SKIPPED++))
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Rust
    if command -v rustc &> /dev/null; then
        RUST_VERSION=$(rustc --version)
        log_success "Rust: $RUST_VERSION"
    else
        log_error "Rust not installed"
        exit 1
    fi
    
    # Check Cargo
    if command -v cargo &> /dev/null; then
        CARGO_VERSION=$(cargo --version)
        log_success "Cargo: $CARGO_VERSION"
    else
        log_error "Cargo not installed"
        exit 1
    fi
    
    # Check Go
    if command -v go &> /dev/null; then
        GO_VERSION=$(go version)
        log_success "Go: $GO_VERSION"
    else
        log_error "Go not installed"
        exit 1
    fi
    
    # Check Bun
    if command -v bun &> /dev/null; then
        BUN_VERSION=$(bun --version)
        log_success "Bun: v$BUN_VERSION"
    else
        log_skip "Bun not installed (optional)"
    fi
    
    echo ""
}

# Validate Tauri configuration
validate_config() {
    local platform=$1
    local config_path="$platform/src-tauri/tauri.conf.json"
    
    log_info "Validating $platform configuration..."
    
    if [[ ! -f "$config_path" ]]; then
        log_error "$config_path not found"
        return 1
    fi
    
    # Check for required sections
    if grep -q '"bundle"' "$config_path"; then
        log_success "$platform: bundle section exists"
    else
        log_error "$platform: bundle section missing"
        return 1
    fi
    
    if grep -q '"updater"' "$config_path"; then
        log_success "$platform: updater section exists"
    else
        log_skip "$platform: updater section missing (optional)"
    fi
    
    # Check for identifier
    if grep -q '"identifier"' "$config_path"; then
        IDENTIFIER=$(grep -o '"identifier":\s*"[^"]*"' "$config_path" | cut -d'"' -f4)
        log_success "$platform: identifier = $IDENTIFIER"
    else
        log_error "$platform: identifier missing"
        return 1
    fi
    
    echo ""
}

# Build Go server
build_server() {
    log_info "Building Go server..."
    
    cd "$PROJECT_ROOT/server"
    
    if make build &> /tmp/tunnelforge-server-build.log; then
        if [[ -f "bin/server" ]]; then
            SERVER_SIZE=$(du -h bin/server | cut -f1)
            log_success "Server built successfully ($SERVER_SIZE)"
        else
            log_error "Server binary not found"
            return 1
        fi
    else
        log_error "Server build failed (see /tmp/tunnelforge-server-build.log)"
        return 1
    fi
    
    cd "$PROJECT_ROOT"
    echo ""
}

# Test platform build
test_build() {
    local platform=$1
    local build_type=${2:-debug}
    
    log_info "Testing $platform build ($build_type)..."
    
    if [[ ! -d "$platform" ]]; then
        log_skip "$platform: directory not found"
        return 0
    fi
    
    cd "$PROJECT_ROOT/$platform"
    
    # Check if package.json exists
    if [[ ! -f "package.json" ]]; then
        log_skip "$platform: package.json not found"
        cd "$PROJECT_ROOT"
        return 0
    fi
    
    # Determine build command
    local build_cmd
    case $build_type in
        debug)
            build_cmd="build:debug"
            ;;
        release)
            build_cmd="build"
            ;;
        *)
            build_cmd="build:debug"
            ;;
    esac
    
    # Check if command exists in package.json
    if ! grep -q "\"$build_cmd\"" package.json; then
        log_skip "$platform: $build_cmd script not found"
        cd "$PROJECT_ROOT"
        return 0
    fi
    
    # Attempt build (with timeout)
    log_info "$platform: Running build (this may take several minutes)..."
    
    if timeout 600 bun run "$build_cmd" &> "/tmp/tunnelforge-$platform-build.log"; then
        # Check for output artifacts
        if [[ -d "src-tauri/target" ]]; then
            ARTIFACT_COUNT=$(find src-tauri/target -type f \( -name "*.deb" -o -name "*.rpm" -o -name "*.AppImage" -o -name "*.msi" -o -name "*.exe" -o -name "*.dmg" \) 2>/dev/null | wc -l)
            
            if [[ $ARTIFACT_COUNT -gt 0 ]]; then
                log_success "$platform: Build succeeded ($ARTIFACT_COUNT artifacts)"
                
                # List artifacts
                find src-tauri/target -type f \( -name "*.deb" -o -name "*.rpm" -o -name "*.AppImage" -o -name "*.msi" -o -name "*.exe" -o -name "*.dmg" \) 2>/dev/null | while read artifact; do
                    SIZE=$(du -h "$artifact" | cut -f1)
                    FILENAME=$(basename "$artifact")
                    echo "  - $FILENAME ($SIZE)"
                done
            else
                log_skip "$platform: Build completed but no artifacts found"
            fi
        else
            log_skip "$platform: target directory not found"
        fi
    else
        EXIT_CODE=$?
        if [[ $EXIT_CODE -eq 124 ]]; then
            log_error "$platform: Build timed out (>10 minutes)"
        else
            log_error "$platform: Build failed (see /tmp/tunnelforge-$platform-build.log)"
        fi
        cd "$PROJECT_ROOT"
        return 1
    fi
    
    cd "$PROJECT_ROOT"
    echo ""
}

# Main execution
main() {
    echo "Starting validation at $(date)"
    echo ""
    
    # Step 1: Check prerequisites
    check_prerequisites
    
    # Step 2: Validate configurations
    log_info "=== Configuration Validation ==="
    echo ""
    validate_config "linux"
    validate_config "windows"
    validate_config "desktop"
    
    # Step 3: Build Go server
    log_info "=== Server Build ==="
    echo ""
    build_server
    
    # Step 4: Test platform builds (debug only for speed)
    log_info "=== Platform Builds ==="
    echo ""
    
    # Determine which platform we're on
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        test_build "linux" "debug"
        log_skip "windows: Requires Windows host"
        log_skip "desktop: Requires macOS host"
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        test_build "desktop" "debug"
        log_skip "linux: Requires Linux host"
        log_skip "windows: Requires Windows host"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        test_build "windows" "debug"
        log_skip "linux: Requires Linux host"
        log_skip "desktop: Requires macOS host"
    else
        log_error "Unknown platform: $OSTYPE"
    fi
    
    # Summary
    echo ""
    echo "==================================="
    echo "Validation Summary"
    echo "==================================="
    echo -e "${GREEN}Passed:${NC}  $PASSED"
    echo -e "${RED}Failed:${NC}  $FAILED"
    echo -e "${YELLOW}Skipped:${NC} $SKIPPED"
    echo ""
    
    if [[ $FAILED -gt 0 ]]; then
        echo -e "${RED}VALIDATION FAILED${NC}"
        echo "Check logs in /tmp/tunnelforge-*.log for details"
        exit 1
    else
        echo -e "${GREEN}VALIDATION PASSED${NC}"
        exit 0
    fi
}

# Run main function
main "$@"
