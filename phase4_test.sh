#!/bin/bash

# Phase 4.1 Test Setup and Execution

TUNNEL_APP="desktop/src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/appimage/TunnelForge_1.0.0_amd64.AppImage"
CONFIG_DIR="$HOME/.config/tunnelforge"
CONFIG_FILE="$CONFIG_DIR/config.json"

echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║            Phase 4.1: Linux Tauri Desktop App Testing              ║"
echo "║                   TEST 4.1.1: Startup Test                          ║"
echo "╚════════════════════════════════════════════════════════════════════╝"

# Create config directory if needed
mkdir -p "$CONFIG_DIR"

# Check default config
echo ""
echo "[1] Checking configuration file..."
if [ -f "$CONFIG_FILE" ]; then
    echo "✅ Config file exists:"
    cat "$CONFIG_FILE"
else
    echo "⚠️  Config file not found, creating default..."
    cat > "$CONFIG_FILE" << 'CONF'
{
  "access_mode": "localhost_only",
  "server": {
    "port": 4021
  },
  "ui": {
    "theme": "dark",
    "auto_start": true
  }
}
CONF
    echo "✅ Created default config"
    cat "$CONFIG_FILE"
fi

echo ""
echo "[2] Checking AppImage location..."
if [ -f "$TUNNEL_APP" ]; then
    echo "✅ AppImage found: $TUNNEL_APP"
    ls -lh "$TUNNEL_APP"
else
    echo "❌ AppImage not found!"
    exit 1
fi

echo ""
echo "[3] Testing AppImage launch in headless mode..."
echo "Starting TunnelForge (will run for 10 seconds)..."

# Launch app with --help to verify it's runnable
"$TUNNEL_APP" --help > /tmp/tunnelforge_help.txt 2>&1 &
HELP_PID=$!
sleep 2
kill $HELP_PID 2>/dev/null || true
wait $HELP_PID 2>/dev/null || true

echo ""
echo "[4] Checking help output..."
if [ -s /tmp/tunnelforge_help.txt ]; then
    echo "✅ App help output:"
    head -20 /tmp/tunnelforge_help.txt
fi

echo ""
echo "[5] Checking server process startup..."
echo "Attempting to start app in background..."

# Start the server
export DISPLAY=""
export WAYLAND_DISPLAY=""

# Start app in background
"$TUNNEL_APP" > /tmp/tunnelforge_app.log 2>&1 &
APP_PID=$!

echo "App started with PID: $APP_PID"

# Give it time to start
sleep 5

# Check if process is running
if ps -p $APP_PID > /dev/null; then
    echo "✅ App process is running (PID: $APP_PID)"
else
    echo "⚠️  App process exited. Checking logs..."
    cat /tmp/tunnelforge_app.log
fi

echo ""
echo "[6] Checking Go server process..."
# Look for tunnelforge-server or the Go backend
ps aux | grep -i tunnelforge | grep -v grep || echo "⚠️  No tunnelforge processes found (UI-only mode)"

echo ""
echo "[7] Checking network bindings..."
ss -tlnp 2>/dev/null | grep 4021 || echo "⚠️  Port 4021 not yet bound"

echo ""
echo "[8] Cleanup..."
if ps -p $APP_PID > /dev/null; then
    kill $APP_PID 2>/dev/null || true
    wait $APP_PID 2>/dev/null || true
    echo "✅ App process terminated"
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║                     Test 4.1.1 Complete                            ║"
echo "╚════════════════════════════════════════════════════════════════════╝"

