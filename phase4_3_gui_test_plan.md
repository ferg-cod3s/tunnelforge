# Phase 4.3: GUI Testing Plan - Linux Desktop App with Xvfb

**Status**: 📋 PLANNING  
**Date**: 2025-10-17  
**Prerequisites**: Phase 4.2 ✅ COMPLETED  

---

## Overview

Phase 4.3 will test the TunnelForge desktop GUI application using Xvfb (X Virtual Frame Buffer) to provide a virtual display server in the headless environment.

### Strategy

1. **Setup Xvfb**: Start virtual X11 display (`:99`)
2. **Launch Tauri App**: Run desktop app with DISPLAY variable pointing to virtual display
3. **Test Scenarios**:
   - Application startup and window creation
   - Settings UI interaction
   - Access mode switching via UI
   - Configuration persistence
   - System tray integration (simulated)

---

## Environment Setup

### Current Status

```bash
$ which xvfb-run
/usr/bin/xvfb-run

$ which Xvfb
/usr/bin/Xvfb

$ xvfb-run --help
Usage: xvfb-run [OPTION] -- EXECUTABLE [ARGS]
  -a                     --auto-display    Select first available display
  -s ARGS                --server-args     Pass ARGS to Xvfb server
  -p PROTOCOL            --protocol        PROTOCOL for authentication
  -n DISPLAY             --display         DISPLAY number
  -w DELAY               --wait            Delay before starting executable
  -v                     --verbose         Verbose output
  -h                     --help            Display help message

$ Xvfb --help 2>&1 | head -20
X.Org X Server 1.20.14
Release Date: 2022-07-21
...
```

**Status**: ✅ **Ready for GUI testing**

---

## Phase 4.3 Test Plan

### 4.3.1: Basic Window Launch Test

**Objective**: Verify Tauri app can start and create a window in virtual display

**Test Script**:
```bash
#!/bin/bash

# Start Xvfb with virtual display :99
export DISPLAY=:99
Xvfb :99 -screen 0 1024x768x24 > /tmp/xvfb.log 2>&1 &
XVFB_PID=$!
sleep 2

# Run Tauri app
echo "Launching TunnelForge desktop app..."
cd desktop/src-tauri/target/release
./TunnelForge --verbose > /tmp/app.log 2>&1 &
APP_PID=$!
sleep 5

# Verify app started
if ps -p $APP_PID > /dev/null; then
    echo "✅ App started successfully (PID: $APP_PID)"
    tail -50 /tmp/app.log
else
    echo "❌ App failed to start"
    cat /tmp/app.log
fi

# Cleanup
kill $APP_PID 2>/dev/null || true
kill $XVFB_PID 2>/dev/null || true
```

---

### 4.3.2: Configuration UI Test

**Objective**: Verify settings UI can load and display current configuration

**Test Scenarios**:
1. Open Settings from main window
2. Verify "Access Mode" dropdown shows options
3. Verify current selection matches config file
4. Test changing selection (LocalhostOnly ↔ NetworkAccess)

---

### 4.3.3: Access Mode Switching Test

**Objective**: Verify UI-triggered mode switch properly restarts server

**Test Procedure**:
1. App starts with LocalhostOnly mode (config default)
2. Verify server running on 127.0.0.1:4021
3. Switch to NetworkAccess via UI
4. Verify server restarted on 0.0.0.0:4021
5. Switch back to LocalhostOnly
6. Verify server restarted on 127.0.0.1:4021

---

### 4.3.4: Configuration Persistence Test

**Objective**: Verify UI changes persist to config file

**Test Procedure**:
1. Record initial config: `LocalhostOnly`
2. Switch to NetworkAccess via UI
3. Verify `~/.config/tunnelforge/config.json` updated
4. Kill and restart app
5. Verify app loads with NetworkAccess mode

---

## Implementation Steps

### Step 1: Create Xvfb Launch Script

```bash
#!/bin/bash

# Create wrapper script for running apps with Xvfb
cat > /usr/local/bin/xvfb-tunnel << 'WRAPPER'
#!/bin/bash
DISPLAY=:99 xvfb-run -s "-screen 0 1024x768x24" "$@"
WRAPPER
chmod +x /usr/local/bin/xvfb-tunnel
```

### Step 2: Create GUI Test Script

```bash
#!/bin/bash
# phase4_3_gui_test.sh

export DISPLAY=:99

echo "Phase 4.3: GUI Testing with Xvfb"
echo "=================================="

# Cleanup any existing Xvfb
pkill -f "Xvfb :99" || true
sleep 1

# Start Xvfb
echo "Starting Xvfb virtual display..."
Xvfb :99 -screen 0 1024x768x24 > /tmp/xvfb.log 2>&1 &
XVFB_PID=$!
sleep 2

# Test 1: Window launch
echo ""
echo "[Test 1] Application Startup"
# ... test code ...

# Cleanup
kill $XVFB_PID 2>/dev/null || true
```

### Step 3: Integrate with Playwright

Since Playwright is already configured, we can use it for browser-based testing:

```bash
# Run Playwright tests pointing to virtual display
DISPLAY=:99 npm run test --workspace=desktop

# Or use headless browser testing
DISPLAY=:99 xvfb-run npx playwright test
```

---

## Tools Available

### Display Server
- ✅ Xvfb (`/usr/bin/Xvfb`)
- ✅ xvfb-run (`/usr/bin/xvfb-run`)

### GUI Interaction Tools
- ✅ Playwright (configured for desktop)
- ⚠️ xdotool (may need install)
- ⚠️ wmctrl (may need install)

### Capture & Analysis
- ⚠️ scrot (screenshot tool)
- ⚠️ xwd (X11 window dump)
- ⚠️ vnc server (optional for remote viewing)

---

## Blocker & Workaround

### Blocker: Tauri App Startup

The Tauri app requires GTK/X11 backend initialization. We need to verify:

1. **Headless vs GUI Tauri Build**
   - Current build targets desktop GUI
   - Need to verify it can run in Xvfb environment

2. **Possible Solutions**:
   - Run Tauri app with explicit GTK setup
   - Use Playwright to interact with embedded web UI
   - Test backend server + web frontend instead of desktop app

---

## Fallback Strategy

If Tauri app cannot run in Xvfb:

### Fallback 4.3a: Test Web Frontend

```bash
# Since Tauri desktop app embeds web frontend,
# test the web UI directly

cd desktop
bun run build:web
bun run preview  # Starts web server

# Use Playwright to test web UI
DISPLAY=:99 npm run test:e2e
```

**Advantages**:
- Tests same UI code as desktop app
- Playwright already configured
- No Tauri desktop binary dependency

### Fallback 4.3b: Manual Testing Instructions

Create comprehensive manual testing guide for:
- Desktop app UI flows
- Configuration changes
- Access mode switching
- System tray integration

---

## Dependencies for Success

| Component | Status | Impact |
|-----------|--------|--------|
| Xvfb | ✅ Available | Required for virtual display |
| GTK libraries | ⚠️ Check needed | Required for app rendering |
| X11 libraries | ✅ Available | Required for X11 support |
| Playwright | ✅ Available | Can supplement testing |
| Desktop build | ✅ Built in Phase 4.1 | Required artifact |

---

## Success Criteria

- ✅ Xvfb display starts without errors
- ✅ Tauri app launches and creates window (or fallback to web UI)
- ✅ Settings UI renders correctly
- ✅ Access mode can be changed via UI
- ✅ Server restarts on mode change
- ✅ Configuration file updated after UI changes
- ✅ App restarts with persisted configuration

---

## Timeline Estimate

- **Setup**: 15-30 minutes (Xvfb configuration)
- **Testing**: 20-30 minutes (test execution)
- **Reporting**: 15-20 minutes (document results)
- **Total**: 50-80 minutes

---

## Next Steps

1. **Verify GTK/X11 Dependencies**
   ```bash
   dpkg -l | grep -E "libgtk|libx11|xorg"
   ```

2. **Test Xvfb Startup**
   ```bash
   xvfb-run -a echo "Display test"
   ```

3. **Attempt Tauri App Launch**
   ```bash
   xvfb-run -a ./desktop/src-tauri/target/release/TunnelForge
   ```

4. **If Tauri Fails, Fall Back to Web UI Testing**
   ```bash
   xvfb-run -a npm run test:e2e
   ```

---

**Status**: 📋 PLANNING - Ready for implementation  
**Prepared by**: Cross-Platform Testing Team  
**Date**: 2025-10-17

