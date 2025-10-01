import { test, expect } from '@playwright/test';

test.describe('TunnelForge Settings Window', () => {
  test.beforeEach(async ({ page }) => {
    // Start the Tauri application
    // This would normally start the actual Tauri app
    // For now, we'll test the web UI directly
    await page.goto('http://localhost:4321');
  });

  test('displays the settings window with all tabs', async ({ page }) => {
    // Check main title
    await expect(page.locator('h1')).toContainText('TunnelForge Settings');

    // Check tab navigation
    await expect(page.locator('text=General')).toBeVisible();
    await expect(page.locator('text=Server')).toBeVisible();
    await expect(page.locator('text=Notifications')).toBeVisible();
    await expect(page.locator('text=Integrations')).toBeVisible();

    // Check action buttons
    await expect(page.locator('text=Save')).toBeVisible();
    await expect(page.locator('text=Close')).toBeVisible();
  });

  test('can switch between tabs', async ({ page }) => {
    // Start on General tab
    await expect(page.locator('text=General')).toHaveClass(/border-b-2/);

    // Switch to Server tab
    await page.click('text=Server');
    await expect(page.locator('text=Server')).toHaveClass(/border-b-2/);

    // Switch to Notifications tab
    await page.click('text=Notifications');
    await expect(page.locator('text=Notifications')).toHaveClass(/border-b-2/);

    // Switch to Integrations tab
    await page.click('text=Integrations');
    await expect(page.locator('text=Integrations')).toHaveClass(/border-b-2/);
  });

  test('can interact with general settings', async ({ page }) => {
    // Check auto start toggle
    const autoStartToggle = page.locator('input[type="checkbox"]').first();
    await expect(autoStartToggle).toBeVisible();

    // Check theme selector
    const themeSelect = page.locator('select');
    await expect(themeSelect).toBeVisible();
    await expect(themeSelect).toHaveValue('system');
  });

  test('can interact with server settings', async ({ page }) => {
    await page.click('text=Server');

    // Check port input
    const portInput = page.locator('input[type="number"]').first();
    await expect(portInput).toBeVisible();
    await expect(portInput).toHaveValue('4021');

    // Test port change
    await portInput.fill('8080');
    await expect(portInput).toHaveValue('8080');
  });

  test('can interact with notification settings', async ({ page }) => {
    await page.click('text=Notifications');

    // Check notification toggles
    const toggles = page.locator('input[type="checkbox"]');
    await expect(toggles).toHaveCount(5); // 5 notification options

    // Test toggling
    const firstToggle = toggles.first();
    await firstToggle.check();
    await expect(firstToggle).toBeChecked();
  });

   test('displays service integrations', async ({ page }) => {
     await page.click('text=Integrations');

     // Check Cloudflare integration
     await expect(page.locator('text=☁️')).toBeVisible();
     await expect(page.locator('text=Cloudflare Quick Tunnels')).toBeVisible();

     // Check ngrok integration
     await expect(page.locator('text=🚇')).toBeVisible();
     await expect(page.locator('text=ngrok Tunnels')).toBeVisible();

     // Check access mode controls
     await expect(page.locator('text=🌐')).toBeVisible();
     await expect(page.locator('text=Access Mode Controls')).toBeVisible();
   });

   test('can configure custom domain', async ({ page }) => {
     await page.click('text=Integrations');

     // Check custom domain input field
     const domainInput = page.locator('input[placeholder*="custom domain"]');
     await expect(domainInput).toBeVisible();

     // Test entering a custom domain
     await domainInput.fill('my-tunnel.example.com');
     await expect(domainInput).toHaveValue('my-tunnel.example.com');

     // Check domain validation (should show valid state)
     await expect(page.locator('text=✅')).toBeVisible();
   });

   test('validates custom domain format', async ({ page }) => {
     await page.click('text=Integrations');

     const domainInput = page.locator('input[placeholder*="custom domain"]');

     // Test invalid domain
     await domainInput.fill('invalid-domain');
     await expect(page.locator('text=❌')).toBeVisible();

     // Test valid domain
     await domainInput.fill('valid.example.com');
     await expect(page.locator('text=✅')).toBeVisible();
   });

  test('can save settings', async ({ page }) => {
    // Mock the save function
    await page.evaluate(() => {
      (window as any).__TAURI__ = {
        invoke: async (cmd: string, payload: any) => {
          if (cmd === 'save_config') {
            return Promise.resolve();
          }
          throw new Error('Unknown command');
        }
      };
    });

    const saveButton = page.locator('text=Save');
    await saveButton.click();

    // Should not throw any errors
  });

  test('handles window close', async ({ page }) => {
    // Mock the close function
    await page.evaluate(() => {
      (window as any).__TAURI__ = {
        invoke: async (cmd: string, payload: any) => {
          if (cmd === 'close_window') {
            return Promise.resolve();
          }
          throw new Error('Unknown command');
        }
      };
    });

    const closeButton = page.locator('text=Close');
    await closeButton.click();

    // Should not throw any errors
  });

  test('displays loading state initially', async ({ page }) => {
    // The page should load without errors
    await expect(page.locator('h1')).toBeVisible();
  });

  test('is responsive on different screen sizes', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('h1')).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('h1')).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('h1')).toBeVisible();
  });
});
