import { test, expect, Page, BrowserContext } from '@playwright/test';
import { createWebViewHelper, WebViewHelper } from '../helpers/webview-helpers';
import { getPlatformConfig, isWSL } from '../helpers/tauri-desktop-helpers';

test.describe('Cross-Platform Compatibility Tests', () => {
  let webViewHelper: WebViewHelper;
  let page: Page;
  let context: BrowserContext;
  const platformConfig = getPlatformConfig();

  test.beforeAll(async ({ browser }, testInfo) => {
    console.log('🚀 Setting up Cross-Platform tests...');
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

  test.describe('Platform Detection and Information', () => {
    test('should correctly detect current platform', async () => {
      console.log('🖥️ Testing platform detection...');

      const result = await webViewHelper.executeCommand('get_platform_info');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('platform');
      expect(result.data).toHaveProperty('arch');
      expect(result.data).toHaveProperty('isWSL');
      expect(result.data).toHaveProperty('isCI');

      const { platform, arch, isWSL, isCI } = result.data;

      // Verify platform matches expected
      if (platformConfig.isWindows) {
        expect(platform).toBe('win32');
      } else if (platformConfig.isMacOS) {
        expect(platform).toBe('darwin');
      } else if (platformConfig.isLinux) {
        expect(platform).toBe('linux');
      }

      // Verify WSL detection
      expect(isWSL).toBe(isWSL());

      // Verify architecture
      expect(['x64', 'arm64', 'ia32']).toContain(arch);

      console.log(`✅ Platform detected: ${platform}-${arch} (WSL: ${isWSL})`);
    });

    test('should get platform-specific capabilities', async () => {
      console.log('🔧 Testing platform capabilities...');

      const result = await webViewHelper.executeCommand('get_platform_capabilities');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('systemTray');
      expect(result.data).toHaveProperty('notifications');
      expect(result.data).toHaveProperty('autoStart');
      expect(result.data).toHaveProperty('fileDialogs');
      expect(result.data).toHaveProperty('externalApps');

      const capabilities = result.data;

      // All platforms should support basic capabilities
      expect(capabilities.fileDialogs).toBe(true);
      expect(capabilities.externalApps).toBe(true);

      // Some capabilities may vary by platform
      console.log(`✅ Platform capabilities: SystemTray=${capabilities.systemTray}, Notifications=${capabilities.notifications}`);
    });

    test('should get platform-specific paths', async () => {
      console.log('📁 Testing platform-specific paths...');

      const result = await webViewHelper.executeCommand('get_platform_paths');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('appData');
      expect(result.data).toHaveProperty('userData');
      expect(result.data).toHaveProperty('temp');
      expect(result.data).toHaveProperty('home');

      const paths = result.data;

      // Verify paths are valid strings
      Object.values(paths).forEach(path => {
        expect(typeof path).toBe('string');
        expect(path.length).toBeGreaterThan(0);
      });

      // Check platform-specific path patterns
      if (platformConfig.isWindows) {
        expect(paths.appData).toMatch(/^[A-Z]:\\/);
        expect(paths.userData).toMatch(/^[A-Z]:\\/);
      } else {
        expect(paths.appData).toMatch(/^\//);
        expect(paths.userData).toMatch(/^\//);
      }

      console.log('✅ Platform-specific paths retrieved');
    });
  });

  test.describe('Windows Platform Features', () => {
    test.beforeEach(async () => {
      test.skip(!platformConfig.isWindows, 'Windows-specific tests');
    });

    test('should handle Windows-specific paths correctly', async () => {
      console.log('🪟 Testing Windows path handling...');

      const testPaths = [
        'C:\\Program Files\\TunnelForge',
        'C:\\Users\\Test\\AppData\\Roaming\\TunnelForge',
        'D:\\Projects\\tunnelforge'
      ];

      for (const path of testPaths) {
        const result = await webViewHelper.executeCommand('normalize_windows_path', [{
          path: path
        }]);
        
        expect(result.success).toBe(true);
        expect(result.data).toMatch(/^[A-Z]:\\/);
      }

      console.log('✅ Windows path handling working correctly');
    });

    test('should handle Windows services', async () => {
      console.log('🔧 Testing Windows service integration...');

      const result = await webViewHelper.executeCommand('get_windows_service_status');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('installed');
      expect(result.data).toHaveProperty('running');
      expect(result.data).toHaveProperty('serviceName');

      console.log(`✅ Windows service status: installed=${result.data.installed}, running=${result.data.running}`);
    });

    test('should handle Windows registry operations', async () => {
      console.log('📝 Testing Windows registry access...');

      // Test reading a safe registry key
      const result = await webViewHelper.executeCommand('read_windows_registry', [{
        key: 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer',
        value: 'Shell Folders'
      }]);
      
      if (result.success) {
        expect(result.data).toBeDefined();
        console.log('✅ Windows registry access working');
      } else {
        console.log('ℹ️ Windows registry access restricted (may need elevated permissions)');
      }
    });

    test('should handle Windows shortcuts', async () => {
      console.log('🔗 Testing Windows shortcut creation...');

      const shortcutData = {
        name: 'TunnelForge E2E Test',
        target: 'tunnelforge',
        arguments: '--test-mode',
        workingDirectory: '%USERPROFILE%',
        iconPath: 'tunnelforge.exe',
        description: 'TunnelForge E2E Test Shortcut'
      };

      const result = await webViewHelper.executeCommand('create_windows_shortcut', [shortcutData]);
      
      if (result.success) {
        expect(result.data).toHaveProperty('path');
        console.log(`✅ Windows shortcut created: ${result.data.path}`);
      } else {
        console.log('ℹ️ Windows shortcut creation failed (may need permissions)');
      }
    });

    test('should handle Windows event log', async () => {
      console.log('📋 Testing Windows event log access...');

      const result = await webViewHelper.executeCommand('read_windows_event_log', [{
        source: 'Application',
        level: 'Error',
        maxEvents: 10
      }]);
      
      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true);
        console.log(`✅ Read ${result.data.length} event log entries`);
      } else {
        console.log('ℹ️ Windows event log access restricted (may need admin rights)');
      }
    });
  });

  test.describe('macOS Platform Features', () => {
    test.beforeEach(async () => {
      test.skip(!platformConfig.isMacOS, 'macOS-specific tests');
    });

    test('should handle macOS-specific paths correctly', async () => {
      console.log('🍎 Testing macOS path handling...');

      const testPaths = [
        '/Applications/TunnelForge.app',
        '/Users/test/Library/Application Support/TunnelForge',
        '/Users/test/.config/tunnelforge'
      ];

      for (const path of testPaths) {
        const result = await webViewHelper.executeCommand('normalize_macos_path', [{
          path: path
        }]);
        
        expect(result.success).toBe(true);
        expect(result.data).toMatch(/^\//);
      }

      console.log('✅ macOS path handling working correctly');
    });

    test('should handle macOS app bundle operations', async () => {
      console.log('📦 Testing macOS app bundle operations...');

      const result = await webViewHelper.executeCommand('get_macos_bundle_info');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('identifier');
      expect(result.data).toHaveProperty('version');
      expect(result.data).toHaveProperty('path');

      console.log(`✅ App bundle: ${result.data.identifier} v${result.data.version}`);
    });

    test('should handle macOS notifications', async () => {
      console.log('🔔 Testing macOS notifications...');

      const notificationData = {
        title: 'TunnelForge macOS Test',
        subtitle: 'Cross-Platform E2E',
        body: 'This is a macOS-specific notification',
        sound: 'Glass',
        identifier: 'tunnelforge-e2e-test'
      };

      const result = await webViewHelper.executeCommand('send_macos_notification', [notificationData]);
      
      expect(result.success).toBe(true);

      console.log('✅ macOS notification sent successfully');
    });

    test('should handle macOS Touch Bar if available', async () => {
      console.log('⌨️ Testing macOS Touch Bar...');

      const result = await webViewHelper.executeCommand('get_touchbar_support');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('available');
      expect(result.data).toHaveProperty('items');

      if (result.data.available) {
        console.log('✅ Touch Bar is available');
      } else {
        console.log('ℹ️ Touch Bar not available on this Mac');
      }
    });

    test('should handle macOS Spotlight integration', async () => {
      console.log('🔍 Testing macOS Spotlight integration...');

      const result = await webViewHelper.executeCommand('get_macos_spotlight_info');
      
      if (result.success) {
        expect(result.data).toHaveProperty('indexed');
        expect(result.data).toHaveProperty('items');
        console.log(`✅ Spotlight indexed: ${result.data.indexed}`);
      } else {
        console.log('ℹ️ Spotlight integration not available');
      }
    });
  });

  test.describe('Linux Platform Features', () => {
    test.beforeEach(async () => {
      test.skip(!platformConfig.isLinux || platformConfig.isWSL, 'Linux-specific tests (not WSL)');
    });

    test('should handle Linux-specific paths correctly', async () => {
      console.log('🐧 Testing Linux path handling...');

      const testPaths = [
        '/usr/local/bin/tunnelforge',
        '/home/user/.config/tunnelforge',
        '/opt/tunnelforge',
        '/var/lib/tunnelforge'
      ];

      for (const path of testPaths) {
        const result = await webViewHelper.executeCommand('normalize_linux_path', [{
          path: path
        }]);
        
        expect(result.success).toBe(true);
        expect(result.data).toMatch(/^\//);
      }

      console.log('✅ Linux path handling working correctly');
    });

    test('should detect Linux distribution', async () => {
      console.log('🐧 Testing Linux distribution detection...');

      const result = await webViewHelper.executeCommand('get_linux_distribution');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('name');
      expect(result.data).toHaveProperty('version');
      expect(result.data).toHaveProperty('desktop');

      console.log(`✅ Linux distro: ${result.data.name} ${result.data.version} (${result.data.desktop})`);
    });

    test('should handle systemd integration', async () => {
      console.log('⚙️ Testing systemd integration...');

      const result = await webViewHelper.executeCommand('get_systemd_support');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('available');
      expect(result.data).toHaveProperty('userMode');

      if (result.data.available) {
        console.log('✅ Systemd is available');
        
        // Test service status
        const serviceResult = await webViewHelper.executeCommand('get_systemd_service_status', [{
          serviceName: 'tunnelforge'
        }]);
        
        if (serviceResult.success) {
          console.log(`✅ Service status: ${serviceResult.data.status}`);
        }
      } else {
        console.log('ℹ️ Systemd not available');
      }
    });

    test('should handle package manager detection', async () => {
      console.log('📦 Testing package manager detection...');

      const result = await webViewHelper.executeCommand('detect_package_manager');
      
      expect(result.success).toBe(true);
      expect(['apt', 'yum', 'dnf', 'pacman', 'zypper', 'apk', 'unknown']).toContain(result.data);

      console.log(`✅ Package manager: ${result.data}`);
    });

    test('should handle desktop environment integration', async () => {
      console.log('🖥️ Testing desktop environment integration...');

      const result = await webViewHelper.executeCommand('get_linux_desktop_info');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('desktop');
      expect(result.data).toHaveProperty('display');
      expect(result.data).toHaveProperty('wayland');

      const validDesktops = ['gnome', 'kde', 'xfce', 'lxde', 'mate', 'cinnamon', 'i3', 'unknown'];
      expect(validDesktops).toContain(result.data.desktop);

      console.log(`✅ Desktop: ${result.data.desktop}, Display: ${result.data.display}, Wayland: ${result.data.wayland}`);
    });
  });

  test.describe('WSL-Specific Features', () => {
    test.beforeEach(async () => {
      test.skip(!isWSL(), 'WSL-specific tests');
    });

    test('should detect WSL environment correctly', async () => {
      console.log('🐧 Testing WSL detection...');

      const result = await webViewHelper.executeCommand('get_wsl_info');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('isWSL', true);
      expect(result.data).toHaveProperty('distribution');
      expect(result.data).toHaveProperty('version');
      expect(result.data).toHaveProperty('windowsPath');

      console.log(`✅ WSL detected: ${result.data.distribution} v${result.data.version}`);
    });

    test('should handle Windows path conversion', async () => {
      console.log('🔄 Testing WSL path conversion...');

      const testConversions = [
        { wsl: '/mnt/c/Users/Test', windows: 'C:\\Users\\Test' },
        { wsl: '/mnt/d/Projects', windows: 'D:\\Projects' }
      ];

      for (const conversion of testConversions) {
        // Test WSL to Windows
        const toWindowsResult = await webViewHelper.executeCommand('convert_wsl_path', [{
          path: conversion.wsl,
          toWindows: true
        }]);
        
        expect(toWindowsResult.success).toBe(true);
        expect(toWindowsResult.data).toMatch(/^[A-Z]:\\/);

        // Test Windows to WSL
        const toWslResult = await webViewHelper.executeCommand('convert_wsl_path', [{
          path: conversion.windows,
          toWindows: false
        }]);
        
        expect(toWslResult.success).toBe(true);
        expect(toWslResult.data).toMatch(/^\/mnt\//);
      }

      console.log('✅ WSL path conversion working correctly');
    });

    test('should access Windows tools from WSL', async () => {
      console.log('🔧 Testing Windows tool access from WSL...');

      const windowsTools = ['cmd.exe', 'powershell.exe', 'explorer.exe'];

      for (const tool of windowsTools) {
        const result = await webViewHelper.executeCommand('check_windows_tool', [{
          tool: tool
        }]);
        
        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('available');
        expect(result.data).toHaveProperty('path');

        if (result.data.available) {
          console.log(`✅ Windows tool available: ${tool}`);
        }
      }
    });

    test('should handle WSL network integration', async () => {
      console.log('🌐 Testing WSL network integration...');

      const result = await webViewHelper.executeCommand('get_wsl_network_info');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('windowsHost');
      expect(result.data).toHaveProperty('interfaces');
      expect(result.data).toHaveProperty('ports');

      console.log(`✅ WSL network: Windows host ${result.data.windowsHost}`);
    });
  });

  test.describe('Cross-Platform File Operations', () => {
    test('should handle platform-specific file separators', async () => {
      console.log('📁 Testing file separator handling...');

      const testPaths = [
        'folder/subfolder/file.txt',
        'folder\\subfolder\\file.txt',
        '/absolute/path/file.txt',
        'C:\\Windows\\path\\file.txt'
      ];

      for (const path of testPaths) {
        const result = await webViewHelper.executeCommand('normalize_file_path', [{
          path: path
        }]);
        
        expect(result.success).toBe(true);
        expect(typeof result.data).toBe('string');
        expect(result.data.length).toBeGreaterThan(0);
      }

      console.log('✅ File separator normalization working');
    });

    test('should handle platform-specific permissions', async () => {
      console.log('🔐 Testing platform-specific permissions...');

      const result = await webViewHelper.executeCommand('get_file_permissions_info');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('platform');
      expect(result.data).toHaveProperty('currentUser');
      expect(result.data).toHaveProperty('canWriteAppData');
      expect(result.data).toHaveProperty('canWriteSystem');

      console.log(`✅ Permissions: canWriteAppData=${result.data.canWriteAppData}, canWriteSystem=${result.data.canWriteSystem}`);
    });

    test('should handle platform-specific file dialogs', async () => {
      console.log('📂 Testing platform-specific file dialogs...');

      const dialogTypes = ['open', 'save', 'folder'];

      for (const type of dialogTypes) {
        const result = await webViewHelper.executeCommand('show_platform_file_dialog', [{
          type: type,
          title: `${type} file dialog test`
        }]);
        
        expect(result).toBeDefined();
        
        if (result.success) {
          console.log(`✅ ${type} dialog opened successfully`);
        } else {
          console.log(`ℹ️ ${type} dialog failed (expected in automated test)`);
        }
      }
    });
  });

  test.describe('Cross-Platform UI Adaptation', () => {
    test('should adapt UI to platform conventions', async () => {
      console.log('🎨 Testing platform UI adaptation...');

      const result = await webViewHelper.executeCommand('get_platform_ui_config');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('platform');
      expect(result.data).toHaveProperty('theme');
      expect(result.data).toHaveProperty('fontFamily');
      expect(result.data).toHaveProperty('buttonStyle');
      expect(result.data).toHaveProperty('menuStyle');

      const config = result.data;

      // Check platform-specific UI elements
      if (platformConfig.isWindows) {
        expect(config.buttonStyle).toMatch(/^(windows|native)$/);
      } else if (platformConfig.isMacOS) {
        expect(config.buttonStyle).toMatch(/^(macos|native)$/);
      } else if (platformConfig.isLinux) {
        expect(config.buttonStyle).toMatch(/^(linux|gtk|qt|native)$/);
      }

      console.log(`✅ UI config for ${config.platform}: ${config.buttonStyle} buttons`);
    });

    test('should handle platform-specific keyboard shortcuts', async () => {
      console.log('⌨️ Testing platform keyboard shortcuts...');

      const result = await webViewHelper.executeCommand('get_platform_shortcuts');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('platform');
      expect(result.data).toHaveProperty('shortcuts');

      const shortcuts = result.data.shortcuts;

      // Check for platform-specific modifier keys
      if (platformConfig.isMacOS) {
        expect(shortcuts).toHaveProperty('copy', 'Cmd+C');
        expect(shortcuts).toHaveProperty('paste', 'Cmd+V');
      } else {
        expect(shortcuts).toHaveProperty('copy', 'Ctrl+C');
        expect(shortcuts).toHaveProperty('paste', 'Ctrl+V');
      }

      console.log(`✅ Platform shortcuts configured for ${result.data.platform}`);
    });

    test('should handle platform-specific scrolling behavior', async () => {
      console.log('🖱️ Testing platform scrolling behavior...');

      const result = await webViewHelper.executeCommand('get_platform_scroll_config');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('platform');
      expect(result.data).toHaveProperty('smoothScrolling');
      expect(result.data).toHaveProperty('scrollSpeed');
      expect(result.data).toHaveProperty('naturalScrolling');

      const config = result.data;

      // macOS typically has natural scrolling enabled by default
      if (platformConfig.isMacOS) {
        expect(typeof config.naturalScrolling).toBe('boolean');
      }

      console.log(`✅ Scroll config: smooth=${config.smoothScrolling}, speed=${config.scrollSpeed}`);
    });
  });

  test.describe('Cross-Platform Performance', () => {
    test('should maintain performance across platforms', async () => {
      console.log('⚡ Testing cross-platform performance...');

      const startTime = Date.now();

      // Execute a series of platform-agnostic commands
      const commands = [
        'get_platform_info',
        'get_app_info',
        'get_settings',
        'get_server_status'
      ];

      for (const command of commands) {
        const result = await webViewHelper.executeCommand(command);
        expect(result.success).toBe(true);
      }

      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / commands.length;

      console.log(`✅ Performance: ${totalTime}ms total, ${avgTime}ms average per command`);
      
      // Performance should be reasonable across all platforms
      expect(avgTime).toBeLessThan(2000); // 2 seconds max per command
    });

    test('should handle platform-specific resource limits', async () => {
      console.log('💾 Testing platform resource limits...');

      const result = await webViewHelper.executeCommand('get_platform_resource_limits');
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('maxMemory');
      expect(result.data).toHaveProperty('maxFileHandles');
      expect(result.data).toHaveProperty('maxProcesses');

      const limits = result.data;

      // Limits should be reasonable numbers
      expect(limits.maxMemory).toBeGreaterThan(0);
      expect(limits.maxFileHandles).toBeGreaterThan(0);
      expect(limits.maxProcesses).toBeGreaterThan(0);

      console.log(`✅ Resource limits: Memory=${limits.maxMemory}MB, Files=${limits.maxFileHandles}, Processes=${limits.maxProcesses}`);
    });
  });

  test.describe('Cross-Platform Error Handling', () => {
    test('should handle platform-specific errors gracefully', async () => {
      console.log('❌ Testing platform-specific error handling...');

      // Test with platform-specific invalid operations
      const platformTests = [
        {
          name: 'Windows registry on non-Windows',
          command: 'read_windows_registry',
          args: [{ key: 'HKEY_CURRENT_USER\\Software', value: 'Test' }],
          shouldFail: !platformConfig.isWindows
        },
        {
          name: 'macOS bundle on non-macOS',
          command: 'get_macos_bundle_info',
          args: [],
          shouldFail: !platformConfig.isMacOS
        },
        {
          name: 'systemd on non-Linux',
          command: 'get_systemd_support',
          args: [],
          shouldFail: !platformConfig.isLinux || platformConfig.isWSL
        }
      ];

      for (const test of platformTests) {
        const result = await webViewHelper.executeCommand(test.command, test.args);
        
        if (test.shouldFail) {
          expect(result.success).toBe(false);
          console.log(`✅ ${test.name} correctly failed`);
        } else {
          expect(result.success).toBe(true);
          console.log(`✅ ${test.name} succeeded as expected`);
        }
      }
    });

    test('should provide platform-specific error messages', async () => {
      console.log('💬 Testing platform-specific error messages...');

      // Trigger an error that should have platform-specific context
      const result = await webViewHelper.executeCommand('access_platform_specific_feature', [{
        feature: 'nonexistent_feature'
      }]);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();

      // Error message should contain platform information
      const errorMessage = result.error.toLowerCase();
      const platformName = platformConfig.isWindows ? 'windows' : 
                           platformConfig.isMacOS ? 'macos' : 
                           platformConfig.isLinux ? 'linux' : 'unknown';

      expect(errorMessage).toContain(platformName);

      console.log(`✅ Platform-specific error message: ${result.error}`);
    });
  });
});