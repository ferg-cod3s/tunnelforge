#!/bin/bash

# TunnelForge Kill Servers Script
# Kills backend and frontend development servers

set -e

echo "🛑 Stopping TunnelForge servers..."
echo ""

KILLED_ANY=0

# Kill Go server (port 4021)
if lsof -ti:4021 >/dev/null 2>&1; then
    echo "   Killing Go backend (port 4021)..."
    lsof -ti:4021 | xargs kill -9 2>/dev/null || true
    KILLED_ANY=1
fi

# Kill Bun server (port 3000)
if lsof -ti:3000 >/dev/null 2>&1; then
    echo "   Killing Bun frontend (port 3000)..."
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    KILLED_ANY=1
fi

# Kill Bun server (port 3001)
if lsof -ti:3001 >/dev/null 2>&1; then
    echo "   Killing Bun frontend (port 3001)..."
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
    KILLED_ANY=1
fi

# Kill any remaining Go processes (tunnelforge, server)
GO_PIDS=$(pgrep -f "go run.*server" || true)
if [ ! -z "$GO_PIDS" ]; then
    echo "   Killing Go server processes..."
    echo "$GO_PIDS" | xargs kill -9 2>/dev/null || true
    KILLED_ANY=1
fi

# Kill any remaining Bun dev processes
BUN_PIDS=$(pgrep -f "bun run" || true)
if [ ! -z "$BUN_PIDS" ]; then
    echo "   Killing Bun dev processes..."
    echo "$BUN_PIDS" | xargs kill -9 2>/dev/null || true
    KILLED_ANY=1
fi

# Check for server.pid file
if [ -f "server.pid" ]; then
    PID=$(cat server.pid)
    if kill -0 "$PID" 2>/dev/null; then
        echo "   Killing server from PID file ($PID)..."
        kill -9 "$PID" 2>/dev/null || true
        KILLED_ANY=1
    fi
    rm -f server.pid
fi

# Check for bun.pid file
if [ -f "bun.pid" ]; then
    PID=$(cat bun.pid)
    if kill -0 "$PID" 2>/dev/null; then
        echo "   Killing Bun server from PID file ($PID)..."
        kill -9 "$PID" 2>/dev/null || true
        KILLED_ANY=1
    fi
    rm -f bun.pid
fi

echo ""
if [ $KILLED_ANY -eq 1 ]; then
    echo "✅ All servers stopped"
else
    echo "ℹ️  No running servers found"
fi
