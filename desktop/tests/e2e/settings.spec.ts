/**
 * Settings E2E Tests
 *
 * Comprehensive tests for TunnelForge desktop app settings functionality
 */

import { test, expect } from '@playwright/test';
import { SettingsPage } from '../helpers/settings-page';

test.describe('Settings - Basic Functionality', () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ page }) => {
    // Navigate to the app (adjust URL based on your dev server)
    await page.goto('http://localhost:1420');

    settingsPage = new SettingsPage(page);
  });

  test('should open and close settings window', async ({ page }) => {
    // Open settings
    await settingsPage.open();
    await expect(settingsPage.settingsModal).toBeVisible();

    // Close settings
    await settingsPage.close();
    await expect(settingsPage.settingsModal).not.toBeVisible();
  });

  test('should navigate between settings tabs', async ({ page }) => {
    await settingsPage.open();

    // Test each tab
    await settingsPage.navigateToTab('general');
    await expect(settingsPage.generalTab).toHaveAttribute('aria-selected', 'true');

    await settingsPage.navigateToTab('server');
    await expect(settingsPage.serverTab).toHaveAttribute('aria-selected', 'true');

    await settingsPage.navigateToTab('remote');
    await expect(settingsPage.remoteTab).toHaveAttribute('aria-selected', 'true');

    await settingsPage.navigateToTab('advanced');
    await expect(settingsPage.advancedTab).toHaveAttribute('aria-selected', 'true');
  });

  test('should toggle general settings checkboxes', async ({ page }) => {
    await settingsPage.open();
    await settingsPage.navigateToTab('general');

    // Test auto-start checkbox
    const initialAutoStart = await settingsPage.autoStartCheckbox.isChecked();
    await settingsPage.toggleCheckbox(settingsPage.autoStartCheckbox, !initialAutoStart);

    const newAutoStart = await settingsPage.autoStartCheckbox.isChecked();
    expect(newAutoStart).toBe(!initialAutoStart);

    // Test notifications checkbox
    const initialNotif = await settingsPage.notificationsCheckbox.isChecked();
    await settingsPage.toggleCheckbox(settingsPage.notificationsCheckbox, !initialNotif);

    const newNotif = await settingsPage.notificationsCheckbox.isChecked();
    expect(newNotif).toBe(!initialNotif);
  });

  test('should modify server settings', async ({ page }) => {
    await settingsPage.open();
    await settingsPage.navigateToTab('server');

    // Change port
    await settingsPage.serverPortInput.fill('4025');
    await expect(settingsPage.serverPortInput).toHaveValue('4025');

    // Change host
    await settingsPage.serverHostInput.fill('127.0.0.1');
    await expect(settingsPage.serverHostInput).toHaveValue('127.0.0.1');
  });

  test('should validate server port number', async ({ page }) => {
    await settingsPage.open();
    await settingsPage.navigateToTab('server');

    // Try invalid port
    await settingsPage.serverPortInput.fill('99999');
    await settingsPage.save();

    // Should show validation error
    await expect(page.getByText(/invalid.*port/i)).toBeVisible();
  });

  test('should save settings successfully', async ({ page }) => {
    await settingsPage.open();
    await settingsPage.navigateToTab('general');

    // Make a change
    await settingsPage.toggleCheckbox(settingsPage.autoStartCheckbox, true);

    // Save
    await settingsPage.save();

    // Should show success message
    await expect(page.getByText(/saved|success/i)).toBeVisible({ timeout: 3000 });
  });

  test('should persist settings after save', async ({ page, context }) => {
    await settingsPage.open();
    await settingsPage.navigateToTab('general');

    // Enable auto-start
    await settingsPage.toggleCheckbox(settingsPage.autoStartCheckbox, true);
    await settingsPage.save();

    // Close and reopen settings
    await settingsPage.close();
    await settingsPage.open();
    await settingsPage.navigateToTab('general');

    // Verify setting persisted
    await expect(settingsPage.autoStartCheckbox).toBeChecked();
  });

  test('should configure remote access providers', async ({ page }) => {
    await settingsPage.open();
    await settingsPage.navigateToTab('remote');

    // Test Tailscale checkbox
    await settingsPage.toggleCheckbox(settingsPage.enableTailscaleCheckbox, true);
    await expect(settingsPage.enableTailscaleCheckbox).toBeChecked();

    // Test Cloudflare checkbox
    await settingsPage.toggleCheckbox(settingsPage.enableCloudflareCheckbox, true);
    await expect(settingsPage.enableCloudflareCheckbox).toBeChecked();

    // Test ngrok checkbox
    await settingsPage.toggleCheckbox(settingsPage.enableNgrokCheckbox, true);
    await expect(settingsPage.enableNgrokCheckbox).toBeChecked();
  });

  test('should reset settings to defaults', async ({ page }) => {
    await settingsPage.open();
    await settingsPage.navigateToTab('general');

    // Make changes
    await settingsPage.toggleCheckbox(settingsPage.autoStartCheckbox, true);
    await settingsPage.save();

    // Reset
    await settingsPage.resetButton.click();

    // Confirm reset dialog (if exists)
    const confirmButton = page.getByRole('button', { name: /confirm|yes|reset/i });
    if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmButton.click();
    }

    // Verify reset
    await settingsPage.navigateToTab('general');
    await expect(settingsPage.autoStartCheckbox).not.toBeChecked();
  });

  test('should cancel settings changes', async ({ page }) => {
    await settingsPage.open();
    await settingsPage.navigateToTab('general');

    // Get initial state
    const initialState = await settingsPage.autoStartCheckbox.isChecked();

    // Make changes
    await settingsPage.toggleCheckbox(settingsPage.autoStartCheckbox, !initialState);

    // Cancel
    await settingsPage.close();

    // Reopen and verify changes were discarded
    await settingsPage.open();
    await settingsPage.navigateToTab('general');

    const currentState = await settingsPage.autoStartCheckbox.isChecked();
    expect(currentState).toBe(initialState);
  });
});

test.describe('Settings - Keyboard Navigation', () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420');
    settingsPage = new SettingsPage(page);
    await settingsPage.open();
  });

  test('should navigate tabs with arrow keys', async ({ page }) => {
    // Focus first tab
    await settingsPage.generalTab.focus();

    // Navigate with arrow right
    await page.keyboard.press('ArrowRight');
    await expect(settingsPage.serverTab).toBeFocused();

    // Navigate with arrow left
    await page.keyboard.press('ArrowLeft');
    await expect(settingsPage.generalTab).toBeFocused();
  });

  test('should navigate form elements with Tab key', async ({ page }) => {
    await settingsPage.navigateToTab('general');

    // Focus first element
    await page.keyboard.press('Tab');

    // Verify an element is focused
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });

  test('should toggle checkbox with Space key', async ({ page }) => {
    await settingsPage.navigateToTab('general');

    await settingsPage.autoStartCheckbox.focus();

    const initialState = await settingsPage.autoStartCheckbox.isChecked();

    await page.keyboard.press('Space');

    const newState = await settingsPage.autoStartCheckbox.isChecked();
    expect(newState).toBe(!initialState);
  });

  test('should close settings with Escape key', async ({ page }) => {
    await page.keyboard.press('Escape');

    // Settings should close
    await expect(settingsPage.settingsModal).not.toBeVisible();
  });
});

test.describe('Settings - Accessibility', () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420');
    settingsPage = new SettingsPage(page);
    await settingsPage.open();
  });

  test('should have proper ARIA roles on tabs', async ({ page }) => {
    await expect(settingsPage.generalTab).toHaveAttribute('role', 'tab');
    await expect(settingsPage.serverTab).toHaveAttribute('role', 'tab');
  });

  test('should have aria-selected on active tab', async ({ page }) => {
    await settingsPage.navigateToTab('general');
    await expect(settingsPage.generalTab).toHaveAttribute('aria-selected', 'true');
  });

  test('should have accessible labels on form inputs', async ({ page }) => {
    await settingsPage.navigateToTab('server');

    // Port input should have label
    const portLabel = await settingsPage.serverPortInput.getAttribute('aria-label') ||
                     await settingsPage.serverPortInput.getAttribute('aria-labelledby');
    expect(portLabel).toBeTruthy();

    // Host input should have label
    const hostLabel = await settingsPage.serverHostInput.getAttribute('aria-label') ||
                      await settingsPage.serverHostInput.getAttribute('aria-labelledby');
    expect(hostLabel).toBeTruthy();
  });

  test('should have visible focus indicators', async ({ page }) => {
    await settingsPage.generalTab.focus();

    const focusStyle = await settingsPage.generalTab.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        outline: style.outline,
        boxShadow: style.boxShadow,
      };
    });

    // Should have visible focus indicator
    const hasFocus = focusStyle.outline !== 'none' || focusStyle.boxShadow !== 'none';
    expect(hasFocus).toBeTruthy();
  });
});

test.describe('Settings - Validation', () => {
  let settingsPage: SettingsPage;

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420');
    settingsPage = new SettingsPage(page);
    await settingsPage.open();
  });

  test('should validate port number range', async ({ page }) => {
    await settingsPage.navigateToTab('server');

    const invalidPorts = ['0', '99999', '-1', 'abc'];

    for (const port of invalidPorts) {
      await settingsPage.serverPortInput.fill(port);
      await settingsPage.save();

      // Should show validation error
      const error = page.getByText(/invalid|port|range/i);
      await expect(error).toBeVisible({ timeout: 2000 });
    }
  });

  test('should show inline validation errors', async ({ page }) => {
    await settingsPage.navigateToTab('server');

    await settingsPage.serverPortInput.fill('99999');
    await settingsPage.serverPortInput.blur();

    // Should show error near input
    const errorMessage = page.locator('[role="alert"]').first();
    await expect(errorMessage).toBeVisible({ timeout: 2000 });
  });

  test('should clear validation errors when fixed', async ({ page }) => {
    await settingsPage.navigateToTab('server');

    // Create error
    await settingsPage.serverPortInput.fill('99999');
    await settingsPage.serverPortInput.blur();

    // Fix error
    await settingsPage.serverPortInput.fill('4020');
    await settingsPage.serverPortInput.blur();

    // Error should clear
    const errorMessage = page.locator('[role="alert"]').first();
    await expect(errorMessage).not.toBeVisible();
  });
});
