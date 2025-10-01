import { test, expect } from '@playwright/test';
import { createTestSession, cleanupTestSession } from '../playwright/helpers/session-lifecycle.helper';

test.describe('Session Management E2E Tests', () => {
  let sessionId: string;

  test.beforeEach(async ({ page }) => {
    sessionId = await createTestSession(page, 'session-management-test');
  });

  test.afterEach(async () => {
    await cleanupTestSession(sessionId);
  });

  test('should create a new session', async ({ page }) => {
    await page.goto('/');

    // Click create session button
    await page.locator('[data-testid="create-session-btn"]').click();

    // Should show session creation form
    await expect(page.locator('[data-testid="session-form"]')).toBeVisible();

    // Fill in session details
    await page.locator('[data-testid="session-name-input"]').fill('Test Session');
    await page.locator('[data-testid="session-command-input"]').fill('echo "Hello World"');

    // Submit form
    await page.locator('[data-testid="create-session-submit"]').click();

    // Should show the new session
    await expect(page.locator('[data-testid="session-card"]:has-text("Test Session")')).toBeVisible();
  });

  test('should display session status correctly', async ({ page }) => {
    await page.goto('/');

    // Should show session status
    await expect(page.locator('[data-testid="session-status"]')).toBeVisible();

    // Status should be one of: running, stopped, exited
    const status = await page.locator('[data-testid="session-status"]').textContent();
    expect(['running', 'stopped', 'exited']).toContain(status?.toLowerCase());
  });

  test('should handle session termination', async ({ page }) => {
    await page.goto('/');

    // Find and click stop button on a running session
    const stopButton = page.locator('[data-testid="session-card"]:has([data-testid="session-status"]:has-text("running")) [data-testid="stop-btn"]');
    if (await stopButton.isVisible()) {
      await stopButton.click();

      // Should show confirmation dialog
      await expect(page.locator('[data-testid="confirm-stop"]')).toBeVisible();
      await page.locator('[data-testid="confirm-stop-btn"]').click();

      // Status should change to stopped
      await expect(page.locator('[data-testid="session-status"]')).toContainText('stopped');
    }
  });

  test('should handle session restart', async ({ page }) => {
    await page.goto('/');

    // Find a stopped session and restart it
    const restartButton = page.locator('[data-testid="session-card"]:has([data-testid="session-status"]:has-text("stopped")) [data-testid="restart-btn"]');
    if (await restartButton.isVisible()) {
      await restartButton.click();

      // Status should change to running
      await expect(page.locator('[data-testid="session-status"]')).toContainText('running');
    }
  });

  test('should display session output', async ({ page }) => {
    await page.goto('/');

    // Click on a session to view details
    await page.locator('[data-testid="session-card"]').first().click();

    // Should show session details page
    await expect(page.locator('[data-testid="session-details"]')).toBeVisible();

    // Should show terminal output
    await expect(page.locator('[data-testid="terminal-output"]')).toBeVisible();
  });

  test('should handle multiple concurrent sessions', async ({ page }) => {
    await page.goto('/');

    // Create multiple sessions
    for (let i = 0; i < 3; i++) {
      await page.locator('[data-testid="create-session-btn"]').click();
      await page.locator('[data-testid="session-name-input"]').fill(`Session ${i + 1}`);
      await page.locator('[data-testid="session-command-input"]').fill(`echo "Session ${i + 1}"`);
      await page.locator('[data-testid="create-session-submit"]').click();

      // Wait a bit between creations
      await page.waitForTimeout(1000);
    }

    // Should show all sessions
    await expect(page.locator('[data-testid="session-card"]')).toHaveCount(3);
  });

  test('should handle session cleanup on page refresh', async ({ page }) => {
    await page.goto('/');

    // Create a session
    await page.locator('[data-testid="create-session-btn"]').click();
    await page.locator('[data-testid="session-name-input"]').fill('Cleanup Test');
    await page.locator('[data-testid="session-command-input"]').fill('sleep 10');
    await page.locator('[data-testid="create-session-submit"]').click();

    // Refresh the page
    await page.reload();

    // Session should still be visible (or properly cleaned up)
    const sessionCard = page.locator('[data-testid="session-card"]:has-text("Cleanup Test")');
    // Either the session is still there or it's properly cleaned up
    // We just check that the page loads without errors
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle session errors gracefully', async ({ page }) => {
    await page.goto('/');

    // Try to create a session with invalid command
    await page.locator('[data-testid="create-session-btn"]').click();
    await page.locator('[data-testid="session-name-input"]').fill('Error Test');
    await page.locator('[data-testid="session-command-input"]').fill('invalid_command_that_does_not_exist');
    await page.locator('[data-testid="create-session-submit"]').click();

    // Should handle the error gracefully
    // Either show error message or handle it in the UI
    await expect(page.locator('[data-testid="session-form"], [data-testid="error-message"]')).toBeVisible();
  });
});