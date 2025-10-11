#!/bin/bash
# Fix logging spam in installed VibeTunnel npm package

VIBETUNNEL_FILE="$HOME/.local/share/fnm/node-versions/v24.8.0/installation/lib/node_modules/vibetunnel/dist/server/pty/pty-manager.js"

echo "Fixing logging spam in VibeTunnel npm package..."
echo "File: $VIBETUNNEL_FILE"

# Create backup
cp "$VIBETUNNEL_FILE" "$VIBETUNNEL_FILE.backup.$(date +%Y%m%d_%H%M%S)"

# Comment out line 2063 - the timestamp spam logging
sed -i '2063s|.*logger.debug.*PGID check:.*|            // Removed timestamp spam logging - only logs on PGID change now|' "$VIBETUNNEL_FILE"

# Also change the interval from 500ms to 5000ms (line ~72)
sed -i 's/const PROCESS_POLL_INTERVAL_MS = 500/const PROCESS_POLL_INTERVAL_MS = 5000/' "$VIBETUNNEL_FILE"

echo "✓ Fixed logging spam"
echo "✓ Changed PROCESS_POLL_INTERVAL_MS from 500ms to 5000ms"
echo ""
echo "Now restart the VibeTunnel server for changes to take effect"
echo "Note: Your terminal sessions will be preserved if you restart properly"
