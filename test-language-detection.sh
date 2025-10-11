#!/bin/bash

BASE_PATH="/home/f3rg/src/github/tunnelforge"
URL="http://localhost:3001/api/fs/preview"

echo "Testing Language Detection"
echo "========================="

test_file() {
    local file=$1
    local expected=$2
    result=$(curl -s "${URL}?path=${BASE_PATH}/${file}" | jq -r '.language // "error"')
    if [ "$result" = "$expected" ]; then
        echo "✅ ${file} → ${result}"
    else
        echo "❌ ${file} → got '${result}', expected '${expected}'"
    fi
}

# Test various file types
test_file "package.json" "json"
test_file "server/go.mod" "go"
test_file "web/src/bun-server.ts" "typescript"
test_file "web/src/client/index.css" "css"
test_file ".github/workflows/build.yml" "yaml"
test_file "server/internal/server/server.go" "go"
test_file "web/package.json" "json"

echo -e "\n✅ Language detection tests complete!"
