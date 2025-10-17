# Phase 2 Testing - Detailed Analysis & Testing Plan

**Date**: 2025-01-27 (resumed)  
**Platform**: Linux (x86_64 Ubuntu 24.04.1)  
**Test Duration**: Estimated 2-3 hours  
**Status**: ⏳ IN PROGRESS

---

## Objective

Validate the network access toggle feature is fully functional on Linux platform through:
1. UI component visibility and rendering
2. Toggle functionality (Settings UI and tray menu)
3. Config file persistence
4. Event flow verification
5. Cross-session state persistence

---

## Implementation Review

### Backend Components

**AccessModeService** (`desktop/src-tauri/src/access_mode_service.rs`):
- ✅ Handles mode switching between `LocalhostOnly` and `NetworkAccess`
- ✅ Loads current mode from config on startup
- ✅ Provides `get_access_mode_status()` command
- ✅ Implements `check_network_access()` for diagnostics

**ConfigManager** (`desktop/src-tauri/src/config_manager.rs`):
- ✅ Persists access mode to disk (`~/.config/tunnelforge/config.json`)
- ✅ Implements `toggle_access_mode()` command
- ✅ Defaults to `LocalhostOnly` on first run
- ✅ Preserves config across sessions

**Tauri Commands** (`desktop/src-tauri/src/main.rs`):
- ✅ `toggle_access_mode` - Switch between modes
- ✅ `get_access_mode_status` - Get current status
- ✅ `check_network_access` - Check network capabilities

### Frontend Components

**NetworkAccessSettings.svelte**:
- ✅ Toggle UI component with visual indicator (🔒 / 🌐)
- ✅ Invokes `toggle_access_mode` command on click
- ✅ Loads status with `get_access_mode_status`
- ✅ Error handling with user feedback
- ✅ Loading states during async operations

**Settings.svelte**:
- ✅ Integrates `NetworkAccessSettings` component
- ✅ Part of Settings tab/panel
- ✅ Event listener for tray menu updates

**Tray Menu** (`desktop/src-tauri/src/ui/tray.rs`):
- ✅ Displays current access mode with icon (🔒 or 🌐)
- ✅ "Toggle Network Access" menu item
- ✅ Emits event to frontend on toggle

---

## Testing Phases Breakdown

### Phase 2.1: Startup & Initialization (10 minutes)

**What We're Testing**:
- App launches without crashes
- Initial config is created with default mode
- Settings UI component loads
- Tray menu appears

**Steps**:
1. Launch app: `cd /home/f3rg/src/github/tunnelforge/linux && cargo tauri dev`
2. Wait for app window to appear
3. Check browser console (F12) for errors
4. Navigate to Settings
5. Verify NetworkAccessSettings component is visible

**Expected Results**:
- ✅ App window appears with no crashes
- ✅ Settings tab is accessible
- ✅ Toggle is visible with 🔒 icon (default LocalhostOnly)
- ✅ Tray menu icon appears (top-right)
- ✅ Browser console shows no critical errors

**Success Criteria**:
- [ ] App window fully rendered
- [ ] Settings accessible
- [ ] Toggle visible and enabled
- [ ] Tray icon visible
- [ ] Config file created: `~/.config/tunnelforge/config.json`

---

### Phase 2.2: Settings UI Toggle Test (10 minutes)

**What We're Testing**:
- Toggle click is responsive
- Backend receives toggle command
- No UI errors occur
- Config updates immediately

**Steps**:
1. Open browser DevTools (F12)
2. Go to Settings → Network Access section
3. Click toggle to switch from 🔒 to 🌐
4. Monitor console for:
   - `invoke('toggle_access_mode')` call
   - Success message
   - Any errors
5. Check config file for updated value

**Expected Results**:
```
Console Output:
  - "Toggling network access..." (if implemented)
  - Toggle state changes visually
  - No errors in console

Config File (~/.config/tunnelforge/config.json):
  - access_mode: "NetworkAccess" (changed from "LocalhostOnly")
```

**Success Criteria**:
- [ ] Toggle click registered in console
- [ ] No errors thrown
- [ ] Config file updated
- [ ] Toggle UI reflects new state
- [ ] Command completes successfully

---

### Phase 2.3: Tray Menu Toggle Test (10 minutes)

**What We're Testing**:
- Tray menu is clickable
- "Toggle Network Access" menu item works
- Backend command is invoked
- Config updates from tray action

**Steps**:
1. Locate tray icon (top-right corner)
2. Right-click or click tray icon
3. Select "Toggle Network Access"
4. Observe state change
5. Check config file reflects change
6. Click toggle again in tray menu

**Expected Results**:
```
First Click: 🌐 → 🔒 (NetworkAccess → LocalhostOnly)
Config: access_mode switches back to "LocalhostOnly"

Tray Menu Item:
- Disappears or updates after click
- New mode icon appears in menu
```

**Success Criteria**:
- [ ] Tray menu opens
- [ ] Toggle menu item visible
- [ ] Toggle menu item clickable
- [ ] Mode switches back
- [ ] Config reflects change immediately
- [ ] No errors or hangs

---

### Phase 2.4: Config Persistence Test (15 minutes)

**What We're Testing**:
- Settings persist across app restart
- Config file is properly formatted JSON
- Mode is loaded from disk on startup
- No data corruption

**Steps**:
1. Toggle to NetworkAccess (if not already)
2. Verify config shows `access_mode: "NetworkAccess"`
3. Close app completely
4. Wait 2 seconds
5. Reopen app: `cargo tauri dev` (in new terminal)
6. Navigate to Settings
7. Verify toggle shows 🌐 (NetworkAccess)
8. Check config file still shows NetworkAccess

**Expected Results**:
```
Before Restart:
  - Config: access_mode = "NetworkAccess"
  - Toggle: Shows 🌐
  
After Restart:
  - Config: still access_mode = "NetworkAccess"
  - Toggle: Shows 🌐 (not reset to default)
  - App loads mode from disk
```

**Success Criteria**:
- [ ] Config file properly formatted JSON
- [ ] Mode persists across restart
- [ ] No config corruption
- [ ] App loads from disk on startup
- [ ] Toggle reflects persisted state

---

### Phase 2.5: Event Flow Verification (10 minutes)

**What We're Testing**:
- Event data flows from tray to frontend
- Frontend receives mode updates
- UI reflects backend state changes

**Steps**:
1. Open DevTools → Console tab
2. Add console logs to verify event flow:
   ```javascript
   // In browser console
   window.addEventListener('toggle-network-access', (e) => {
     console.log('Event received:', e.detail);
   });
   ```
3. Toggle from tray menu
4. Watch for event log in console
5. Verify event contains correct mode info

**Expected Results**:
```
Console Log:
  Event received: {mode: "NetworkAccess", ...}

Or (if different event format):
  Event received: {currentMode: "LocalhostOnly", ...}
```

**Success Criteria**:
- [ ] Event fires when tray toggled
- [ ] Event contains mode information
- [ ] Frontend receives event successfully
- [ ] Event data is correct

---

### Phase 2.6: Validation & Error Handling (10 minutes)

**What We're Testing**:
- App handles rapid clicks gracefully
- Error messages are clear
- No data corruption on failed operations

**Steps**:
1. Click toggle rapidly 5-10 times
2. Watch for any errors or hangs
3. Check config file for corruption
4. Try toggling while browser DevTools closed
5. Verify app continues functioning

**Expected Results**:
- ✅ No crashes or hangs
- ✅ Config remains valid JSON
- ✅ Last click wins (no race conditions)
- ✅ App recovers cleanly

**Success Criteria**:
- [ ] No errors on rapid clicks
- [ ] Config file remains valid
- [ ] No UI hangs or freezes
- [ ] App stable after repeated toggles

---

## Testing Checklist

### Pre-Test Setup
- [ ] Binary exists and is executable: `ls -l linux/src-tauri/target/debug/tunnelforge`
- [ ] Terminal 1 ready for app launch
- [ ] Terminal 2 ready for file monitoring
- [ ] Browser ready with DevTools
- [ ] Config directory cleaned (fresh start): `rm -rf ~/.config/tunnelforge`

### Phase 2.1: Startup
- [ ] App launches with `cargo tauri dev`
- [ ] Window appears within 5 seconds
- [ ] Settings tab is clickable
- [ ] Toggle component is visible
- [ ] Tray icon appears
- [ ] Config file created

### Phase 2.2: Settings Toggle
- [ ] Toggle is clickable
- [ ] Toggle visual feedback works
- [ ] Config file updates
- [ ] No console errors
- [ ] Toggle switches state

### Phase 2.3: Tray Menu
- [ ] Tray menu opens
- [ ] Toggle menu item exists
- [ ] Toggle menu item is clickable
- [ ] Config updates after tray toggle
- [ ] Tray icon reflects new mode

### Phase 2.4: Persistence
- [ ] Config is valid JSON format
- [ ] Mode persists after restart
- [ ] App loads from config on startup
- [ ] No data loss

### Phase 2.5: Event Flow
- [ ] Events fire correctly
- [ ] Events have correct data
- [ ] Frontend receives events
- [ ] UI updates from events

### Phase 2.6: Error Handling
- [ ] Rapid clicks handled gracefully
- [ ] Config valid after operations
- [ ] No hangs or freezes
- [ ] App remains stable

---

## File Monitoring Commands

**Terminal 2 - Monitor config file in real-time**:
```bash
# Watch for changes
watch -n 1 'cat ~/.config/tunnelforge/config.json | jq . 2>/dev/null || echo "File not found"'

# Or use tail
tail -f ~/.config/tunnelforge/config.json
```

---

## Sample Config Files

### Initial State (LocalhostOnly - Default)
```json
{
  "access_mode": "LocalhostOnly",
  "server_port": 4021,
  "last_updated": "2025-01-27T..."
}
```

### After Toggle (NetworkAccess)
```json
{
  "access_mode": "NetworkAccess",
  "server_port": 4021,
  "last_updated": "2025-01-27T..."
}
```

---

## Success Metrics

**Phase 2 is successful if**:
- ✅ All 6 sub-phases pass
- ✅ Toggle works from Settings UI
- ✅ Toggle works from tray menu
- ✅ Config persists across restarts
- ✅ No crashes or critical errors
- ✅ No data corruption
- ✅ Event flow is verified

---

## Known Issues to Watch For

1. **Config not persisting**: Check write permissions on `~/.config/tunnelforge/`
2. **Tray not appearing**: May be platform-specific, document behavior
3. **UI not updating**: Check if frontend event listener is connected
4. **Rapid toggle issues**: Look for race conditions in backend
5. **Permission errors**: May need to handle read-only config

---

## Next Steps After Phase 2

1. **If all pass**: Proceed to Phase 3 (Network Binding Validation)
2. **If some fail**: Document failures and investigate in IMPLEMENTATION_VALIDATION.md
3. **If critical issues**: Roll back changes and debug in smaller increments

---

## Notes & Observations

*Space for recording observations during testing*

---

**Estimated Total Time**: 2-3 hours  
**Report Location**: `docs/TESTING_PHASE_2_REPORT.md` (to be created)  
**Current Status**: Ready to begin testing

