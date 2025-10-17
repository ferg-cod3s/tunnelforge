# Network Access Feature - Testing Plan

**Status**: ✅ Implementation Complete - Ready for Testing  
**Last Updated**: 2025-10-17  
**Build Status**: SUCCESS (26M binary built without errors)

## Overview

The Network Access Feature implementation enables TunnelForge to dynamically switch between:
- **LocalhostOnly** (Default): Server binds to `127.0.0.1` - only accessible from local machine
- **NetworkAccess**: Server binds to `0.0.0.0` - accessible from other machines on the network

## Implementation Summary

### Components Implemented

#### 1. Access Mode Service (`access_mode_service.rs`)
- Emits "access-mode-changed" event when mode is updated
- Persists mode to config for app restart recovery
- Provides API for UI to query and change mode

#### 2. Event Listener (`main.rs`)
- Listens for "access-mode-changed" events
- Triggers server restart in background thread
- 1-second grace period for clean shutdown
- Automatic restart with new binding

#### 3. Dynamic Binding (`server/mod.rs`)
- `get_server_host()` function reads AccessMode from config
- Sets HOST environment variable based on mode
- Updates logging to show actual binding address

### Files Modified
- `desktop/src-tauri/src/access_mode_service.rs` (+11 lines)
- `desktop/src-tauri/src/main.rs` (+40 lines)
- `desktop/src-tauri/src/server/mod.rs` (+55 lines)

### Build Verification
✅ Clean build without errors  
✅ 26M binary created successfully  
✅ Type mismatch fixed (Ok → Some pattern matching)

## Testing Strategy

### Test Environment Setup

Before running tests:
1. Ensure `tunnelforge-server` binary is available in the desktop directory
2. Have network connectivity for testing
3. Run tests with different network configurations (if possible)
4. Monitor logs at: `~/Library/Logs/tunnelforge/` (macOS) or platform-specific location

### Test Cases

#### Test 1: LocalhostOnly Mode (Default)
**Objective**: Verify server only accessible locally in default mode

**Steps**:
1. Launch TunnelForge desktop app
2. Navigate to Settings → Access Mode
3. Verify "Localhost Only" is selected (default)
4. Check logs: should show "binding to 127.0.0.1"

**Verification**:
- ✓ Local machine can access: `curl http://127.0.0.1:4021/health`
- ✓ Same network cannot access: From another machine: `curl http://<local-ip>:4021/health` → Connection refused
- ✓ Logs show: "AccessMode set to LocalhostOnly - binding to 127.0.0.1"

**Expected Result**: PASS - External connections blocked, local access works

---

#### Test 2: Switch to Network Access Mode
**Objective**: Verify dynamic binding change and automatic server restart

**Steps**:
1. From Settings → Access Mode
2. Click "Enable Network Access"
3. Monitor logs during transition
4. Wait for "Server restarted successfully with new access mode" message

**Verification**:
- ✓ Server stops gracefully
- ✓ 1-second wait observed in logs
- ✓ Server restarts with new binding
- ✓ Logs show: "binding to 0.0.0.0"
- ✓ No errors in restart process

**Expected Result**: PASS - Clean restart, no connection errors

---

#### Test 3: Network Access Enabled
**Objective**: Verify server accessible from other machines

**Steps**:
1. Ensure Network Access mode is enabled
2. From another machine on same network, try to connect
3. Access server from remote machine: `curl http://<tunnelforge-machine-ip>:4021/health`

**Verification**:
- ✓ Remote machine can access: `curl http://<local-ip>:4021/health` → 200 OK
- ✓ Terminal sessions work over network
- ✓ Logs show connections from remote IPs
- ✓ No security warnings or blocked connections

**Expected Result**: PASS - External connections work correctly

---

#### Test 4: Mode Toggle Persistence
**Objective**: Verify mode is remembered after app restart

**Steps**:
1. Enable Network Access mode
2. Verify binding shows 0.0.0.0
3. Exit TunnelForge completely
4. Relaunch TunnelForge
5. Check logs for current mode

**Verification**:
- ✓ Mode is remembered after app restart
- ✓ Server binds to correct address on startup
- ✓ No "switching" behavior (should remain as set)

**Expected Result**: PASS - Persistence works correctly

---

#### Test 5: Rapid Mode Toggles
**Objective**: Test robustness of restart mechanism under rapid changes

**Steps**:
1. Toggle between modes rapidly 3-5 times
2. Monitor logs for any errors
3. Verify final mode is correct

**Verification**:
- ✓ All restarts complete without errors
- ✓ No crashed processes or zombie processes
- ✓ Server responsive after final toggle
- ✓ Logs show clean restart sequence

**Expected Result**: PASS - Robust restart handling

---

#### Test 6: Server Health After Mode Switch
**Objective**: Verify server functionality is intact after mode change

**Steps**:
1. Start in LocalhostOnly mode
2. Create a terminal session
3. Switch to Network Access mode
4. Verify session still works

**Verification**:
- ✓ Existing session continues to function
- ✓ New sessions can be created
- ✓ Terminal input/output works correctly
- ✓ No memory leaks or resource issues

**Expected Result**: PASS - Full functionality preserved

---

#### Test 7: Configuration File Persistence
**Objective**: Verify config file is correctly updated

**Steps**:
1. Change access mode via UI
2. Locate config file (platform-specific)
3. Inspect config file directly
4. Verify correct mode is saved

**Verification**:
- ✓ Config file updated immediately
- ✓ Correct JSON structure
- ✓ Other settings not affected

**Expected Result**: PASS - Config integrity maintained

---

#### Test 8: Network Isolation Verification (Network Access Mode)
**Objective**: Verify network access actually works across different interfaces

**Steps**:
1. Enable Network Access mode
2. Test on different network interfaces (WiFi, Ethernet, VPN if available)
3. Verify access works on all

**Verification**:
- ✓ Server accessible on all network interfaces
- ✓ Consistent behavior across different networks
- ✓ Proper binding to 0.0.0.0 (all interfaces)

**Expected Result**: PASS - Works on all interfaces

---

#### Test 9: Error Handling - Server Failure During Restart
**Objective**: Test graceful handling if server fails to restart

**Steps**:
1. Delete or rename tunnelforge-server binary
2. Switch access mode
3. Check error handling

**Verification**:
- ✓ Error logged appropriately
- ✓ App doesn't crash
- ✓ User gets error notification
- ✓ Restore binary and manually restart works

**Expected Result**: PASS - Graceful error handling

---

#### Test 10: Cross-Platform Behavior
**Objective**: Verify feature works consistently across platforms

**Test on each platform**:

**macOS**:
- ✓ DMG installation works
- ✓ Launch agent respects access mode
- ✓ Mode persisted in UserDefaults-compatible location

**Windows**:
- ✓ Installer works
- ✓ Windows Service respects access mode
- ✓ Config stored in correct registry/file location

**Linux**:
- ✓ AppImage/DEB works
- ✓ Systemd service respects access mode
- ✓ Config in ~/.config/tunnelforge/

**Expected Result**: PASS - Consistent behavior across platforms

## Test Execution Checklist

### Pre-Test
- [ ] Build verified (26M binary)
- [ ] Access mode service implemented
- [ ] Event listener in place
- [ ] Dynamic binding logic working
- [ ] Config persistence ready

### During Tests
- [ ] Monitor logs continuously
- [ ] Check process lifecycle
- [ ] Verify network connectivity
- [ ] Monitor resource usage
- [ ] Document any issues

### Post-Test
- [ ] All tests pass
- [ ] No crashes or hangs
- [ ] Performance acceptable
- [ ] Logs clean and informative
- [ ] Create summary report

## Logging Verification Points

Key log messages to look for:

```
# Mode change initiated
"Received access-mode-changed event, restarting server with new binding..."

# Server stopping
"Failed to stop server during restart" (should NOT appear on success)

# Mode reading
"AccessMode set to LocalhostOnly - binding to 127.0.0.1"
"AccessMode set to NetworkAccess - binding to 0.0.0.0"

# Server starting
"Starting server with PORT=4021 HOST=<address>"
"TunnelForge server started with PID: <pid> (listening on <address>:<port>)"

# Success
"Server restarted successfully with new access mode"
```

## Performance Benchmarks

Expected performance:
- **Mode switch time**: < 2 seconds
- **Restart uptime**: 1-2 seconds (1s grace + startup)
- **Memory overhead**: < 5MB additional
- **CPU spike**: Brief (< 1s) during restart
- **Connection drop**: < 2 seconds

## Known Limitations

None for this implementation. All identified issues have been resolved:
- ✅ Type mismatch fixed (Ok → Some)
- ✅ Event listener properly integrated
- ✅ Dynamic binding implemented
- ✅ Build successful

## Next Steps After Testing

1. **If all tests pass**:
   - Create release notes
   - Update documentation with new feature
   - Prepare for beta/production release

2. **If issues found**:
   - Document issue with reproduction steps
   - Create fix branch if needed
   - Re-test after fixes

3. **Performance optimization** (if needed):
   - Reduce grace period if possible
   - Optimize restart sequence
   - Add caching if beneficial

## Support & Debugging

### Common Issues & Solutions

**Issue**: Server doesn't restart
- Check: Logs for error messages
- Solution: Ensure server binary exists and is executable

**Issue**: Mode doesn't persist
- Check: Config file exists and is writable
- Solution: Verify file permissions in config directory

**Issue**: External connections don't work
- Check: Firewall settings
- Solution: Verify 0.0.0.0 binding in logs

**Issue**: Performance degradation after mode switch
- Check: Multiple server processes running
- Solution: Ensure previous processes properly killed

### Debug Commands

```bash
# Check if server is running
lsof -i :4021

# Monitor server process
ps aux | grep tunnelforge-server

# Check current mode in config
cat ~/.config/tunnelforge/config.json (or platform-specific path)

# View logs
tail -f ~/Library/Logs/tunnelforge/tunnelforge.log (macOS)
tail -f ~/.local/share/TunnelForge/logs/tunnelforge.log (Linux)
```

## Success Criteria

✅ **All 10 test cases pass**  
✅ **No crashes or unexpected behavior**  
✅ **Performance within benchmarks**  
✅ **Cross-platform consistency**  
✅ **Clean logs with no errors**  

---

**Ready to proceed with testing!**

Report any issues with:
- Platform (macOS/Windows/Linux)
- Version (desktop app version)
- Steps to reproduce
- Expected vs actual behavior
- Log excerpts if applicable
