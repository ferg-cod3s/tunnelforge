#!/bin/bash

# Configuration
CHECK_INTERVAL=30  # Seconds between checks
MAX_RETRIES=3      # Number of retries before restarting
PING_HOST="8.8.8.8" # Host to ping (Google DNS)

check_network() {
    for ((i=1; i<=MAX_RETRIES; i++)); do
        if ping -c 1 -W 5 "$PING_HOST" &>/dev/null; then
            return 0
        fi
        sleep 2
    done
    return 1
}

restart_tunnelforge() {
    echo "Network disconnection detected. Restarting TunnelForge..."
    systemctl --user restart tunnelforge.service
}

while true; do
    if ! check_network; then
        restart_tunnelforge
    fi
    sleep "$CHECK_INTERVAL"
done