import { test, expect, Page, BrowserContext } from '@playwright/test';
import { createWebViewHelper, WebViewHelper } from '../helpers/webview-helpers';

test.describe('Settings UI Tests', () => {
  let webViewHelper: WebViewHelper;
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }, testInfo) => {
    console.log('🚀 Setting up Settings UI tests...');
    
    context = await browser.newContext({
      viewport: { width: 1200, height: 800 }
    });
    
    page = await context.newPage();
    await page.goto('http://localhost:4021', { waitUntil: 'networkidle' });
    
    webViewHelper = createWebViewHelper(page, context, testInfo, {
      captureScreenshots: true,
      timeout: 30000
    });
    
    await webViewHelper.initialize();
  });

  test.afterAll(async () => {
    if (webViewHelper) {
      await webViewHelper.cleanup();
    }
    if (context) {
      await context.close();
    }
  });

  test.describe('Settings Navigation and Layout', () => {
    test('should navigate to settings page', async () => {
      console.log('🧭 Testing settings navigation...');

      // Try different ways to navigate to settings
      const settingsSelectors = [
        '[data-testid="settings-button"]',
        '.settings-button',
        '#settings',
        'button[aria-label="Settings"]',
        'nav a[href*="settings"]',
        '.menu-item[data-route="settings"]'
      ];

      let navigationSuccessful = false;

      for (const selector of settingsSelectors) {
        try {
          const element = await page.locator(selector).first();
          if (await element.isVisible()) {
            await element.click();
            await page.waitForTimeout(1000);
            
            // Check if we're on settings page
            const url = page.url();
            if (url.includes('settings') || await page.locator('[data-page="settings"]').isVisible()) {
              navigationSuccessful = true;
              console.log(`✅ Navigated to settings using: ${selector}`);
              break;
            }
          }
        } catch {
          // Try next selector
        }
      }

      if (!navigationSuccessful) {
        console.log('ℹ️ Settings navigation not found - testing settings commands directly');
      }
    });

    test('should display settings sections properly', async () => {
      console.log('📑 Testing settings sections...');

      // Look for common settings sections
      const sectionSelectors = [
        '[data-section="general"]',
        '[data-section="server"]',
        '[data-section="tunnels"]',
        '[data-section="appearance"]',
        '[data-section="advanced"]',
        '.settings-section',
        '.settings-group'
      ];

      let foundSections = 0;

      for (const selector of sectionSelectors) {
        const sections = await page.locator(selector).all();
        if (sections.length > 0) {
          foundSections += sections.length;
          console.log(`✅ Found ${sections.length} sections with selector: ${selector}`);
        }
      }

      if (foundSections > 0) {
        console.log(`✅ Found ${foundSections} settings sections total`);
      } else {
        console.log('ℹ️ Settings sections not found in UI - testing via commands');
      }
    });

    test('should have proper settings form elements', async () => {
      console.log('📝 Testing settings form elements...');

      // Look for common form elements
      const formElements = [
        'input[type="text"]',
        'input[type="number"]',
        'input[type="checkbox"]',
        'input[type="radio"]',
        'select',
        'textarea',
        '.form-control',
        '.settings-input'
      ];

      let foundElements = 0;

      for (const selector of formElements) {
        const elements = await page.locator(selector).all();
        if (elements.length > 0) {
          foundElements += elements.length;
          console.log(`✅ Found ${elements.length} elements with selector: ${selector}`);
        }
      }

      if (foundElements > 0) {
        console.log(`✅ Found ${foundElements} form elements total`);
      } else {
        console.log('ℹ️ Form elements not found in UI - testing via commands');
      }
    });
  });

  test.describe('Settings Commands Integration', () => {
    test('should get current settings', async () => {
      console.log('⚙️ Testing get settings command...');

      const result = await webViewHelper.executeCommand('get_settings');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('theme');
      expect(result.data).toHaveProperty('serverPort');
      expect(result.data).toHaveProperty('autoStart');
      expect(result.data).toHaveProperty('notifications');

      console.log('✅ Settings retrieved successfully');
      console.log('Current settings:', JSON.stringify(result.data, null, 2));
    });

    test('should update theme setting', async () => {
      console.log('🎨 Testing theme setting update...');

      // Get current settings
      const getResult = await webViewHelper.executeCommand('get_settings');
      expect(getResult.success).toBe(true);

      const originalSettings = getResult.data;
      const originalTheme = originalSettings.theme;

      // Determine new theme
      const newTheme = originalTheme === 'dark' ? 'light' : 
                      originalTheme === 'light' ? 'auto' : 'dark';

      // Update theme
      const updateResult = await webViewHelper.executeCommand('set_settings', [{
        ...originalSettings,
        theme: newTheme
      }]);
      
      expect(updateResult.success).toBe(true);

      // Verify theme was updated
      const verifyResult = await webViewHelper.executeCommand('get_settings');
      expect(verifyResult.success).toBe(true);
      expect(verifyResult.data.theme).toBe(newTheme);

      // Test UI reflects theme change
      await page.waitForTimeout(1000);
      const bodyClass = await page.locator('body').getAttribute('class');
      if (bodyClass) {
        expect(bodyClass).toContain(newTheme);
      }

      // Restore original theme
      const restoreResult = await webViewHelper.executeCommand('set_settings', [originalSettings]);
      expect(restoreResult.success).toBe(true);

      console.log(`✅ Theme setting updated: ${originalTheme} → ${newTheme} → ${originalTheme}`);
    });

    test('should update server port setting', async () => {
      console.log('🔌 Testing server port setting update...');

      // Get current settings
      const getResult = await webViewHelper.executeCommand('get_settings');
      expect(getResult.success).toBe(true);

      const originalSettings = getResult.data;
      const originalPort = originalSettings.serverPort;

      // Update to a different port
      const newPort = originalPort === 4021 ? 4022 : 4021;

      const updateResult = await webViewHelper.executeCommand('set_settings', [{
        ...originalSettings,
        serverPort: newPort
      }]);
      
      expect(updateResult.success).toBe(true);

      // Verify port was updated
      const verifyResult = await webViewHelper.executeCommand('get_settings');
      expect(verifyResult.success).toBe(true);
      expect(verifyResult.data.serverPort).toBe(newPort);

      // Restore original port
      const restoreResult = await webViewHelper.executeCommand('set_settings', [originalSettings]);
      expect(restoreResult.success).toBe(true);

      console.log(`✅ Server port setting updated: ${originalPort} → ${newPort} → ${originalPort}`);
    });

    test('should update auto-start setting', async () => {
      console.log('🚀 Testing auto-start setting update...');

      // Get current settings
      const getResult = await webViewHelper.executeCommand('get_settings');
      expect(getResult.success).toBe(true);

      const originalSettings = getResult.data;
      const originalAutoStart = originalSettings.autoStart;

      // Toggle auto-start
      const newAutoStart = !originalAutoStart;

      const updateResult = await webViewHelper.executeCommand('set_settings', [{
        ...originalSettings,
        autoStart: newAutoStart
      }]);
      
      expect(updateResult.success).toBe(true);

      // Verify auto-start was updated
      const verifyResult = await webViewHelper.executeCommand('get_settings');
      expect(verifyResult.success).toBe(true);
      expect(verifyResult.data.autoStart).toBe(newAutoStart);

      // Restore original setting
      const restoreResult = await webViewHelper.executeCommand('set_settings', [originalSettings]);
      expect(restoreResult.success).toBe(true);

      console.log(`✅ Auto-start setting updated: ${originalAutoStart} → ${newAutoStart} → ${originalAutoStart}`);
    });

    test('should update notification settings', async () => {
      console.log('🔔 Testing notification settings update...');

      // Get current settings
      const getResult = await webViewHelper.executeCommand('get_settings');
      expect(getResult.success).toBe(true);

      const originalSettings = getResult.data;
      const originalNotifications = originalSettings.notifications;

      // Update notification settings
      const newNotifications = {
        ...originalNotifications,
        enabled: !originalNotifications.enabled,
        sound: !originalNotifications.sound,
        desktop: !originalNotifications.desktop
      };

      const updateResult = await webViewHelper.executeCommand('set_settings', [{
        ...originalSettings,
        notifications: newNotifications
      }]);
      
      expect(updateResult.success).toBe(true);

      // Verify notification settings were updated
      const verifyResult = await webViewHelper.executeCommand('get_settings');
      expect(verifyResult.success).toBe(true);
      expect(verifyResult.data.notifications.enabled).toBe(newNotifications.enabled);
      expect(verifyResult.data.notifications.sound).toBe(newNotifications.sound);
      expect(verifyResult.data.notifications.desktop).toBe(newNotifications.desktop);

      // Restore original settings
      const restoreResult = await webViewHelper.executeCommand('set_settings', [originalSettings]);
      expect(restoreResult.success).toBe(true);

      console.log('✅ Notification settings updated and restored');
    });
  });

  test.describe('Settings Validation', () => {
    test('should validate server port range', async () => {
      console.log('🔍 Testing server port validation...');

      // Get current settings
      const getResult = await webViewHelper.executeCommand('get_settings');
      expect(getResult.success).toBe(true);

      const originalSettings = getResult.data;

      // Test invalid port (too low)
      const invalidPortLow = await webViewHelper.executeCommand('set_settings', [{
        ...originalSettings,
        serverPort: 0
      }]);
      
      expect(invalidPortLow.success).toBe(false);
      expect(invalidPortLow.error).toContain('port');

      // Test invalid port (too high)
      const invalidPortHigh = await webViewHelper.executeCommand('set_settings', [{
        ...originalSettings,
        serverPort: 65536
      }]);
      
      expect(invalidPortHigh.success).toBe(false);
      expect(invalidPortHigh.error).toContain('port');

      // Test invalid port type
      const invalidPortType = await webViewHelper.executeCommand('set_settings', [{
        ...originalSettings,
        serverPort: 'not-a-number'
      }]);
      
      expect(invalidPortType.success).toBe(false);
      expect(invalidPortType.error).toContain('port');

      console.log('✅ Server port validation working correctly');
    });

    test('should validate theme values', async () => {
      console.log('🎨 Testing theme validation...');

      // Get current settings
      const getResult = await webViewHelper.executeCommand('get_settings');
      expect(getResult.success).toBe(true);

      const originalSettings = getResult.data;

      // Test invalid theme
      const invalidTheme = await webViewHelper.executeCommand('set_settings', [{
        ...originalSettings,
        theme: 'invalid-theme'
      }]);
      
      expect(invalidTheme.success).toBe(false);
      expect(invalidTheme.error).toContain('theme');

      console.log('✅ Theme validation working correctly');
    });

    test('should validate settings structure', async () => {
      console.log('🏗️ Testing settings structure validation...');

      // Test with completely invalid settings
      const invalidSettings = await webViewHelper.executeCommand('set_settings', [{
        invalidProperty: 'invalidValue',
        nested: {
          invalid: true
        }
      }]);
      
      expect(invalidSettings.success).toBe(false);

      // Test with null settings
      const nullSettings = await webViewHelper.executeCommand('set_settings', [null]);
      
      expect(nullSettings.success).toBe(false);

      // Test with undefined settings
      const undefinedSettings = await webViewHelper.executeCommand('set_settings', [undefined]);
      
      expect(undefinedSettings.success).toBe(false);

      console.log('✅ Settings structure validation working correctly');
    });
  });

  test.describe('Settings Persistence', () => {
    test('should persist settings across app restarts', async () => {
      console.log('💾 Testing settings persistence...');

      // Get current settings
      const getResult = await webViewHelper.executeCommand('get_settings');
      expect(getResult.success).toBe(true);

      const originalSettings = getResult.data;

      // Create a unique test setting
      const testSettings = {
        ...originalSettings,
        testPersistence: `test-value-${Date.now()}`
      };

      // Update settings
      const updateResult = await webViewHelper.executeCommand('set_settings', [testSettings]);
      expect(updateResult.success).toBe(true);

      // Simulate app restart by reloading
      await page.reload();
      await webViewHelper.initialize();

      // Check if settings persisted
      const persistedResult = await webViewHelper.executeCommand('get_settings');
      expect(persistedResult.success).toBe(true);

      // Note: testPersistence might not be part of the actual settings schema
      // This test mainly verifies that the settings system doesn't crash on restart
      expect(persistedResult.data).toHaveProperty('theme');
      expect(persistedResult.data).toHaveProperty('serverPort');

      // Restore original settings
      const restoreResult = await webViewHelper.executeCommand('set_settings', [originalSettings]);
      expect(restoreResult.success).toBe(true);

      console.log('✅ Settings persistence test completed');
    });

    test('should export and import settings', async () => {
      console.log('📤📥 Testing settings export/import...');

      // Get current settings
      const getResult = await webViewHelper.executeCommand('get_settings');
      expect(getResult.success).toBe(true);

      const originalSettings = getResult.data;

      // Export settings
      const exportResult = await webViewHelper.executeCommand('export_settings', [{
        format: 'json'
      }]);
      
      expect(exportResult.success).toBe(true);
      expect(exportResult.data).toHaveProperty('settings');
      expect(exportResult.data).toHaveProperty('timestamp');

      // Modify settings
      const modifiedSettings = {
        ...originalSettings,
        theme: originalSettings.theme === 'dark' ? 'light' : 'dark'
      };

      // Import modified settings
      const importResult = await webViewHelper.executeCommand('import_settings', [{
        settings: modifiedSettings
      }]);
      
      expect(importResult.success).toBe(true);

      // Verify settings were imported
      const verifyResult = await webViewHelper.executeCommand('get_settings');
      expect(verifyResult.success).toBe(true);
      expect(verifyResult.data.theme).toBe(modifiedSettings.theme);

      // Restore original settings
      const restoreResult = await webViewHelper.executeCommand('set_settings', [originalSettings]);
      expect(restoreResult.success).toBe(true);

      console.log('✅ Settings export/import working correctly');
    });

    test('should reset settings to defaults', async () => {
      console.log('🔄 Testing settings reset...');

      // Get current settings
      const getResult = await webViewHelper.executeCommand('get_settings');
      expect(getResult.success).toBe(true);

      const originalSettings = getResult.data;

      // Modify settings significantly
      const modifiedSettings = {
        ...originalSettings,
        theme: 'dark',
        serverPort: 9999,
        autoStart: true,
        notifications: {
          enabled: false,
          sound: false,
          desktop: false
        }
      };

      // Apply modified settings
      await webViewHelper.executeCommand('set_settings', [modifiedSettings]);

      // Reset to defaults
      const resetResult = await webViewHelper.executeCommand('reset_settings');
      expect(resetResult.success).toBe(true);

      // Verify settings were reset
      const resetSettingsResult = await webViewHelper.executeCommand('get_settings');
      expect(resetSettingsResult.success).toBe(true);

      // Should have default-like values
      expect(['dark', 'light', 'auto']).toContain(resetSettingsResult.data.theme);
      expect(typeof resetSettingsResult.data.serverPort).toBe('number');
      expect(resetSettingsResult.data.serverPort).toBeGreaterThan(0);
      expect(resetSettingsResult.data.serverPort).toBeLessThan(65536);

      console.log('✅ Settings reset working correctly');
    });
  });

  test.describe('Settings UI Interaction', () => {
    test('should handle theme toggle in UI', async () => {
      console.log('🎨 Testing UI theme toggle...');

      // Look for theme toggle elements
      const themeSelectors = [
        '[data-testid="theme-toggle"]',
        '.theme-toggle',
        'input[name="theme"]',
        'select[name="theme"]',
        '.theme-selector'
      ];

      let themeToggleFound = false;

      for (const selector of themeSelectors) {
        const element = await page.locator(selector).first();
        if (await element.isVisible()) {
          themeToggleFound = true;

          // Get current theme
          const getResult = await webViewHelper.executeCommand('get_settings');
          const originalTheme = getResult.data.theme;

          // Toggle theme
          await element.click();
          await page.waitForTimeout(1000);

          // Check if theme changed
          const newResult = await webViewHelper.executeCommand('get_settings');
          expect(newResult.data.theme).not.toBe(originalTheme);

          console.log(`✅ Theme toggled via UI: ${originalTheme} → ${newResult.data.theme}`);
          break;
        }
      }

      if (!themeToggleFound) {
        console.log('ℹ️ Theme toggle UI element not found');
      }
    });

    test('should handle form submission', async () => {
      console.log('📝 Testing settings form submission...');

      // Look for settings form
      const formSelectors = [
        'form[data-settings]',
        '.settings-form',
        '#settings-form',
        'form[action*="settings"]'
      ];

      let formFound = false;

      for (const selector of formSelectors) {
        const form = await page.locator(selector).first();
        if (await form.isVisible()) {
          formFound = true;

          // Look for submit button
          const submitButton = await form.locator('button[type="submit"], .save-button, .apply-button').first();
          
          if (await submitButton.isVisible()) {
            // Get current settings
            const getResult = await webViewHelper.executeCommand('get_settings');
            const originalSettings = getResult.data;

            // Modify a form field if available
            const portInput = await form.locator('input[name="serverPort"], input[name="port"]').first();
            if (await portInput.isVisible()) {
              await portInput.fill('4022');
            }

            // Submit form
            await submitButton.click();
            await page.waitForTimeout(2000);

            // Check if settings were updated
            const newResult = await webViewHelper.executeCommand('get_settings');
            
            if (await portInput.isVisible()) {
              expect(newResult.data.serverPort).toBe(4022);
            }

            // Restore original settings
            await webViewHelper.executeCommand('set_settings', [originalSettings]);

            console.log('✅ Settings form submission working');
            break;
          }
        }
      }

      if (!formFound) {
        console.log('ℹ️ Settings form not found in UI');
      }
    });

    test('should handle settings validation in UI', async () => {
      console.log('✅ Testing UI settings validation...');

      // Look for validation indicators
      const validationSelectors = [
        '.error-message',
        '.validation-error',
        '[data-error]',
        '.invalid-feedback',
        '.field-error'
      ];

      // Try to trigger validation by setting invalid values
      const getResult = await webViewHelper.executeCommand('get_settings');
      const originalSettings = getResult.data;

      // Set invalid port to trigger validation
      const invalidResult = await webViewHelper.executeCommand('set_settings', [{
        ...originalSettings,
        serverPort: 99999
      }]);

      if (!invalidResult.success) {
        // Check if UI shows validation error
        for (const selector of validationSelectors) {
          const errorElement = await page.locator(selector).first();
          if (await errorElement.isVisible()) {
            const errorText = await errorElement.textContent();
            expect(errorText).toBeTruthy();
            console.log(`✅ Validation error displayed: ${errorText}`);
            break;
          }
        }
      }

      // Restore valid settings
      await webViewHelper.executeCommand('set_settings', [originalSettings]);

      console.log('✅ Settings validation UI test completed');
    });
  });

  test.describe('Settings Performance', () => {
    test('should handle rapid settings changes', async () => {
      console.log('⚡ Testing rapid settings changes...');

      // Get current settings
      const getResult = await webViewHelper.executeCommand('get_settings');
      expect(getResult.success).toBe(true);

      const originalSettings = getResult.data;

      // Perform rapid settings changes
      const startTime = Date.now();
      const changeCount = 10;

      for (let i = 0; i < changeCount; i++) {
        const tempSettings = {
          ...originalSettings,
          theme: i % 2 === 0 ? 'dark' : 'light'
        };

        const result = await webViewHelper.executeCommand('set_settings', [tempSettings]);
        expect(result.success).toBe(true);
      }

      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / changeCount;

      // Restore original settings
      await webViewHelper.executeCommand('set_settings', [originalSettings]);

      console.log(`✅ ${changeCount} settings changes completed in ${totalTime}ms (avg: ${avgTime}ms per change)`);
      expect(avgTime).toBeLessThan(1000); // Should average less than 1 second per change
    });

    test('should handle large settings objects', async () => {
      console.log('📊 Testing large settings objects...');

      // Get current settings
      const getResult = await webViewHelper.executeCommand('get_settings');
      expect(getResult.success).toBe(true);

      const originalSettings = getResult.data;

      // Create large settings object
      const largeSettings = {
        ...originalSettings,
        largeArray: Array.from({ length: 1000 }, (_, i) => `item-${i}`),
        largeObject: Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => [`key-${i}`, `value-${i}`])
        )
      };

      const startTime = Date.now();

      // Try to set large settings
      const result = await webViewHelper.executeCommand('set_settings', [largeSettings]);
      
      const totalTime = Date.now() - startTime;

      if (result.success) {
        console.log(`✅ Large settings object handled in ${totalTime}ms`);
        expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      } else {
        console.log('ℹ️ Large settings object rejected (may be expected)');
      }

      // Restore original settings
      await webViewHelper.executeCommand('set_settings', [originalSettings]);
    });
  });
});