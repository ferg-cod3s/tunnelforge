#!/bin/bash

# Tauri Testing Validation Script
# Validates that the Tauri testing environment is properly configured

set -e

echo "🔍 Validating Tauri testing environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Validation results
VALIDATION_PASSED=true
VALIDATION_ERRORS=()

# Check if running in WSL
check_wsl() {
    if [[ -f /proc/version ]] && grep -q "Microsoft\|WSL" /proc/version; then
        print_success "WSL environment detected"
        return 0
    else
        print_status "Non-WSL environment detected"
        return 1
    fi
}

# Validate system dependencies
validate_dependencies() {
    print_status "Validating system dependencies..."
    
    local deps=("xvfb" "xdpyinfo" "node" "bun" "cargo" "tauri")
    local missing=()
    
    for dep in "${deps[@]}"; do
        if command -v "$dep" &> /dev/null; then
            print_success "✓ $dep"
        else
            print_error "✗ $dep (missing)"
            missing+=("$dep")
            VALIDATION_PASSED=false
        fi
    done
    
    if [[ ${#missing[@]} -gt 0 ]]; then
        VALIDATION_ERRORS+=("Missing dependencies: ${missing[*]}")
    fi
}

# Validate display configuration
validate_display() {
    print_status "Validating display configuration..."
    
    local display=${DISPLAY:-:99}
    
    if xdpyinfo -display "$display" &> /dev/null; then
        print_success "✓ Display $display is working"
        
        # Get display info
        local screen_info=$(xdpyinfo -display "$display" | grep "dimensions:")
        print_status "Screen info: $screen_info"
    else
        print_error "✗ Display $display is not working"
        VALIDATION_PASSED=false
        VALIDATION_ERRORS+=("Display $display is not working")
    fi
}

# Validate Node.js and project dependencies
validate_node_deps() {
    print_status "Validating Node.js dependencies..."
    
    if [[ -f "package.json" ]]; then
        if bun install &> /dev/null; then
            print_success "✓ Node.js dependencies installed"
        else
            print_error "✗ Failed to install Node.js dependencies"
            VALIDATION_PASSED=false
            VALIDATION_ERRORS+=("Node.js dependency installation failed")
        fi
    else
        print_error "✗ package.json not found"
        VALIDATION_PASSED=false
        VALIDATION_ERRORS+=("package.json not found")
    fi
}

# Validate Playwright installation
validate_playwright() {
    print_status "Validating Playwright installation..."
    
    if bunx playwright --version &> /dev/null; then
        local playwright_version=$(bunx playwright --version)
        print_success "✓ Playwright: $playwright_version"
        
        # Check browsers
        local browsers=("chromium" "firefox" "webkit")
        for browser in "${browsers[@]}"; do
            if bunx playwright install "$browser" --dry-run &> /dev/null; then
                print_success "✓ $browser browser available"
            else
                print_warning "⚠ $browser browser not installed"
            fi
        done
    else
        print_error "✗ Playwright not installed"
        VALIDATION_PASSED=false
        VALIDATION_ERRORS+=("Playwright not installed")
    fi
}

# Validate Tauri project structure
validate_tauri_project() {
    print_status "Validating Tauri project structure..."
    
    local required_files=(
        "src-tauri/tauri.conf.json"
        "src-tauri/Cargo.toml"
        "src-tauri/src/lib.rs"
        "playwright.config.tauri.enhanced.ts"
        "tests/e2e-desktop/helpers/tauri-desktop-helpers.ts"
    )
    
    for file in "${required_files[@]}"; do
        if [[ -f "$file" ]]; then
            print_success "✓ $file"
        else
            print_error "✗ $file (missing)"
            VALIDATION_PASSED=false
            VALIDATION_ERRORS+=("Required file missing: $file")
        fi
    done
}

# Validate test directories
validate_test_dirs() {
    print_status "Validating test directories..."
    
    local test_dirs=(
        "test-results/tauri-screenshots"
        "test-results/tauri-videos"
        "test-results/tauri-traces"
        "test-results/tauri-logs"
        "test-results/tauri-output"
    )
    
    for dir in "${test_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            print_success "✓ $dir"
        else
            print_warning "⚠ $dir (will be created during tests)"
        fi
    done
}

# Validate environment variables
validate_env_vars() {
    print_status "Validating environment variables..."
    
    local env_vars=(
        "TUNNELFORGE_TEST_MODE"
        "TAURI_DEBUG"
        "RUST_LOG"
    )
    
    for var in "${env_vars[@]}"; do
        if [[ -n "${!var}" ]]; then
            print_success "✓ $var=${!var}"
        else
            print_warning "⚠ $var not set"
        fi
    done
}

# Test basic Tauri functionality
test_tauri_functionality() {
    print_status "Testing basic Tauri functionality..."
    
    # Check if Tauri can be built
    if cargo check --manifest-path src-tauri/Cargo.toml &> /dev/null; then
        print_success "✓ Tauri project compiles"
    else
        print_error "✗ Tauri project compilation failed"
        VALIDATION_PASSED=false
        VALIDATION_ERRORS+=("Tauri project compilation failed")
        return
    fi
    
    # Test Tauri CLI
    if tauri --version &> /dev/null; then
        local tauri_version=$(tauri --version)
        print_success "✓ Tauri CLI: $tauri_version"
    else
        print_error "✗ Tauri CLI not working"
        VALIDATION_PASSED=false
        VALIDATION_ERRORS+=("Tauri CLI not working")
    fi
}

# Test Playwright configuration
test_playwright_config() {
    print_status "Testing Playwright configuration..."
    
    if [[ -f "playwright.config.tauri.enhanced.ts" ]]; then
        # Try to validate the config syntax
        if bun --check playwright.config.tauri.enhanced.ts &> /dev/null; then
            print_success "✓ Playwright config syntax is valid"
        else
            print_error "✗ Playwright config syntax error"
            VALIDATION_PASSED=false
            VALIDATION_ERRORS+=("Playwright config syntax error")
        fi
    fi
}

# Run a quick test
run_quick_test() {
    print_status "Running quick validation test..."
    
    # Create a simple test file
    cat > test-validation.spec.ts << 'EOF'
import { test, expect } from '@playwright/test';

test('validation test', async ({ page }) => {
  await page.goto('about:blank');
  expect(await page.title()).toBe('');
});
EOF
    
    # Run the test
    if bunx playwright test test-validation.spec.ts --config=playwright.config.tauri.enhanced.ts &> /dev/null; then
        print_success "✓ Playwright test execution works"
    else
        print_warning "⚠ Playwright test execution failed (may be normal if Tauri app not running)"
    fi
    
    # Cleanup
    rm -f test-validation.spec.ts
}

# Generate validation report
generate_report() {
    echo
    echo "=================================="
    echo "📊 VALIDATION REPORT"
    echo "=================================="
    
    if [[ "$VALIDATION_PASSED" == true ]]; then
        print_success "✅ All validations passed!"
        echo
        print_status "You can now run Tauri tests:"
        echo "  bun run test:tauri              # Headless tests"
        echo "  bun run test:tauri:headed      # Headed tests"
        echo "  bun run test:desktop           # Desktop tests"
        if check_wsl &> /dev/null; then
            echo "  bun run test:wsl               # WSL tests"
        fi
    else
        print_error "❌ Validation failed!"
        echo
        print_error "Issues found:"
        for error in "${VALIDATION_ERRORS[@]}"; do
            echo "  • $error"
        done
        echo
        print_status "To fix issues:"
        echo "  1. Run: ./setup-wsl-testing.sh"
        echo "  2. Install missing dependencies"
        echo "  3. Check environment variables"
        echo "  4. Verify display configuration"
    fi
    
    echo "=================================="
}

# Main validation function
main() {
    echo "🔍 Starting Tauri testing environment validation..."
    echo
    
    # Run all validations
    check_wsl
    validate_dependencies
    validate_display
    validate_node_deps
    validate_playwright
    validate_tauri_project
    validate_test_dirs
    validate_env_vars
    test_tauri_functionality
    test_playwright_config
    run_quick_test
    
    # Generate report
    generate_report
    
    # Exit with appropriate code
    if [[ "$VALIDATION_PASSED" == true ]]; then
        exit 0
    else
        exit 1
    fi
}

# Run main function
main "$@"