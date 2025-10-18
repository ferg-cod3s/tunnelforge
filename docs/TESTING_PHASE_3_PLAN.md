# Phase 3 Testing Plan - Network Binding Validation

**Objective**: Verify the server actually binds to the correct network interfaces based on access mode settings.

**Duration**: 1-2 hours  
**Platform**: Linux (x86_64 Ubuntu 24.04.1)  
**Prerequisites**: Phase 2 tests passed ✅

---

## Phase 3.1: LocalhostOnly Mode Binding Test

**Objective**: Verify server binds to 127.0.0.1:4021 only when in LocalhostOnly mode

### Test Procedure

1. **Ensure LocalhostOnly mode is active**
   - Config default: LocalhostOnly ✅
   - Verify: `~/.config/tunnelforge/config.json` contains `"access_mode": "LocalhostOnly"`

2. **Start the server**
   - Launch TunnelForge desktop app
   - Verify server starts with LocalhostOnly binding

3. **Check socket binding with netstat**
   ```bash
   netstat -tlnp | grep 4021
   # Expected output:
   # tcp    0    0 127.0.0.1:4021    0.0.0.0:*    LISTEN    <pid>/tunnelforge
   ```

4. **Verify with ss command**
   ```bash
   ss -tlnp | grep 4021
   # Expected: Shows 127.0.0.1:4021 only
   ```

5. **Test localhost connectivity**
   ```bash
   curl -v http://127.0.0.1:4021/health
   # Expected: Connection successful, returns 200 OK
   ```

6. **Verify external connectivity fails**
   ```bash
   curl -v http://0.0.0.0:4021/health
   # Expected: Connection refused or timeout
   ```

**Success Criteria**:
- ✅ netstat shows 127.0.0.1:4021 only (no 0.0.0.0)
- ✅ curl to localhost succeeds
- ✅ curl to 0.0.0.0 fails

---

## Phase 3.2: NetworkAccess Mode Binding Test

**Objective**: Verify server binds to 0.0.0.0:4021 (all interfaces) when in NetworkAccess mode

### Test Procedure

1. **Switch to NetworkAccess mode**
   - Via Settings UI: toggle "Allow Network Access"
   - Or via config: set `"access_mode": "NetworkAccess"` in config file

2. **Verify mode change took effect**
   - Check log output: "Received access-mode-changed event, restarting server"
   - Verify config file: `"access_mode": "NetworkAccess"`

3. **Check socket binding with netstat**
   ```bash
   netstat -tlnp | grep 4021
   # Expected output:
   # tcp    0    0 0.0.0.0:4021    0.0.0.0:*    LISTEN    <pid>/tunnelforge
   ```

4. **Verify with ss command**
   ```bash
   ss -tlnp | grep 4021
   # Expected: Shows 0.0.0.0:4021 (all interfaces)
   ```

5. **Test connectivity from localhost**
   ```bash
   curl -v http://127.0.0.1:4021/health
   # Expected: Connection successful
   ```

6. **Test connectivity from external IP**
   ```bash
   # Get machine IP address
   hostname -I
   # Use that IP to test
   curl -v http://<machine-ip>:4021/health
   # Expected: Connection successful
   ```

**Success Criteria**:
- ✅ netstat shows 0.0.0.0:4021 (all interfaces)
- ✅ curl to localhost succeeds
- ✅ curl to machine IP succeeds

---

## Phase 3.3: Mode Toggle Stability Test

**Objective**: Verify rapid mode switching doesn't cause crashes or resource leaks

### Test Procedure

1. **Prepare toggle script**
   ```bash
   # Create test script to toggle 10 times
   for i in {1..10}; do
     # Toggle via API/command
     # Wait for server to restart
     sleep 2
     # Verify binding
   done
   ```

2. **Execute rapid toggles**
   - Start in LocalhostOnly mode
   - Toggle to NetworkAccess
   - Toggle back to LocalhostOnly
   - Repeat 5 times total
   - Monitor for errors or crashes

3. **Monitor system resources**
   ```bash
   watch -n 1 'ps aux | grep tunnelforge'
   # Monitor PID, memory usage, CPU
   ```

4. **Check logs for errors**
   ```bash
   tail -f ~/.local/share/tunnelforge/logs/*.log
   # Watch for panic, error, or resource exhaustion messages
   ```

5. **Verify server remains responsive**
   - After final toggle, verify server still responds to requests
   - Check binding is correct for final mode

**Success Criteria**:
- ✅ No crashes or panics during toggles
- ✅ Memory usage stable (no leaks)
- ✅ CPU usage returns to baseline after each restart
- ✅ Server responsive after all toggles
- ✅ Final binding correct for final mode

---

## Phase 3.4: Port Conflict Detection Test

**Objective**: Verify behavior when port 4021 is already in use

### Test Procedure

1. **Start a service on port 4021**
   ```bash
   # Use netcat to occupy the port
   nc -l 0.0.0.0 4021 &
   NC_PID=$!
   ```

2. **Attempt to start TunnelForge**
   - App should fail to start server
   - Error message should indicate port unavailable

3. **Check error handling**
   - Verify app doesn't crash
   - Verify error is logged
   - Verify user is notified (notification or UI warning)

4. **Kill the conflicting service**
   ```bash
   kill $NC_PID
   ```

5. **Restart TunnelForge**
   - Server should start successfully
   - Binding should be correct

**Success Criteria**:
- ✅ App handles port conflict gracefully
- ✅ Error message displayed to user
- ✅ App doesn't crash
- ✅ App recovers when port becomes available

---

## Phase 3.5: Network Interface Enumeration Test

**Objective**: Verify app correctly identifies available network interfaces

### Test Procedure

1. **Get system network interfaces**
   ```bash
   ip addr show
   # Note all active interfaces and their IP addresses
   ```

2. **Check app's interface enumeration**
   - Via API: `invoke('check_network_access')`
   - Expected: List of all non-loopback interfaces
   - Expected: IP addresses and netmask information

3. **Verify interface status**
   ```bash
   ip link show
   # Check for UP/DOWN status
   ```

4. **Compare with app data**
   - App should match system interface list
   - App should correctly reflect UP/DOWN status
   - App should show correct IP addresses

**Success Criteria**:
- ✅ App enumerates all interfaces
- ✅ IP addresses match system
- ✅ Interface status matches system
- ✅ Loopback interface appropriately flagged

---

## Phase 3.6: Firewall Impact Assessment

**Objective**: Evaluate firewall implications of NetworkAccess mode

### Test Procedure

1. **Check system firewall status**
   ```bash
   sudo ufw status
   # or
   sudo firewall-cmd --list-all
   ```

2. **With LocalhostOnly mode**
   - Firewall rules shouldn't matter (local only)
   - Verify external attempt fails regardless of firewall

3. **With NetworkAccess mode**
   - If firewall blocks port 4021: verify connection fails
   - If firewall allows port 4021: verify connection succeeds
   - Test from same network (if available)

4. **Document firewall recommendations**
   - Recommended ufw rule for NetworkAccess
   - Warning about security implications
   - Best practices for firewall configuration

**Success Criteria**:
- ✅ Behavior consistent with firewall settings
- ✅ Clear logging of firewall-related issues
- ✅ Documentation updated with recommendations

---

## Phase 3.7: IPv4 vs IPv6 Verification

**Objective**: Verify correct behavior on systems with IPv6

### Test Procedure

1. **Check IPv6 availability**
   ```bash
   ip addr show | grep inet6
   # or
   hostname -I
   ```

2. **For LocalhostOnly mode**
   - Server should bind to 127.0.0.1 (IPv4)
   - Verify IPv6 loopback [::1] is not used
   ```bash
   netstat -tlnp | grep -E '4021|127.0.0.1|::1'
   ```

3. **For NetworkAccess mode**
   - Server should bind to 0.0.0.0 (all IPv4 interfaces)
   - Verify IPv6 binding (if needed)
   ```bash
   netstat -tlnp | grep 4021
   # Check for both IPv4 and IPv6 entries
   ```

4. **Test IPv6 connectivity** (if available)
   ```bash
   curl -v http://[::1]:4021/health    # IPv6 loopback in LocalhostOnly
   curl -v http://[ipv6-addr]:4021/health  # IPv6 external in NetworkAccess
   ```

**Success Criteria**:
- ✅ Correct IPv4 binding verified
- ✅ IPv6 behavior documented
- ✅ Both protocols work correctly (if available)

---

## Test Execution Checklist

- [ ] Phase 3.1: LocalhostOnly binding verified
- [ ] Phase 3.2: NetworkAccess binding verified
- [ ] Phase 3.3: Rapid toggle stability confirmed
- [ ] Phase 3.4: Port conflict handling tested
- [ ] Phase 3.5: Network interface enumeration verified
- [ ] Phase 3.6: Firewall implications documented
- [ ] Phase 3.7: IPv4/IPv6 behavior verified

---

## Tools Required

- `netstat` or `ss` - Check network bindings
- `curl` - Test HTTP connectivity
- `ip` command - Check network interfaces
- `ps` - Monitor processes
- `watch` - Monitor changes in real-time
- Log viewer - Check app logs

---

## Expected Outcomes

### Success Path
- All network bindings correct for respective modes
- No crashes during mode switching
- Firewall implications clear
- Platform-ready for Phase 4 (Cross-platform validation)

### Failure Path
- Document specific binding issues
- Update server implementation if needed
- Retest after fixes
- Document platform-specific quirks

---

## Next Phase (Phase 4)

After Phase 3 completes successfully:
- Cross-platform validation (Windows, macOS)
- Performance benchmarking
- Security audit
- Production deployment readiness

