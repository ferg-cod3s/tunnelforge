#!/bin/bash

BASE_PATH="/home/f3rg/src/github/tunnelforge"
PROXY_URL="http://localhost:3001"
DIRECT_URL="http://localhost:4021"

echo "Testing File Browser Endpoints (via Bun proxy)"
echo "=============================================="

# Test 1: Preview endpoint
echo -e "\n1. Testing /api/fs/preview"
curl -s "${PROXY_URL}/api/fs/preview?path=${BASE_PATH}/README.md" | jq -r 'if .type then "✅ type=\(.type), lang=\(.language), size=\(.humanSize)" else "❌ \(.)" end'

# Test 2: Diff endpoint
echo -e "\n2. Testing /api/fs/diff"
curl -s "${PROXY_URL}/api/fs/diff?path=${BASE_PATH}/README.md" | jq -r 'if .path then "✅ path=\(.path), hasDiff=\(.hasDiff)" else "❌ \(.)" end'

# Test 3: Diff-content endpoint
echo -e "\n3. Testing /api/fs/diff-content"
curl -s "${PROXY_URL}/api/fs/diff-content?path=${BASE_PATH}/README.md" | jq -r 'if .language then "✅ lang=\(.language), originalSize=\(.originalContent | length) chars" else "❌ \(.)" end'

echo -e "\nTesting direct Go server (bypassing proxy)"
echo "=========================================="

# Test 4: Direct Go server
echo -e "\n4. Testing Go server directly"
curl -s "${DIRECT_URL}/api/fs/preview?path=${BASE_PATH}/README.md" | jq -r 'if .type then "✅ Direct: type=\(.type), lang=\(.language)" else "❌ \(.)" end'

echo -e "\n✅ All tests complete!"
