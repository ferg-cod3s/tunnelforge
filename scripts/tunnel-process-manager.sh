#!/bin/bash

# TunnelForge and VibeTunnel Process Manager
# Prevents conflicts between the two applications

echo "🔍 TunnelForge/VibeTunnel Process Manager"
echo "======================================"

# Function to check if processes are running
check_processes() {
    echo "📊 Checking running processes..."
    
    local tunnelforge_running=false
    local vibetunnel_running=false
    
    # Check TunnelForge
    if pgrep -f "tunnelforge" > /dev/null 2>&1; then
        tunnelforge_running=true
        echo "✅ TunnelForge: RUNNING"
        pgrep -f "tunnelforge" | while read pid; do
            echo "   PID: $pid"
        done
    else
        echo "❌ TunnelForge: STOPPED"
    fi
    
    # Check VibeTunnel
    if pgrep -f "vibetunnel" > /dev/null 2>&1; then
        vibetunnel_running=true
        echo "✅ VibeTunnel: RUNNING"
        pgrep -f "vibetunnel" | while read pid; do
            echo "   PID: $pid"
        done
    else
        echo "❌ VibeTunnel: STOPPED"
    fi
    
    # Check port usage
    echo ""
    echo "🔌 Port Usage:"
    local port_4020=$(ss -tlnp 2>/dev/null | grep ":4020 ")
    local port_4021=$(ss -tlnp 2>/dev/null | grep ":4021 ")
    
    if [[ -n "$port_4020" ]]; then
        echo "   Port 4020: IN USE (VibeTunnel)"
        echo "$port_4020" | sed 's/^/     /'
    else
        echo "   Port 4020: FREE"
    fi
    
    if [[ -n "$port_4021" ]]; then
        echo "   Port 4021: IN USE (TunnelForge)"
        echo "$port_4021" | sed 's/^/     /'
    else
        echo "   Port 4021: FREE"
    fi
    
    # Return status
    if [[ "$tunnelforge_running" == true && "$vibetunnel_running" == true ]]; then
        echo ""
        echo "⚠️  WARNING: Both apps are running! This may cause conflicts."
        return 2
    elif [[ "$tunnelforge_running" == true || "$vibetunnel_running" == true ]]; then
        echo ""
        echo "✅ One app running (safe)"
        return 0
    else
        echo ""
        echo "💤 No apps running"
        return 1
    fi
}

# Function to stop all tunnel processes
stop_all() {
    echo "🛑 Stopping all tunnel-related processes..."
    
    # Stop TunnelForge
    if pgrep -f "tunnelforge" > /dev/null 2>&1; then
        echo "   Stopping TunnelForge..."
        pkill -f "tunnelforge"
        sleep 2
        # Force kill if still running
        pgrep -f "tunnelforge" > /dev/null 2>&1 && pkill -9 -f "tunnelforge"
    fi
    
    # Stop VibeTunnel
    if pgrep -f "vibetunnel" > /dev/null 2>&1; then
        echo "   Stopping VibeTunnel..."
        pkill -f "vibetunnel"
        sleep 2
        # Force kill if still running
        pgrep -f "vibetunnel" > /dev/null 2>&1 && pkill -9 -f "vibetunnel"
    fi
    
    # Clear any stuck ports
    echo "   Clearing stuck ports..."
    sudo fuser -k 4020/tcp 2>/dev/null || true
    sudo fuser -k 4021/tcp 2>/dev/null || true
    
    echo "✅ All processes stopped"
}

# Function to start TunnelForge safely
start_tunnelforge() {
    echo "🚀 Starting TunnelForge..."
    
    # Stop any VibeTunnel processes first
    if pgrep -f "vibetunnel" > /dev/null 2>&1; then
        echo "   Stopping VibeTunnel to prevent conflicts..."
        pkill -f "vibetunnel"
        sleep 2
    fi
    
    # Check if port 4021 is available
    if ss -tlnp 2>/dev/null | grep -q ":4021 "; then
        echo "❌ Port 4021 is already in use!"
        echo "   Run '$0 status' to see what's using it"
        return 1
    fi
    
    # Navigate to TunnelForge directory
    cd /home/f3rg/src/github/tunnelforge/desktop
    
    echo "   Starting TunnelForge on port 4021..."
    echo "   (Use Ctrl+C to stop)"
    bun run tauri dev
}

# Function to start VibeTunnel safely
start_vibetunnel() {
    echo "🚀 Starting VibeTunnel..."
    
    # Stop any TunnelForge processes first
    if pgrep -f "tunnelforge" > /dev/null 2>&1; then
        echo "   Stopping TunnelForge to prevent conflicts..."
        pkill -f "tunnelforge"
        sleep 2
    fi
    
    # Check if port 4020 is available
    if ss -tlnp 2>/dev/null | grep -q ":4020 "; then
        echo "❌ Port 4020 is already in use!"
        echo "   Run '$0 status' to see what's using it"
        return 1
    fi
    
    # Try to find VibeTunnel directory
    local vibetunnel_dir=""
    if [[ -d "/home/f3rg/src/github/tunnelforge/vibetunnel" ]]; then
        vibetunnel_dir="/home/f3rg/src/github/tunnelforge/vibetunnel"
    elif [[ -d "$HOME/vibetunnel" ]]; then
        vibetunnel_dir="$HOME/vibetunnel"
    else
        echo "❌ VibeTunnel directory not found!"
        echo "   Please specify the path to VibeTunnel"
        return 1
    fi
    
    echo "   Starting VibeTunnel on port 4020..."
    echo "   (Use Ctrl+C to stop)"
    cd "$vibetunnel_dir"
    
    # Try different start methods
    if [[ -f "package.json" ]]; then
        npm run dev 2>/dev/null || npm start
    elif command -v vibetunnel-cli >/dev/null 2>&1; then
        vibetunnel-cli --port 4020 --no-auth
    else
        echo "❌ Could not determine how to start VibeTunnel"
        return 1
    fi
}

# Main command handling
case "${1:-status}" in
    "status")
        check_processes
        ;;
    "stop")
        stop_all
        ;;
    "tunnelforge"|"tf")
        start_tunnelforge
        ;;
    "vibetunnel"|"vt")
        start_vibetunnel
        ;;
    "help"|"-h"|"--help")
        echo "TunnelForge/VibeTunnel Process Manager"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  status      Show running processes and port usage"
        echo "  stop        Stop all tunnel-related processes"
        echo "  tunnelforge Start TunnelForge (stops VibeTunnel first)"
        echo "  vibetunnel  Start VibeTunnel (stops TunnelForge first)"
        echo "  help        Show this help message"
        echo ""
        echo "Examples:"
        echo "  $0                    # Show status"
        echo "  $0 tunnelforge       # Start TunnelForge"
        echo "  $0 vibetunnel        # Start VibeTunnel"
        echo "  $0 stop              # Stop everything"
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo "   Use '$0 help' for usage information"
        exit 1
        ;;
esac