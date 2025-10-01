import { test, expect } from '@playwright/test';

test.describe('Cloudflare Service E2E Tests', () => {
  test('should display Cloudflare tunnel status', async ({ page }) => {
    await page.goto('/settings');

    // Navigate to Cloudflare settings
    await page.locator('[data-testid="cloudflare-tab"]').click();

    // Should show Cloudflare configuration section
    await expect(page.locator('[data-testid="cloudflare-config"]')).toBeVisible();

    // Should show tunnel status
    await expect(page.locator('[data-testid="tunnel-status"]')).toBeVisible();
  });

  test('should handle Cloudflare tunnel creation', async ({ page }) => {
    await page.goto('/settings');

    // Navigate to Cloudflare settings
    await page.locator('[data-testid="cloudflare-tab"]').click();

    // Fill in tunnel configuration
    await page.locator('[data-testid="tunnel-name-input"]').fill('test-tunnel');
    await page.locator('[data-testid="tunnel-port-input"]').fill('4021');

    // Create tunnel
    await page.locator('[data-testid="create-tunnel-btn"]').click();

    // Should show tunnel creation progress
    await expect(page.locator('[data-testid="tunnel-creating"]')).toBeVisible();

    // Should eventually show tunnel as active
    await expect(page.locator('[data-testid="tunnel-status"]:has-text("active")')).toBeVisible();
  });

  test('should handle Cloudflare tunnel deletion', async ({ page }) => {
    await page.goto('/settings');

    // Navigate to Cloudflare settings
    await page.locator('[data-testid="cloudflare-tab"]').click();

    // Find an active tunnel and delete it
    const deleteButton = page.locator('[data-testid="tunnel-card"]:has([data-testid="tunnel-status"]:has-text("active")) [data-testid="delete-tunnel-btn"]');
    if (await deleteButton.isVisible()) {
      await deleteButton.click();

      // Confirm deletion
      await expect(page.locator('[data-testid="confirm-delete-tunnel"]')).toBeVisible();
      await page.locator('[data-testid="confirm-delete-btn"]').click();

      // Tunnel should be removed or show as deleted
      await expect(page.locator('[data-testid="tunnel-card"]:has-text("test-tunnel")')).not.toBeVisible();
    }
  });

  test('should handle custom domain assignment', async ({ page }) => {
    await page.goto('/settings');

    // Navigate to Cloudflare settings
    await page.locator('[data-testid="cloudflare-tab"]').click();

    // Navigate to domains section
    await page.locator('[data-testid="domains-tab"]').click();

    // Add a custom domain
    await page.locator('[data-testid="add-domain-btn"]').click();
    await page.locator('[data-testid="domain-input"]').fill('test.example.com');
    await page.locator('[data-testid="assign-domain-btn"]').click();

    // Should show domain assignment
    await expect(page.locator('[data-testid="domain-list"]:has-text("test.example.com")')).toBeVisible();
  });

  test('should handle domain removal', async ({ page }) => {
    await page.goto('/settings');

    // Navigate to Cloudflare settings
    await page.locator('[data-testid="cloudflare-tab"]').click();

    // Navigate to domains section
    await page.locator('[data-testid="domains-tab"]').click();

    // Remove a domain
    const removeButton = page.locator('[data-testid="domain-list"]:has-text("test.example.com") [data-testid="remove-domain-btn"]');
    if (await removeButton.isVisible()) {
      await removeButton.click();

      // Confirm removal
      await expect(page.locator('[data-testid="confirm-remove-domain"]')).toBeVisible();
      await page.locator('[data-testid="confirm-remove-btn"]').click();

      // Domain should be removed
      await expect(page.locator('[data-testid="domain-list"]:has-text("test.example.com")')).not.toBeVisible();
    }
  });

  test('should handle Cloudflare API errors', async ({ page }) => {
    await page.goto('/settings');

    // Navigate to Cloudflare settings
    await page.locator('[data-testid="cloudflare-tab"]').click();

    // Try to create a tunnel with invalid configuration
    await page.locator('[data-testid="tunnel-name-input"]').fill('invalid-tunnel');
    await page.locator('[data-testid="tunnel-port-input"]').fill('invalid-port');

    // Create tunnel
    await page.locator('[data-testid="create-tunnel-btn"]').click();

    // Should show error message
    await expect(page.locator('[data-testid="tunnel-error"]')).toBeVisible();
  });

  test('should display tunnel metrics', async ({ page }) => {
    await page.goto('/settings');

    // Navigate to Cloudflare settings
    await page.locator('[data-testid="cloudflare-tab"]').click();

    // Navigate to metrics section
    await page.locator('[data-testid="metrics-tab"]').click();

    // Should show tunnel metrics
    await expect(page.locator('[data-testid="tunnel-metrics"]')).toBeVisible();

    // Should show connection count, bandwidth, etc.
    await expect(page.locator('[data-testid="connection-count"]')).toBeVisible();
    await expect(page.locator('[data-testid="bandwidth-usage"]')).toBeVisible();
  });

  test('should handle tunnel configuration updates', async ({ page }) => {
    await page.goto('/settings');

    // Navigate to Cloudflare settings
    await page.locator('[data-testid="cloudflare-tab"]').click();

    // Find an existing tunnel and update its configuration
    const configButton = page.locator('[data-testid="tunnel-card"] [data-testid="edit-config-btn"]');
    if (await configButton.isVisible()) {
      await configButton.click();

      // Update configuration
      await page.locator('[data-testid="tunnel-port-input"]').fill('4022');
      await page.locator('[data-testid="save-config-btn"]').click();

      // Should show success message
      await expect(page.locator('[data-testid="config-saved"]')).toBeVisible();
    }
  });
});