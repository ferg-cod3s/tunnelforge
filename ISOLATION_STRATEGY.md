# TunnelForge and VibeTunnel Isolation Strategy

## Problem Identified

Both applications were running simultaneously:
- **TunnelForge** (port 4021) - New Tauri desktop app
- **VibeTunnel** (port 4020) - Legacy Node.js app from global npm

This caused potential resource conflicts and process interference.

## Isolation Requirements

### 1. **Port Separation**
- **TunnelForge**: 4021 (current - correct)
- **VibeTunnel**: 4020 (current - correct)
- **No overlap**: Ports are properly separated

### 2. **Process Isolation**
- Each app should run in independent process trees
- No shared PID files or lock files
- Separate temporary directories
- Independent configuration storage

### 3. **Configuration Separation**
- **TunnelForge**: `~/.local/share/TunnelForge/`
- **VibeTunnel**: `~/.local/share/VibeTunnel/`
- No shared configuration files

### 4. **Runtime Separation**
- Different working directories
- Separate log files
- Independent system tray registrations
- Separate auto-start configurations

## Safe Operation Procedures

### Starting TunnelForge (Recommended)
```bash
# Stop any VibeTunnel processes first
pkill -f vibetunnel-cli

# Navigate to TunnelForge directory
cd /home/f3rg/src/github/tunnelforge

# Start TunnelForge
cd desktop && bun run tauri dev
```

### Starting VibeTunnel (Legacy)
```bash
# Stop any TunnelForge processes first
pkill -f tunnelforge

# Navigate to VibeTunnel directory (if exists)
cd /path/to/vibetunnel

# Start VibeTunnel
npm run dev
```

### Checking Running Status
```bash
# Check TunnelForge processes
ps aux | grep -i tunnelforge | grep -v grep

# Check VibeTunnel processes  
ps aux | grep -i vibetunnel | grep -v grep

# Check port usage
ss -tlnp | grep -E "(4020|4021)"
```

## Conflict Prevention

### 1. **Process Management**
- Use `pkill -f` with specific patterns
- Check for existing processes before starting
- Use different process names where possible

### 2. **Port Management**
- Always check port availability before starting
- Use different port ranges if needed
- Implement port conflict detection

### 3. **File System Separation**
- Separate application data directories
- Different temporary file locations
- Independent log file locations

### 4. **System Integration**
- Separate system tray registrations
- Different auto-start service names
- Independent desktop entries

## Emergency Procedures

### If Both Apps Crash
```bash
# Kill all tunnel-related processes
pkill -f "tunnel"
pkill -f "vibetunnel"

# Clear any stuck processes
sudo fuser -k 4020/tcp 2>/dev/null
sudo fuser -k 4021/tcp 2>/dev/null

# Restart desired application only
```

### If Port Conflicts Occur
```bash
# Find process using port
sudo lsof -i :4020
sudo lsof -i :4021

# Kill conflicting process
sudo kill -9 <PID>
```

## Development Best Practices

### 1. **Single App Development**
- Work on one application at a time
- Stop other app before starting development
- Use separate terminal sessions

### 2. **Clear Environment**
- Check for running processes before starting
- Use different terminal windows for each app
- Clear temporary files regularly

### 3. **Configuration Management**
- Keep configs in separate directories
- Use different environment variable prefixes
- Document any shared resources

## Monitoring

### Health Check Script
```bash
#!/bin/bash
echo "=== TunnelForge Status ==="
if pgrep -f "tunnelforge" > /dev/null; then
    echo "✅ TunnelForge: RUNNING"
else
    echo "❌ TunnelForge: STOPPED"
fi

echo "=== VibeTunnel Status ==="
if pgrep -f "vibetunnel" > /dev/null; then
    echo "✅ VibeTunnel: RUNNING"
else
    echo "❌ VibeTunnel: STOPPED"
fi

echo "=== Port Usage ==="
ss -tlnp | grep -E "(4020|4021)" || echo "No ports in use"
```

## Conclusion

TunnelForge and VibeTunnel are completely separate applications that should never run simultaneously. The port conflict was resolved by killing both processes, and future conflicts can be prevented by following the isolation procedures outlined above.

**Recommendation**: Focus on TunnelForge development and keep VibeTunnel stopped unless specifically needed for legacy testing.