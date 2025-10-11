#!/bin/bash
# Load environment from .env.development if it exists
ENV_FILE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/../.env.development"
if [ -f "$ENV_FILE" ]; then
    echo "📝 Loading environment from .env.development"
    set -a
    source "$ENV_FILE"
    set +a
fi
echo ""

# TunnelForge Go Server - Quick Start Script

set -e

echo "🚀 TunnelForge Go Server - Quick Start"
echo "======================================"

# Build the server
echo "📦 Building server..."
go build -o tunnelforge-server cmd/server/main.go

# Check if Node.js server is running on 4020
if curl -s --connect-timeout 1 http://localhost:4020/health > /dev/null 2>&1; then
    echo "✅ Node.js server detected on port 4020"
else
    echo "ℹ️  No Node.js server detected on port 4020"
fi

echo "🌐 Starting Go server on port 4021..."
echo ""
echo "Endpoints:"
echo "  Health:    http://localhost:4021/health"
echo "  WebSocket: ws://localhost:4021/ws"
echo "  Sessions:  http://localhost:4021/api/sessions"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
exec ./tunnelforge-server
