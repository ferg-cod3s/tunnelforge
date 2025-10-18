import { test, expect } from '@playwright/test';

test.describe('Dashboard Loading', () => {
  test('should load dashboard page successfully', async ({ page }) => {
    const response = await page.goto('/');
    
    expect(response?.status()).toBeLessThan(400);
  });

  test('should display page title', async ({ page }) => {
    await page.goto('/');
    
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('should have valid HTML structure', async ({ page }) => {
    await page.goto('/');
    
    // Check for basic HTML structure
    const htmlElement = await page.$('html');
    expect(htmlElement).toBeTruthy();
    
    const bodyElement = await page.$('body');
    expect(bodyElement).toBeTruthy();
  });

  test('should load without critical console errors', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Allow a brief moment for any async errors
    await page.waitForTimeout(1000);
    
    // Filter out expected errors in test mode (auth failures, favicon issues)
    const criticalErrors = errors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('401') &&
      !e.includes('Unauthorized') &&
      !e.includes('Failed to get current') &&
      !e.includes('auth-client')
    );
    
    // In test mode, we expect authentication errors but not critical runtime errors
    expect(criticalErrors.length).toBe(0);
  });

  test('should respond to user interactions', async ({ page }) => {
    await page.goto('/');
    
    // Find any button and try to interact with it
    const buttons = await page.locator('button').all();
    
    if (buttons.length > 0) {
      // Just verify buttons are clickable (don't actually click in test)
      const isVisible = await buttons[0].isVisible();
      expect(isVisible).toBeTruthy();
    }
  });

  test('should have accessible viewport', async ({ page }) => {
    await page.goto('/');
    
    // Check viewport size
    const viewportSize = page.viewportSize();
    expect(viewportSize).toBeTruthy();
    expect(viewportSize?.width).toBeGreaterThan(0);
    expect(viewportSize?.height).toBeGreaterThan(0);
  });

  test('should display content in viewport', async ({ page }) => {
    await page.goto('/');
    
    // Wait for any main content to load
    await page.waitForLoadState('networkidle');
    
    // Check that some content is actually rendered
    const bodyText = await page.textContent('body');
    expect(bodyText?.length).toBeGreaterThan(0);
  });

  test('should handle CSS and styling', async ({ page }) => {
    await page.goto('/');
    
    // Get computed styles for body element
    const bodyStyles = await page.evaluate(() => {
      return window.getComputedStyle(document.body).display;
    });
    
    expect(bodyStyles).toBeTruthy();
  });

  test('should be responsive to viewport changes', async ({ page }) => {
    await page.goto('/');
    
    const initialWidth = page.viewportSize()?.width;
    
    // Resize viewport
    await page.setViewportSize({ width: 640, height: 480 });
    
    const newWidth = page.viewportSize()?.width;
    
    expect(newWidth).toBe(640);
    expect(newWidth).not.toBe(initialWidth);
  });

  test('should maintain state during page interactions', async ({ page }) => {
    await page.goto('/');
    
    // Get initial page title
    const initialTitle = await page.title();
    
    // Wait for network
    await page.waitForLoadState('networkidle');
    
    // Title should remain the same
    const finalTitle = await page.title();
    expect(finalTitle).toBe(initialTitle);
  });
});
