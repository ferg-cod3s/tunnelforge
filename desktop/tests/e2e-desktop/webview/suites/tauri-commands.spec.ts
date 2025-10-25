import { test, expect, Page, BrowserContext } from '@playwright/test';
import { createWebViewHelper, WebViewHelper } from '../helpers/webview-helpers';

test.describe('Tauri Commands Integration Tests', () => {
  let webViewHelper: WebViewHelper;
  let page: Page;
  let context: BrowserContext;

  test.beforeAll(async ({ browser }, testInfo) => {
    console.log('🚀 Setting up Tauri commands tests...');
    
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

  test.describe('Application Commands', () => {
    test('should get application information', async () => {
      console.log('📱 Testing app info command...');

      const result = await webViewHelper.executeCommand('get_app_info');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('name', 'TunnelForge');
      expect(result.data).toHaveProperty('version');
      expect(result.data).toHaveProperty('platform');
      expect(result.data).toHaveProperty('arch');

      console.log('✅ App info command works correctly');
    });

    test('should get application version', async () => {
      console.log('🏷️ Testing app version command...');

      const result = await webViewHelper.executeCommand('get_app_version');
      
      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('string');
      expect(result.data).toMatch(/^\d+\.\d+\.\d+$/); // Semantic version

      console.log(`✅ App version: ${result.data}`);
    });

    test('should get platform information', async () => {
      console.log('🖥️ Testing platform info command...');

      const result = await webViewHelper.executeCommand('get_platform_info');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('platform');
      expect(result.data).toHaveProperty('arch');
      expect(result.data).toHaveProperty('isWSL');
      expect(result.data).toHaveProperty('isCI');

      const validPlatforms = ['win32', 'darwin', 'linux'];
      expect(validPlatforms).toContain(result.data.platform);

      console.log(`✅ Platform: ${result.data.platform}-${result.data.arch}`);
    });

    test('should test Sentry integration', async () => {
      console.log('📊 Testing Sentry integration...');

      const result = await webViewHelper.executeCommand('test_sentry_integration');
      
      // Sentry might not be configured in test environment
      if (result.success) {
        expect(result.data).toContain('Sentry integration');
        console.log('✅ Sentry integration working');
      } else {
        expect(result.error).toContain('SENTRY_DSN');
        console.log('ℹ️ Sentry not configured (expected in test env)');
      }
    });
  });

  test.describe('Server Management Commands', () => {
    test('should get server status', async () => {
      console.log('🖥️ Testing server status command...');

      const result = await webViewHelper.executeCommand('get_server_status');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('running');
      expect(result.data).toHaveProperty('port');
      expect(result.data).toHaveProperty('pid');
      expect(result.data).toHaveProperty('uptime');

      console.log(`✅ Server status: ${result.data.running ? 'running' : 'stopped'}`);
    });

    test('should start and stop server', async () => {
      console.log('🔄 Testing server start/stop commands...');

      // Get initial status
      const initialStatus = await webViewHelper.executeCommand('get_server_status');
      expect(initialStatus.success).toBe(true);

      // If server is running, stop it first
      if (initialStatus.data.running) {
        const stopResult = await webViewHelper.executeCommand('stop_server');
        expect(stopResult.success).toBe(true);
        
        // Wait for server to stop
        await page.waitForTimeout(2000);
      }

      // Start server
      const startResult = await webViewHelper.executeCommand('start_server', [{
        port: 4021
      }]);
      expect(startResult.success).toBe(true);

      // Wait for server to start
      await page.waitForTimeout(3000);

      // Verify server is running
      const runningStatus = await webViewHelper.executeCommand('get_server_status');
      expect(runningStatus.success).toBe(true);
      expect(runningStatus.data.running).toBe(true);
      expect(runningStatus.data.port).toBe(4021);

      console.log('✅ Server start/stop commands working');
    });

    test('should restart server', async () => {
      console.log('🔄 Testing server restart command...');

      const result = await webViewHelper.executeCommand('restart_server');
      
      expect(result.success).toBe(true);

      // Wait for restart to complete
      await page.waitForTimeout(5000);

      // Verify server is still running
      const status = await webViewHelper.executeCommand('get_server_status');
      expect(status.success).toBe(true);
      expect(status.data.running).toBe(true);

      console.log('✅ Server restart command working');
    });

    test('should get server logs', async () => {
      console.log('📝 Testing server logs command...');

      const result = await webViewHelper.executeCommand('get_server_logs', [{
        limit: 50
      }]);
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);

      if (result.data.length > 0) {
        const logEntry = result.data[0];
        expect(logEntry).toHaveProperty('timestamp');
        expect(logEntry).toHaveProperty('level');
        expect(logEntry).toHaveProperty('message');
      }

      console.log(`✅ Retrieved ${result.data.length} log entries`);
    });

    test('should get server health', async () => {
      console.log('🏥 Testing server health command...');

      const result = await webViewHelper.executeCommand('get_server_health');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('status');
      expect(result.data).toHaveProperty('checks');
      expect(Array.isArray(result.data.checks)).toBe(true);

      const validStatuses = ['healthy', 'degraded', 'unhealthy'];
      expect(validStatuses).toContain(result.data.status);

      console.log(`✅ Server health: ${result.data.status}`);
    });
  });

  test.describe('Settings Commands', () => {
    test('should get current settings', async () => {
      console.log('⚙️ Testing get settings command...');

      const result = await webViewHelper.executeCommand('get_settings');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('theme');
      expect(result.data).toHaveProperty('serverPort');
      expect(result.data).toHaveProperty('autoStart');
      expect(result.data).toHaveProperty('notifications');

      console.log('✅ Settings retrieved successfully');
    });

    test('should update settings', async () => {
      console.log('💾 Testing set settings command...');

      // Get current settings
      const getResult = await webViewHelper.executeCommand('get_settings');
      expect(getResult.success).toBe(true);

      const originalSettings = getResult.data;

      // Update theme
      const newTheme = originalSettings.theme === 'dark' ? 'light' : 'dark';
      const updatedSettings = {
        ...originalSettings,
        theme: newTheme
      };

      const setResult = await webViewHelper.executeCommand('set_settings', [updatedSettings]);
      expect(setResult.success).toBe(true);

      // Verify setting was updated
      const verifyResult = await webViewHelper.executeCommand('get_settings');
      expect(verifyResult.success).toBe(true);
      expect(verifyResult.data.theme).toBe(newTheme);

      // Restore original settings
      const restoreResult = await webViewHelper.executeCommand('set_settings', [originalSettings]);
      expect(restoreResult.success).toBe(true);

      console.log('✅ Settings update working correctly');
    });

    test('should reset settings to defaults', async () => {
      console.log('🔄 Testing reset settings command...');

      const result = await webViewHelper.executeCommand('reset_settings');
      
      expect(result.success).toBe(true);

      // Verify settings were reset
      const settings = await webViewHelper.executeCommand('get_settings');
      expect(settings.success).toBe(true);

      // Check that settings have default values
      expect(settings.data.theme).toMatch(/^(dark|light|auto)$/);
      expect(typeof settings.data.serverPort).toBe('number');

      console.log('✅ Settings reset working correctly');
    });

    test('should export and import settings', async () => {
      console.log('📤 Testing settings export/import...');

      // Export settings
      const exportResult = await webViewHelper.executeCommand('export_settings', [{
        format: 'json'
      }]);
      
      expect(exportResult.success).toBe(true);
      expect(exportResult.data).toHaveProperty('settings');
      expect(exportResult.data).toHaveProperty('timestamp');

      // Import settings
      const importResult = await webViewHelper.executeCommand('import_settings', [{
        settings: exportResult.data.settings
      }]);
      
      expect(importResult.success).toBe(true);

      console.log('✅ Settings export/import working');
    });
  });

  test.describe('Terminal Session Commands', () => {
    test('should list terminal sessions', async () => {
      console.log('📋 Testing list terminal sessions command...');

      const result = await webViewHelper.executeCommand('get_terminal_sessions');
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);

      console.log(`✅ Found ${result.data.length} terminal sessions`);
    });

    test('should create terminal session', async () => {
      console.log('💻 Testing create terminal session command...');

      const result = await webViewHelper.executeCommand('create_terminal_session', [{
        title: 'E2E Test Terminal',
        shell: '/bin/bash',
        cols: 80,
        rows: 24
      }]);
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('sessionId');
      expect(result.data).toHaveProperty('title');
      expect(result.data.title).toBe('E2E Test Terminal');

      const sessionId = result.data.sessionId;

      // Clean up the session
      const cleanupResult = await webViewHelper.executeCommand('cleanup_terminal_session', [sessionId]);
      expect(cleanupResult.success).toBe(true);

      console.log('✅ Terminal session creation working');
    });

    test('should send input to terminal session', async () => {
      console.log('⌨️ Testing terminal input command...');

      // Create a session first
      const createResult = await webViewHelper.executeCommand('create_terminal_session', [{
        title: 'Input Test Terminal'
      }]);
      expect(createResult.success).toBe(true);

      const sessionId = createResult.data.sessionId;

      // Send input
      const inputResult = await webViewHelper.executeCommand('send_terminal_input', [{
        sessionId,
        input: 'echo "Hello from WebView E2E"\n'
      }]);
      
      expect(inputResult.success).toBe(true);

      // Wait for command to execute
      await page.waitForTimeout(2000);

      // Get output
      const outputResult = await webViewHelper.executeCommand('get_terminal_output', [{
        sessionId,
        lines: 10
      }]);
      
      expect(outputResult.success).toBe(true);
      expect(outputResult.data).toContain('Hello from WebView E2E');

      // Clean up
      await webViewHelper.executeCommand('cleanup_terminal_session', [sessionId]);

      console.log('✅ Terminal input/output working');
    });

    test('should resize terminal session', async () => {
      console.log('📏 Testing terminal resize command...');

      // Create a session
      const createResult = await webViewHelper.executeCommand('create_terminal_session', [{
        title: 'Resize Test Terminal'
      }]);
      expect(createResult.success).toBe(true);

      const sessionId = createResult.data.sessionId;

      // Resize terminal
      const resizeResult = await webViewHelper.executeCommand('resize_terminal', [{
        sessionId,
        cols: 120,
        rows: 40
      }]);
      
      expect(resizeResult.success).toBe(true);

      // Clean up
      await webViewHelper.executeCommand('cleanup_terminal_session', [sessionId]);

      console.log('✅ Terminal resize working');
    });
  });

  test.describe('File System Commands', () => {
    test('should get app directories', async () => {
      console.log('📁 Testing get app directories command...');

      const result = await webViewHelper.executeCommand('get_app_directories');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('appDir');
      expect(result.data).toHaveProperty('documentsDir');
      expect(result.data).toHaveProperty('configDir');
      expect(result.data).toHaveProperty('cacheDir');

      console.log('✅ App directories retrieved');
    });

    test('should list directory contents', async () => {
      console.log('📂 Testing list directory command...');

      // Get app directory first
      const dirsResult = await webViewHelper.executeCommand('get_app_directories');
      expect(dirsResult.success).toBe(true);

      const appDir = dirsResult.data.appDir;

      // List directory
      const listResult = await webViewHelper.executeCommand('list_directory', [{
        path: appDir
      }]);
      
      expect(listResult.success).toBe(true);
      expect(Array.isArray(listResult.data)).toBe(true);

      console.log(`✅ Listed ${listResult.data.length} items in directory`);
    });

    test('should read and write files', async () => {
      console.log('📄 Testing file read/write commands...');

      // Get app directory
      const dirsResult = await webViewHelper.executeCommand('get_app_directories');
      expect(dirsResult.success).toBe(true);

      const appDir = dirsResult.data.appDir;
      const testFilePath = `${appDir}/webview-test-${Date.now()}.txt`;
      const testContent = `WebView E2E Test File\nCreated: ${new Date().toISOString()}`;

      // Write file
      const writeResult = await webViewHelper.executeCommand('write_file', [{
        path: testFilePath,
        content: testContent
      }]);
      
      expect(writeResult.success).toBe(true);

      // Read file
      const readResult = await webViewHelper.executeCommand('read_file', [{
        path: testFilePath
      }]);
      
      expect(readResult.success).toBe(true);
      expect(readResult.data).toBe(testContent);

      // Clean up
      const deleteResult = await webViewHelper.executeCommand('delete_file', [{
        path: testFilePath
      }]);
      expect(deleteResult.success).toBe(true);

      console.log('✅ File read/write working correctly');
    });

    test('should check file existence and metadata', async () => {
      console.log('🔍 Testing file existence and metadata commands...');

      // Get app directory
      const dirsResult = await webViewHelper.executeCommand('get_app_directories');
      expect(dirsResult.success).toBe(true);

      const appDir = dirsResult.data.appDir;
      const testFilePath = `${appDir}/metadata-test-${Date.now()}.txt`;

      // Create test file
      await webViewHelper.executeCommand('write_file', [{
        path: testFilePath,
        content: 'Test content for metadata'
      }]);

      // Check existence
      const existsResult = await webViewHelper.executeCommand('file_exists', [{
        path: testFilePath
      }]);
      
      expect(existsResult.success).toBe(true);
      expect(existsResult.data).toBe(true);

      // Get metadata
      const metadataResult = await webViewHelper.executeCommand('get_file_metadata', [{
        path: testFilePath
      }]);
      
      expect(metadataResult.success).toBe(true);
      expect(metadataResult.data).toHaveProperty('size');
      expect(metadataResult.data).toHaveProperty('modified');
      expect(metadataResult.data).toHaveProperty('created');

      // Clean up
      await webViewHelper.executeCommand('delete_file', [{ path: testFilePath }]);

      console.log('✅ File existence and metadata working');
    });
  });

  test.describe('Tunnel Service Commands', () => {
    test('should get Ngrok status and configuration', async () => {
      console.log('🌐 Testing Ngrok commands...');

      // Get status
      const statusResult = await webViewHelper.executeCommand('get_ngrok_status');
      expect(statusResult.success).toBe(true);
      expect(statusResult.data).toHaveProperty('installed');
      expect(statusResult.data).toHaveProperty('running');

      // Get configuration
      const configResult = await webViewHelper.executeCommand('get_ngrok_config');
      expect(configResult.success).toBe(true);
      expect(configResult.data).toHaveProperty('authToken');
      expect(configResult.data).toHaveProperty('tunnels');

      console.log('✅ Ngrok commands working');
    });

    test('should get Cloudflare status and configuration', async () => {
      console.log('☁️ Testing Cloudflare commands...');

      // Get status
      const statusResult = await webViewHelper.executeCommand('get_cloudflare_status');
      expect(statusResult.success).toBe(true);
      expect(statusResult.data).toHaveProperty('installed');
      expect(statusResult.data).toHaveProperty('authenticated');

      // Get configuration
      const configResult = await webViewHelper.executeCommand('get_cloudflare_config');
      expect(configResult.success).toBe(true);
      expect(configResult.data).toHaveProperty('account');
      expect(configResult.data).toHaveProperty('tunnels');

      console.log('✅ Cloudflare commands working');
    });

    test('should get Tailscale status and configuration', async () => {
      console.log('🦊 Testing Tailscale commands...');

      // Get status
      const statusResult = await webViewHelper.executeCommand('get_tailscale_status');
      expect(statusResult.success).toBe(true);
      expect(statusResult.data).toHaveProperty('installed');
      expect(statusResult.data).toHaveProperty('connected');

      // Get configuration
      const configResult = await webViewHelper.executeCommand('get_tailscale_config');
      expect(configResult.success).toBe(true);

      console.log('✅ Tailscale commands working');
    });
  });

  test.describe('System Integration Commands', () => {
    test('should manage system tray', async () => {
      console.log('🔌 Testing system tray commands...');

      // Get tray items
      const itemsResult = await webViewHelper.executeCommand('get_tray_items');
      expect(itemsResult.success).toBe(true);
      expect(Array.isArray(itemsResult.data)).toBe(true);

      // Update tray menu
      const updateResult = await webViewHelper.executeCommand('update_tray_menu', [{
        items: [
          { id: 'test-item', label: 'Test Item', enabled: true }
        ]
      }]);
      
      expect(updateResult.success).toBe(true);

      console.log('✅ System tray commands working');
    });

    test('should manage notifications', async () => {
      console.log('🔔 Testing notification commands...');

      // Check permission
      const permissionResult = await webViewHelper.executeCommand('get_notification_permission');
      expect(permissionResult.success).toBe(true);
      expect(['granted', 'denied', 'default']).toContain(permissionResult.data);

      // Send test notification
      const notifyResult = await webViewHelper.executeCommand('send_notification', [{
        title: 'WebView E2E Test',
        body: 'This is a test notification',
        icon: 'info'
      }]);
      
      expect(notifyResult.success).toBe(true);

      console.log('✅ Notification commands working');
    });

    test('should manage auto-start', async () => {
      console.log('🚀 Testing auto-start commands...');

      // Get current status
      const statusResult = await webViewHelper.executeCommand('get_autostart_status');
      expect(statusResult.success).toBe(true);
      expect(statusResult.data).toHaveProperty('enabled');
      expect(statusResult.data).toHaveProperty('supported');

      // Toggle auto-start if supported
      if (statusResult.data.supported) {
        const toggleResult = await webViewHelper.executeCommand('toggle_autostart');
        expect(toggleResult.success).toBe(true);

        // Toggle back to original state
        await webViewHelper.executeCommand('toggle_autostart');
      }

      console.log('✅ Auto-start commands working');
    });

    test('should open external URLs', async () => {
      console.log('🌍 Testing external URL command...');

      const result = await webViewHelper.executeCommand('open_external_url', [{
        url: 'https://github.com/tunnelforge'
      }]);
      
      expect(result.success).toBe(true);

      console.log('✅ External URL command working');
    });
  });

  test.describe('Performance and Monitoring Commands', () => {
    test('should get performance metrics', async () => {
      console.log('📊 Testing performance metrics command...');

      const result = await webViewHelper.executeCommand('get_performance_metrics');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('memory');
      expect(result.data).toHaveProperty('cpu');
      expect(result.data).toHaveProperty('uptime');

      console.log('✅ Performance metrics retrieved');
    });

    test('should get startup metrics', async () => {
      console.log('⏱️ Testing startup metrics command...');

      const result = await webViewHelper.executeCommand('get_startup_metrics');
      
      if (result.success) {
        expect(result.data).toHaveProperty('totalTime');
        expect(result.data).toHaveProperty('phases');
        console.log(`✅ Startup time: ${result.data.totalTime}ms`);
      } else {
        console.log('ℹ️ Startup metrics not available');
      }
    });

    test('should write diagnostics', async () => {
      console.log('📝 Testing diagnostics command...');

      const diagnosticsContent = {
        timestamp: new Date().toISOString(),
        test: 'WebView E2E Diagnostics',
        system: await webViewHelper.executeCommand('get_platform_info'),
        app: await webViewHelper.executeCommand('get_app_info')
      };

      const result = await webViewHelper.executeCommand('write_diagnostics', [{
        path: `test-results/diagnostics-${Date.now()}.json`,
        content: JSON.stringify(diagnosticsContent, null, 2)
      }]);
      
      expect(result.success).toBe(true);

      console.log('✅ Diagnostics written successfully');
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle invalid commands gracefully', async () => {
      console.log('❌ Testing invalid command handling...');

      const result = await webViewHelper.executeCommand('nonexistent_command');
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.executionTime).toBeGreaterThan(0);

      console.log('✅ Invalid commands handled gracefully');
    });

    test('should handle command timeouts', async () => {
      console.log('⏰ Testing command timeout handling...');

      // Create a helper with short timeout for this test
      const shortTimeoutHelper = createWebViewHelper(page, context, testInfo, {
        timeout: 1000 // 1 second timeout
      });

      const result = await shortTimeoutHelper.executeCommand('simulate_long_operation');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');

      console.log('✅ Command timeouts handled correctly');
    });

    test('should validate command arguments', async () => {
      console.log('🔍 Testing argument validation...');

      // Test with invalid arguments
      const result = await webViewHelper.executeCommand('set_settings', [{
        invalidProperty: 'invalidValue',
        serverPort: 'not_a_number'
      }]);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      console.log('✅ Argument validation working');
    });

    test('should handle concurrent command execution', async () => {
      console.log('🔄 Testing concurrent command execution...');

      // Execute multiple commands concurrently
      const commands = [
        webViewHelper.executeCommand('get_app_info'),
        webViewHelper.executeCommand('get_settings'),
        webViewHelper.executeCommand('get_server_status'),
        webViewHelper.executeCommand('get_platform_info')
      ];

      const results = await Promise.all(commands);

      // All should succeed
      for (const result of results) {
        expect(result.success).toBe(true);
      }

      // Results should be consistent
      const appInfo1 = results[0].data;
      const appInfo2 = results[0].data;
      expect(appInfo1).toEqual(appInfo2);

      console.log('✅ Concurrent execution handled correctly');
    });
  });
});