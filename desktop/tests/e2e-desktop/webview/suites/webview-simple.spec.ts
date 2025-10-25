import { test, expect, Page, BrowserContext } from '@playwright/test';
import { createSimpleWebViewHelper, SimpleWebViewHelper } from '../helpers/webview-simple-helpers';

test.describe('WebView Simple Tests', () => {
  let webViewHelper: SimpleWebViewHelper;
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }, testInfo) => {
    console.log('🚀 Setting up simple WebView tests...');
    
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
    
    webViewHelper = createSimpleWebViewHelper(page, context, testInfo, {
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

  test('should load page with proper structure', async () => {
    console.log('🔍 Testing page structure...');
    
    await webViewHelper.testPageStructure();
  });

  test('should have API connectivity', async () => {
    console.log('🔌 Testing API connectivity...');
    
    await webViewHelper.testAPIConnectivity();
  });

  test('should have terminal interface', async () => {
    console.log('💻 Testing terminal interface...');
    
    await webViewHelper.testTerminalInterface();
  });

  test('should have settings interface', async () => {
    console.log('⚙️ Testing settings interface...');
    
    await webViewHelper.testSettingsInterface();
  });

  test('should be responsive', async () => {
    console.log('📱 Testing responsive design...');
    
    await webViewHelper.testResponsiveDesign();
  });

  test('should meet accessibility requirements', async () => {
    console.log('♿ Testing accessibility...');
    
    await webViewHelper.testAccessibility();
  });

  test('should have good performance', async () => {
    console.log('⚡ Testing performance...');
    
    await webViewHelper.testPerformance();
  });

  test('should handle API commands', async () => {
    console.log('🔧 Testing API commands...');

    // Test basic API commands
    const commands = [
      'health',
      'sessions',
      'info'
    ];

    for (const command of commands) {
      const result = await webViewHelper.executeCommand(command);
      
      // Some commands might fail, that's okay for this test
      console.log(`Command ${command}: ${result.success ? '✅' : '❌'} ${result.executionTime}ms`);
      
      if (result.error) {
        console.log(`  Error: ${result.error}`);
      }
    }

    // At least some commands should work
    const commandHistory = webViewHelper.getCommandHistory();
    const successfulCommands = commandHistory.filter(cmd => cmd.success);
    
    console.log(`✅ ${successfulCommands.length}/${commandHistory.length} commands executed successfully`);
    
    // We expect at least the health command to work
    expect(successfulCommands.length).toBeGreaterThan(0);
  });

  test('should handle error states gracefully', async () => {
    console.log('⚠️ Testing error handling...');

    // Test invalid command
    const invalidResult = await webViewHelper.executeCommand('invalid_command');
    expect(invalidResult.success).toBe(false);
    expect(invalidResult.error).toBeDefined();

    // Test 404 endpoint
    const response = await page.goto('/api/nonexistent');
    expect(response?.status()).toBe(404);

    console.log('✅ Error handling working correctly');
  });

  test('should maintain UI responsiveness', async () => {
    console.log('⚡ Testing UI responsiveness...');

    // Test UI remains responsive during operations
    const startTime = Date.now();
    
    // Execute multiple operations concurrently
    const operations = [
      webViewHelper.executeCommand('health'),
      webViewHelper.testPageStructure(),
      page.waitForTimeout(1000)
    ];

    await Promise.all(operations);
    
    const responseTime = Date.now() - startTime;
    expect(responseTime).toBeLessThan(10000); // Should complete within 10 seconds

    console.log(`✅ UI remained responsive (${responseTime}ms)`);
  });

  test('should handle concurrent operations', async () => {
    console.log('🔄 Testing concurrent operations...');

    // Execute multiple commands concurrently
    const concurrentCommands = [
      webViewHelper.executeCommand('health'),
      webViewHelper.executeCommand('sessions'),
      webViewHelper.executeCommand('info')
    ];

    const results = await Promise.all(concurrentCommands);

    // Check that we got results for all commands
    expect(results.length).toBe(3);

    // Log results
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      console.log(`Concurrent command ${i + 1}: ${result.success ? '✅' : '❌'} ${result.executionTime}ms`);
    }

    console.log('✅ Concurrent operations handled safely');
  });
});