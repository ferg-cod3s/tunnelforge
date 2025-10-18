#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_RESULTS_DIR="$PROJECT_ROOT/test-results"
TAURI_DIR="$PROJECT_ROOT/src-tauri"
CACHE_FILE="$TEST_RESULTS_DIR/.tauri-build-cache"

echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  TunnelForge E2E Test Runner${NC}"
echo -e "${YELLOW}  Platform: $(uname -s)${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"

# Create test results directory if it doesn't exist
mkdir -p "$TEST_RESULTS_DIR"

# Check if we need to rebuild Tauri
REBUILD_NEEDED=false
if [ ! -f "$CACHE_FILE" ]; then
    echo -e "${YELLOW}[1/3] First run detected - Tauri app needs to be built${NC}"
    REBUILD_NEEDED=true
elif [ "$1" = "--rebuild" ]; then
    echo -e "${YELLOW}[1/3] Rebuild requested${NC}"
    REBUILD_NEEDED=true
else
    # Check if source files have changed since last build
    LAST_BUILD=$(cat "$CACHE_FILE")
    echo -e "${YELLOW}[1/3] Checking for source file changes since $(date -d @$LAST_BUILD 2>/dev/null || echo $LAST_BUILD)${NC}"
    
    # Quick check for source file modifications
    RECENT_CHANGES=$(find "$TAURI_DIR/src" -type f -newer "$CACHE_FILE" 2>/dev/null | wc -l)
    if [ "$RECENT_CHANGES" -gt 0 ]; then
        echo -e "${YELLOW}     Found $RECENT_CHANGES changed source files - rebuilding${NC}"
        REBUILD_NEEDED=true
    fi
fi

if [ "$REBUILD_NEEDED" = true ]; then
    echo -e "${YELLOW}[2/3] Pre-compiling Tauri app (this may take 2-5 minutes on first run)...${NC}"
    cd "$TAURI_DIR"
    
    # Run cargo build in background and show progress
    if timeout 600 cargo build --profile dev 2>&1 | tail -20; then
        echo -e "${GREEN}     ✓ Tauri app compiled successfully${NC}"
        date +%s > "$CACHE_FILE"
    else
        echo -e "${RED}     ✗ Tauri compilation failed${NC}"
        exit 1
    fi
    cd "$PROJECT_ROOT"
else
    echo -e "${GREEN}     ✓ Using cached Tauri build${NC}"
fi

# Run Playwright tests
echo -e "${YELLOW}[3/3] Running Playwright E2E tests...${NC}"
echo ""

cd "$PROJECT_ROOT"

# Run with improved timeout and output
if bun run test 2>&1 | tee "$TEST_RESULTS_DIR/test-run-$(date +%Y%m%d-%H%M%S).log"; then
    EXIT_CODE=0
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  ✓ E2E Tests Completed Successfully${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}📊 Test Results:${NC}"
    echo "   HTML Report: $TEST_RESULTS_DIR/index.html"
    echo "   JSON Results: $TEST_RESULTS_DIR/results.json"
else
    EXIT_CODE=$?
    echo ""
    echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}  ✗ E2E Tests Failed (Exit Code: $EXIT_CODE)${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}📊 Logs Available:${NC}"
    ls -lt "$TEST_RESULTS_DIR"/test-run-*.log 2>/dev/null | head -3 | awk '{print "   " $NF}'
    echo ""
    echo -e "${YELLOW}💡 Troubleshooting:${NC}"
    echo "   1. Check the HTML report: open $TEST_RESULTS_DIR/index.html"
    echo "   2. Review test logs: tail -50 $TEST_RESULTS_DIR/test-run-*.log | head -100"
    echo "   3. Rebuild app: $0 --rebuild"
fi

exit $EXIT_CODE
