/**
 * Settings HTML UI Tests
 *
 * Tests the settings UI directly by loading the HTML file,
 * without requiring the full Tauri application to be running.
 * This allows fast, reliable UI testing.
 */

import { test, expect } from '@playwright/test';
import { SettingsPage } from '../helpers/settings-page';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the current directory in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test.describe('Settings UI - HTML Tests', () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ page }) => {
    // Navigate to the HTML file using absolute file path
    const htmlPath = join(__dirname, '../../dist/index.html');
    await page.goto(`file://${htmlPath}`);
    settingsPage = new SettingsPage(page);

    // Wait for the page to be fully loaded
    await page.waitForLoadState('networkidle');
  });

  test.describe('Page Structure', () => {
    test('should load the settings UI', async ({ page }) => {
      await expect(page.locator('h1:has-text("TunnelForge Desktop")')).toBeVisible();
      await expect(page.locator('.main-content')).toBeVisible();
      await expect(page.locator('.sidebar')).toBeVisible();
    });

    test('should display all navigation tabs', async ({ page }) => {
      await expect(settingsPage.generalTab).toBeVisible();
      await expect(settingsPage.notificationsTab).toBeVisible();
      await expect(settingsPage.powerTab).toBeVisible();
      await expect(settingsPage.integrationsTab).toBeVisible();
      await expect(settingsPage.serverTab).toBeVisible();
    });

    test('should show general tab by default', async ({ page }) => {
      const generalPanel = page.locator('#general');
      await expect(generalPanel).toBeVisible();
      await expect(generalPanel).toHaveClass(/active/);
    });
  });

  test.describe('Tab Navigation', () => {
    test('should navigate between tabs', async ({ page }) => {
      // Start on general tab
      await expect(page.locator('#general')).toHaveClass(/active/);

      // Navigate to notifications tab
      await settingsPage.navigateToTab('notifications');
      await expect(page.locator('#notifications')).toBeVisible();

      // Navigate to power tab
      await settingsPage.navigateToTab('power');
      await expect(page.locator('#power')).toBeVisible();

      // Navigate to integrations tab
      await settingsPage.navigateToTab('integrations');
      await expect(page.locator('#integrations')).toBeVisible();

      // Navigate to server tab
      await settingsPage.navigateToTab('server');
      await expect(page.locator('#server')).toBeVisible();
    });

    test('should highlight active tab', async ({ page }) => {
      await settingsPage.navigateToTab('notifications');
      await expect(settingsPage.notificationsTab).toHaveClass(/active/);
    });
  });

  test.describe('General Settings', () => {
    test.beforeEach(async () => {
      await settingsPage.navigateToTab('general');
    });

    test('should display all general settings controls', async ({ page }) => {
      await expect(settingsPage.autoStartCheckbox).toBeVisible();
      await expect(settingsPage.showInDockCheckbox).toBeVisible();
      await expect(settingsPage.serverPortInput).toBeVisible();
      await expect(settingsPage.accessModeSelect).toBeVisible();
    });

    test('should toggle auto-start checkbox', async () => {
      const initialState = await settingsPage.autoStartCheckbox.isChecked();
      await settingsPage.autoStartCheckbox.click();
      const newState = await settingsPage.autoStartCheckbox.isChecked();
      expect(newState).toBe(!initialState);
    });

    test('should accept valid server port', async () => {
      await settingsPage.setServerPort(4021);
      const port = await settingsPage.getServerPort();
      expect(port).toBe('4021');
    });

    test('should change access mode', async () => {
      await settingsPage.setAccessMode('network');
      const mode = await settingsPage.getAccessMode();
      expect(mode).toBe('network');
    });
  });

  test.describe('Notification Settings', () => {
    test.beforeEach(async () => {
      await settingsPage.navigateToTab('notifications');
    });

    test('should display notification controls', async () => {
      await expect(settingsPage.notificationsEnabledCheckbox).toBeVisible();
      await expect(settingsPage.testNotificationButton).toBeVisible();
    });

    test('should show notification options when enabled', async ({ page }) => {
      // Enable notifications
      await settingsPage.toggleCheckbox(settingsPage.notificationsEnabledCheckbox, true);

      // Check that additional options are visible
      await expect(settingsPage.notificationSoundCheckbox).toBeVisible();
      await expect(settingsPage.sessionStartNotificationCheckbox).toBeVisible();
      await expect(settingsPage.sessionEndNotificationCheckbox).toBeVisible();
      await expect(settingsPage.errorNotificationCheckbox).toBeVisible();
    });
  });

  test.describe('Power Management', () => {
    test.beforeEach(async () => {
      await settingsPage.navigateToTab('power');
    });

    test('should display power management controls', async () => {
      await expect(settingsPage.preventSleepCheckbox).toBeVisible();
      await expect(settingsPage.powerMonitoringCheckbox).toBeVisible();
    });

    test('should toggle prevent sleep option', async () => {
      const initialState = await settingsPage.preventSleepCheckbox.isChecked();
      await settingsPage.preventSleepCheckbox.click();
      const newState = await settingsPage.preventSleepCheckbox.isChecked();
      expect(newState).toBe(!initialState);
    });
  });

  test.describe('Integration Settings', () => {
    test.beforeEach(async () => {
      await settingsPage.navigateToTab('integrations');
    });

    test('should display integration options', async () => {
      await expect(settingsPage.tailscaleEnabledCheckbox).toBeVisible();
      await expect(settingsPage.cloudflareEnabledCheckbox).toBeVisible();
      await expect(settingsPage.ngrokEnabledCheckbox).toBeVisible();
    });

    test('should show ngrok token field when enabled', async ({ page }) => {
      // Enable ngrok
      await settingsPage.toggleCheckbox(settingsPage.ngrokEnabledCheckbox, true);

      // Token field should become visible
      await expect(settingsPage.ngrokAuthTokenInput).toBeVisible();
    });
  });

  test.describe('Server Management', () => {
    test.beforeEach(async () => {
      await settingsPage.navigateToTab('server');
    });

    test('should display server controls', async () => {
      await expect(settingsPage.stopServerButton).toBeVisible();
      await expect(settingsPage.restartServerButton).toBeVisible();
      await expect(settingsPage.serverStatusText).toBeVisible();
    });

    test('should display server status information', async ({ page }) => {
      const serverInfo = page.locator('.server-info');
      await expect(serverInfo).toBeVisible();

      // Check for status display elements
      await expect(page.locator('#serverStatusText')).toBeVisible();
      await expect(page.locator('#serverPortDisplay')).toBeVisible();
      await expect(page.locator('#serverPID')).toBeVisible();
    });
  });

  test.describe('Actions', () => {
    test('should display action buttons', async ({ page }) => {
      await expect(settingsPage.openWebUILink).toBeVisible();
      await expect(settingsPage.viewLogsLink).toBeVisible();
      await expect(settingsPage.saveButton).toBeVisible();
    });

    test('should have functional save button', async () => {
      await expect(settingsPage.saveButton).toBeEnabled();
      await expect(settingsPage.saveButton).toHaveText(/save/i);
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should navigate tabs with keyboard', async ({ page }) => {
      // Focus on first tab
      await settingsPage.generalTab.focus();

      // Tab through navigation items
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Should be able to activate tabs with Enter/Space
      await settingsPage.notificationsTab.focus();
      await page.keyboard.press('Enter');

      // Notifications panel should be visible
      await expect(page.locator('#notifications')).toBeVisible();
    });

    test('should support Tab key for form navigation', async ({ page }) => {
      await settingsPage.navigateToTab('general');

      // Focus first control
      await settingsPage.autoStartCheckbox.focus();

      // Tab through controls
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => document.activeElement?.id);

      // Should move to next control
      expect(focused).toBeTruthy();
    });
  });

  test.describe('Responsive Design', () => {
    test('should handle mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await expect(page.locator('.main-content')).toBeVisible();
      await expect(settingsPage.generalTab).toBeVisible();
    });

    test('should handle tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await expect(page.locator('.main-content')).toBeVisible();
      await expect(settingsPage.generalTab).toBeVisible();
    });

    test('should handle desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await expect(page.locator('.main-content')).toBeVisible();
      await expect(settingsPage.generalTab).toBeVisible();
    });
  });

  test.describe('Form Validation', () => {
    test('should validate port number range', async ({ page }) => {
      await settingsPage.navigateToTab('general');

      // Try invalid port
      await settingsPage.serverPortInput.fill('999'); // Below minimum
      const isValid = await settingsPage.serverPortInput.evaluate(
        (el: HTMLInputElement) => el.validity.valid
      );

      expect(isValid).toBe(false);
    });

    test('should accept valid port number', async ({ page }) => {
      await settingsPage.navigateToTab('general');

      // Try valid port
      await settingsPage.serverPortInput.fill('4021');
      const isValid = await settingsPage.serverPortInput.evaluate(
        (el: HTMLInputElement) => el.validity.valid
      );

      expect(isValid).toBe(true);
    });
  });
});
