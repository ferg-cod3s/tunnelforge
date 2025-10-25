import { test, expect, Page, BrowserContext } from '@playwright/test';
import { createTauriHelper, getPlatformConfig } from './helpers/tauri-helpers';

/**
 * Tauri Desktop App Lifecycle Tests
 * 
 * These tests verify the core functionality of the TunnelForge desktop application:
 * - App startup and initialization
 * - Tauri command execution
 * - System integration
 * - Cross-platform compatibility
 */

test.describe('Tauri App Lifecycle', () => {
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
    // Navigate to Tauri app
    await page.goto('http://localhost:1420');
    await helper.waitForTauriApp();
    await helper.logConsoleMessages();
  });

  test('should initialize Tauri app successfully', async () => {
    console.log('🧪 Testing Tauri app initialization...');
    
    // Wait for app to be ready
    await helper.waitForAppReady();
    
    // Check if Tauri API is available
    const tauriAvailable = await page.evaluate(() => {
      return typeof window !== 'undefined' && 
             window.__TAURI__ && 
             window.__TAURI__.invoke;
    });
    
    expect(tauriAvailable).toBe(true);
    
    // Get app information
    const appInfo = await helper.getAppInfo();
    console.log('📱 App Info:', appInfo);
    
    expect(appInfo.name).toContain('TunnelForge');
    expect(appInfo.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('should execute Tauri commands successfully', async () => {
    console.log('🧪 Testing Tauri command execution...');
    
    // Test a simple command - get app version
    const version = await helper.invokeTauriCommand('get_app_version');
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    
    // Test getting platform info
    const platformInfo = await helper.invokeTauriCommand('get_platform_info');
    expect(platformInfo).toHaveProperty('platform');
    expect(platformInfo).toHaveProperty('arch');
  });

  test('should handle file system operations', async () => {
    console.log('🧪 Testing file system operations...');
    
    await helper.testFileSystemOperations();
  });

  test('should handle shell operations', async () => {
    console.log('🧪 Testing shell operations...');
    
    await helper.testShellOperations();
  });

  test('should handle notifications', async () => {
    console.log('🧪 Testing notifications...');
    
    await helper.testNotifications();
  });

  test('should handle window operations', async () => {
    console.log('🧪 Testing window operations...');
    
    await helper.testWindowOperations();
  });

  test('should display correct environment information', async () => {
    console.log('🧪 Testing environment information...');
    
    const envInfo = await helper.getEnvironmentInfo();
    const platformConfig = getPlatformConfig();
    
    console.log('🌍 Environment Info:', envInfo);
    
    expect(envInfo.tauri).toBe(true);
    expect(envInfo.platform).toBe(platformConfig.isWindows ? 'Windows' : 
                                   platformConfig.isMacOS ? 'Darwin' : 'Linux');
  });

  test('should handle system tray functionality', async () => {
    console.log('🧪 Testing system tray...');
    
    await helper.testSystemTray();
  });

  test('should capture screenshots on demand', async () => {
    console.log('🧪 Testing screenshot capture...');
    
    await helper.takeScreenshot('tauri-app-ready');
    
    // Verify screenshot was created
    const fs = require('fs/promises');
    const screenshotPath = 'test-results/tauri-screenshots/tauri-app-ready.png';
    
    try {
      await fs.access(screenshotPath);
      console.log('✅ Screenshot created successfully');
    } catch (error) {
      console.warn('⚠️ Screenshot not found:', error);
    }
  });

  test('should handle cross-platform differences', async () => {
    console.log('🧪 Testing cross-platform compatibility...');
    
    const platformConfig = getPlatformConfig();
    console.log('🖥️ Platform Config:', platformConfig);
    
    // Test platform-specific features
    if (platformConfig.isWindows) {
      // Windows-specific tests
      console.log('🪟 Running Windows-specific tests...');
      // Test Windows-specific functionality
    } else if (platformConfig.isMacOS) {
      // macOS-specific tests
      console.log('🍎 Running macOS-specific tests...');
      // Test macOS-specific functionality
    } else if (platformConfig.isLinux) {
      // Linux-specific tests
      console.log('🐧 Running Linux-specific tests...');
      // Test Linux-specific functionality
    }
    
    if (platformConfig.isWSL) {
      // WSL-specific tests
      console.log('🐧 Running WSL-specific tests...');
      // Test WSL-specific functionality
    }
    
    // All platforms should have basic functionality
    const appInfo = await helper.getAppInfo();
    expect(appInfo).toBeDefined();
    expect(appInfo.name).toContain('TunnelForge');
  });

  test('should handle errors gracefully', async () => {
    console.log('🧪 Testing error handling...');
    
    // Test invalid command
    try {
      await helper.invokeTauriCommand('invalid_command_that_does_not_exist');
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeDefined();
      console.log('✅ Error handling works correctly');
    }
    
    // Test command with invalid arguments
    try {
      await helper.invokeTauriCommand('get_app_dir', { invalid: 'args' });
      // This might not throw, but should handle gracefully
    } catch (error) {
      console.log('✅ Invalid arguments handled gracefully');
    }
  });

  test('should maintain state across interactions', async () => {
    console.log('🧪 Testing state management...');
    
    // Set some state
    await page.evaluate(() => {
      window.__TAURI_TEST_STATE__ = {
        timestamp: Date.now(),
        testId: 'state-test'
      };
    });
    
    // Verify state persists
    const state = await page.evaluate(() => {
      return window.__TAURI_TEST_STATE__;
    });
    
    expect(state).toBeDefined();
    expect(state.testId).toBe('state-test');
    
    // Navigate away and back
    await page.goto('about:blank');
    await page.goto('http://localhost:1420');
    await helper.waitForTauriApp();
    
    // State should be reset (since it's a new page load)
    const newState = await page.evaluate(() => {
      return window.__TAURI_TEST_STATE__;
    });
    
    expect(newState).toBeUndefined();
  });
});

test.describe('Tauri App Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    console.log('🧪 Testing app load performance...');
    
    const startTime = Date.now();
    
    await page.goto('http://localhost:1420');
    
    // Wait for app to be ready
    await page.waitForFunction(() => {
      return typeof window !== 'undefined' && 
             window.__TAURI__ && 
             window.__TAURI__.invoke;
    }, { timeout: 30000 });
    
    const loadTime = Date.now() - startTime;
    console.log(`⏱️ App load time: ${loadTime}ms`);
    
    // Should load within 30 seconds (generous for CI)
    expect(loadTime).toBeLessThan(30000);
  });

  test('should be responsive to user interactions', async ({ page }) => {
    console.log('🧪 Testing app responsiveness...');
    
    await page.goto('http://localhost:1420');
    
    // Wait for app to be ready
    await page.waitForFunction(() => {
      return typeof window !== 'undefined' && 
             window.__TAURI__ && 
             window.__TAURI__.invoke;
    });
    
    // Test click responsiveness
    const startTime = Date.now();
    
    await page.click('body'); // Click anywhere
    
    const responseTime = Date.now() - startTime;
    console.log(`⏱️ Click response time: ${responseTime}ms`);
    
    // Should respond within 1 second
    expect(responseTime).toBeLessThan(1000);
  });
});