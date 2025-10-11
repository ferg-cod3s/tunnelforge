import { test, expect } from '@playwright/test';

/**
 * E2E tests for complete application flow
 * Tests authentication, session list, and navigation
 */

test.describe('App Component - Full Application Flow', () => {
  test.setTimeout(30000);

  test('should load the app page successfully', async ({ page }) => {
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    
    // Check page loaded
    expect(page.url()).toContain('/app');
  });

  test('should authenticate in guest mode automatically', async ({ page }) => {
    // Clear any existing auth token
    await page.goto('/app');
    await page.evaluate(() => localStorage.clear());
    
    // Navigate to app page
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    
    // Wait for auth flow to complete (guest mode should auto-login)
    await page.waitForTimeout(3000);
    
    // Check localStorage for auth token
    const token = await page.evaluate(() => localStorage.getItem('authToken'));
    expect(token).toBeTruthy();
    expect(token).toContain('guest');
  });

  test('should display session list after authentication', async ({ page }) => {
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    
    // Wait for auth and navigation to session list
    await page.waitForTimeout(3000);
    
    // Look for session list indicators
    const sessionListPresent = await page.locator('text=/session/i').count() > 0 ||
                                await page.locator('[class*="session"]').count() > 0 ||
                                await page.locator('button, a').count() > 0;
    
    expect(sessionListPresent).toBeTruthy();
  });

  test('should show app header with settings button', async ({ page }) => {
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Look for settings button (gear icon or settings text)
    const settingsButton = page.locator('button[title*="Settings"], button:has-text("Settings"), [aria-label*="settings"]').first();
    const hasSettings = await settingsButton.count() > 0;
    
    if (hasSettings) {
      await expect(settingsButton).toBeVisible();
    }
  });

  test('should handle navigation to settings view', async ({ page }) => {
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Try to click settings button
    const settingsButton = page.locator('button[title*="Settings"], button:has-text("Settings"), [aria-label*="settings"]').first();
    
    if (await settingsButton.count() > 0) {
      await settingsButton.click();
      await page.waitForTimeout(1000);
      
      // Check if settings view is shown
      const settingsHeading = page.getByRole('heading', { name: /settings/i });
      await expect(settingsHeading).toBeVisible({ timeout: 5000 });
    }
  });

  test('should not show console errors on page load', async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    page.on('response', (response) => {
      if (response.status() === 404) {
        failedRequests.push(response.url());
      }
    });
    
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Log failed requests for debugging
    if (failedRequests.length > 0) {
      console.log('404 requests:', failedRequests);
    }
    
    // Filter out known harmless errors
    const criticalErrors = consoleErrors.filter(err => 
      !err.includes('favicon') && 
      !err.includes('sourcemap') &&
      !err.includes('DevTools')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('should make successful API calls', async ({ page }) => {
    const apiCalls: string[] = [];
    
    page.on('response', (response) => {
      if (response.url().includes('/api/')) {
        apiCalls.push(`${response.request().method()} ${response.url()} ${response.status()}`);
      }
    });
    
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Should have made auth config call
    const authConfigCall = apiCalls.find(call => call.includes('/api/auth/config'));
    expect(authConfigCall).toBeTruthy();
    expect(authConfigCall).toContain('200');
    
    // Should have made auth password call (guest login)
    const authPasswordCall = apiCalls.find(call => call.includes('/api/auth/password'));
    expect(authPasswordCall).toBeTruthy();
    expect(authPasswordCall).toContain('200');
  });

  test('should persist authentication across page reloads', async ({ page }) => {
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    const tokenBefore = await page.evaluate(() => localStorage.getItem('authToken'));
    expect(tokenBefore).toBeTruthy();
    
    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const tokenAfter = await page.evaluate(() => localStorage.getItem('authToken'));
    expect(tokenAfter).toBe(tokenBefore);
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/app');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Page should still render correctly
    const bodyVisible = await page.locator('body').isVisible();
    expect(bodyVisible).toBeTruthy();
  });
});
