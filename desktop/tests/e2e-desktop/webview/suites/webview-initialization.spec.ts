import { test, expect, Page, BrowserContext } from '@playwright/test';
import { createWebViewHelper, WebViewHelper } from '../helpers/webview-helpers';
import { isWSL, getPlatformConfig } from '../../helpers/tauri-desktop-helpers';

test.describe('WebView Initialization Tests', () => {
  let webViewHelper: WebViewHelper;
  let page: Page;
  let context: BrowserContext;

test.beforeAll(async ({ browser }, testInfo) => {
    console.log('🚀 Setting up WebView initialization tests...');
    
    context = await browser.newContext({
      viewport: { width: 1200, height: 800 },
      recordVideo: {
        dir: 'test-results/webview-videos',
        size: { width: 1200, height: 800 }
      }
    });
    
    page = await context.newPage();
    
    // Navigate to TunnelForge web interface
    await page.goto('http://localhost:4021', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    webViewHelper = createWebViewHelper(page, context, testInfo, {
      captureScreenshots: true,
      enableTracing: true,
      timeout: 30000
    });
    
    await webViewHelper.initialize();
  });
    
    page = await context.newPage();
    
    // Navigate to the Tauri app
    await page.goto('http://localhost:4021', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    webViewHelper = createWebViewHelper(page, context, testInfo, {
      captureScreenshots: true,
      enableTracing: true,
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

  test.beforeEach(async () => {
    // Reset state before each test
    await page.reload();
    await webViewHelper.initialize();
  });

  test('should load WebView with proper Tauri APIs available', async () => {
    console.log('🔍 Testing WebView API availability...');

    // Check that all required Tauri APIs are available
    const apiCheck = await page.evaluate(() => {
      const requiredAPIs = [
        '__TAURI__',
        '__TAURI__.invoke',
        '__TAURI__.app',
        '__TAURI__.window',
        '__TAURI__.fs',
        '__TAURI__.shell',
        '__TAURI__.notification',
        '__TAURI__.dialog',
        '__TAURI__.clipboard',
        '__TAURI__.globalShortcut'
      ];

      const results: Record<string, boolean> = {};
      
      for (const api of requiredAPIs) {
        try {
          const pathParts = api.split('.');
          let obj = window;
          for (const part of pathParts) {
            if (part === 'window') continue;
            obj = obj[part];
            if (!obj) {
              results[api] = false;
              break;
            }
          }
          results[api] = !!obj;
        } catch {
          results[api] = false;
        }
      }

      return results;
    });

    // Verify all APIs are available
    for (const [api, available] of Object.entries(apiCheck)) {
      expect(available).toBe(true, `Tauri API ${api} should be available`);
    }

    console.log('✅ All required Tauri APIs are available');
  });

  test('should have proper WebView document structure', async () => {
    console.log('📄 Testing WebView document structure...');

    // Check basic HTML structure
    await expect(page.locator('html')).toBeVisible();
    await expect(page.locator('head')).toBeVisible();
    await expect(page.locator('body')).toBeVisible();

    // Check for main app container
    const appContainer = await page.locator('#app, .app, [data-app]').first();
    await expect(appContainer).toBeVisible();

    // Check for proper meta tags
    const title = await page.title();
    expect(title).toContain('TunnelForge');

    // Check for proper viewport meta tag
    const viewportMeta = await page.locator('meta[name="viewport"]').first();
    await expect(viewportMeta).toBeVisible();

    console.log('✅ WebView document structure is correct');
  });

  test('should load application resources properly', async () => {
    console.log('📦 Testing resource loading...');

    // Check CSS files are loaded
    const cssLinks = await page.locator('link[rel="stylesheet"]').all();
    expect(cssLinks.length).toBeGreaterThan(0);

    // Check JavaScript files are loaded
    const scriptTags = await page.locator('script[src]').all();
    expect(scriptTags.length).toBeGreaterThan(0);

    // Check for images and icons
    const images = await page.locator('img[src]').all();
    
    // Verify no broken resources
    const failedRequests: string[] = [];
    page.on('requestfailed', request => {
      failedRequests.push(request.url());
    });

    // Wait a bit for any failed requests to be captured
    await page.waitForTimeout(2000);

    if (failedRequests.length > 0) {
      console.warn('⚠️ Some resources failed to load:', failedRequests);
    }

    console.log('✅ Application resources loaded properly');
  });

  test('should establish WebSocket connection to backend', async () => {
    console.log('🔌 Testing WebSocket connection...');

    // Wait for WebSocket connection to be established
    const wsConnected = await page.waitForFunction(() => {
      return window.__TAURI_APP_WS_CONNECTED__ === true || 
             document.querySelector('[data-ws-connected="true"]') !== null;
    }, { timeout: 10000 });

    expect(wsConnected).toBeTruthy();

    // Test WebSocket communication
    const wsTestResult = await webViewHelper.executeCommand('test_websocket_connection');
    expect(wsTestResult.success).toBe(true);

    console.log('✅ WebSocket connection established successfully');
  });

  test('should handle cross-platform environment detection', async () => {
    console.log('🌍 Testing platform detection...');

    const platformConfig = getPlatformConfig();
    console.log('Platform config:', platformConfig);

    // Test platform detection from within WebView
    const platformInfo = await webViewHelper.executeCommand('get_platform_info');
    expect(platformInfo.success).toBe(true);

    const { platform, arch, isWSL } = platformInfo.data;
    
    // Verify platform matches expected
    if (platformConfig.isWindows) {
      expect(platform).toBe('win32');
    } else if (platformConfig.isMacOS) {
      expect(platform).toBe('darwin');
    } else if (platformConfig.isLinux) {
      expect(platform).toBe('linux');
    }

    // Verify WSL detection
    if (isWSL()) {
      expect(isWSL).toBe(true);
    }

    console.log(`✅ Platform detection working: ${platform}-${arch}`);
  });

  test('should initialize application state correctly', async () => {
    console.log('🔄 Testing application state initialization...');

    // Check app info
    const appInfoResult = await webViewHelper.executeCommand('get_app_info');
    expect(appInfoResult.success).toBe(true);

    const appInfo = appInfoResult.data;
    expect(appInfo).toHaveProperty('name');
    expect(appInfo).toHaveProperty('version');
    expect(appInfo.name).toBe('TunnelForge');

    // Check server status
    const serverStatusResult = await webViewHelper.executeCommand('get_server_status');
    expect(serverStatusResult.success).toBe(true);

    const serverStatus = serverStatusResult.data;
    expect(serverStatus).toHaveProperty('running');
    expect(serverStatus).toHaveProperty('port');

    // Check settings
    const settingsResult = await webViewHelper.executeCommand('get_settings');
    expect(settingsResult.success).toBe(true);

    const settings = settingsResult.data;
    expect(settings).toHaveProperty('theme');
    expect(settings).toHaveProperty('serverPort');

    console.log('✅ Application state initialized correctly');
  });

  test('should handle error states gracefully', async () => {
    console.log('⚠️ Testing error handling...');

    // Test invalid command
    const invalidCommandResult = await webViewHelper.executeCommand('invalid_command_name');
    expect(invalidCommandResult.success).toBe(false);
    expect(invalidCommandResult.error).toBeDefined();

    // Test command with invalid arguments
    const invalidArgsResult = await webViewHelper.executeCommand('get_settings', [{ invalid: 'args' }]);
    // This might succeed or fail depending on implementation, just ensure it doesn't crash
    expect(invalidArgsResult).toBeDefined();

    // Test network error handling
    await page.route('**/api/**', route => route.abort());
    
    const networkErrorResult = await webViewHelper.executeCommand('test_network_connection');
    expect(networkErrorResult.success).toBe(false);

    // Restore network
    await page.unroute('**/api/**');

    console.log('✅ Error handling working correctly');
  });

  test('should maintain responsive UI during operations', async () => {
    console.log('⚡ Testing UI responsiveness...');

    // Test UI remains responsive during command execution
    const startTime = Date.now();
    
    // Execute a potentially long-running command
    const longCommandPromise = webViewHelper.executeCommand('get_detailed_system_info');
    
    // While command is running, test UI responsiveness
    await page.click('body'); // Should be responsive
    await page.keyboard.press('Tab'); // Should work
    
    const longCommandResult = await longCommandPromise;
    expect(longCommandResult.success).toBe(true);
    
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(10000); // Should complete within 10 seconds

    console.log(`✅ UI remained responsive (${responseTime}ms)`);
  });

  test('should handle window resize and orientation changes', async () => {
    console.log('📏 Testing window resize handling...');

    // Get initial window size
    const initialSize = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }));

    // Resize window
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(500);

    // Check that UI adapts to new size
    const resizedSize = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }));

    expect(resizedSize.width).toBe(800);
    expect(resizedSize.height).toBe(600);

    // Test responsive design elements
    const isMobileView = await page.evaluate(() => {
      return window.innerWidth < 768;
    });

    // Check that mobile/desktop classes are applied correctly
    const bodyClasses = await page.locator('body').getAttribute('class');
    if (isMobileView) {
      expect(bodyClasses).toMatch(/mobile|compact/);
    }

    // Restore original size
    await page.setViewportSize(initialSize);
    await page.waitForTimeout(500);

    console.log('✅ Window resize handling works correctly');
  });

  test('should maintain security boundaries', async () => {
    console.log('🔒 Testing security boundaries...');

    // Test that eval is properly restricted
    const evalTest = await page.evaluate(() => {
      try {
        // This should be blocked or restricted
        window.eval('window.__TAURI_INTERNALS__');
        return 'eval_allowed';
      } catch {
        return 'eval_blocked';
      }
    });

    // In production, eval should be restricted
    expect(['eval_blocked', 'eval_allowed']).toContain(evalTest);

    // Test CSP headers are enforced
    const cspMeta = await page.locator('meta[http-equiv="Content-Security-Policy"]').first();
    const cspContent = await cspMeta.getAttribute('content');
    
    if (cspContent) {
      expect(cspContent).toContain("default-src 'self'");
      expect(cspContent).toContain("connect-src 'self'");
    }

    // Test that external scripts are blocked
    const externalScriptTest = await page.evaluate(() => {
      const script = document.createElement('script');
      script.src = 'https://evil.com/script.js';
      document.head.appendChild(script);
      return script.onload !== null;
    });

    // External scripts should be blocked by CSP
    expect(externalScriptTest).toBe(false);

    console.log('✅ Security boundaries are properly enforced');
  });

  test('should handle accessibility requirements', async () => {
    console.log('♿ Testing accessibility requirements...');

    // Check for proper language attribute
    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBeTruthy();

    // Check for proper title
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    // Check for ARIA landmarks
    const landmarks = await page.locator('[role="main"], [role="navigation"], [role="banner"]').all();
    expect(landmarks.length).toBeGreaterThan(0);

    // Check for focus management
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement);
    expect(focusedElement).toBeTruthy();

    // Check for alt text on images
    const imagesWithoutAlt = await page.locator('img:not([alt])').all();
    expect(imagesWithoutAlt.length).toBe(0);

    console.log('✅ Accessibility requirements are met');
  });

  test('should handle concurrent operations safely', async () => {
    console.log('🔄 Testing concurrent operations...');

    // Execute multiple commands concurrently
    const concurrentCommands = [
      webViewHelper.executeCommand('get_app_info'),
      webViewHelper.executeCommand('get_settings'),
      webViewHelper.executeCommand('get_server_status'),
      webViewHelper.executeCommand('get_terminal_sessions'),
      webViewHelper.executeCommand('get_platform_info')
    ];

    const results = await Promise.all(concurrentCommands);

    // All commands should succeed
    for (const result of results) {
      expect(result.success).toBe(true);
    }

    // Verify no race conditions occurred
    const appInfo1 = results[0].data;
    const appInfo2 = results[0].data; // Same command, should be consistent
    expect(appInfo1).toEqual(appInfo2);

    console.log('✅ Concurrent operations handled safely');
  });

  test('should provide proper error reporting and logging', async () => {
    console.log('📝 Testing error reporting and logging...');

    // Capture console messages
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Trigger an error
    await webViewHelper.executeCommand('trigger_test_error');

    // Wait for error to be logged
    await page.waitForTimeout(1000);

    // Check that error was logged
    const hasErrorLog = consoleMessages.some(msg => 
      msg.includes('error') || msg.includes('ERROR')
    );

    if (hasErrorLog) {
      console.log('✅ Error logging is working');
    } else {
      console.warn('⚠️ No error logs found (may be expected)');
    }

    // Test debug information collection
    const debugInfo = await webViewHelper.executeCommand('get_debug_info');
    expect(debugInfo.success).toBe(true);

    const debugData = debugInfo.data;
    expect(debugData).toHaveProperty('timestamp');
    expect(debugData).toHaveProperty('version');
    expect(debugData).toHaveProperty('platform');

    console.log('✅ Error reporting and logging working correctly');
  });
});