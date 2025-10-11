#!/bin/bash
# Test script for file browser endpoints
# Tests the three new endpoints: /api/fs/preview, /api/fs/diff, /api/fs/diff-content

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BUN_SERVER_URL="${BUN_SERVER_URL:-http://localhost:3001}"
GO_SERVER_URL="${GO_SERVER_URL:-http://localhost:4021}"

echo -e "${YELLOW}File Browser Endpoints Test Suite${NC}"
echo "=================================="
echo ""

# Check if servers are running
echo "Checking server availability..."
if ! curl -s -f "$GO_SERVER_URL/health" > /dev/null; then
    echo -e "${RED}✗ Go server not responding at $GO_SERVER_URL${NC}"
    echo "  Please start: cd server && ./vibetunnel"
    exit 1
fi
echo -e "${GREEN}✓ Go server running at $GO_SERVER_URL${NC}"

if ! curl -s -f "$BUN_SERVER_URL/api/config" > /dev/null; then
    echo -e "${RED}✗ Bun proxy not responding at $BUN_SERVER_URL${NC}"
    echo "  Please start: cd web && bun run src/bun-server.ts"
    exit 1
fi
echo -e "${GREEN}✓ Bun proxy running at $BUN_SERVER_URL${NC}"
echo ""

# Test files
TEST_FILES=(
    "/home/f3rg/src/github/tunnelforge/README.md:markdown"
    "/home/f3rg/src/github/tunnelforge/package.json:json"
    "/home/f3rg/src/github/tunnelforge/server/internal/filesystem/preview.go:go"
    "/home/f3rg/src/github/tunnelforge/web/src/bun-server.ts:typescript"
)

PASSED=0
FAILED=0

for test_file in "${TEST_FILES[@]}"; do
    IFS=':' read -r filepath expected_lang <<< "$test_file"
    
    if [ ! -f "$filepath" ]; then
        echo -e "${YELLOW}⊘ Skipping non-existent file: $filepath${NC}"
        continue
    fi
    
    filename=$(basename "$filepath")
    echo -e "${YELLOW}Testing: $filename${NC}"
    
    # Test 1: Preview endpoint
    echo -n "  /api/fs/preview ... "
    response=$(curl -s "$BUN_SERVER_URL/api/fs/preview?path=$filepath")
    type=$(echo "$response" | jq -r '.type // empty')
    language=$(echo "$response" | jq -r '.language // empty')
    size=$(echo "$response" | jq -r '.size // empty')
    
    if [ "$type" = "text" ] && [ "$language" = "$expected_lang" ] && [ -n "$size" ]; then
        echo -e "${GREEN}✓${NC} (type=$type, lang=$language, size=$size)"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} (type=$type, lang=$language, size=$size, expected=$expected_lang)"
        ((FAILED++))
    fi
    
    # Test 2: Diff endpoint
    echo -n "  /api/fs/diff ... "
    response=$(curl -s "$BUN_SERVER_URL/api/fs/diff?path=$filepath")
    path=$(echo "$response" | jq -r '.path // empty')
    has_diff=$(echo "$response" | jq -r '.hasDiff // empty')
    
    if [ -n "$path" ] && [ "$has_diff" = "false" ]; then
        echo -e "${GREEN}✓${NC} (hasDiff=$has_diff)"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} (path=$path, hasDiff=$has_diff)"
        ((FAILED++))
    fi
    
    # Test 3: Diff content endpoint
    echo -n "  /api/fs/diff-content ... "
    response=$(curl -s "$BUN_SERVER_URL/api/fs/diff-content?path=$filepath")
    path=$(echo "$response" | jq -r '.path // empty')
    language=$(echo "$response" | jq -r '.language // empty')
    has_original=$(echo "$response" | jq -r 'if .originalContent then "true" else "false" end')
    has_modified=$(echo "$response" | jq -r 'if .modifiedContent then "true" else "false" end')
    
    if [ -n "$path" ] && [ "$language" = "$expected_lang" ] && [ "$has_original" = "true" ] && [ "$has_modified" = "true" ]; then
        echo -e "${GREEN}✓${NC} (lang=$language, hasContent=true)"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} (path=$path, lang=$language, orig=$has_original, mod=$has_modified)"
        ((FAILED++))
    fi
    
    echo ""
done

# Test error handling
echo -e "${YELLOW}Testing error handling:${NC}"

# Test non-existent file
echo -n "  Non-existent file ... "
response=$(curl -s -w "%{http_code}" "$BUN_SERVER_URL/api/fs/preview?path=/nonexistent/file.txt" -o /tmp/test-response.json)
if [ "$response" -ge 400 ]; then
    echo -e "${GREEN}✓${NC} (returns error status)"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} (should return error status, got $response)"
    ((FAILED++))
fi

# Summary
echo ""
echo "=================================="
echo -e "${YELLOW}Test Summary${NC}"
echo "=================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Please review the output above.${NC}"
    exit 1
fi
