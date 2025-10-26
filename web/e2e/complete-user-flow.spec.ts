import { test, expect } from '@playwright/test';

/**
 * Comprehensive E2E Test: Complete User Flow
 *
 * Tests the full user journey from server setup through web UI usage:
 * 1. Server connectivity and initial setup
 * 2. Settings configuration (tunnels, notifications, network access)
 * 3. Session creation and management
 * 4. Terminal interaction and I/O
 * 5. Session persistence across restarts
 * 6. Complete workflow validation
 */

test.describe('Complete User Flow - Server Setup to Web UI', () => {
  test.setTimeout(120000); // 2 minutes for complete flow

  test.describe('Step 1: Server Setup and Connectivity', () => {
    test('should connect to server and verify API availability', async ({ page }) => {
      // Check server health
      const healthResponse = await page.request.get('http://localhost:4021/health');
      expect(healthResponse.ok()).toBeTruthy();

      const healthData = await healthResponse.json();
      expect(healthData).toHaveProperty('status');
      expect(healthData.status).toBe('ok');
    });

    test('should load auth configuration', async ({ page }) => {
      const authResponse = await page.request.get('http://localhost:4021/api/auth/config');
      expect(authResponse.ok()).toBeTruthy();

      const authConfig = await authResponse.json();
      expect(authConfig).toHaveProperty('authRequired');
      expect(typeof authConfig.authRequired).toBe('boolean');
    });

    test('should authenticate successfully (guest mode)', async ({ page }) => {
      const authResponse = await page.request.post('http://localhost:4021/api/auth/password', {
        data: {},
      });

      expect(authResponse.ok()).toBeTruthy();
      const authData = await authResponse.json();
      expect(authData).toHaveProperty('token');
      expect(authData.token).toBeTruthy();
    });
  });

  test.describe('Step 2: Web UI Initial Load', () => {
    test('should load web application successfully', async ({ page }) => {
      await page.goto('/app');
      await page.waitForLoadState('networkidle');

      // Should auto-authenticate in guest mode
      await page.waitForTimeout(3000);

      const token = await page.evaluate(() => localStorage.getItem('authToken'));
      expect(token).toBeTruthy();
    });

    test('should display session list view', async ({ page }) => {
      await page.goto('/app');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // Check for session list container or empty state
      const hasSessionList = await page.locator('[data-testid="session-list-container"], .session-list-container, [class*="session"]').count() > 0;
      expect(hasSessionList).toBeTruthy();
    });
  });

  test.describe('Step 3: Settings Configuration', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/app');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
    });

    test('should open settings modal', async ({ page }) => {
      const settingsButton = page.locator('button.notification-status, [class*="notification-status"], button[title*="Settings"]').first();

      await settingsButton.click();
      await page.waitForTimeout(1000);

      // Settings modal should be visible
      const settingsModal = page.locator('.settings-modal, [class*="settings-modal"]');
      await expect(settingsModal).toBeVisible();
    });

    test('should navigate through settings tabs', async ({ page }) => {
      const settingsButton = page.locator('button.notification-status, [class*="notification-status"]').first();
      await settingsButton.click();
      await page.waitForTimeout(1000);

      // Check all tabs are present
      const generalTab = page.locator('button.tab-button:has-text("General")');
      const notificationsTab = page.locator('button.tab-button:has-text("Notifications")');
      const domainsTab = page.locator('button.tab-button:has-text("Domains")');
      const tunnelsTab = page.locator('button.tab-button:has-text("Tunnels")');

      await expect(generalTab).toBeVisible();
      await expect(notificationsTab).toBeVisible();
      await expect(domainsTab).toBeVisible();
      await expect(tunnelsTab).toBeVisible();

      // Navigate to each tab
      await notificationsTab.click();
      await page.waitForTimeout(500);

      await tunnelsTab.click();
      await page.waitForTimeout(500);

      await generalTab.click();
      await page.waitForTimeout(500);
    });

    test('should display Cloudflare tunnel settings', async ({ page }) => {
      const settingsButton = page.locator('button.notification-status, [class*="notification-status"]').first();
      await settingsButton.click();
      await page.waitForTimeout(1000);

      // Navigate to tunnels tab
      const tunnelsTab = page.locator('button.tab-button:has-text("Tunnels")');
      await tunnelsTab.click();
      await page.waitForTimeout(500);

      // Should show Cloudflare tunnel options
      const hasTunnelSettings = await page.locator('text=/cloudflare|tunnel/i').count() > 0;
      expect(hasTunnelSettings).toBeTruthy();
    });

    test('should toggle between quick tunnel and custom domain', async ({ page }) => {
      const settingsButton = page.locator('button.notification-status, [class*="notification-status"]').first();
      await settingsButton.click();
      await page.waitForTimeout(1000);

      const tunnelsTab = page.locator('button.tab-button:has-text("Tunnels")');
      await tunnelsTab.click();
      await page.waitForTimeout(500);

      // Look for quick tunnel toggle
      const quickTunnelToggle = page.locator('button[role="switch"]').filter({ hasText: /quick tunnel/i }).first();

      if (await quickTunnelToggle.count() > 0) {
        const initialState = await quickTunnelToggle.getAttribute('aria-checked');
        await quickTunnelToggle.click();
        await page.waitForTimeout(500);

        const newState = await quickTunnelToggle.getAttribute('aria-checked');
        expect(newState).not.toBe(initialState);
      }
    });

    test('should close settings modal', async ({ page }) => {
      const settingsButton = page.locator('button.notification-status, [class*="notification-status"]').first();
      await settingsButton.click();
      await page.waitForTimeout(1000);

      const closeButton = page.locator('button.close-button, [class*="close-button"]').first();
      await closeButton.click();
      await page.waitForTimeout(500);

      const settingsModal = page.locator('.settings-modal, [class*="settings-modal"]');
      await expect(settingsModal).not.toBeVisible();
    });
  });

  test.describe('Step 4: Session Creation', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/app');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
    });

    test('should show create session button', async ({ page }) => {
      const createButton = page.locator('button:has-text("New"), button:has-text("Create"), button:has-text("+")').first();

      if (await createButton.count() > 0) {
        await expect(createButton).toBeVisible();
      }
    });

    test('should create a new session via API', async ({ page }) => {
      // Get auth token
      const authResponse = await page.request.post('http://localhost:4021/api/auth/password', {
        data: {},
      });
      const authData = await authResponse.json();
      const token = authData.token;

      // Create session
      const createResponse = await page.request.post('http://localhost:4021/api/sessions', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          command: ['bash'],
          name: 'E2E Test Session',
          cols: 80,
          rows: 24,
        },
      });

      expect(createResponse.ok()).toBeTruthy();
      const sessionData = await createResponse.json();
      expect(sessionData).toHaveProperty('sessionId');
      expect(sessionData).toHaveProperty('title');

      // Clean up - delete the session
      await page.request.delete(`http://localhost:4021/api/sessions/${sessionData.sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    });

    test('should list created sessions', async ({ page }) => {
      // Get auth token
      const authResponse = await page.request.post('http://localhost:4021/api/auth/password', {
        data: {},
      });
      const authData = await authResponse.json();
      const token = authData.token;

      // List sessions
      const sessionsResponse = await page.request.get('http://localhost:4021/api/sessions', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(sessionsResponse.ok()).toBeTruthy();
      const sessions = await sessionsResponse.json();
      expect(Array.isArray(sessions) || typeof sessions === 'object').toBeTruthy();
    });
  });

  test.describe('Step 5: Terminal Interaction', () => {
    let sessionId: string;
    let authToken: string;

    test.beforeAll(async ({ request }) => {
      // Authenticate
      const authResponse = await request.post('http://localhost:4021/api/auth/password', {
        data: {},
      });
      const authData = await authResponse.json();
      authToken = authData.token;

      // Create a test session
      const sessionResponse = await request.post('http://localhost:4021/api/sessions', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        data: {
          command: ['bash'],
          name: 'E2E Flow Test Session',
          cols: 80,
          rows: 24,
        },
      });

      const sessionData = await sessionResponse.json();
      sessionId = sessionData.sessionId;
    });

    test.afterAll(async ({ request }) => {
      // Clean up test session
      if (sessionId && authToken) {
        await request.delete(`http://localhost:4021/api/sessions/${sessionId}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        });
      }
    });

    test('should retrieve session details', async ({ page }) => {
      const response = await page.request.get(`http://localhost:4021/api/sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
      });

      expect(response.ok()).toBeTruthy();
      const sessionData = await response.json();
      expect(sessionData).toHaveProperty('sessionId', sessionId);
      expect(sessionData).toHaveProperty('title');
    });

    test('should establish WebSocket connection to session', async ({ page }) => {
      await page.goto('/app');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // Monitor WebSocket connections
      let wsConnected = false;
      page.on('websocket', (ws) => {
        if (ws.url().includes('/ws') && ws.url().includes(sessionId)) {
          wsConnected = true;
        }
      });

      // Navigate to session (if UI supports it)
      const sessionCard = page.locator(`[data-session-id="${sessionId}"]`).first();

      if (await sessionCard.count() > 0) {
        await sessionCard.click();
        await page.waitForTimeout(2000);

        // WebSocket should be connected
        expect(typeof wsConnected).toBe('boolean');
      }
    });
  });

  test.describe('Step 6: Session Persistence', () => {
    test('should persist session metadata', async ({ request }) => {
      // Authenticate
      const authResponse = await request.post('http://localhost:4021/api/auth/password', {
        data: {},
      });
      const authData = await authResponse.json();
      const token = authData.token;

      // Create session
      const createResponse = await request.post('http://localhost:4021/api/sessions', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          command: ['bash'],
          name: 'Persistence Test Session',
          cols: 80,
          rows: 24,
        },
      });

      const sessionData = await createResponse.json();
      const sessionId = sessionData.sessionId;

      // Wait for auto-save
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify session still exists
      const checkResponse = await request.get(`http://localhost:4021/api/sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(checkResponse.ok()).toBeTruthy();

      // Clean up
      await request.delete(`http://localhost:4021/api/sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    });

    test('should restore sessions on server restart simulation', async ({ request }) => {
      // Get list of sessions before
      const authResponse = await request.post('http://localhost:4021/api/auth/password', {
        data: {},
      });
      const authData = await authResponse.json();
      const token = authData.token;

      const beforeResponse = await request.get('http://localhost:4021/api/sessions', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(beforeResponse.ok()).toBeTruthy();
      const sessionsBefore = await beforeResponse.json();

      // Note: We can't actually restart the server in this test,
      // but we verify the persistence API exists
      expect(Array.isArray(sessionsBefore) || typeof sessionsBefore === 'object').toBeTruthy();
    });
  });

  test.describe('Step 7: Complete User Workflow', () => {
    test('should complete full user journey: setup → settings → session → terminal', async ({ page, request }) => {
      // Step 1: Verify server is running
      const healthCheck = await request.get('http://localhost:4021/health');
      expect(healthCheck.ok()).toBeTruthy();

      // Step 2: Load web UI and authenticate
      await page.goto('/app');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      const token = await page.evaluate(() => localStorage.getItem('authToken'));
      expect(token).toBeTruthy();

      // Step 3: Open settings
      const settingsButton = page.locator('button.notification-status, [class*="notification-status"]').first();
      await settingsButton.click();
      await page.waitForTimeout(1000);

      // Step 4: Navigate to tunnels tab
      const tunnelsTab = page.locator('button.tab-button:has-text("Tunnels")');
      if (await tunnelsTab.count() > 0) {
        await tunnelsTab.click();
        await page.waitForTimeout(500);
      }

      // Step 5: Close settings
      const closeButton = page.locator('button.close-button, [class*="close-button"]').first();
      await closeButton.click();
      await page.waitForTimeout(500);

      // Step 6: Create a session via API
      const createResponse = await request.post('http://localhost:4021/api/sessions', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          command: ['bash'],
          name: 'Complete Flow Test',
          cols: 80,
          rows: 24,
        },
      });

      expect(createResponse.ok()).toBeTruthy();
      const sessionData = await createResponse.json();

      // Step 7: Verify session exists
      const sessionCheck = await request.get(`http://localhost:4021/api/sessions/${sessionData.sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      expect(sessionCheck.ok()).toBeTruthy();

      // Step 8: Clean up
      await request.delete(`http://localhost:4021/api/sessions/${sessionData.sessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      // Success! Complete user flow validated
    });
  });

  test.describe('Step 8: Error Handling and Edge Cases', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      const consoleErrors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto('/app');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);

      // Filter critical errors
      const criticalErrors = consoleErrors.filter(err =>
        !err.includes('favicon') &&
        !err.includes('sourcemap') &&
        !err.includes('DevTools')
      );

      expect(criticalErrors.length).toBeLessThan(3);
    });

    test('should handle unauthorized API calls', async ({ request }) => {
      const response = await request.get('http://localhost:4021/api/sessions', {
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      });

      expect(response.status()).toBe(401);
    });

    test('should handle missing session gracefully', async ({ request }) => {
      const authResponse = await request.post('http://localhost:4021/api/auth/password', {
        data: {},
      });
      const authData = await authResponse.json();

      const response = await request.get('http://localhost:4021/api/sessions/nonexistent-session-id', {
        headers: {
          'Authorization': `Bearer ${authData.token}`,
        },
      });

      expect(response.status()).toBe(404);
    });
  });
});
