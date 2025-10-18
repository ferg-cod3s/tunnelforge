# Phase 4.3b: E2E Testing Implementation for Tauri Desktop App

**Date**: 2025-10-18  
**Status**: Analysis & Planning  
**Previous Phase**: 4.3a (Timeout Investigation)  
**Duration Target**: 2-3 weeks  

## Executive Summary

After investigating Playwright E2E testing for the TunnelForge Tauri desktop app, we discovered a **fundamental architecture mismatch**: 

- **Problem**: Tauri's development mode uses a native webview and **does NOT expose an HTTP server** on port 1420
- **Current Attempt**: Playwright is configured to connect to `http://localhost:1420`, which doesn't exist
- **Result**: 300-second timeout waiting for a server that will never be ready
- **Impact**: Current E2E test approach cannot work without significant modifications

## Root Cause Analysis

### What We Found
1. ✅ **Tauri compiles successfully** - Desktop binary builds in ~7 seconds
2. ✅ **App starts without errors** - Log shows "UI initialization time: 875ms"
3. ❌ **No HTTP server exposure** - Port 1420 never becomes ready
4. ❌ **Playwright misconfiguration** - Assumes web server exists when it doesn't

### Tauri Architecture
```
Tauri Desktop App (Native Webview)
├── Rust Backend (src-tauri/src/main.rs)
├── WebView (Native to each platform)
│   └── UI served from in-memory bundle (not HTTP)
└── IPC Bridge (Tauri commands, not HTTP endpoints)

Expected by Playwright:
HTTP Server on localhost:1420
└── Serves HTML/JS/CSS
```

**Fundamental Difference**: Tauri apps are NOT web servers. They're native applications with embedded webviews. You can't test them with Playwright's `webServer` configuration.

## Three Viable Solutions

### Solution 1: Use Tauri's WebDriver Protocol ✅ (Recommended)
**Status**: Mature ecosystem, officially supported  
**Approach**: Use Tauri-specific WebDriver to test the actual native app

```typescript
// Instead of Playwright connecting to HTTP server:
// Use WebDriver to control the Tauri webview
const driver = await webdriver.remote({
  capabilities: {
    'tauri:options': {
      binary: './target/debug/tunnelforge'
    }
  }
});

await driver.url('http://wry.localhost/');
const element = await driver.$('text=Settings');
```

**Pros**:
- ✅ Tests the actual native application
- ✅ Official Tauri testing solution
- ✅ Full OS integration (system tray, notifications, etc.)
- ✅ Works on all platforms (Windows, macOS, Linux)

**Cons**:
- ⚠️ Different API than Playwright
- ⚠️ Steeper learning curve
- ⚠️ Fewer examples/tutorials

**Implementation Time**: 1 week

---

### Solution 2: Test the Web Frontend Separately ⚠️ (Quick Fix)
**Status**: Simplest immediate solution  
**Approach**: Start web server separately, test via HTTP

```typescript
// Start Go web server directly (not through Tauri)
const webServer = spawn('go', ['run', './cmd/server/main.go'], {
  cwd: '../server'
});

// Wait for port 4021
await waitForPort(4021);

// Now Playwright can connect
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('http://localhost:4021');
```

**Pros**:
- ✅ Minimal config changes
- ✅ Works with existing Playwright setup
- ✅ Fast to implement

**Cons**:
- ❌ Doesn't test the Tauri desktop app at all
- ❌ Doesn't test system features (tray, notifications, auto-start)
- ❌ Doesn't test desktop-specific functionality
- ❌ Tests Go server, not integration

**Implementation Time**: 2-3 days  
**Testing Coverage**: ~30% (web frontend only)

---

### Solution 3: Hybrid Approach 📋 (Best for Timeline)
**Status**: Pragmatic balance  
**Approach**: 
1. Create Playwright tests for web frontend (fast wins)
2. Create WebDriver tests for Tauri desktop app (proper validation)
3. Separate test suites, documented testing strategy

```
tests/
├── e2e/                          (Current - won't work)
├── e2e-web/                      (NEW - Playwright, Go server)
│   ├── settings.spec.ts
│   ├── dashboard.spec.ts
│   └── terminal.spec.ts
├── e2e-desktop/                  (NEW - WebDriver, Tauri app)
│   ├── app-startup.spec.ts
│   ├── tray-integration.spec.ts
│   └── server-lifecycle.spec.ts
└── README.md (testing strategy)
```

**Pros**:
- ✅ Gets tests working quickly (web)
- ✅ Proper Tauri testing (desktop)
- ✅ Both approaches validated
- ✅ Clear testing strategy

**Cons**:
- ⚠️ Requires learning two test frameworks
- ⚠️ More maintenance overhead
- ⚠️ Longer implementation

**Implementation Time**: 2-3 weeks

---

## Recommended Path Forward: Hybrid Approach

### Phase 4.3b Timeline (2-3 weeks)

#### Week 1: Foundation & Quick Wins
- **Days 1-2**: Set up Playwright for Go web server testing
  - Update `playwright.config.ts` to use Go server instead of Tauri
  - Create working tests for web frontend
  - Generate baseline results (target: 80%+ pass rate)
  
- **Days 3-4**: Implement basic WebDriver setup for Tauri
  - Install `tauri-webdriver` dependencies
  - Create WebDriver configuration
  - Proof-of-concept: Launch app, verify window appears
  
- **Day 5**: Documentation & Review
  - Create testing strategy document
  - Record testing approach decision
  - Update CI/CD configuration

#### Week 2: Full Web Frontend Coverage
- **Days 1-2**: Expand Playwright test coverage
  - Settings and configuration
  - Terminal session management
  - Dashboard and statistics
  
- **Days 3-4**: Stabilize Playwright tests
  - Fix flaky tests
  - Add retry logic for timing-sensitive tests
  - Optimize test execution speed
  
- **Day 5**: Initial Tauri testing
  - Create WebDriver test for app startup
  - Test system tray interaction
  - Document any blockers

#### Week 3: Desktop Integration & Polish
- **Days 1-2**: Expand Tauri WebDriver tests
  - Server lifecycle (start/stop/restart)
  - Settings persistence across restart
  - Auto-start functionality
  
- **Days 3-4**: Cross-platform testing
  - Validate tests run on Windows/macOS/Linux
  - Document platform-specific quirks
  - Set up CI/CD for all platforms
  
- **Day 5**: Report & Sign-off
  - Generate comprehensive testing report
  - Quantify coverage for both approaches
  - Create roadmap for Phase 4.4

### Success Criteria

**Web Frontend Tests** (Playwright):
- ✅ All critical user flows passing
- ✅ >80% test pass rate
- ✅ <5 flaky tests (retry after 1 attempt)
- ✅ Execution time <5 minutes

**Desktop App Tests** (WebDriver):
- ✅ App starts and initializes
- ✅ System tray works
- ✅ Settings persist across restart
- ✅ Server lifecycle management works
- ✅ At least 2-3 comprehensive tests running

**Documentation**:
- ✅ Clear testing strategy
- ✅ Runbook for adding new tests
- ✅ CI/CD configuration updated
- ✅ Known issues documented

## Implementation Details

### Part A: Playwright for Go Web Server

**File**: `desktop/playwright.config.web-server.ts`
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e-web',
  use: {
    baseURL: 'http://localhost:4021', // Go server port
  },
  webServer: {
    command: 'cd ../server && go run ./cmd/server/main.go',
    port: 4021,
    timeout: 30000, // Go server starts faster
    reuseExistingServer: true,
  },
  // ... rest of config
});
```

**Files to Create**:
- `tests/e2e-web/auth.spec.ts` - Login/authentication
- `tests/e2e-web/dashboard.spec.ts` - Main dashboard
- `tests/e2e-web/terminal.spec.ts` - Terminal session
- `tests/e2e-web/settings.spec.ts` - User settings
- `tests/e2e-web/helpers/auth.ts` - Auth helper functions

**Package Updates**:
```json
{
  "scripts": {
    "test:e2e:web": "playwright test --config=playwright.config.web-server.ts",
    "test:e2e:desktop": "playwright test --config=playwright.config.desktop.ts"
  }
}
```

### Part B: WebDriver for Tauri Desktop App

**Installation**:
```bash
cd desktop
bun add -D @tauri-apps/cli @tauri-apps/api webdriverio @wdio/local-runner
```

**File**: `desktop/wdio.conf.ts`
```typescript
export const config: WebdriverIO.Config = {
  runner: 'local',
  port: 4444,
  specs: ['./tests/e2e-desktop/**/*.ts'],
  
  capabilities: [{
    platformName: 'linux', // or 'win32', 'darwin'
    'tauri:options': {
      binary: './src-tauri/target/debug/tunnelforge',
    }
  }],

  framework: 'mocha',
  mochaOpts: {
    timeout: 60000,
  },
};
```

**Files to Create**:
- `tests/e2e-desktop/app-startup.spec.ts` - App initialization
- `tests/e2e-desktop/tray.spec.ts` - System tray interaction
- `tests/e2e-desktop/settings.spec.ts` - Desktop-specific settings
- `tests/e2e-desktop/server-lifecycle.spec.ts` - Server management

### Part C: CI/CD Configuration

**Update** `.github/workflows/e2e-tests.yml`:
```yaml
- name: Run Web Frontend Tests
  run: cd desktop && bun run test:e2e:web

- name: Run Desktop App Tests (Linux)
  if: runner.os == 'Linux'
  run: cd desktop && bun run test:e2e:desktop
```

## Known Challenges & Mitigations

| Challenge | Mitigation | Impact |
|-----------|-----------|--------|
| WebDriver API different from Playwright | Create helper abstraction layer | Low - isolated to test code |
| Tauri startup slower than web server | Use 120s timeout for Tauri, 30s for web | Low - documented in config |
| Platform-specific UI behaviors | Test on all 3 platforms in CI | Medium - requires CI setup |
| System tray interaction varies by OS | Platform-specific test suites | Medium - manageable |
| WebDriver documentation sparse | Reference community examples | Low - active Tauri community |

## Questions for Stakeholder Review

1. **Testing Scope**: Should we prioritize web frontend or desktop integration first?
   - **Recommendation**: Web first (faster wins), desktop second (proper validation)

2. **Platform Coverage**: Should all tests run on Windows/macOS/Linux, or Linux only initially?
   - **Recommendation**: Start with Linux only (no build environment for others yet)

3. **Coverage Target**: What's the acceptable test pass rate to move to Phase 4.4?
   - **Recommendation**: 80% for web tests, 60% for desktop (higher complexity)

4. **Timeline Flexibility**: If WebDriver setup takes longer, acceptable to delay desktop tests?
   - **Recommendation**: Yes - web tests provide sufficient coverage for Phase 4.4

## Files Impacted

| File | Change | Type |
|------|--------|------|
| `desktop/playwright.config.ts` | Update to use Go server, not Tauri | CONFIG |
| `desktop/playwright.config.web-server.ts` | NEW - Playwright web server config | NEW |
| `desktop/wdio.conf.ts` | NEW - WebDriver Tauri config | NEW |
| `desktop/tests/e2e-web/*.spec.ts` | NEW - Web frontend tests | NEW |
| `desktop/tests/e2e-desktop/*.spec.ts` | NEW - Desktop app tests | NEW |
| `desktop/package.json` | Add WebDriver/wdio dependencies | UPDATE |
| `desktop/.github/workflows/*.yml` | Add E2E test jobs | UPDATE |
| `.github/workflows/e2e-tests.yml` | NEW - E2E testing workflow | NEW |
| `TESTING.md` | Update with testing strategy | UPDATE |

## Next Steps

1. **Immediate** (Next commit):
   - Create this analysis document (DONE)
   - Update todo list with Phase 4.3b plan
   - Get stakeholder buy-in on approach

2. **This Week**:
   - Rename `tests/e2e/` to `tests/e2e-old/` (backup)
   - Create `tests/e2e-web/` directory
   - Update `playwright.config.ts` to test Go server
   - Create first 2-3 working web tests
   - Verify >80% tests pass

3. **Next Week**:
   - Expand web test coverage to 8-10 tests
   - Set up WebDriver for Tauri
   - Create proof-of-concept Tauri test
   - Document testing strategy

4. **Week 3**:
   - Complete full test coverage
   - Cross-platform validation
   - CI/CD integration
   - Generate Phase 4.3b completion report

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-18  
**Status**: Ready for Review & Approval

