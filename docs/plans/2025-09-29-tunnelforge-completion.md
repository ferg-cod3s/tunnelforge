# TunnelForge Completion Implementation Plan

**Created**: 2025-09-29
**Status**: Ready for Implementation
**Estimated Total Effort**: 10-15 days (parallel execution)
**Risk Level**: Low-Medium

## Executive Summary

This plan addresses three critical areas to complete TunnelForge:
1. **Track 1**: Fix folder selection 400 errors (HIGH PRIORITY)
2. **Track 2**: Implement comprehensive E2E testing infrastructure (HIGH PRIORITY)
3. **Track 3**: Add custom domain support for Cloudflare tunnels (MEDIUM PRIORITY)

All three tracks are designed for parallel execution with minimal dependencies.

## Research Context

This plan is based on comprehensive codebase analysis:
- **Testing Infrastructure Analysis**: Identified Playwright configured but no E2E tests exist
- **File Browser Error Analysis**: Root cause traced to path validation in `server/internal/files/handler.go`
- **CloudflareService Analysis**: Currently uses quick tunnels; requires named tunnel support for custom domains

---

## Track 1: Critical Bug Fixes - Folder Selection 400 Errors

**Priority**: 🔴 HIGH
**Estimated Effort**: 2-3 days
**Dependencies**: None
**Risk**: Low

### Problem Statement

Users experience 400 errors when selecting folders in the file browser. Root cause analysis reveals:

1. **Primary Issue** (`server/internal/files/handler.go:49-55`): Paths outside configured allowed directories
2. **Secondary Issues**:
   - Path encoding/decoding inconsistencies
   - Missing path validation logging
   - Undocumented allowed directories configuration

### Implementation Steps

#### Phase 1.1: Add Comprehensive Logging (0.5 days)

**File**: `server/internal/files/handler.go`

**Changes at line 45** (before validation):
```go
// Add detailed logging for debugging
log.Printf("[FileBrowser] ListFiles request - path: %q, absolute: %v",
    path, filepath.IsAbs(path))

if !filepath.IsAbs(path) {
    log.Printf("[FileBrowser] ERROR: Non-absolute path rejected: %q", path)
    http.Error(w, "Path must be absolute", http.StatusBadRequest)
    return
}
```

**Changes at line 49** (allowed directories check):
```go
allowed := false
matchedDir := ""
for _, dir := range h.allowedDirs {
    if strings.HasPrefix(path, dir) {
        allowed = true
        matchedDir = dir
        break
    }
}

if !allowed {
    log.Printf("[FileBrowser] ERROR: Path outside allowed directories - path: %q, allowed: %v",
        path, h.allowedDirs)
    http.Error(w, fmt.Sprintf("Access denied: path outside allowed directories. Allowed: %v", h.allowedDirs),
        http.StatusBadRequest)
    return
}

log.Printf("[FileBrowser] Path validated - path: %q, matched_dir: %q", path, matchedDir)
```

**Changes at line 57** (service errors):
```go
files, err := h.service.ListDirectory(path)
if err != nil {
    log.Printf("[FileBrowser] ERROR: Service error for path %q: %v", path, err)
    http.Error(w, err.Error(), http.StatusBadRequest)
    return
}
```

**File**: `web/src/server/routes/files.ts`

**Changes at line 15** (add logging):
```typescript
const path = req.query.path as string;
console.log('[FileBrowser] Bun received path:', path,
    'encoded:', encodeURIComponent(path));

if (!path) {
    console.error('[FileBrowser] ERROR: Missing path parameter');
    return res.status(400).json({
        success: false,
        error: 'Path parameter required'
    });
}
```

#### Phase 1.2: Verify and Document Allowed Directories (0.5 days)

**File**: `server/internal/files/handler.go` or `server/cmd/server/main.go`

**Action**: Locate where `allowedDirs` is configured and document.

**Expected locations to check**:
```bash
grep -r "allowedDirs\|AllowedDirs" server/
```

**Create documentation file**: `docs/configuration/allowed-directories.md`

```markdown
# File Browser Allowed Directories Configuration

## Overview
The file browser restricts access to specific directories for security.

## Configuration
Located in: [FILE_PATH_TO_BE_DETERMINED]

Default allowed directories:
- `/home/$USER`
- Current working directory
- [Add others as discovered]

## Adding New Allowed Directories
[Instructions based on actual implementation]
```

#### Phase 1.3: Expand Default Allowed Directories (0.5 days)

**File**: Configuration location (TBD in Phase 1.2)

**Changes**:
```go
// Expand allowed directories to include common user directories
allowedDirs := []string{
    homeDir,                          // User home directory
    filepath.Join(homeDir, "Documents"),
    filepath.Join(homeDir, "Desktop"),
    filepath.Join(homeDir, "Downloads"),
    cwd,                              // Current working directory
    "/tmp",                           // Temporary directory (with warning)
}

// Add environment variable for custom allowed directories
if customDirs := os.Getenv("TUNNELFORGE_ALLOWED_DIRS"); customDirs != "" {
    for _, dir := range strings.Split(customDirs, ":") {
        allowedDirs = append(allowedDirs, dir)
    }
}

log.Printf("[FileBrowser] Allowed directories: %v", allowedDirs)
```

#### Phase 1.4: Add Path Encoding Tests (0.5 days)

**File**: `server/internal/files/handler_test.go`

**New test**:
```go
func TestListFiles_PathEncoding(t *testing.T) {
    tests := []struct {
        name        string
        path        string
        shouldError bool
    }{
        {"simple path", "/home/user/folder", false},
        {"path with spaces", "/home/user/My Folder", false},
        {"path with special chars", "/home/user/test-folder_123", false},
        {"relative path", "relative/path", true},
        {"outside allowed", "/etc/passwd", true},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test implementation
        })
    }
}
```

#### Phase 1.5: Update Error Messages (0.5 days)

**Make error messages more user-friendly**:

**File**: `server/internal/files/handler.go`

```go
// Instead of technical error messages, provide actionable guidance
http.Error(w, fmt.Sprintf(
    "Cannot access '%s'. This directory is outside the allowed folders. "+
    "Allowed directories: %s",
    path, strings.Join(h.allowedDirs, ", ")),
    http.StatusBadRequest)
```

**File**: `web/src/client/components/file-browser.ts`

**Add user-friendly error display**:
```typescript
private handleError(error: Error) {
    // Parse 400 errors and show helpful message
    if (error.message.includes('outside allowed directories')) {
        this.errorMessage = 'This folder cannot be accessed. Please navigate to an allowed directory.';
    } else {
        this.errorMessage = error.message;
    }
}
```

### Success Criteria

#### Automated Verification
- [ ] All new logging statements added and verified
- [ ] Path encoding tests pass
- [ ] No 400 errors for paths within allowed directories
- [ ] Error logs show exact path and validation failure reason

#### Manual Verification
- [ ] Test folder selection with spaces in name: `/home/user/My Folder`
- [ ] Test folder selection with special characters: `/home/user/test-123_folder`
- [ ] Verify error message clarity when selecting disallowed folder
- [ ] Confirm logs show helpful debugging information
- [ ] Document allowed directories configuration

### Testing Strategy

**Unit Tests**:
```bash
cd server
go test ./internal/files/... -v
```

**Manual Testing**:
1. Start TunnelForge server
2. Open file browser in web UI
3. Navigate to folder with spaces in name
4. Navigate to folder with special characters
5. Attempt to navigate to `/tmp` (should work with new config)
6. Attempt to navigate to `/etc` (should fail with clear message)
7. Check server logs for helpful error messages

### Rollback Plan

If issues arise:
1. Revert logging changes (non-breaking)
2. Revert allowed directories expansion (restore original list)
3. Keep path encoding tests (no impact on production)

---

## Track 2: Testing Infrastructure - E2E Tests with Playwright

**Priority**: 🔴 HIGH
**Estimated Effort**: 3-5 days
**Dependencies**: None
**Risk**: Low

### Problem Statement

TunnelForge has comprehensive Go unit tests (42 files) and Playwright configured, but **ZERO E2E tests exist**. This creates risk for:
- Regression bugs in critical user flows
- Integration issues between components
- API contract violations
- UI/UX regressions

### Implementation Steps

#### Phase 2.1: Create E2E Test Directory Structure (0.5 days)

**Create directories**:
```bash
mkdir -p web/e2e/{session-management,file-browser,authentication,settings,cloudflare}
mkdir -p web/e2e/fixtures
mkdir -p web/e2e/helpers
```

**Create base test configuration**: `web/e2e/config.ts`

```typescript
export const TEST_CONFIG = {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:4020',
    timeout: 30000,
    retries: 2,
};

export const TEST_USER = {
    username: 'test-user',
    password: 'test-password-123',
};
```

**Create test helpers**: `web/e2e/helpers/setup.ts`

```typescript
import { Page } from '@playwright/test';

export async function setupTestEnvironment(page: Page) {
    // Ensure server is running
    await page.goto(TEST_CONFIG.baseURL);
    await page.waitForLoadState('networkidle');
}

export async function cleanupTestSessions(page: Page) {
    // Clean up any test sessions created
    const sessions = await page.evaluate(() => {
        return fetch('/api/sessions').then(r => r.json());
    });

    for (const session of sessions) {
        if (session.name.startsWith('test-')) {
            await page.evaluate((id) => {
                return fetch(`/api/sessions/${id}`, { method: 'DELETE' });
            }, session.id);
        }
    }
}
```

#### Phase 2.2: Session Management E2E Tests (1 day)

**File**: `web/e2e/session-management/session-lifecycle.e2e.ts`

```typescript
import { test, expect } from '@playwright/test';
import { setupTestEnvironment, cleanupTestSessions } from '../helpers/setup';

test.describe('Session Management', () => {
    test.beforeEach(async ({ page }) => {
        await setupTestEnvironment(page);
    });

    test.afterEach(async ({ page }) => {
        await cleanupTestSessions(page);
    });

    test('should create new terminal session', async ({ page }) => {
        // Navigate to dashboard
        await page.goto('/');

        // Click "New Session" button
        await page.click('button[data-testid="new-session"]');

        // Fill in session details
        await page.fill('input[name="command"]', 'bash');
        await page.fill('input[name="name"]', 'test-session-1');

        // Create session
        await page.click('button[type="submit"]');

        // Verify session appears in list
        await expect(page.locator('text=test-session-1')).toBeVisible();
    });

    test('should connect to terminal via WebSocket', async ({ page }) => {
        // Create session via API
        const session = await page.evaluate(async () => {
            const response = await fetch('/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: ['bash'],
                    name: 'test-websocket-session'
                })
            });
            return response.json();
        });

        // Open terminal view
        await page.goto(`/terminal/${session.sessionId}`);

        // Wait for WebSocket connection
        await page.waitForSelector('.terminal-connected');

        // Type command
        await page.keyboard.type('echo "test-output"\n');

        // Verify output appears
        await expect(page.locator('text=test-output')).toBeVisible({ timeout: 5000 });
    });

    test('should handle session termination', async ({ page }) => {
        // Create session
        await page.goto('/');
        await page.click('button[data-testid="new-session"]');
        await page.fill('input[name="command"]', 'bash');
        await page.fill('input[name="name"]', 'test-session-to-delete');
        await page.click('button[type="submit"]');

        // Verify session exists
        await expect(page.locator('text=test-session-to-delete')).toBeVisible();

        // Click delete button
        await page.click('button[data-testid="delete-session"]');

        // Confirm deletion
        await page.click('button[data-testid="confirm-delete"]');

        // Verify session removed
        await expect(page.locator('text=test-session-to-delete')).not.toBeVisible();
    });
});
```

#### Phase 2.3: File Browser E2E Tests (1 day)

**File**: `web/e2e/file-browser/folder-navigation.e2e.ts`

```typescript
import { test, expect } from '@playwright/test';
import { setupTestEnvironment } from '../helpers/setup';

test.describe('File Browser', () => {
    test.beforeEach(async ({ page }) => {
        await setupTestEnvironment(page);
        await page.goto('/files');
    });

    test('should list home directory contents', async ({ page }) => {
        // Verify file browser loads
        await expect(page.locator('.file-browser')).toBeVisible();

        // Should show some files/folders
        const items = page.locator('.file-item');
        await expect(items).toHaveCount({ min: 1 });
    });

    test('should navigate into folder', async ({ page }) => {
        // Click on first folder
        const firstFolder = page.locator('.file-item[data-type="directory"]').first();
        const folderName = await firstFolder.textContent();
        await firstFolder.click();

        // Verify URL updated
        await expect(page).toHaveURL(/path=/);

        // Verify breadcrumb shows navigation
        await expect(page.locator('.breadcrumb')).toContainText(folderName || '');
    });

    test('should handle folder with spaces in name', async ({ page }) => {
        // Create test folder with spaces
        const testFolderPath = await page.evaluate(async () => {
            const homeDir = await fetch('/api/files/home').then(r => r.text());
            return `${homeDir}/Test Folder ${Date.now()}`;
        });

        // Create folder via API
        await page.evaluate((path) => {
            return fetch('/api/files/mkdir', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            });
        }, testFolderPath);

        // Refresh file list
        await page.reload();

        // Click on folder with spaces
        await page.click(`text="${testFolderPath.split('/').pop()}"`);

        // Verify navigation succeeded (no 400 error)
        await expect(page.locator('.error-message')).not.toBeVisible();
        await expect(page.locator('.file-browser')).toBeVisible();
    });

    test('should display error for restricted folders', async ({ page }) => {
        // Attempt to navigate to /etc
        await page.evaluate(() => {
            const input = document.querySelector('input[name="path"]') as HTMLInputElement;
            if (input) {
                input.value = '/etc';
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        await page.click('button[data-testid="navigate"]');

        // Verify error message appears
        await expect(page.locator('.error-message')).toBeVisible();
        await expect(page.locator('.error-message')).toContainText('outside allowed directories');
    });
});
```

#### Phase 2.4: Authentication E2E Tests (0.5 days)

**File**: `web/e2e/authentication/auth-flow.e2e.ts`

```typescript
import { test, expect } from '@playwright/test';
import { TEST_CONFIG, TEST_USER } from '../config';

test.describe('Authentication', () => {
    test('should show login page for unauthenticated user', async ({ page }) => {
        await page.goto(TEST_CONFIG.baseURL);

        // Verify login form appears
        await expect(page.locator('form[data-testid="login-form"]')).toBeVisible();
    });

    test('should login with valid credentials', async ({ page }) => {
        await page.goto('/login');

        // Fill in credentials
        await page.fill('input[name="username"]', TEST_USER.username);
        await page.fill('input[name="password"]', TEST_USER.password);

        // Submit form
        await page.click('button[type="submit"]');

        // Verify redirect to dashboard
        await expect(page).toHaveURL('/dashboard');
        await expect(page.locator('text=Welcome')).toBeVisible();
    });

    test('should reject invalid credentials', async ({ page }) => {
        await page.goto('/login');

        await page.fill('input[name="username"]', 'invalid-user');
        await page.fill('input[name="password"]', 'wrong-password');
        await page.click('button[type="submit"]');

        // Verify error message
        await expect(page.locator('.error-message')).toContainText('Invalid credentials');
    });

    test('should logout successfully', async ({ page, context }) => {
        // Login first
        await page.goto('/login');
        await page.fill('input[name="username"]', TEST_USER.username);
        await page.fill('input[name="password"]', TEST_USER.password);
        await page.click('button[type="submit"]');
        await page.waitForURL('/dashboard');

        // Click logout
        await page.click('button[data-testid="logout"]');

        // Verify redirect to login
        await expect(page).toHaveURL('/login');

        // Verify session cleared
        const cookies = await context.cookies();
        expect(cookies.find(c => c.name === 'session')).toBeUndefined();
    });
});
```

#### Phase 2.5: Cloudflare Service E2E Tests (0.5 days)

**File**: `web/e2e/cloudflare/tunnel-management.e2e.ts`

```typescript
import { test, expect } from '@playwright/test';
import { setupTestEnvironment } from '../helpers/setup';

test.describe('Cloudflare Tunnel Management', () => {
    test.beforeEach(async ({ page }) => {
        await setupTestEnvironment(page);
        await page.goto('/settings/remote-access');
    });

    test('should display Cloudflare tunnel options', async ({ page }) => {
        await expect(page.locator('text=Cloudflare Tunnel')).toBeVisible();
        await expect(page.locator('button[data-testid="start-cloudflare"]')).toBeVisible();
    });

    test('should start quick tunnel', async ({ page }) => {
        // Click start tunnel
        await page.click('button[data-testid="start-cloudflare"]');

        // Wait for tunnel URL to appear (may take 10-30 seconds)
        await expect(page.locator('.tunnel-url')).toBeVisible({ timeout: 45000 });

        // Verify URL format
        const tunnelUrl = await page.locator('.tunnel-url').textContent();
        expect(tunnelUrl).toMatch(/https:\/\/.*\.trycloudflare\.com/);
    });

    test('should stop running tunnel', async ({ page }) => {
        // Start tunnel first
        await page.click('button[data-testid="start-cloudflare"]');
        await expect(page.locator('.tunnel-url')).toBeVisible({ timeout: 45000 });

        // Click stop button
        await page.click('button[data-testid="stop-cloudflare"]');

        // Verify tunnel stopped
        await expect(page.locator('.tunnel-url')).not.toBeVisible();
        await expect(page.locator('text=Tunnel stopped')).toBeVisible();
    });
});
```

#### Phase 2.6: Update Playwright Configuration (0.5 days)

**File**: `web/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [
        ['html'],
        ['json', { outputFile: 'playwright-report.json' }],
        ['junit', { outputFile: 'playwright-report.xml' }],
    ],
    use: {
        baseURL: process.env.TEST_BASE_URL || 'http://localhost:4020',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },
    ],
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:4020',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
    },
});
```

#### Phase 2.7: Add CI/CD Integration (0.5 days)

**File**: `.github/workflows/e2e-tests.yml`

```yaml
name: E2E Tests

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Setup Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'

      - name: Install dependencies
        working-directory: web
        run: npm install

      - name: Install Playwright Browsers
        working-directory: web
        run: npx playwright install --with-deps

      - name: Build Go server
        working-directory: server
        run: go build -o ../tunnelforge-server cmd/server/main.go

      - name: Start TunnelForge server
        run: |
          ./tunnelforge-server &
          sleep 5

      - name: Run E2E tests
        working-directory: web
        run: npm run test:e2e
        env:
          TEST_BASE_URL: http://localhost:4020

      - name: Upload Playwright Report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: web/playwright-report/
          retention-days: 30
```

**Update `web/package.json`**:

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug"
  }
}
```

### Success Criteria

#### Automated Verification
- [ ] All E2E tests pass in CI/CD
- [ ] Playwright report generated successfully
- [ ] Test coverage includes session management, file browser, authentication, and Cloudflare
- [ ] Tests run in parallel across multiple browsers (Chromium, Firefox, WebKit)

#### Manual Verification
- [ ] Run `npm run test:e2e` locally - all tests pass
- [ ] Run `npm run test:e2e:ui` - Playwright UI opens and tests can be debugged
- [ ] Verify HTML report generated in `playwright-report/`
- [ ] Check CI/CD pipeline includes E2E tests and they pass

### Testing Strategy

**Local Development**:
```bash
cd web
npm run test:e2e:ui  # Interactive mode for development
```

**CI/CD Pipeline**:
- Runs automatically on all PRs
- Generates HTML report as artifact
- Fails build if any E2E test fails

**Coverage Goals**:
- Session lifecycle: Create, connect, use, terminate
- File browser: Navigate, handle errors, special characters
- Authentication: Login, logout, session persistence
- Cloudflare: Start/stop tunnels, URL extraction

### Rollback Plan

E2E tests are non-breaking additions. If issues arise:
1. Disable failing tests with `test.skip()`
2. Fix and re-enable incrementally
3. CI/CD continues with unit tests until E2E stabilizes

---

## Track 3: Custom Domain Feature - Cloudflare Named Tunnels

**Priority**: 🟡 MEDIUM
**Estimated Effort**: 5-7 days
**Dependencies**: None
**Risk**: Medium (requires Cloudflare account setup)

### Problem Statement

TunnelForge currently uses Cloudflare quick tunnels which provide random URLs (e.g., `https://random-name.trycloudflare.com`). Users need custom domain support for:
- Professional branding
- Stable URLs
- SSL certificate management
- Production deployments

### Architecture Overview

**Current**: Quick tunnels (`cloudflared tunnel --url http://localhost:4021`)
**Target**: Named tunnels (`cloudflared tunnel run --credentials-file <path> <tunnel-name>`)

**Required Components**:
1. Tunnel creation and credential management
2. DNS configuration
3. Configuration storage (ConfigManager)
4. UI for setup and management

### Implementation Steps

#### Phase 3.1: Extend ConfigManager for Custom Domains (1 day)

**File**: `mac/TunnelForge/Services/ConfigManager.swift`

**Add around line 30** (after existing configuration properties):

```swift
// MARK: - Cloudflare Custom Domain Configuration

/// Custom domain for Cloudflare tunnel (e.g., "tunnel.example.com")
@Published var cloudflareCustomDomain: String? {
    didSet {
        UserDefaults.standard.set(cloudflareCustomDomain, forKey: "cloudflareCustomDomain")
    }
}

/// Tunnel name for named Cloudflare tunnel
@Published var cloudflareTunnelName: String? {
    didSet {
        UserDefaults.standard.set(cloudflareTunnelName, forKey: "cloudflareTunnelName")
    }
}

/// Path to Cloudflare tunnel credentials file
@Published var cloudflareTunnelCredentialsPath: String? {
    didSet {
        UserDefaults.standard.set(cloudflareTunnelCredentialsPath, forKey: "cloudflareTunnelCredentialsPath")
    }
}

/// Whether to use custom domain (true) or quick tunnel (false)
@Published var cloudflareUseCustomDomain: Bool {
    didSet {
        UserDefaults.standard.set(cloudflareUseCustomDomain, forKey: "cloudflareUseCustomDomain")
    }
}

// MARK: - Initialization Updates

init() {
    // ... existing init code ...

    // Load Cloudflare custom domain settings
    self.cloudflareCustomDomain = UserDefaults.standard.string(forKey: "cloudflareCustomDomain")
    self.cloudflareTunnelName = UserDefaults.standard.string(forKey: "cloudflareTunnelName")
    self.cloudflareTunnelCredentialsPath = UserDefaults.standard.string(forKey: "cloudflareTunnelCredentialsPath")
    self.cloudflareUseCustomDomain = UserDefaults.standard.bool(forKey: "cloudflareUseCustomDomain")
}
```

**Add validation helper**:

```swift
// MARK: - Custom Domain Validation

func validateCloudflareCustomDomainSetup() -> Result<Void, ConfigError> {
    guard cloudflareUseCustomDomain else {
        return .success(()) // Quick tunnel mode, no validation needed
    }

    guard let domain = cloudflareCustomDomain, !domain.isEmpty else {
        return .failure(.missingCustomDomain)
    }

    guard let tunnelName = cloudflareTunnelName, !tunnelName.isEmpty else {
        return .failure(.missingTunnelName)
    }

    guard let credentialsPath = cloudflareTunnelCredentialsPath,
          FileManager.default.fileExists(atPath: credentialsPath) else {
        return .failure(.missingCredentials)
    }

    return .success(())
}

enum ConfigError: LocalizedError {
    case missingCustomDomain
    case missingTunnelName
    case missingCredentials

    var errorDescription: String? {
        switch self {
        case .missingCustomDomain:
            return "Custom domain is required for named tunnels"
        case .missingTunnelName:
            return "Tunnel name is required for named tunnels"
        case .missingCredentials:
            return "Tunnel credentials file not found"
        }
    }
}
```

#### Phase 3.2: Add Tunnel Setup Methods to CloudflareService (2 days)

**File**: `mac/TunnelForge/Services/CloudflareService.swift`

**Add new methods after existing code** (around line 280):

```swift
// MARK: - Custom Domain Setup

/// Create a new Cloudflare tunnel
func createTunnel(name: String) async throws -> TunnelCredentials {
    guard let cloudflaredPath = getCloudflaredPath() else {
        throw CloudflareError.binaryNotFound
    }

    return try await withCheckedThrowingContinuation { continuation in
        let process = Process()
        process.launchPath = cloudflaredPath
        process.arguments = ["tunnel", "create", name]

        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe

        var outputData = Data()
        var errorData = Data()

        outputPipe.fileHandleForReading.readabilityHandler = { handle in
            outputData.append(handle.availableData)
        }

        errorPipe.fileHandleForReading.readabilityHandler = { handle in
            errorData.append(handle.availableData)
        }

        process.terminationHandler = { process in
            outputPipe.fileHandleForReading.readabilityHandler = nil
            errorPipe.fileHandleForReading.readabilityHandler = nil

            if process.terminationStatus == 0 {
                // Parse output to extract credentials file path
                if let output = String(data: outputData, encoding: .utf8) {
                    if let credentials = self.parseCredentialsPath(from: output) {
                        continuation.resume(returning: credentials)
                        return
                    }
                }
                continuation.resume(throwing: CloudflareError.credentialsParsingFailed)
            } else {
                let error = String(data: errorData, encoding: .utf8) ?? "Unknown error"
                continuation.resume(throwing: CloudflareError.tunnelCreationFailed(error))
            }
        }

        do {
            try process.run()
        } catch {
            continuation.resume(throwing: error)
        }
    }
}

/// Configure DNS for the tunnel
func configureDNS(tunnelName: String, hostname: String) async throws {
    guard let cloudflaredPath = getCloudflaredPath() else {
        throw CloudflareError.binaryNotFound
    }

    return try await withCheckedThrowingContinuation { continuation in
        let process = Process()
        process.launchPath = cloudflaredPath
        process.arguments = ["tunnel", "route", "dns", tunnelName, hostname]

        let errorPipe = Pipe()
        process.standardError = errorPipe

        var errorData = Data()
        errorPipe.fileHandleForReading.readabilityHandler = { handle in
            errorData.append(handle.availableData)
        }

        process.terminationHandler = { process in
            errorPipe.fileHandleForReading.readabilityHandler = nil

            if process.terminationStatus == 0 {
                continuation.resume(returning: ())
            } else {
                let error = String(data: errorData, encoding: .utf8) ?? "Unknown error"
                continuation.resume(throwing: CloudflareError.dnsConfigurationFailed(error))
            }
        }

        do {
            try process.run()
        } catch {
            continuation.resume(throwing: error)
        }
    }
}

/// List existing tunnels
func listTunnels() async throws -> [TunnelInfo] {
    guard let cloudflaredPath = getCloudflaredPath() else {
        throw CloudflareError.binaryNotFound
    }

    return try await withCheckedThrowingContinuation { continuation in
        let process = Process()
        process.launchPath = cloudflaredPath
        process.arguments = ["tunnel", "list", "--output", "json"]

        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe

        var outputData = Data()

        outputPipe.fileHandleForReading.readabilityHandler = { handle in
            outputData.append(handle.availableData)
        }

        process.terminationHandler = { process in
            outputPipe.fileHandleForReading.readabilityHandler = nil
            errorPipe.fileHandleForReading.readabilityHandler = nil

            if process.terminationStatus == 0 {
                do {
                    let tunnels = try JSONDecoder().decode([TunnelInfo].self, from: outputData)
                    continuation.resume(returning: tunnels)
                } catch {
                    continuation.resume(throwing: CloudflareError.tunnelListParsingFailed(error))
                }
            } else {
                continuation.resume(throwing: CloudflareError.tunnelListFailed)
            }
        }

        do {
            try process.run()
        } catch {
            continuation.resume(throwing: error)
        }
    }
}

// MARK: - Helper Methods

private func parseCredentialsPath(from output: String) -> TunnelCredentials? {
    // Example output: "Created tunnel my-tunnel with id abc123"
    // Credentials file: ~/.cloudflared/abc123.json

    let pattern = "Created tunnel .* with id ([a-f0-9\\-]+)"
    guard let regex = try? NSRegularExpression(pattern: pattern),
          let match = regex.firstMatch(in: output, range: NSRange(output.startIndex..., in: output)),
          let range = Range(match.range(at: 1), in: output) else {
        return nil
    }

    let tunnelId = String(output[range])
    let homeDir = FileManager.default.homeDirectoryForCurrentUser.path
    let credentialsPath = "\(homeDir)/.cloudflared/\(tunnelId).json"

    return TunnelCredentials(tunnelId: tunnelId, path: credentialsPath)
}

// MARK: - Data Models

struct TunnelCredentials {
    let tunnelId: String
    let path: String
}

struct TunnelInfo: Codable {
    let id: String
    let name: String
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case createdAt = "created_at"
    }
}

enum CloudflareError: LocalizedError {
    case binaryNotFound
    case tunnelCreationFailed(String)
    case dnsConfigurationFailed(String)
    case tunnelListFailed
    case tunnelListParsingFailed(Error)
    case credentialsParsingFailed

    var errorDescription: String? {
        switch self {
        case .binaryNotFound:
            return "cloudflared binary not found. Please install cloudflared."
        case .tunnelCreationFailed(let error):
            return "Failed to create tunnel: \(error)"
        case .dnsConfigurationFailed(let error):
            return "Failed to configure DNS: \(error)"
        case .tunnelListFailed:
            return "Failed to list tunnels"
        case .tunnelListParsingFailed(let error):
            return "Failed to parse tunnel list: \(error.localizedDescription)"
        case .credentialsParsingFailed:
            return "Failed to parse credentials path from cloudflared output"
        }
    }
}

private func getCloudflaredPath() -> String? {
    let paths = [
        "/opt/homebrew/bin/cloudflared",
        "/usr/local/bin/cloudflared"
    ]
    return paths.first { FileManager.default.fileExists(atPath: $0) }
}
```

#### Phase 3.3: Update startTunnel Method for Named Tunnels (1 day)

**File**: `mac/TunnelForge/Services/CloudflareService.swift`

**Modify existing `startTunnel` method** (around line 67-110):

```swift
func startTunnel(port: Int = 4021) {
    guard !isRunning else {
        print("CloudflareService: Tunnel already running")
        return
    }

    guard let cloudflaredPath = getCloudflaredPath() else {
        DispatchQueue.main.async {
            self.error = CloudflareError.binaryNotFound.localizedDescription
        }
        return
    }

    let process = Process()
    process.launchPath = cloudflaredPath

    // Check if using custom domain or quick tunnel
    let config = ConfigManager.shared

    if config.cloudflareUseCustomDomain,
       let tunnelName = config.cloudflareTunnelName,
       let credentialsPath = config.cloudflareTunnelCredentialsPath {

        // Named tunnel with custom domain
        process.arguments = [
            "tunnel",
            "run",
            "--url", "http://localhost:\(port)",
            "--credentials-file", credentialsPath,
            tunnelName
        ]

        print("CloudflareService: Starting named tunnel '\(tunnelName)' with custom domain")

    } else {
        // Quick tunnel (default behavior)
        process.arguments = [
            "tunnel",
            "--url", "http://localhost:\(port)"
        ]

        print("CloudflareService: Starting quick tunnel")
    }

    // ... rest of existing startTunnel code ...
}
```

**Update output parsing** (around line 154-166):

```swift
private func parseOutput(_ output: String) {
    // For named tunnels, URL is the custom domain
    let config = ConfigManager.shared
    if config.cloudflareUseCustomDomain,
       let customDomain = config.cloudflareCustomDomain {

        // Named tunnel ready when we see "Registered tunnel connection"
        if output.contains("Registered tunnel connection") {
            let url = "https://\(customDomain)"
            DispatchQueue.main.async {
                self.tunnelURL = url
                self.isRunning = true
            }
        }

    } else {
        // Quick tunnel - parse trycloudflare.com URL
        if output.contains("trycloudflare.com") {
            let pattern = "https://[^\\s]+\\.trycloudflare\\.com"
            if let regex = try? NSRegularExpression(pattern: pattern),
               let match = regex.firstMatch(in: output, range: NSRange(output.startIndex..., in: output)),
               let range = Range(match.range, in: output) {
                let url = String(output[range])
                DispatchQueue.main.async {
                    self.tunnelURL = url
                    self.isRunning = true
                }
            }
        }
    }
}
```

#### Phase 3.4: Create Custom Domain Setup UI (2 days)

**File**: `mac/TunnelForge/Views/Settings/CloudflareCustomDomainView.swift` (new file)

```swift
import SwiftUI

struct CloudflareCustomDomainView: View {
    @StateObject private var cloudflareService = CloudflareService.shared
    @StateObject private var config = ConfigManager.shared

    @State private var tunnelName = ""
    @State private var customDomain = ""
    @State private var isCreatingTunnel = false
    @State private var isConfiguringDNS = false
    @State private var setupStep: SetupStep = .initial
    @State private var errorMessage: String?
    @State private var existingTunnels: [TunnelInfo] = []

    enum SetupStep {
        case initial
        case createTunnel
        case configureDNS
        case complete
    }

    var body: some View {
        VStack(spacing: 20) {
            // Header
            VStack(alignment: .leading, spacing: 8) {
                Text("Custom Domain Setup")
                    .font(.title2)
                    .fontWeight(.bold)

                Text("Set up a Cloudflare tunnel with your own custom domain")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Divider()

            // Setup wizard
            switch setupStep {
            case .initial:
                initialView
            case .createTunnel:
                createTunnelView
            case .configureDNS:
                configureDNSView
            case .complete:
                completeView
            }

            Spacer()

            // Error display
            if let error = errorMessage {
                Text(error)
                    .foregroundColor(.red)
                    .font(.caption)
                    .padding()
                    .background(Color.red.opacity(0.1))
                    .cornerRadius(8)
            }
        }
        .padding()
        .onAppear {
            loadExistingTunnels()
        }
    }

    // MARK: - Step Views

    private var initialView: some View {
        VStack(spacing: 16) {
            Text("Choose an option:")
                .font(.headline)

            Button(action: {
                setupStep = .createTunnel
            }) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Create New Tunnel")
                        .font(.headline)
                    Text("Set up a new Cloudflare tunnel with custom domain")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
                .background(Color.blue.opacity(0.1))
                .cornerRadius(8)
            }
            .buttonStyle(.plain)

            if !existingTunnels.isEmpty {
                Button(action: {
                    // TODO: Select existing tunnel
                }) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Use Existing Tunnel")
                            .font(.headline)
                        Text("Select from \(existingTunnels.count) existing tunnel(s)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                    .background(Color.green.opacity(0.1))
                    .cornerRadius(8)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var createTunnelView: some View {
        VStack(spacing: 16) {
            Text("Step 1: Create Tunnel")
                .font(.headline)

            VStack(alignment: .leading, spacing: 8) {
                Text("Tunnel Name")
                    .font(.subheadline)
                    .fontWeight(.medium)

                TextField("my-tunnel", text: $tunnelName)
                    .textFieldStyle(.roundedBorder)
                    .disabled(isCreatingTunnel)

                Text("Choose a unique name for your tunnel (e.g., my-tunnel)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            HStack {
                Button("Back") {
                    setupStep = .initial
                }
                .disabled(isCreatingTunnel)

                Spacer()

                Button("Create Tunnel") {
                    createTunnel()
                }
                .buttonStyle(.borderedProminent)
                .disabled(tunnelName.isEmpty || isCreatingTunnel)
            }

            if isCreatingTunnel {
                ProgressView("Creating tunnel...")
            }
        }
    }

    private var configureDNSView: some View {
        VStack(spacing: 16) {
            Text("Step 2: Configure DNS")
                .font(.headline)

            VStack(alignment: .leading, spacing: 8) {
                Text("Custom Domain")
                    .font(.subheadline)
                    .fontWeight(.medium)

                TextField("tunnel.example.com", text: $customDomain)
                    .textFieldStyle(.roundedBorder)
                    .disabled(isConfiguringDNS)
                    .autocapitalization(.none)

                Text("Enter your custom domain or subdomain")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            HStack {
                Button("Back") {
                    setupStep = .createTunnel
                }
                .disabled(isConfiguringDNS)

                Spacer()

                Button("Configure DNS") {
                    configureDNS()
                }
                .buttonStyle(.borderedProminent)
                .disabled(customDomain.isEmpty || isConfiguringDNS)
            }

            if isConfiguringDNS {
                ProgressView("Configuring DNS...")
            }
        }
    }

    private var completeView: some View {
        VStack(spacing: 16) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 60))
                .foregroundColor(.green)

            Text("Setup Complete!")
                .font(.title2)
                .fontWeight(.bold)

            VStack(alignment: .leading, spacing: 8) {
                Text("Your custom domain is ready:")
                    .font(.subheadline)

                Text("https://\(customDomain)")
                    .font(.headline)
                    .foregroundColor(.blue)
            }

            Button("Start Tunnel") {
                config.cloudflareUseCustomDomain = true
                cloudflareService.startTunnel()
                // Navigate back to settings
            }
            .buttonStyle(.borderedProminent)
        }
    }

    // MARK: - Actions

    private func loadExistingTunnels() {
        Task {
            do {
                existingTunnels = try await cloudflareService.listTunnels()
            } catch {
                errorMessage = "Failed to load existing tunnels: \(error.localizedDescription)"
            }
        }
    }

    private func createTunnel() {
        isCreatingTunnel = true
        errorMessage = nil

        Task {
            do {
                let credentials = try await cloudflareService.createTunnel(name: tunnelName)

                // Save credentials to config
                await MainActor.run {
                    config.cloudflareTunnelName = tunnelName
                    config.cloudflareTunnelCredentialsPath = credentials.path

                    isCreatingTunnel = false
                    setupStep = .configureDNS
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isCreatingTunnel = false
                }
            }
        }
    }

    private func configureDNS() {
        isConfiguringDNS = true
        errorMessage = nil

        Task {
            do {
                try await cloudflareService.configureDNS(
                    tunnelName: tunnelName,
                    hostname: customDomain
                )

                // Save custom domain to config
                await MainActor.run {
                    config.cloudflareCustomDomain = customDomain

                    isConfiguringDNS = false
                    setupStep = .complete
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isConfiguringDNS = false
                }
            }
        }
    }
}

#Preview {
    CloudflareCustomDomainView()
}
```

**Add to Settings view**:

**File**: `mac/TunnelForge/Views/Settings/RemoteAccessSettingsView.swift`

```swift
// Add navigation link to custom domain setup
NavigationLink(destination: CloudflareCustomDomainView()) {
    HStack {
        Image(systemName: "globe")
        Text("Custom Domain Setup")
        Spacer()
        if ConfigManager.shared.cloudflareUseCustomDomain {
            Image(systemName: "checkmark.circle.fill")
                .foregroundColor(.green)
        }
    }
}
```

#### Phase 3.5: Add TypeScript Implementation (1 day)

**File**: `web/src/server/services/cloudflare-service.ts`

**Add custom domain methods**:

```typescript
async createTunnel(name: string): Promise<TunnelCredentials> {
    return new Promise((resolve, reject) => {
        const process = spawn('cloudflared', ['tunnel', 'create', name]);

        let output = '';
        let errorOutput = '';

        process.stdout.on('data', (data) => {
            output += data.toString();
        });

        process.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        process.on('close', (code) => {
            if (code === 0) {
                const credentials = this.parseCredentialsPath(output);
                if (credentials) {
                    resolve(credentials);
                } else {
                    reject(new Error('Failed to parse credentials path'));
                }
            } else {
                reject(new Error(`Tunnel creation failed: ${errorOutput}`));
            }
        });
    });
}

async configureDNS(tunnelName: string, hostname: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const process = spawn('cloudflared', [
            'tunnel', 'route', 'dns', tunnelName, hostname
        ]);

        let errorOutput = '';

        process.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        process.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`DNS configuration failed: ${errorOutput}`));
            }
        });
    });
}

private parseCredentialsPath(output: string): TunnelCredentials | null {
    const pattern = /Created tunnel .* with id ([a-f0-9\-]+)/;
    const match = output.match(pattern);

    if (match) {
        const tunnelId = match[1];
        const homeDir = os.homedir();
        const path = `${homeDir}/.cloudflared/${tunnelId}.json`;

        return { tunnelId, path };
    }

    return null;
}

interface TunnelCredentials {
    tunnelId: string;
    path: string;
}
```

**Update startTunnel method**:

```typescript
startTunnel(port: number = 4021, customConfig?: CustomDomainConfig) {
    const args = ['tunnel'];

    if (customConfig && customConfig.useCustomDomain) {
        // Named tunnel
        args.push('run', '--url', `http://localhost:${port}`);
        args.push('--credentials-file', customConfig.credentialsPath);
        args.push(customConfig.tunnelName);
    } else {
        // Quick tunnel
        args.push('--url', `http://localhost:${port}`);
    }

    this.tunnelProcess = spawn('cloudflared', args);

    // ... rest of existing code ...
}

interface CustomDomainConfig {
    useCustomDomain: boolean;
    tunnelName: string;
    credentialsPath: string;
    customDomain: string;
}
```

#### Phase 3.6: Documentation (0.5 days)

**Create**: `docs/cloudflare-custom-domains.md`

```markdown
# Cloudflare Custom Domain Setup

## Overview

TunnelForge supports custom domains for Cloudflare tunnels using named tunnels.

## Prerequisites

1. **Cloudflare Account**: Free or paid account
2. **Domain**: Domain registered with Cloudflare (or DNS managed by Cloudflare)
3. **cloudflared CLI**: Installed at `/opt/homebrew/bin/cloudflared` (macOS) or `/usr/local/bin/cloudflared`

## Installation

### Install cloudflared

**macOS**:
```bash
brew install cloudflare/cloudflare/cloudflared
```

**Linux**:
```bash
wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
sudo mv cloudflared-linux-amd64 /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared
```

**Windows**:
Download from: https://github.com/cloudflare/cloudflared/releases

### Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

This opens a browser for Cloudflare authentication.

## Setup via UI

1. Open TunnelForge Settings
2. Navigate to "Remote Access" → "Cloudflare"
3. Click "Custom Domain Setup"
4. Follow the wizard:
   - **Step 1**: Create tunnel (choose a name)
   - **Step 2**: Configure DNS (enter your domain)
   - **Step 3**: Start tunnel

## Manual Setup

### 1. Create Tunnel

```bash
cloudflared tunnel create my-tunnel
```

Output:
```
Created tunnel my-tunnel with id abc123-def456-ghi789
Credentials written to: /Users/username/.cloudflared/abc123-def456-ghi789.json
```

### 2. Configure DNS

```bash
cloudflared tunnel route dns my-tunnel tunnel.example.com
```

### 3. Configure TunnelForge

In TunnelForge settings:
- Tunnel Name: `my-tunnel`
- Custom Domain: `tunnel.example.com`
- Credentials Path: `/Users/username/.cloudflared/abc123-def456-ghi789.json`
- Enable "Use Custom Domain"

### 4. Start Tunnel

Click "Start Tunnel" in TunnelForge.

Access your TunnelForge instance at: `https://tunnel.example.com`

## Troubleshooting

### Tunnel won't start

**Check credentials file**:
```bash
ls -la ~/.cloudflared/
```

**Verify tunnel exists**:
```bash
cloudflared tunnel list
```

**Check DNS configuration**:
```bash
cloudflared tunnel route dns list
```

### DNS not resolving

- Allow 5-10 minutes for DNS propagation
- Verify domain is using Cloudflare nameservers
- Check Cloudflare dashboard for DNS records

### Connection issues

**Test tunnel directly**:
```bash
cloudflared tunnel run --url http://localhost:4021 my-tunnel
```

Access via browser to verify connectivity.

## Security

- Credentials file contains sensitive data - keep secure
- Use appropriate file permissions: `chmod 600 ~/.cloudflared/*.json`
- Consider using Cloudflare Access for authentication

## Cost

- Quick tunnels: Free
- Named tunnels: Free (up to 50 tunnels)
- Custom domains: Requires domain with Cloudflare DNS (free tier available)
```

### Success Criteria

#### Automated Verification
- [ ] ConfigManager stores custom domain settings
- [ ] CloudflareService can create tunnels via `createTunnel()`
- [ ] CloudflareService can configure DNS via `configureDNS()`
- [ ] Named tunnels start successfully with custom domain
- [ ] Unit tests pass for all new methods

#### Manual Verification
- [ ] UI wizard guides user through setup
- [ ] Tunnel creation completes successfully
- [ ] DNS configuration succeeds
- [ ] Custom domain resolves correctly
- [ ] TunnelForge accessible via custom domain
- [ ] Documentation complete and accurate

### Testing Strategy

**Unit Tests**:

**File**: `mac/TunnelForgeTests/CloudflareServiceTests.swift`

```swift
func testCreateTunnel() async throws {
    let service = CloudflareService.shared
    let credentials = try await service.createTunnel(name: "test-tunnel")

    XCTAssertFalse(credentials.tunnelId.isEmpty)
    XCTAssertTrue(FileManager.default.fileExists(atPath: credentials.path))
}

func testConfigureDNS() async throws {
    let service = CloudflareService.shared
    try await service.configureDNS(tunnelName: "test-tunnel", hostname: "test.example.com")

    // Verify DNS route was created
    let tunnels = try await service.listTunnels()
    XCTAssertTrue(tunnels.contains { $0.name == "test-tunnel" })
}
```

**Manual Testing**:
1. Run setup wizard in TunnelForge
2. Create tunnel named "test-tunnel-manual"
3. Configure DNS for "test.yourdomain.com"
4. Start tunnel
5. Access `https://test.yourdomain.com` from browser
6. Verify TunnelForge dashboard loads
7. Stop tunnel
8. Verify tunnel stops cleanly

**Integration Testing**:
1. Test quick tunnel → custom domain switch
2. Test custom domain → quick tunnel fallback
3. Verify configuration persists across app restarts

### Rollback Plan

Custom domain is an additive feature with fallback to quick tunnels:

1. **Disable custom domain** in settings (use quick tunnel mode)
2. **Remove configuration** from ConfigManager if needed
3. **Delete tunnel** via Cloudflare dashboard if cleanup required:
   ```bash
   cloudflared tunnel delete <tunnel-name>
   ```

No data loss - quick tunnels continue working if custom domain fails.

---

## Overall Success Criteria

### Track 1: Bug Fixes
- [ ] No 400 errors for valid folder selections
- [ ] Clear error messages for invalid paths
- [ ] Comprehensive logging for debugging
- [ ] Allowed directories documented

### Track 2: E2E Testing
- [ ] 15+ E2E tests covering critical flows
- [ ] All tests pass in CI/CD
- [ ] Playwright reports generated
- [ ] Test coverage >80% for critical paths

### Track 3: Custom Domains
- [ ] Named tunnels work with custom domains
- [ ] UI wizard guides setup process
- [ ] Configuration persists correctly
- [ ] Documentation complete

## Timeline

| Track | Days | Can Start | Blocking |
|-------|------|-----------|----------|
| Track 1 | 2-3 | Immediately | None |
| Track 2 | 3-5 | Immediately | None |
| Track 3 | 5-7 | Immediately | None |

**Total**: 10-15 days (parallel execution)

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Path validation too strict | Medium | Medium | Comprehensive testing with diverse paths |
| E2E tests flaky in CI | Medium | Low | Retry logic, screenshot on failure |
| Cloudflare setup complex | Medium | Medium | Wizard UI, detailed docs |
| DNS propagation delays | High | Low | Clear user messaging, fallback to quick tunnel |

## Dependencies

### External
- Cloudflare account (free) for custom domains
- cloudflared CLI installed
- Playwright browsers installed

### Internal
- Go server running on port 4021
- Web frontend accessible
- UserDefaults/ConfigManager for persistence

## Notes

- All three tracks are independent and can be worked in parallel
- Track 1 (bug fixes) provides immediate user value
- Track 2 (testing) prevents future regressions
- Track 3 (custom domains) is optional enhancement - quick tunnels remain functional

## References

- Research document: `/research-enhanced` output
- File browser analysis: `web/src/client/components/file-browser.ts:1-end`
- CloudflareService: `mac/TunnelForge/Services/CloudflareService.swift:1-276`
- Testing infrastructure: `web/playwright.config.ts`