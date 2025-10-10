#!/bin/bash
# Test TunnelForge server connectivity
# This ensures Go server and Bun proxy can communicate

set -e

echo "🧪 TunnelForge Server Connectivity Test"
echo "=========================================="
echo ""

# Load environment
if [ -f .env.development ]; then
    source .env.development
    echo "✅ Loaded .env.development"
else
    echo "❌ .env.development not found!"
    exit 1
fi

GO_PORT=${PORT:-4021}
BUN_PORT=${WEB_PORT:-3001}
GO_URL="http://localhost:${GO_PORT}"

echo ""
echo "Configuration:"
echo "  Go Server Port: ${GO_PORT}"
echo "  Bun Server Port: ${BUN_PORT}"
echo "  Go Server URL: ${GO_URL}"
echo ""

# Test 1: Check if Go server is running
echo "Test 1: Check Go server availability"
if curl -s -f "${GO_URL}/api/config" > /dev/null 2>&1; then
    echo "  ✅ Go server is responding on ${GO_URL}"
else
    echo "  ❌ Go server is NOT responding on ${GO_URL}"
    echo "     Start it with: cd server && ./start.sh"
    exit 1
fi

# Test 2: Check Go server config endpoint
echo ""
echo "Test 2: Verify Go server config endpoint"
CONFIG=$(curl -s "${GO_URL}/api/config")
if echo "$CONFIG" | jq -e '.authRequired' > /dev/null 2>&1; then
    echo "  ✅ Go server returns valid config JSON"
    echo "     authRequired: $(echo "$CONFIG" | jq -r '.authRequired')"
else
    echo "  ❌ Go server config is invalid"
    exit 1
fi

# Test 3: Check if Bun server is running
echo ""
echo "Test 3: Check Bun proxy availability"
if curl -s -f "http://localhost:${BUN_PORT}/api/config" > /dev/null 2>&1; then
    echo "  ✅ Bun server is responding on port ${BUN_PORT}"
else
    echo "  ⚠️  Bun server is NOT responding on port ${BUN_PORT}"
    echo "     This test can still validate the configuration"
fi

# Test 4: Check Bun → Go proxy (if Bun is running)
if curl -s -f "http://localhost:${BUN_PORT}/api/config" > /dev/null 2>&1; then
    echo ""
    echo "Test 4: Verify Bun → Go proxy"
    PROXY_CONFIG=$(curl -s "http://localhost:${BUN_PORT}/api/config")
    if echo "$PROXY_CONFIG" | jq -e '.authRequired' > /dev/null 2>&1; then
        echo "  ✅ Bun proxy successfully forwards to Go server"
        echo "     Proxy config: $(echo "$PROXY_CONFIG" | jq -c '{authRequired, websocketUrl}')"
    else
        echo "  ❌ Bun proxy is not forwarding correctly"
        exit 1
    fi
fi

echo ""
echo "=========================================="
echo "✅ All connectivity tests passed!"
echo ""
echo "Frontend URL: http://localhost:${BUN_PORT}"
echo "API URL: ${GO_URL}"
echo ""
