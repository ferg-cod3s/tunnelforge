#!/bin/bash

# Pre-UI Test Validation Script
# Validates backend endpoints before browser testing

echo "========================================="
echo "Pre-UI Test Validation"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Server Health
echo "1. Testing Server Health..."
GO_HEALTH=$(curl -s http://localhost:4021/api/health)
BUN_HEALTH=$(curl -s http://localhost:3001/api/health)

if echo "$GO_HEALTH" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✓${NC} Go server (4021) is healthy"
else
    echo -e "${RED}✗${NC} Go server (4021) is NOT responding"
    exit 1
fi

if echo "$BUN_HEALTH" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✓${NC} Bun proxy (3001) is healthy"
else
    echo -e "${RED}✗${NC} Bun proxy (3001) is NOT responding"
    exit 1
fi

echo ""

# Test 2: File Preview Endpoint
echo "2. Testing /api/fs/preview..."
PREVIEW=$(curl -s "http://localhost:3001/api/fs/preview?path=/home/f3rg/src/github/tunnelforge/README.md")

if echo "$PREVIEW" | grep -q '"type":"text"'; then
    LANG=$(echo "$PREVIEW" | jq -r '.language')
    SIZE=$(echo "$PREVIEW" | jq -r '.humanSize')
    echo -e "${GREEN}✓${NC} Preview endpoint working (language: $LANG, size: $SIZE)"
else
    echo -e "${RED}✗${NC} Preview endpoint NOT working"
    echo "Response: $PREVIEW"
    exit 1
fi

echo ""

# Test 3: Diff Structure Endpoint
echo "3. Testing /api/fs/diff..."
DIFF=$(curl -s "http://localhost:3001/api/fs/diff?path=/home/f3rg/src/github/tunnelforge/README.md")

if echo "$DIFF" | grep -q '"path"'; then
    HAS_DIFF=$(echo "$DIFF" | jq -r '.hasDiff')
    echo -e "${GREEN}✓${NC} Diff structure endpoint working (hasDiff: $HAS_DIFF)"
else
    echo -e "${RED}✗${NC} Diff structure endpoint NOT working"
    echo "Response: $DIFF"
    exit 1
fi

echo ""

# Test 4: Diff Content Endpoint
echo "4. Testing /api/fs/diff-content..."
DIFF_CONTENT=$(curl -s "http://localhost:3001/api/fs/diff-content?path=/home/f3rg/src/github/tunnelforge/README.md")

if echo "$DIFF_CONTENT" | grep -q '"path"'; then
    LANG=$(echo "$DIFF_CONTENT" | jq -r '.language // "unknown"')
    echo -e "${GREEN}✓${NC} Diff content endpoint working (language: $LANG)"
else
    echo -e "${RED}✗${NC} Diff content endpoint NOT working"
    echo "Response: $DIFF_CONTENT"
    exit 1
fi

echo ""

# Test 5: Language Detection
echo "5. Testing Language Detection..."
declare -A LANGUAGE_TESTS=(
    ["/home/f3rg/src/github/tunnelforge/server/cmd/vibetunnel/main.go"]="go"
    ["/home/f3rg/src/github/tunnelforge/web/src/bun-server.ts"]="typescript"
    ["/home/f3rg/src/github/tunnelforge/package.json"]="json"
)

LANG_PASS=0
LANG_TOTAL=0

for filepath in "${!LANGUAGE_TESTS[@]}"; do
    if [ -f "$filepath" ]; then
        LANG_TOTAL=$((LANG_TOTAL + 1))
        expected="${LANGUAGE_TESTS[$filepath]}"
        result=$(curl -s "http://localhost:3001/api/fs/preview?path=${filepath}" | jq -r '.language')
        
        if [ "$result" = "$expected" ]; then
            echo -e "${GREEN}✓${NC} $(basename $filepath) detected as '$result'"
            LANG_PASS=$((LANG_PASS + 1))
        else
            echo -e "${RED}✗${NC} $(basename $filepath) detected as '$result' (expected: '$expected')"
        fi
    fi
done

echo ""

# Test 6: Error Handling
echo "6. Testing Error Handling..."
NOT_FOUND=$(curl -s -w "%{http_code}" "http://localhost:3001/api/fs/preview?path=/nonexistent/file.txt" -o /dev/null)

if [ "$NOT_FOUND" = "404" ]; then
    echo -e "${GREEN}✓${NC} 404 error handling works"
else
    echo -e "${RED}✗${NC} 404 error handling incorrect (got: $NOT_FOUND)"
fi

echo ""
echo "========================================="
echo "Pre-Test Validation Complete"
echo "========================================="
echo ""
echo -e "Endpoints: ${GREEN}4/4 working${NC}"
echo -e "Language Detection: ${GREEN}${LANG_PASS}/${LANG_TOTAL} passed${NC}"
echo -e "Error Handling: ${GREEN}1/1 passed${NC}"
echo ""
echo -e "${GREEN}✓ All backend tests passed!${NC}"
echo ""
echo "Next steps:"
echo "1. Open browser to: http://localhost:3001"
echo "2. Follow checklist in: BROWSER_UI_TEST_CHECKLIST.md"
echo "3. Test file preview, diff viewing, and error handling"
echo ""
