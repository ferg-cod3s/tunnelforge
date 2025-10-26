# Session Persistence in TunnelForge

**Guide**: Understanding how TunnelForge saves and restores terminal sessions across server restarts

## Overview

TunnelForge automatically saves your terminal sessions so they survive server restarts. Sessions are stored as lightweight JSON files with no external database required.

## How It Works

### Automatic Saving

When you create a terminal session, TunnelForge automatically saves:
- Session metadata (ID, title, command, working directory)
- Terminal dimensions (rows, columns)
- Creation and update timestamps
- Active status

**What's NOT saved**:
- Terminal output/scrollback (for performance and privacy)
- Active PTY state (new PTY created on restore)

### Storage Location

Sessions are stored in:
- **Linux**: `/var/lib/tunnelforge/sessions/`
- **macOS**: `~/Library/Application Support/TunnelForge/sessions/`
- **Windows**: `%APPDATA%\TunnelForge\sessions\`

Each session is a separate JSON file:
```
sessions/
├── abc-123-uuid.json
├── def-456-uuid.json
└── ghi-789-uuid.json
```

### File Format

Example `abc-123-uuid.json`:
```json
{
  "id": "abc-123-uuid-here",
  "title": "Development Server",
  "command": ["bash"],
  "cwd": "/home/user/projects/myapp",
  "cols": 120,
  "rows": 30,
  "createdAt": "2025-10-26T12:00:00Z",
  "updatedAt": "2025-10-26T14:30:00Z",
  "active": true
}
```

## Automatic Restoration

### On Server Startup

TunnelForge automatically:
1. Scans the sessions directory
2. Loads all session metadata
3. Restores sessions less than 24 hours old
4. Cleans up sessions older than retention period

### What Gets Restored

✅ **Restored**:
- Session ID and title
- Working directory
- Terminal dimensions
- Original command

❌ **Not Restored**:
- Terminal output (starts fresh)
- Running processes (command re-executed)
- WebSocket connections (clients reconnect)

## Configuration

### Auto-Save Settings

In server configuration:
```go
// Enable auto-save (default: true)
AutoSave: true

// Save interval (default: 30 seconds)
SaveInterval: 30 * time.Second

// Retention period (default: 24 hours)
RetentionPeriod: 24 * time.Hour

// Max sessions (default: 100)
MaxSessions: 100
```

### Via Environment Variables

```bash
# Enable/disable auto-save
TUNNELFORGE_AUTO_SAVE=true

# Save interval in seconds
TUNNELFORGE_SAVE_INTERVAL=30

# Retention in hours
TUNNELFORGE_RETENTION_HOURS=24

# Max sessions
TUNNELFORGE_MAX_SESSIONS=100
```

## Manual Management

### Via API

**List persisted sessions**:
```bash
curl http://localhost:4021/api/sessions
```

**Delete session**:
```bash
curl -X DELETE http://localhost:4021/api/sessions/<SESSION-ID>
```

**Clear all sessions**:
```bash
curl -X POST http://localhost:4021/api/sessions/clear
```

### Via CLI

**View sessions**:
```bash
tf sessions list
```

**Clean old sessions**:
```bash
tf sessions clean --older-than 24h
```

**Clear all**:
```bash
tf sessions clear
```

## Retention Policy

### Automatic Cleanup

Old sessions are automatically cleaned based on:
1. **Age**: Sessions older than retention period
2. **Count**: If exceeding max sessions, oldest deleted first
3. **Inactive**: Inactive sessions cleaned first

### Manual Cleanup

```bash
# Delete sessions older than 7 days
find /var/lib/tunnelforge/sessions/ -name "*.json" -mtime +7 -delete
```

## Backup and Restore

### Backup Sessions

```bash
# Create backup
tar -czf tunnelforge-sessions-backup.tar.gz /var/lib/tunnelforge/sessions/

# Backup with timestamp
tar -czf tunnelforge-sessions-$(date +%Y%m%d).tar.gz /var/lib/tunnelforge/sessions/
```

### Restore from Backup

```bash
# Stop TunnelForge server
sudo systemctl stop tunnelforge

# Restore sessions
tar -xzf tunnelforge-sessions-backup.tar.gz -C /

# Start TunnelForge server
sudo systemctl start tunnelforge
```

### Migrate Between Servers

```bash
# On old server
tar -czf sessions.tar.gz /var/lib/tunnelforge/sessions/
scp sessions.tar.gz new-server:/tmp/

# On new server
tar -xzf /tmp/sessions.tar.gz -C /var/lib/tunnelforge/
chown -R tunnelforge:tunnelforge /var/lib/tunnelforge/sessions/
systemctl restart tunnelforge
```

## Privacy and Security

### Data Stored

**Stored**:
- Session metadata
- Working directory paths
- Commands executed

**NOT Stored**:
- Terminal output/scrollback
- Environment variables
- Passwords or secrets entered

### File Permissions

Automatically set:
```bash
chmod 644 /var/lib/tunnelforge/sessions/*.json
chown tunnelforge:tunnelforge /var/lib/tunnelforge/sessions/*.json
```

### Sensitive Information

If sessions contain sensitive paths:
1. Use `TUNNELFORGE_AUTO_SAVE=false` to disable
2. Manually clean sessions: `tf sessions clear`
3. Encrypt sessions directory

## Troubleshooting

### Sessions Not Saving

**Check permissions**:
```bash
ls -ld /var/lib/tunnelforge/sessions/
# Should be writable by tunnelforge user
```

**Check disk space**:
```bash
df -h /var/lib/tunnelforge/
```

**Check logs**:
```bash
journalctl -u tunnelforge | grep -i persistence
```

### Sessions Not Restoring

**Check retention period**:
```bash
# Sessions older than 24h won't restore by default
find /var/lib/tunnelforge/sessions/ -name "*.json" -mtime +1
```

**Check file format**:
```bash
# Validate JSON
cat /var/lib/tunnelforge/sessions/<SESSION-ID>.json | jq .
```

### Too Many Sessions

**Clean old sessions**:
```bash
tf sessions clean --older-than 7d
```

**Lower max sessions**:
```bash
# In config
TUNNELFORGE_MAX_SESSIONS=50
```

## Performance

### Storage Impact

- **Per session**: ~500 bytes
- **1000 sessions**: ~500 KB
- **Impact**: Negligible for most use cases

### Startup Time

- **100 sessions**: <100ms load time
- **1000 sessions**: <500ms load time
- **10000 sessions**: ~3s load time (consider cleanup)

### Optimization

For large session counts:
1. Reduce retention period
2. Lower max sessions limit
3. Implement session archiving

## Advanced Usage

### Custom Storage Location

```bash
# Set custom directory
TUNNELFORGE_SESSIONS_DIR=/custom/path/sessions
```

### Programmatic Access

```go
import "github.com/ferg-cod3s/tunnelforge/go-server/internal/persistence"

// Create store
store, err := persistence.NewFileStore("/path/to/sessions")

// Save session
err = store.SaveSession(session)

// Load all sessions
sessions, err := store.LoadAllSessions()

// Delete session
err = store.DeleteSession(sessionID)
```

## Best Practices

1. **Regular Backups**: Backup sessions directory weekly
2. **Monitor Size**: Watch disk usage if creating many sessions
3. **Clean Regularly**: Remove old sessions manually if needed
4. **Secure Storage**: Ensure proper file permissions
5. **Test Restore**: Verify backup/restore process works

## Future Enhancements

Coming soon:
- Session export/import UI
- Compression for large session counts
- Session tags and categorization
- Cloud backup integration

## Support

- [TunnelForge Documentation](https://docs.tunnelforge.sh)
- [GitHub Issues](https://github.com/ferg-cod3s/tunnelforge/issues)
- [Discord Community](https://discord.gg/tunnelforge)

---

**Next**: [Cloudflare Custom Domains](./cloudflare-custom-domains.md) | [User Guide](./USER_GUIDE.md)
