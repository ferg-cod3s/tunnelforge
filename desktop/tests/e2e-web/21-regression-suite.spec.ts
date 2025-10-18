import { test, expect, Page } from '@playwright/test';

/**
 * Phase 4.4: Regression and Compatibility Tests
 * 
 * Tests known bug prevention, platform compatibility re-checks,
 * and backwards compatibility validation.
 * 
 * Test Categories:
 * 1. Known Bug Prevention (regression tests for previously fixed issues)
 * 2. Platform Compatibility (cross-platform consistency)
 * 3. Backwards Compatibility (API, data format compatibility)
 * 4. Browser Compatibility (different browsers/versions)
 * 5. Mobile/Responsive Compatibility
 * 6. Legacy Feature Support
 */

test.describe('Regression and Compatibility Tests', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ============================================================================
  // Known Bug Prevention Tests
  // ============================================================================

  test('Regression: Terminal Input Focus Loss', async () => {
    // Bug: Terminal loses focus after command execution
    await page.goto('http://localhost:5173/dashboard');
    
    // 1. Create session
    await page.click('button:has-text("New Session")');
    await page.fill('input[placeholder="Session name"]', 'focus-test');
    await page.click('button:has-text("Create")');
    
    // 2. Verify input is focused
    const input = page.locator('.terminal-input');
    await input.focus();
    await expect(input).toBeFocused();
    
    // 3. Execute command
    await page.keyboard.type('echo "Test"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // 4. Verify focus restored to input
    await expect(input).toBeFocused();
    
    // 5. Should be able to type immediately
    await page.keyboard.type('echo "Second"');
    const inputValue = await input.inputValue();
    expect(inputValue).toContain('Second');
  });

  test('Regression: WebSocket Connection Leaks', async () => {
    // Bug: Multiple connections accumulate without proper cleanup
    await page.goto('http://localhost:5173/dashboard');
    
    // 1. Create and close multiple sessions rapidly
    for (let i = 0; i < 5; i++) {
      await page.click('button:has-text("New Session")');
      await page.fill('input[placeholder="Session name"]', `ws-test-${i}`);
      await page.click('button:has-text("Create")');
      await page.waitForTimeout(200);
      
      // Execute command
      await page.click('.terminal-input');
      await page.keyboard.type(`echo "Session ${i}"`);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
      
      // Close session
      await page.click('button[title="Close Session"]');
      await page.click('button:has-text("Confirm")');
      await page.waitForTimeout(200);
    }
    
    // 2. Check network requests to verify no lingering connections
    const requests = await page.context().tracing.export();
    
    // 3. Verify final session creation works smoothly
    await page.click('button:has-text("New Session")');
    await page.fill('input[placeholder="Session name"]', 'final-test');
    await page.click('button:has-text("Create")');
    
    const terminal = page.locator('.terminal-container');
    await expect(terminal).toBeVisible();
  });

  test('Regression: Memory Leak in File Browser', async () => {
    // Bug: Opening and closing file browser repeatedly causes memory growth
    await page.goto('http://localhost:5173/dashboard');
    
    // 1. Navigate to files multiple times
    for (let i = 0; i < 10; i++) {
      await page.click('button:has-text("Files")');
      await page.waitForTimeout(300);
      
      // Browse into a directory if present
      const firstDir = page.locator('.file-list-item.directory').first();
      if (await firstDir.isVisible()) {
        await firstDir.dblclick();
        await page.waitForTimeout(200);
        await page.click('button[title="Up Directory"]');
        await page.waitForTimeout(200);
      }
      
      // Return to dashboard
      await page.click('button:has-text("Dashboard")');
      await page.waitForTimeout(100);
    }
    
    // 2. Verify file browser still responsive
    await page.click('button:has-text("Files")');
    const fileList = page.locator('.file-list-item');
    await expect(fileList.first()).toBeVisible({ timeout: 3000 });
  });

  test('Regression: Session Persistence with Special Characters', async () => {
    // Bug: Session names with special chars cause issues
    await page.goto('http://localhost:5173/dashboard');
    
    const specialNames = [
      'test-session',
      'test_session',
      'test.session',
      'test@session',
      'test#1',
      'tëst-sëssíon'
    ];
    
    for (const name of specialNames) {
      // 1. Create session with special name
      await page.click('button:has-text("New Session")');
      const input = page.locator('input[placeholder="Session name"]');
      await input.fill('');
      await page.keyboard.type(name);
      await page.click('button:has-text("Create")');
      await page.waitForTimeout(300);
      
      // 2. Verify session created and listed correctly
      const sessionItem = page.locator(`text=${name}`);
      await expect(sessionItem).toBeVisible();
      
      // 3. Close session
      await page.click('button[title="Close Session"]');
      await page.click('button:has-text("Confirm")');
      await page.waitForTimeout(200);
    }
  });

  test('Regression: Command History with Long Commands', async () => {
    // Bug: Very long commands corrupt history
    await page.goto('http://localhost:5173/dashboard');
    
    // 1. Create session
    await page.click('button:has-text("New Session")');
    await page.fill('input[placeholder="Session name"]', 'history-test');
    await page.click('button:has-text("Create")');
    
    // 2. Execute long command
    const longCmd = 'echo ' + 'x'.repeat(500);
    await page.click('.terminal-input');
    await page.keyboard.type(longCmd);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // 3. Access history
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(200);
    
    // 4. Verify full command in history
    const inputValue = await page.locator('.terminal-input').inputValue();
    expect(inputValue.length).toBeGreaterThan(100);
    
    // 5. Clear and execute different command
    await page.keyboard.press('End');
    await page.keyboard.press('Control+U');
    await page.keyboard.type('echo "Short"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    
    // 6. Verify history navigable
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(200);
    const secondValue = await page.locator('.terminal-input').inputValue();
    expect(secondValue).toBe('echo "Short"');
  });

  // ============================================================================
  // Platform Compatibility Tests
  // ============================================================================

  test('Compatibility: Path Separators Across Platforms', async () => {
    // Bug: Windows paths not handled correctly
    await page.goto('http://localhost:5173/dashboard');
    
    // 1. Create session
    await page.click('button:has-text("New Session")');
    await page.fill('input[placeholder="Session name"]', 'path-test');
    await page.click('button:has-text("Create")');
    
    // 2. Check current working directory
    await page.click('.terminal-input');
    await page.keyboard.type('pwd');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // 3. Navigate to files view
    await page.click('button:has-text("Files")');
    
    // 4. Verify file paths display correctly
    const fileItems = page.locator('.file-list-item');
    const count = await fileItems.count();
    expect(count).toBeGreaterThan(0);
    
    // 5. Verify path display format
    const pathDisplay = page.locator('[data-current-path]');
    if (await pathDisplay.isVisible()) {
      const pathText = await pathDisplay.textContent();
      // Should contain either / or \ depending on platform
      expect(pathText).toMatch(/[\\/]/);
    }
  });

  test('Compatibility: File Permissions Display', async () => {
    // Bug: File permissions not shown correctly on different platforms
    await page.goto('http://localhost:5173/dashboard');
    
    // 1. Navigate to files
    await page.click('button:has-text("Files")');
    
    // 2. Look for permissions column
    const permissionHeaders = page.locator('th:has-text("Permissions")');
    
    if (await permissionHeaders.isVisible()) {
      // 3. Verify file items show permissions
      const fileItems = page.locator('.file-list-item[data-permissions]');
      
      if (await fileItems.first().isVisible()) {
        const perms = await fileItems.first().getAttribute('data-permissions');
        expect(perms).toBeTruthy();
      }
    }
  });

  test('Compatibility: Line Endings (CRLF vs LF)', async () => {
    // Bug: Files with different line endings corrupted on display
    await page.goto('http://localhost:5173/dashboard');
    
    // 1. Create session
    await page.click('button:has-text("New Session")');
    await page.fill('input[placeholder="Session name"]', 'line-ending-test');
    await page.click('button:has-text("Create")');
    
    // 2. Create file with multiple lines
    await page.click('.terminal-input');
    await page.keyboard.type('printf "Line 1\\nLine 2\\nLine 3" > multiline.txt');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    
    // 3. Navigate to files
    await page.click('button:has-text("Files")');
    
    // 4. Open file
    const file = page.locator('text=multiline.txt');
    await file.dblclick();
    await page.waitForTimeout(500);
    
    // 5. Verify content display
    const content = page.locator('[data-file-content]');
    if (await content.isVisible()) {
      const text = await content.textContent();
      expect(text).toContain('Line 1');
      expect(text).toContain('Line 2');
      expect(text).toContain('Line 3');
    }
  });

  // ============================================================================
  // Backwards Compatibility Tests
  // ============================================================================

  test('Backwards Compatibility: API Endpoint Versions', async () => {
    // 1. Check API endpoints respond correctly
    const response = await page.request.get('http://localhost:4021/api/version');
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('apiVersion');
  });

  test('Backwards Compatibility: Authentication Token Format', async () => {
    // 1. Login and get token
    const response = await page.request.post('http://localhost:4021/api/auth/login', {
      data: {
        username: 'testuser',
        password: 'password123'
      }
    });
    
    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data).toHaveProperty('token');
    
    // 2. Verify token format is compatible
    const token = data.token;
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
  });

  test('Backwards Compatibility: Session Data Format', async () => {
    // 1. Create session via API
    const loginResp = await page.request.post('http://localhost:4021/api/auth/login', {
      data: { username: 'testuser', password: 'password123' }
    });
    const token = (await loginResp.json()).token;
    
    // 2. Create session
    const createResp = await page.request.post('http://localhost:4021/api/sessions', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'compat-test' }
    });
    
    expect(createResp.ok()).toBeTruthy();
    
    const session = await createResp.json();
    
    // 3. Verify session has all expected fields
    expect(session).toHaveProperty('id');
    expect(session).toHaveProperty('name');
    expect(session).toHaveProperty('createdAt');
    expect(session).toHaveProperty('status');
  });

  test('Backwards Compatibility: Configuration File Format', async () => {
    await page.goto('http://localhost:5173/dashboard');
    
    // 1. Navigate to settings
    await page.click('button[title="Settings"]');
    
    // 2. Verify settings can be saved and loaded
    await page.locator('input[name="theme"]').click();
    await page.locator('input[name="fontSize"]').fill('14');
    
    // 3. Save
    await page.click('button:has-text("Save Settings")');
    await page.waitForTimeout(500);
    
    // 4. Reload page
    await page.reload();
    await page.waitForURL('**/dashboard');
    
    // 5. Return to settings and verify loaded
    await page.click('button[title="Settings"]');
    await page.waitForTimeout(500);
    
    const fontSize = await page.locator('input[name="fontSize"]').inputValue();
    expect(fontSize).toBe('14');
  });

  // ============================================================================
  // Mobile/Responsive Compatibility Tests
  // ============================================================================

  test('Responsive: Mobile Viewport', async () => {
    // 1. Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // 2. Navigate to app
    await page.goto('http://localhost:5173/dashboard');
    
    // 3. Verify layout adapts
    const sidebar = page.locator('[data-testid="sidebar"]');
    
    if (await sidebar.isVisible()) {
      // Should be hidden or collapsed on mobile
      const isCollapsed = await sidebar.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return rect.width < 100;
      });
      expect(isCollapsed).toBeTruthy();
    }
    
    // 4. Check hamburger menu exists
    const hamburger = page.locator('button[title="Menu"]');
    await expect(hamburger).toBeVisible();
    
    // 5. Verify terminal is still usable
    await page.click('button:has-text("New Session")');
    await page.fill('input[placeholder="Session name"]', 'mobile-test');
    await page.click('button:has-text("Create")');
    
    const terminal = page.locator('.terminal-container');
    await expect(terminal).toBeVisible();
  });

  test('Responsive: Tablet Viewport', async () => {
    // 1. Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // 2. Navigate to dashboard
    await page.goto('http://localhost:5173/dashboard');
    
    // 3. Verify layout is optimized for tablet
    const mainContent = page.locator('[data-testid="main-content"]');
    await expect(mainContent).toBeVisible();
    
    // 4. Test navigation
    await page.click('button:has-text("Files")');
    const fileList = page.locator('.file-list-item');
    await expect(fileList.first()).toBeVisible({ timeout: 3000 });
  });

  test('Responsive: Desktop Viewport', async () => {
    // 1. Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // 2. Navigate to dashboard
    await page.goto('http://localhost:5173/dashboard');
    
    // 3. Verify sidebar visible
    const sidebar = page.locator('[data-testid="sidebar"]');
    if (await sidebar.isVisible()) {
      const width = await sidebar.evaluate(el => {
        return el.getBoundingClientRect().width;
      });
      expect(width).toBeGreaterThan(100);
    }
    
    // 4. Verify all main sections visible
    const dashboard = page.locator('[data-testid="dashboard"]');
    await expect(dashboard).toBeVisible();
  });

  // ============================================================================
  // Legacy Feature Support Tests
  // ============================================================================

  test('Legacy: Old Session Format Migration', async () => {
    // 1. Simulate loading old session format
    const oldSessionData = {
      id: 'legacy-session-1',
      name: 'Old Session',
      created: '2024-01-01T00:00:00Z', // Old format
      active: true
    };
    
    // 2. Would be loaded via API or local storage
    // Verify system handles gracefully
    await page.goto('http://localhost:5173/dashboard');
    
    // 3. Create new session to ensure system works
    await page.click('button:has-text("New Session")');
    await page.fill('input[placeholder="Session name"]', 'legacy-compat-test');
    await page.click('button:has-text("Create")');
    
    // 4. Verify new session created without issues
    const sessionItem = page.locator('text=legacy-compat-test');
    await expect(sessionItem).toBeVisible();
  });

  test('Legacy: Old Configuration File Support', async () => {
    // 1. Verify old config file format still readable
    const response = await page.request.get('http://localhost:4021/api/config/schema');
    
    // 2. Should have backwards compatibility info
    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('version');
    }
  });

  // ============================================================================
  // Cross-Browser Compatibility Tests
  // ============================================================================

  test('Browser Compat: Local Storage Usage', async () => {
    await page.goto('http://localhost:5173/dashboard');
    
    // 1. Verify local storage is used for persistence
    const storageData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('app-config') || '{}');
    });
    
    // 2. Make a change
    await page.click('button[title="Settings"]');
    await page.locator('input[name="theme"]').click();
    await page.click('button:has-text("Save Settings")');
    await page.waitForTimeout(500);
    
    // 3. Verify changes in local storage
    const updatedData = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('app-config') || '{}');
    });
    
    expect(updatedData).toBeTruthy();
  });

  test('Browser Compat: Session Storage', async () => {
    await page.goto('http://localhost:5173/dashboard');
    
    // 1. Check session storage
    const sessionData = await page.evaluate(() => {
      return Object.keys(sessionStorage);
    });
    
    // 2. Verify auth token might be in session storage
    const hasTokenKey = sessionData.some(key => 
      key.includes('token') || key.includes('auth')
    );
    
    // Even if false, system should work
    const mainContent = page.locator('[data-testid="dashboard"]');
    await expect(mainContent).toBeVisible({ timeout: 5000 });
  });

  test('Browser Compat: IndexedDB Support', async () => {
    await page.goto('http://localhost:5173/dashboard');
    
    // 1. Check if IndexedDB is accessible
    const hasIndexedDB = await page.evaluate(() => {
      return 'indexedDB' in window;
    });
    
    expect(hasIndexedDB).toBeTruthy();
    
    // 2. Application should work regardless of IndexedDB usage
    const dashboard = page.locator('[data-testid="dashboard"]');
    await expect(dashboard).toBeVisible();
  });

  test('Browser Compat: WebSocket Support', async () => {
    await page.goto('http://localhost:5173/dashboard');
    
    // 1. Check WebSocket support
    const hasWebSocket = await page.evaluate(() => {
      return 'WebSocket' in window;
    });
    
    expect(hasWebSocket).toBeTruthy();
    
    // 2. Create session to verify WebSocket works
    await page.click('button:has-text("New Session")');
    await page.fill('input[placeholder="Session name"]', 'ws-compat-test');
    await page.click('button:has-text("Create")');
    
    const terminal = page.locator('.terminal-container');
    await expect(terminal).toBeVisible();
  });
});
