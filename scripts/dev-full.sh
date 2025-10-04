#!/bin/bash
# TunnelForge Development - Start Go Server + Bun Web Server
# This script starts both the Go backend server and the Bun web frontend/proxy

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SERVER_DIR="$PROJECT_ROOT/server"
WEB_DIR="$PROJECT_ROOT/web"

# Default ports
GO_SERVER_PORT="${GO_SERVER_PORT:-4021}"
BUN_SERVER_PORT="${BUN_SERVER_PORT:-3001}"

# Function to get local IP address
get_local_ip() {
    # Try different methods to get local IP
    local ip=""

    # Method 1: Use hostname -I (Linux)
    if command -v hostname >/dev/null 2>&1; then
        ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi

    # Method 2: Use ip route (Linux)
    if [ -z "$ip" ] && command -v ip >/dev/null 2>&1; then
        ip=$(ip route get 1 2>/dev/null | grep -oP 'src \K\S+' | head -1)
    fi

    # Method 3: Use ifconfig (macOS/Linux)
    if [ -z "$ip" ] && command -v ifconfig >/dev/null 2>&1; then
        ip=$(ifconfig 2>/dev/null | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -1 | awk '{print $2}' | sed 's/addr://')
    fi

    # Method 4: Use networksetup (macOS)
    if [ -z "$ip" ] && command -v networksetup >/dev/null 2>&1; then
        ip=$(networksetup -getinfo Wi-Fi 2>/dev/null | grep -oE 'IP address: [0-9.]+' | cut -d' ' -f3)
        if [ -z "$ip" ]; then
            ip=$(networksetup -getinfo Ethernet 2>/dev/null | grep -oE 'IP address: [0-9.]+' | cut -d' ' -f3)
        fi
    fi

    # Fallback to localhost if no IP found
    if [ -z "$ip" ]; then
        ip="localhost"
    fi

    echo "$ip"
}

# Get local IP for network access
LOCAL_IP=$(get_local_ip)
if [ "$LOCAL_IP" != "localhost" ]; then
    echo -e "${GREEN}📡 Detected local IP: $LOCAL_IP${NC}"
else
    echo -e "${YELLOW}⚠️  Could not detect local IP address, using localhost${NC}"
fi
echo ""

# Load environment from .env.development if it exists
ENV_FILE="$PROJECT_ROOT/.env.development"
if [ -f "$ENV_FILE" ]; then
    echo -e "${GREEN}📝 Loading environment from .env.development${NC}"
    set -a
    source "$ENV_FILE"
    set +a

    # Verify Sentry DSNs are loaded
    if [ -n "$SENTRY_SERVER_DSN" ]; then
        echo -e "${GREEN}   ✓ Bun Sentry DSN loaded${NC}"
    fi
    if [ -n "$SENTRY_GO_DSN" ]; then
        echo -e "${GREEN}   ✓ Go Sentry DSN loaded${NC}"
    fi
fi

# Function to cleanup background processes on exit
cleanup() {
    echo -e "\n${YELLOW}🛑 Shutting down servers...${NC}"
    if [ -n "$GO_PID" ]; then
        kill $GO_PID 2>/dev/null || true
    fi
    if [ -n "$BUN_PID" ]; then
        kill $BUN_PID 2>/dev/null || true
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     TunnelForge Development Environment       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Check if servers are already running
if lsof -Pi :$GO_SERVER_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${RED}❌ Port $GO_SERVER_PORT is already in use!${NC}"
    echo -e "${YELLOW}   Kill the process with: lsof -ti:$GO_SERVER_PORT | xargs kill${NC}"
    exit 1
fi

if lsof -Pi :$BUN_SERVER_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${RED}❌ Port $BUN_SERVER_PORT is already in use!${NC}"
    echo -e "${YELLOW}   Kill the process with: lsof -ti:$BUN_SERVER_PORT | xargs kill${NC}"
    exit 1
fi

# Start Go server
echo -e "${GREEN}🚀 Starting Go server on port $GO_SERVER_PORT...${NC}"
cd "$SERVER_DIR"
go run cmd/server/main.go &
GO_PID=$!
echo -e "${GREEN}   Go server PID: $GO_PID${NC}"

# Wait for Go server to be ready
echo -e "${YELLOW}⏳ Waiting for Go server to be ready...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:$GO_SERVER_PORT/health >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Go server is ready!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Go server failed to start within 30 seconds${NC}"
        exit 1
    fi
    sleep 1
done

# Start Bun web server
echo -e "${GREEN}🚀 Starting Bun web server on port $BUN_SERVER_PORT...${NC}"
cd "$WEB_DIR"
PORT=$BUN_SERVER_PORT GO_SERVER_URL="http://$LOCAL_IP:$GO_SERVER_PORT" bun run --hot src/bun-server.ts &
BUN_PID=$!
echo -e "${GREEN}   Bun server PID: $BUN_PID${NC}"

# Wait for Bun server to be ready
echo -e "${YELLOW}⏳ Waiting for Bun server to be ready...${NC}"
for i in {1..10}; do
    if curl -s http://localhost:$BUN_SERVER_PORT >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Bun server is ready!${NC}"
        break
    fi
    if [ $i -eq 10 ]; then
        echo -e "${RED}❌ Bun server failed to start within 10 seconds${NC}"
        exit 1
    fi
    sleep 1
done

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           🎉 TunnelForge is running!          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}📡 Go Server (Backend):${NC}"
echo -e "   ${GREEN}Local:${NC}  http://localhost:$GO_SERVER_PORT"
if [ "$LOCAL_IP" != "localhost" ]; then
    echo -e "   ${GREEN}Network:${NC} http://$LOCAL_IP:$GO_SERVER_PORT"
fi
echo -e "${GREEN}🌐 Bun Server (Frontend):${NC}"
echo -e "   ${GREEN}Local:${NC}  http://localhost:$BUN_SERVER_PORT"
if [ "$LOCAL_IP" != "localhost" ]; then
    echo -e "   ${GREEN}Network:${NC} http://$LOCAL_IP:$BUN_SERVER_PORT"
fi
echo ""
echo -e "${GREEN}📊 Sentry Monitoring:${NC}"
echo -e "   ${GREEN}Dashboard:${NC}  https://sentry.fergify.work"
if [ -n "$SENTRY_SERVER_DSN" ]; then
    echo -e "   ${GREEN}Bun Server:${NC} ✅ Enabled (project 11)"
fi
if [ -n "$SENTRY_GO_DSN" ]; then
    echo -e "   ${GREEN}Go Server:${NC}  ✅ Enabled (project 12)"
fi
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"
echo ""

# Wait for both processes
wait $GO_PID $BUN_PID
