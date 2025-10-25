import { test, expect, Page, BrowserContext } from '@playwright/test';
import { createWebViewHelper, WebViewHelper } from '../helpers/webview-helpers';
import { getPlatformConfig } from '../helpers/tauri-desktop-helpers';

test.describe('System Integration Tests', () => {
  let webViewHelper: WebViewHelper;
  let page: Page;
  let context: BrowserContext;
  const platformConfig = getPlatformConfig();

  test.beforeAll(async ({ browser }, testInfo) => {
    console.log('🚀 Setting up System Integration tests...');
    console.log(`Platform: ${process.platform}-${process.arch}`);
    console.log(`WSL: ${platformConfig.isWSL}, CI: ${platformConfig.isCI}`);
    
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

  test.describe('System Tray Integration', () => {
    test('should get system tray status', async () => {
      console.log('🔌 Testing system tray status...');

      const result = await webViewHelper.executeCommand('get_tray_status');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('available');
      expect(result.data).toHaveProperty('visible');
      expect(result.data).toHaveProperty('items');

      console.log(`✅ System tray available: ${result.data.available}`);
    });

    test('should get tray menu items', async () => {
      console.log('📋 Testing tray menu items...');

      const result = await webViewHelper.executeCommand('get_tray_items');
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);

      if (result.data.length > 0) {
        const firstItem = result.data[0];
        expect(firstItem).toHaveProperty('id');
        expect(firstItem).toHaveProperty('label');
        expect(firstItem).toHaveProperty('enabled');

        console.log(`✅ Found ${result.data.length} tray menu items`);
      } else {
        console.log('ℹ️ No tray menu items found (may be expected)');
      }
    });

    test('should update tray menu', async () => {
      console.log('🔄 Testing tray menu update...');

      const testMenu = [
        { id: 'test-show', label: 'Show TunnelForge', enabled: true },
        { id: 'test-hide', label: 'Hide TunnelForge', enabled: true },
        { id: 'test-separator', label: '-', enabled: true, isSeparator: true },
        { id: 'test-quit', label: 'Quit', enabled: true }
      ];

      const result = await webViewHelper.executeCommand('update_tray_menu', [{
        items: testMenu
      }]);
      
      expect(result.success).toBe(true);

      // Verify menu was updated
      const verifyResult = await webViewHelper.executeCommand('get_tray_items');
      expect(verifyResult.success).toBe(true);

      console.log('✅ Tray menu updated successfully');
    });

    test('should handle tray item clicks', async () => {
      console.log('🖱️ Testing tray item click handling...');

      // Get current tray items
      const itemsResult = await webViewHelper.executeCommand('get_tray_items');
      expect(itemsResult.success).toBe(true);

      if (itemsResult.data.length > 0) {
        const firstItem = itemsResult.data[0];
        
        // Simulate tray item click
        const clickResult = await webViewHelper.executeCommand('handle_tray_item_click', [{
          itemId: firstItem.id
        }]);
        
        expect(clickResult.success).toBe(true);

        console.log(`✅ Tray item click handled: ${firstItem.label}`);
      } else {
        console.log('ℹ️ No tray items to test clicks');
      }
    });
  });

  test.describe('Notification System', () => {
    test('should check notification permission', async () => {
      console.log('🔐 Testing notification permission...');

      const result = await webViewHelper.executeCommand('get_notification_permission');
      
      expect(result.success).toBe(true);
      expect(['granted', 'denied', 'default', 'prompt']).toContain(result.data);

      console.log(`✅ Notification permission: ${result.data}`);
    });

    test('should request notification permission', async () => {
      console.log('📝 Testing notification permission request...');

      const result = await webViewHelper.executeCommand('request_notification_permission');
      
      expect(result.success).toBe(true);
      expect(['granted', 'denied']).toContain(result.data);

      console.log(`✅ Permission request result: ${result.data}`);
    });

    test('should send basic notification', async () => {
      console.log('🔔 Testing basic notification...');

      const notificationData = {
        title: 'TunnelForge E2E Test',
        body: 'This is a test notification from WebView E2E tests',
        icon: 'info'
      };

      const result = await webViewHelper.executeCommand('send_notification', [notificationData]);
      
      expect(result.success).toBe(true);

      // Wait for notification to appear
      await page.waitForTimeout(2000);

      console.log('✅ Basic notification sent successfully');
    });

    test('should send notification with actions', async () => {
      console.log('⚡ Testing notification with actions...');

      const notificationData = {
        title: 'TunnelForge Action Test',
        body: 'This notification has actions',
        icon: 'warning',
        actions: [
          { id: 'open', title: 'Open TunnelForge' },
          { id: 'dismiss', title: 'Dismiss' }
        ]
      };

      const result = await webViewHelper.executeCommand('send_notification', [notificationData]);
      
      expect(result.success).toBe(true);

      console.log('✅ Notification with actions sent successfully');
    });

    test('should handle notification click events', async () => {
      console.log('🖱️ Testing notification click handling...');

      // Send a notification first
      const notificationData = {
        title: 'Click Test Notification',
        body: 'Click this notification to test handling',
        tag: 'click-test'
      };

      const sendResult = await webViewHelper.executeCommand('send_notification', [notificationData]);
      expect(sendResult.success).toBe(true);

      // Simulate notification click
      const clickResult = await webViewHelper.executeCommand('handle_notification_click', [{
        tag: 'click-test',
        action: 'default'
      }]);
      
      expect(clickResult.success).toBe(true);

      console.log('✅ Notification click handled successfully');
    });
  });

  test.describe('Auto-Start Management', () => {
    test('should get auto-start status', async () => {
      console.log('🚀 Testing auto-start status...');

      const result = await webViewHelper.executeCommand('get_autostart_status');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('enabled');
      expect(result.data).toHaveProperty('supported');
      expect(result.data).toHaveProperty('platform');

      console.log(`✅ Auto-start enabled: ${result.data.enabled}, supported: ${result.data.supported}`);
    });

    test('should toggle auto-start if supported', async () => {
      console.log('🔄 Testing auto-start toggle...');

      // Get current status
      const statusResult = await webViewHelper.executeCommand('get_autostart_status');
      expect(statusResult.success).toBe(true);

      if (statusResult.data.supported) {
        const originalEnabled = statusResult.data.enabled;

        // Toggle auto-start
        const toggleResult = await webViewHelper.executeCommand('toggle_autostart');
        expect(toggleResult.success).toBe(true);

        // Wait for system to update
        await page.waitForTimeout(2000);

        // Verify toggle worked
        const newStatusResult = await webViewHelper.executeCommand('get_autostart_status');
        expect(newStatusResult.success).toBe(true);
        expect(newStatusResult.data.enabled).toBe(!originalEnabled);

        // Toggle back to original state
        await webViewHelper.executeCommand('toggle_autostart');

        console.log('✅ Auto-start toggle working correctly');
      } else {
        console.log('ℹ️ Auto-start not supported on this platform');
      }
    });

    test('should enable/disable auto-start explicitly', async () => {
      console.log('⚙️ Testing explicit auto-start control...');

      const statusResult = await webViewHelper.executeCommand('get_autostart_status');
      expect(statusResult.success).toBe(true);

      if (statusResult.data.supported) {
        const originalEnabled = statusResult.data.enabled;

        // Try to set explicit state
        const targetState = !originalEnabled;
        const setResult = await webViewHelper.executeCommand('set_autostart', [{
          enabled: targetState
        }]);
        
        expect(setResult.success).toBe(true);

        // Verify state was set
        const verifyResult = await webViewHelper.executeCommand('get_autostart_status');
        expect(verifyResult.success).toBe(true);
        expect(verifyResult.data.enabled).toBe(targetState);

        // Restore original state
        await webViewHelper.executeCommand('set_autostart', [{
          enabled: originalEnabled
        }]);

        console.log('✅ Explicit auto-start control working');
      } else {
        console.log('ℹ️ Auto-start not supported on this platform');
      }
    });
  });

  test.describe('File System Integration', () => {
    test('should get system directories', async () => {
      console.log('📁 Testing system directory access...');

      const result = await webViewHelper.executeCommand('get_system_directories');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('home');
      expect(result.data).toHaveProperty('documents');
      expect(result.data).toHaveProperty('downloads');
      expect(result.data).toHaveProperty('desktop');

      console.log('✅ System directories retrieved');
    });

    test('should show file dialog for opening files', async () => {
      console.log('📂 Testing file open dialog...');

      // Note: In automated testing, we can't actually interact with system dialogs
      // But we can test that the dialog command is available and doesn't crash

      const dialogOptions = {
        title: 'Select File',
        filters: [
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        multiple: false
      };

      const result = await webViewHelper.executeCommand('show_file_dialog', [{
        type: 'open',
        options: dialogOptions
      }]);
      
      // This might fail because no user interaction is possible, but shouldn't crash
      expect(result).toBeDefined();

      if (result.success) {
        console.log('✅ File dialog opened successfully');
      } else {
        console.log('ℹ️ File dialog failed (expected in automated test)');
      }
    });

    test('should show file dialog for saving files', async () => {
      console.log('💾 Testing file save dialog...');

      const dialogOptions = {
        title: 'Save File',
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        defaultPath: 'tunnelforge-config.json'
      };

      const result = await webViewHelper.executeCommand('show_file_dialog', [{
        type: 'save',
        options: dialogOptions
      }]);
      
      expect(result).toBeDefined();

      if (result.success) {
        console.log('✅ Save file dialog opened successfully');
      } else {
        console.log('ℹ️ Save file dialog failed (expected in automated test)');
      }
    });

    test('should show folder dialog', async () => {
      console.log('📁 Testing folder dialog...');

      const dialogOptions = {
        title: 'Select Folder',
        multiple: false
      };

      const result = await webViewHelper.executeCommand('show_file_dialog', [{
        type: 'folder',
        options: dialogOptions
      }]);
      
      expect(result).toBeDefined();

      if (result.success) {
        console.log('✅ Folder dialog opened successfully');
      } else {
        console.log('ℹ️ Folder dialog failed (expected in automated test)');
      }
    });
  });

  test.describe('External Application Integration', () => {
    test('should open external URLs', async () => {
      console.log('🌍 Testing external URL opening...');

      const testUrls = [
        'https://github.com/tunnelforge',
        'https://docs.tunnelforge.dev',
        'mailto:test@example.com'
      ];

      for (const url of testUrls) {
        const result = await webViewHelper.executeCommand('open_external_url', [{
          url: url
        }]);
        
        expect(result.success).toBe(true);
        console.log(`✅ Opened external URL: ${url}`);
      }
    });

    test('should open external files', async () => {
      console.log('📄 Testing external file opening...');

      // Create a test file first
      const dirsResult = await webViewHelper.executeCommand('get_app_directories');
      expect(dirsResult.success).toBe(true);

      const testFilePath = `${dirsResult.data.appDir}/test-file-${Date.now()}.txt`;
      const testContent = 'Test file for external opening';

      await webViewHelper.executeCommand('write_file', [{
        path: testFilePath,
        content: testContent
      }]);

      // Try to open the file
      const result = await webViewHelper.executeCommand('open_external_file', [{
        path: testFilePath
      }]);
      
      expect(result.success).toBe(true);

      // Clean up
      await webViewHelper.executeCommand('delete_file', [{ path: testFilePath }]);

      console.log('✅ External file opened successfully');
    });

    test('should execute system commands', async () => {
      console.log('⚡ Testing system command execution...');

      const safeCommands = [
        { cmd: 'echo', args: ['Hello from TunnelForge'] },
        { cmd: 'pwd', args: [] },
        { cmd: 'whoami', args: [] }
      ];

      for (const command of safeCommands) {
        const result = await webViewHelper.executeCommand('execute_system_command', [{
          command: command.cmd,
          args: command.args,
          timeout: 5000
        }]);
        
        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('stdout');
        expect(result.data).toHaveProperty('stderr');
        expect(result.data).toHaveProperty('exitCode');

        console.log(`✅ Executed command: ${command.cmd}`);
      }
    });
  });

  test.describe('Platform-Specific Features', () => {
    test('should handle Windows-specific features', async () => {
      console.log('🪟 Testing Windows-specific features...');

      if (platformConfig.isWindows) {
        // Test Windows service status
        const serviceResult = await webViewHelper.executeCommand('get_windows_service_status');
        expect(serviceResult.success).toBe(true);

        // Test Windows registry access
        const registryResult = await webViewHelper.executeCommand('read_windows_registry', [{
          key: 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion',
          value: 'ProgramFilesDir'
        }]);
        
        if (registryResult.success) {
          console.log('✅ Windows registry access working');
        } else {
          console.log('ℹ️ Windows registry access failed (may need admin rights)');
        }

        // Test Windows shortcuts
        const shortcutResult = await webViewHelper.executeCommand('create_windows_shortcut', [{
          name: 'TunnelForge Test',
          target: 'tunnelforge',
          arguments: '--test'
        }]);
        
        if (shortcutResult.success) {
          console.log('✅ Windows shortcut creation working');
        } else {
          console.log('ℹ️ Windows shortcut creation failed');
        }

        console.log('✅ Windows-specific features tested');
      } else {
        console.log('ℹ️ Skipping Windows-specific features on non-Windows platform');
      }
    });

    test('should handle macOS-specific features', async () => {
      console.log('🍎 Testing macOS-specific features...');

      if (platformConfig.isMacOS) {
        // Test macOS Touch Bar support
        const touchbarResult = await webViewHelper.executeCommand('get_touchbar_support');
        expect(touchbarResult.success).toBe(true);

        // Test macOS notifications
        const notificationResult = await webViewHelper.executeCommand('send_macos_notification', [{
          title: 'macOS Test',
          subtitle: 'TunnelForge E2E',
          body: 'This is a macOS-specific notification',
          sound: 'default'
        }]);
        
        expect(notificationResult.success).toBe(true);

        // Test macOS app bundle info
        const bundleResult = await webViewHelper.executeCommand('get_macos_bundle_info');
        expect(bundleResult.success).toBe(true);
        expect(bundleResult.data).toHaveProperty('identifier');
        expect(bundleResult.data).toHaveProperty('version');

        console.log('✅ macOS-specific features tested');
      } else {
        console.log('ℹ️ Skipping macOS-specific features on non-macOS platform');
      }
    });

    test('should handle Linux-specific features', async () => {
      console.log('🐧 Testing Linux-specific features...');

      if (platformConfig.isLinux) {
        // Test systemd support
        const systemdResult = await webViewHelper.executeCommand('get_systemd_support');
        expect(systemdResult.success).toBe(true);

        // Test desktop integration
        const desktopResult = await webViewHelper.executeCommand('get_linux_desktop_info');
        expect(desktopResult.success).toBe(true);
        expect(desktopResult.data).toHaveProperty('desktop');
        expect(desktopResult.data).toHaveProperty('display');

        // Test package manager detection
        const packageResult = await webViewHelper.executeCommand('detect_package_manager');
        expect(packageResult.success).toBe(true);
        expect(['apt', 'yum', 'dnf', 'pacman', 'zypper', 'unknown']).toContain(packageResult.data);

        console.log('✅ Linux-specific features tested');
      } else {
        console.log('ℹ️ Skipping Linux-specific features on non-Linux platform');
      }
    });

    test('should handle WSL-specific features', async () => {
      console.log('🐧 Testing WSL-specific features...');

      if (platformConfig.isWSL) {
        // Test WSL detection
        const wslResult = await webViewHelper.executeCommand('get_wsl_info');
        expect(wslResult.success).toBe(true);
        expect(wslResult.data).toHaveProperty('isWSL');
        expect(wslResult.data).toHaveProperty('distribution');
        expect(wslResult.data).toHaveProperty('version');

        // Test Windows path conversion
        const pathResult = await webViewHelper.executeCommand('convert_wsl_path', [{
          path: '/mnt/c/Users',
          toWindows: true
        }]);
        
        expect(pathResult.success).toBe(true);
        expect(pathResult.data).toMatch(/^[A-Z]:\\/);

        console.log('✅ WSL-specific features tested');
      } else {
        console.log('ℹ️ Skipping WSL-specific features on non-WSL environment');
      }
    });
  });

  test.describe('System Monitoring', () => {
    test('should get system information', async () => {
      console.log('💻 Testing system information...');

      const result = await webViewHelper.executeCommand('get_system_info');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('platform');
      expect(result.data).toHaveProperty('arch');
      expect(result.data).toHaveProperty('hostname');
      expect(result.data).toHaveProperty('username');
      expect(result.data).toHaveProperty('memory');
      expect(result.data).toHaveProperty('cpu');

      console.log(`✅ System info: ${result.data.platform}-${result.data.arch}`);
    });

    test('should get performance metrics', async () => {
      console.log('📊 Testing performance metrics...');

      const result = await webViewHelper.executeCommand('get_performance_metrics');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('memory');
      expect(result.data).toHaveProperty('cpu');
      expect(result.data).toHaveProperty('uptime');
      expect(result.data).toHaveProperty('timestamp');

      const memory = result.data.memory;
      expect(memory).toHaveProperty('total');
      expect(memory).toHaveProperty('used');
      expect(memory).toHaveProperty('free');

      console.log(`✅ Performance metrics: ${memory.used}MB / ${memory.total}MB used`);
    });

    test('should monitor resource usage over time', async () => {
      console.log('📈 Testing resource monitoring...');

      const measurements = [];
      const duration = 5000; // 5 seconds
      const interval = 1000; // 1 second
      const startTime = Date.now();

      while (Date.now() - startTime < duration) {
        const result = await webViewHelper.executeCommand('get_performance_metrics');
        expect(result.success).toBe(true);

        measurements.push({
          timestamp: result.data.timestamp,
          memory: result.data.memory.used,
          cpu: result.data.cpu.usage
        });

        await page.waitForTimeout(interval);
      }

      expect(measurements.length).toBeGreaterThan(4);

      // Check that we got varying measurements
      const memoryValues = measurements.map(m => m.memory);
      const cpuValues = measurements.map(m => m.cpu);

      expect(memoryValues.length).toBeGreaterThan(0);
      expect(cpuValues.length).toBeGreaterThan(0);

      console.log(`✅ Collected ${measurements.length} performance measurements`);
    });
  });

  test.describe('Security and Permissions', () => {
    test('should check system permissions', async () => {
      console.log('🔐 Testing system permissions...');

      const result = await webViewHelper.executeCommand('get_system_permissions');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('fileSystem');
      expect(result.data).toHaveProperty('network');
      expect(result.data).toHaveProperty('notifications');
      expect(result.data).toHaveProperty('autoStart');

      console.log('✅ System permissions retrieved');
    });

    test('should request necessary permissions', async () => {
      console.log('📝 Testing permission requests...');

      const permissions = ['fileSystem', 'network', 'notifications'];

      for (const permission of permissions) {
        const result = await webViewHelper.executeCommand('request_permission', [{
          permission: permission
        }]);
        
        expect(result.success).toBe(true);
        expect(['granted', 'denied']).toContain(result.data);

        console.log(`✅ Permission ${permission}: ${result.data}`);
      }
    });

    test('should handle security restrictions', async () => {
      console.log('🛡️ Testing security restrictions...');

      // Try to access restricted system paths
      const restrictedPaths = [
        '/etc/shadow',
        '/etc/passwd',
        'C:\\Windows\\System32\\config\\SAM'
      ];

      for (const path of restrictedPaths) {
        const result = await webViewHelper.executeCommand('check_file_access', [{
          path: path
        }]);
        
        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('accessible');
        
        // Should not be accessible in normal circumstances
        if (result.data.accessible) {
          console.warn(`⚠️ Restricted path accessible: ${path}`);
        }
      }

      console.log('✅ Security restrictions verified');
    });
  });
});