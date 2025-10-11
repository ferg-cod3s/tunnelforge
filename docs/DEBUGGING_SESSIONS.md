# Debugging TunnelForge Session Issues

This guide explains how to debug issues with PTY sessions not showing up in the web client.

## Quick Diagnostic Steps

### 1. Check if the Server is Running

```bash
ps aux | grep -E "(tunnelforge|vibetunnel)" | grep -v grep
```

You should see a process like:
```
f3rg  3460177  0.2  0.7 1840860 252480 ?  Ssl  06:50  2:30 node vibetunnel-cli --port 4020 --no-auth
```

### 2. Check Network Ports

```bash
lsof -i :4020 -i :4021 | head -20
```

This shows which processes are listening on the web (4020) and Go server (4021) ports.

### 3. Check Sessions via API

```bash
# List all sessions
curl -s http://localhost:4020/api/sessions | jq .

# Count sessions by status
curl -s http://localhost:4020/api/sessions | jq '[.[] | .status] | group_by(.) | map({status: .[0], count: length})'
```

Expected output:
```json
[
  { "status": "running", "count": 1 },
  { "status": "exited", "count": 22 }
]
```

### 4. Check Browser Console

Open your browser's developer console (F12) and look for:
- Errors during session fetching
- WebSocket connection errors
- Filter the console by "session" to see session-related logs

### 5. Check Server Logs

```bash
# View recent logs (recommended for debugging)
./scripts/vtlog.sh -n 200

# Search for session-related logs
./scripts/vtlog.sh -n 500 -s "session"

# Show only errors
./scripts/vtlog.sh -e
```

**Important**: Always use `-n` to check a specific number of recent log lines. Do NOT use `-f` (follow mode) as it will block and timeout after 2 minutes.

## Common Issues and Solutions

### Issue 1: Sessions Not Showing in UI

**Symptoms**: API returns sessions but they don't appear in the web UI.

**Debug Steps**:
1. Open browser console and check for JavaScript errors
2. Look for logs like:
   ```
   [App] Sessions updated: 23 total, 1 running, 22 exited
   [SessionList] Rendering: total=23, active=1, idle=0, exited=22, hideExited=true
   ```
3. Check if "Hide exited" toggle is enabled (hides exited sessions)

**Solution**: Toggle "Hide exited" button in the UI to show all sessions.

### Issue 2: WebSocket Connection Failures

**Symptoms**: Session view loads but terminal is blank or shows connection errors.

**Debug Steps**:
1. Check browser console for WebSocket errors:
   ```
   WebSocket connection to 'ws://localhost:4020/ws/sessions/xxx' failed
   ```
2. Check server logs for WebSocket handshake errors:
   ```bash
   ./scripts/vtlog.sh -n 200 | grep -i websocket
   ```

**Solution**:
- Ensure server is running and accessible
- Check firewall settings
- Verify session ID is valid

### Issue 3: Sessions Created but Not Listed

**Symptoms**: `tf` command creates session but it doesn't appear in the list.

**Debug Steps**:
1. Verify session was created:
   ```bash
   curl -s http://localhost:4020/api/sessions | jq '.[] | select(.status == "running")'
   ```
2. Check for auto-refresh:
   - UI should auto-refresh every 3 seconds
   - Check browser console for refresh logs
3. Manually refresh the page

**Solution**: If auto-refresh isn't working, check browser console for errors and ensure the refresh interval is set.

### Issue 4: Activity Status Issues

**Symptoms**: Sessions are marked as idle when they should be active.

**Debug Steps**:
1. Check activity status in API response:
   ```bash
   curl -s http://localhost:4020/api/sessions | jq '.[] | {id, name, status, activityStatus}'
   ```
2. Look for `activityStatus.isActive` field
3. Check if activity detection is working:
   ```bash
   ./scripts/vtlog.sh -n 200 | grep -i activity
   ```

**Solution**: Activity detection is based on terminal output. If a session hasn't produced output recently, it may be marked as idle.

## Debug Logging

We've added comprehensive debug logging to help diagnose issues:

### Client-Side Logging

The following logs are now available in the browser console:

```javascript
// Session loading
[App] Sessions updated: 23 total, 1 running, 22 exited

// Session rendering
[SessionList] Rendering: total=23, active=1, idle=0, exited=22, hideExited=true

// Activity status
Sessions with activity status: [{id: "...", name: "...", activityStatus: {...}}]
```

### Server-Side Logging

Server logs are available via `./scripts/vtlog.sh`. Key log categories:

- **Session creation**: `POST /api/sessions`
- **Session listing**: `GET /api/sessions`
- **WebSocket**: `WebSocket connection established/closed`
- **Activity**: `Activity detected for session`

## Advanced Debugging

### Enable Debug Mode

Set the following environment variable before starting the server:

```bash
export DEBUG=vibetunnel:*
```

This enables verbose debug logging for all VibeTunnel components.

### Inspect Session State

```bash
# Get detailed session info
curl -s http://localhost:4020/api/sessions/<session-id> | jq .

# Check session PTY process
ps aux | grep <pid-from-session>
```

### Network Analysis

Use browser DevTools Network tab to inspect:
- API requests (`/api/sessions`)
- WebSocket connections (`/ws/sessions/:id`)
- Response times and status codes

### Memory and Performance

```bash
# Check memory usage
ps -o pid,vsz,rss,comm | grep -E "(tunnelforge|vibetunnel)"

# Monitor system resources
htop
```

## Debugging Tools

### Browser DevTools

- **Console**: JavaScript errors and debug logs
- **Network**: API requests and WebSocket connections
- **Application**: localStorage, sessionStorage
- **Performance**: Memory leaks, CPU usage

### Command Line Tools

- `curl`: Test API endpoints
- `jq`: Parse JSON responses
- `grep`: Search logs
- `lsof`: Check network connections
- `ps`: Check running processes

### MCP Chrome DevTools (when available)

```bash
# List browser pages
mcp__chrome-devtools__list_pages

# Take snapshot
mcp__chrome-devtools__take_snapshot

# View console messages
mcp__chrome-devtools__list_console_messages
```

## Common Log Patterns

### Normal Operation

```
[App] Sessions updated: 5 total, 2 running, 3 exited
[SessionList] Rendering: total=5, active=2, idle=0, exited=3, hideExited=false
WebSocket connection established for session abc123
```

### Session Creation

```
POST /api/sessions - Creating new session
Session created: abc123
WebSocket connection established for session abc123
```

### Session Termination

```
Session abc123 exited with code 0
WebSocket connection closed for session abc123
```

### Errors to Watch For

```
Failed to fetch /api/sessions: Network error
WebSocket connection failed: Connection refused
Session not found: abc123
```

## Getting Help

If you're still stuck after trying these debugging steps:

1. **Collect Information**:
   - Browser console output
   - Server logs (`./scripts/vtlog.sh -n 500 > logs.txt`)
   - API response (`curl -s http://localhost:4020/api/sessions > sessions.json`)

2. **Create Minimal Reproduction**:
   - What steps reproduce the issue?
   - What did you expect to happen?
   - What actually happened?

3. **Check GitHub Issues**:
   - Search for similar issues
   - Create a new issue with collected information

## Useful Commands Reference

```bash
# Server status
ps aux | grep -E "(tunnelforge|vibetunnel)" | grep -v grep
lsof -i :4020

# API tests
curl http://localhost:4020/api/sessions
curl http://localhost:4020/api/sessions/<id>

# Logs
./scripts/vtlog.sh -n 200
./scripts/vtlog.sh -n 500 -s "error"
./scripts/vtlog.sh -e

# System
netstat -tlnp | grep 4020
ss -tlnp | grep 4020
```

## Summary

The most common issue is that the "Hide exited" toggle is enabled, hiding exited sessions from the UI. The debugging logs added to the client will help identify this and other rendering issues quickly.

Always check:
1. Server is running (`ps aux | grep tunnelforge`)
2. API returns sessions (`curl http://localhost:4020/api/sessions`)
3. Browser console for errors (F12)
4. "Hide exited" toggle state

These four checks resolve 90% of session visibility issues.
