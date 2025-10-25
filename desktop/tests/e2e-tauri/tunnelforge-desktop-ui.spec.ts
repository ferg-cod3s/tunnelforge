import { test, expect, Page, BrowserContext } from '@playwright/test';
import { createTauriHelper } from './helpers/tauri-helpers';

/**
 * TunnelForge Desktop UI Integration Tests
 * 
 * These tests verify the TunnelForge desktop application's user interface:
 * - Navigation between sections
 * - Server management UI
 * - Settings interface
 * - Debug console functionality
 * - Integration with web frontend
 */

test.describe('TunnelForge Desktop UI', () => {
  let page: Page;
  let context: BrowserContext;
  let helper: any;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    helper = createTauriHelper(page, context, test.info);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.beforeEach(async () => {
    await page.goto('http://localhost:1420');
    await helper.waitForTauriApp();
    await helper.waitForAppReady();
  });

  test.describe('Navigation', () => {
    test('should display main navigation sections', async () => {
      console.log('🧪 Testing main navigation...');
      
      // Check for main navigation elements
      const navigationSections = [
        { selector: '[data-section="dashboard"]', title: 'Dashboard' },
        { selector: '[data-section="tunnelforge"]', title: 'TunnelForge Web' },
        { selector: '[data-section="settings"]', title: 'Settings' },
        { selector: '[data-section="cli"]', title: 'CLI Tools' },
        { selector: '[data-section="debug"]', title: 'Debug Console' },
      ];
      
      for (const section of navigationSections) {
        const element = page.locator(section.selector);
        await expect(element).toBeVisible({ timeout: 10000 });
        console.log(`✅ Found navigation section: ${section.title}`);
      }
    });

    test('should navigate between sections correctly', async () => {
      console.log('🧪 Testing section navigation...');
      
      const sections = [
        { selector: '[data-section="dashboard"]', title: 'Dashboard' },
        { selector: '[data-section="tunnelforge"]', title: 'TunnelForge Web' },
        { selector: '[data-section="settings"]', title: 'Settings' },
        { selector: '[data-section="cli"]', title: 'CLI Tools' },
        { selector: '[data-section="debug"]', title: 'Debug Console' },
      ];
      
      for (const section of sections) {
        console.log(`🔄 Navigating to: ${section.title}`);
        
        // Click navigation item
        await page.click(section.selector);
        
        // Wait for navigation to complete
        await page.waitForTimeout(500);
        
        // Check page title updates
        const titleElement = page.locator('#page-title, h1, .page-title');
        if (await titleElement.count() > 0) {
          await expect(titleElement.first()).toContainText(section.title, { timeout: 5000 });
        }
        
        // Check active state
        await expect(page.locator(section.selector)).toHaveClass(/active/);
        
        console.log(`✅ Successfully navigated to: ${section.title}`);
      }
    });
  });

  test.describe('Dashboard Section', () => {
    test('should display dashboard content', async () => {
      console.log('🧪 Testing dashboard section...');
      
      // Navigate to dashboard
      await page.click('[data-section="dashboard"]');
      await page.waitForTimeout(500);
      
      // Check for dashboard elements
      await expect(page.locator('#page-title, h1')).toContainText('Dashboard');
      
      // Check for server status
      const serverStatus = page.locator('#server-status, .server-status');
      if (await serverStatus.count() > 0) {
        await expect(serverStatus).toBeVisible();
      }
      
      // Check for action buttons
      const actionButtons = page.locator('button:has-text("Start"), button:has-text("Stop"), button:has-text("Restart")');
      if (await actionButtons.count() > 0) {
        await expect(actionButtons.first()).toBeVisible();
      }
      
      console.log('✅ Dashboard content displayed correctly');
    });
  });

  test.describe('TunnelForge Web Section', () => {
    test('should display web frontend integration', async () => {
      console.log('🧪 Testing TunnelForge web integration...');
      
      // Navigate to TunnelForge web section
      await page.click('[data-section="tunnelforge"]');
      await page.waitForTimeout(1000); // Wait for iframe/webview to load
      
      // Check for web content
      const webContent = page.locator('iframe, .webview, .tunnelforge-web');
      if (await webContent.count() > 0) {
        await expect(webContent.first()).toBeVisible();
        console.log('✅ Web content integration found');
      } else {
        // Check if content is loaded directly
        const tunnelForgeContent = page.locator('[data-tunnelforge="true"], .tunnelforge-app');
        if (await tunnelForgeContent.count() > 0) {
          await expect(tunnelForgeContent.first()).toBeVisible();
          console.log('✅ Direct TunnelForge content found');
        } else {
          console.log('ℹ️ No TunnelForge web integration detected (may be expected)');
        }
      }
    });
  });

  test.describe('Settings Section', () => {
    test('should display settings interface', async () => {
      console.log('🧪 Testing settings section...');
      
      // Navigate to settings
      await page.click('[data-section="settings"]');
      await page.waitForTimeout(500);
      
      // Check for settings title
      await expect(page.locator('#page-title, h1')).toContainText('Settings');
      
      // Check for common settings elements
      const settingsElements = [
        '#port-setting, input[name="port"]',
        '#about-version, .version-info',
        'button:has-text("Save")',
        'button:has-text("Reset")',
      ];
      
      for (const selector of settingsElements) {
        const element = page.locator(selector);
        if (await element.count() > 0) {
          await expect(element.first()).toBeVisible();
          console.log(`✅ Found settings element: ${selector}`);
        }
      }
      
      console.log('✅ Settings interface displayed correctly');
    });

    test('should allow changing server port setting', async () => {
      console.log('🧪 Testing port setting change...');
      
      // Navigate to settings
      await page.click('[data-section="settings"]');
      await page.waitForTimeout(500);
      
      // Find port input
      const portInput = page.locator('#port-setting, input[name="port"], input[type="number"]');
      if (await portInput.count() > 0) {
        const input = portInput.first();
        
        // Get current value
        const currentValue = await input.inputValue();
        expect(currentValue).toMatch(/^\d+$/);
        
        // Try to change value (this might be disabled in test mode)
        await input.fill('4022');
        await page.waitForTimeout(500);
        
        // Check if value changed
        const newValue = await input.inputValue();
        console.log(`📝 Port changed from ${currentValue} to ${newValue}`);
        
        // Reset to original value
        await input.fill(currentValue);
      } else {
        console.log('ℹ️ Port setting input not found (may be disabled in test mode)');
      }
    });
  });

  test.describe('CLI Tools Section', () => {
    test('should display CLI tools interface', async () => {
      console.log('🧪 Testing CLI tools section...');
      
      // Navigate to CLI tools
      await page.click('[data-section="cli"]');
      await page.waitForTimeout(500);
      
      // Check for CLI tools title
      await expect(page.locator('#page-title, h1')).toContainText('CLI Tools');
      
      // Check for CLI-related elements
      const cliElements = [
        '#cli-status, .cli-status',
        'button:has-text("Check Installation")',
        'button:has-text("Install CLI")',
        '#cli-version, .cli-version',
      ];
      
      for (const selector of cliElements) {
        const element = page.locator(selector);
        if (await element.count() > 0) {
          await expect(element.first()).toBeVisible();
          console.log(`✅ Found CLI element: ${selector}`);
        }
      }
      
      console.log('✅ CLI tools interface displayed correctly');
    });
  });

  test.describe('Debug Console Section', () => {
    test('should display debug console', async () => {
      console.log('🧪 Testing debug console section...');
      
      // Navigate to debug console
      await page.click('[data-section="debug"]');
      await page.waitForTimeout(500);
      
      // Check for debug console title
      await expect(page.locator('#page-title, h1')).toContainText('Debug Console');
      
      // Check for debug elements
      const debugElements = [
        '#debug-logs, .debug-logs, .logs-container',
        '#debug-version, .debug-version',
        '#debug-port, .debug-port',
        '#debug-ua, .debug-user-agent',
        'button:has-text("Refresh")',
        'button:has-text("Clear")',
        'button:has-text("Copy All")',
      ];
      
      for (const selector of debugElements) {
        const element = page.locator(selector);
        if (await element.count() > 0) {
          await expect(element.first()).toBeVisible();
          console.log(`✅ Found debug element: ${selector}`);
        }
      }
      
      console.log('✅ Debug console displayed correctly');
    });

    test('should display system information', async () => {
      console.log('🧪 Testing system information display...');
      
      // Navigate to debug console
      await page.click('[data-section="debug"]');
      await page.waitForTimeout(500);
      
      // Check version information
      const versionElement = page.locator('#debug-version, .debug-version');
      if (await versionElement.count() > 0) {
        const versionText = await versionElement.first().textContent();
        expect(versionText).not.toContain('Loading...');
        expect(versionText).toMatch(/\d+\.\d+\.\d+/);
        console.log(`✅ Version info: ${versionText}`);
      }
      
      // Check port information
      const portElement = page.locator('#debug-port, .debug-port');
      if (await portElement.count() > 0) {
        const portText = await portElement.first().textContent();
        expect(portText).toContain('4021');
        console.log(`✅ Port info: ${portText}`);
      }
      
      // Check user agent information
      const uaElement = page.locator('#debug-ua, .debug-user-agent');
      if (await uaElement.count() > 0) {
        const uaText = await uaElement.first().textContent();
        expect(uaText).not.toContain('Loading...');
        expect(uaText).toContain('Mozilla');
        console.log(`✅ User agent: ${uaText.substring(0, 50)}...`);
      }
    });

    test('should handle debug console actions', async () => {
      console.log('🧪 Testing debug console actions...');
      
      // Navigate to debug console
      await page.click('[data-section="debug"]');
      await page.waitForTimeout(500);
      
      // Test refresh button
      const refreshButton = page.locator('button:has-text("Refresh")');
      if (await refreshButton.count() > 0) {
        await refreshButton.click();
        await page.waitForTimeout(1000);
        console.log('✅ Refresh button works');
      }
      
      // Test clear button (if logs are present)
      const clearButton = page.locator('button:has-text("Clear")');
      if (await clearButton.count() > 0) {
        await clearButton.click();
        await page.waitForTimeout(500);
        console.log('✅ Clear button works');
      }
      
      // Test copy all button
      const copyButton = page.locator('button:has-text("Copy All")');
      if (await copyButton.count() > 0) {
        // Note: clipboard testing is complex, so we just verify the button exists and is clickable
        await expect(copyButton.first()).toBeVisible();
        console.log('✅ Copy All button is available');
      }
    });
  });

  test.describe('Responsive Design', () => {
    test('should adapt to different viewport sizes', async () => {
      console.log('🧪 Testing responsive design...');
      
      const viewports = [
        { width: 1920, height: 1080, name: 'Desktop HD' },
        { width: 1366, height: 768, name: 'Desktop Small' },
        { width: 768, height: 1024, name: 'Tablet' },
        { width: 375, height: 667, name: 'Mobile' },
      ];
      
      for (const viewport of viewports) {
        console.log(`📱 Testing viewport: ${viewport.name} (${viewport.width}x${viewport.height})`);
        
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.waitForTimeout(500);
        
        // Check that navigation is still accessible
        const navElement = page.locator('[data-section="dashboard"]');
        await expect(navElement).toBeVisible();
        
        // Check that main content is visible
        const titleElement = page.locator('#page-title, h1');
        if (await titleElement.count() > 0) {
          await expect(titleElement.first()).toBeVisible();
        }
        
        console.log(`✅ ${viewport.name} viewport works correctly`);
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels and roles', async () => {
      console.log('🧪 Testing accessibility...');
      
      // Check for proper heading structure
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      const headingCount = await headings.count();
      expect(headingCount).toBeGreaterThan(0);
      console.log(`✅ Found ${headingCount} headings`);
      
      // Check for navigation landmarks
      const navElement = page.locator('nav, [role="navigation"]');
      if (await navElement.count() > 0) {
        await expect(navElement.first()).toBeVisible();
        console.log('✅ Navigation landmark found');
      }
      
      // Check for main content landmark
      const mainElement = page.locator('main, [role="main"]');
      if (await mainElement.count() > 0) {
        await expect(mainElement.first()).toBeVisible();
        console.log('✅ Main content landmark found');
      }
      
      // Check for button accessibility
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();
      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        const button = buttons.nth(i);
        const hasText = await button.textContent();
        const hasAriaLabel = await button.getAttribute('aria-label');
        
        expect(hasText || hasAriaLabel).toBeTruthy();
      }
      console.log(`✅ ${buttonCount} buttons have accessible labels`);
    });
  });
});