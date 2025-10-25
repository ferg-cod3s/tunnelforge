import { test, expect, beforeAll, afterAll } from '@playwright/test';
import { createTauriDesktopHelper, getPlatformConfig } from './helpers/tauri-desktop-helpers';
import { detectWSLEnvironment, setupX11Display, validateWSLSetup } from './helpers/wsl-helpers';

test.describe('Tauri App Lifecycle Tests', () => {
  let helper: any;
  const platformConfig = getPlatformConfig();

  beforeAll(async ({ page, context, browserName }, testInfo) => {
    console.log('🚀 Setting up Tauri App Lifecycle tests...');
    
    // WSL-specific setup
    if (platformConfig.isWSL) {
      console.log('🖥️ Detected WSL environment, setting up X11...');
      const wslConfig = await detectWSLEnvironment();
      
      if (!wslConfig.x11Running) {
        await setupX11Display(wslConfig);
      }
      
      const isValid = await validateWSLSetup();
      if (!isValid) {
        throw new Error('WSL setup validation failed');
      }
    }
    
    // Create helper
    helper = createTauriDesktopHelper(page, context, testInfo);
    await helper.setupLogging();
    await helper.waitForTauriApp();
  });

  afterAll(async () => {
    if (helper) {
      await helper.cleanup();
    }
  });

  test('should initialize Tauri app successfully', async () => {
    console.log('🧪 Testing Tauri app initialization...');
    
    // Check if Tauri API is available
    const tauriAvailable = await helper.page.evaluate(() => {
      return typeof window !== 'undefined' && 
             window.__TAURI__ && 
             window.__TAURI__.invoke &&
             window.__TAURI__.app &&
             window.__TAURI__.window;
    });
    
    expect(tauriAvailable).toBe(true);
    
    // Get app info
    const appInfo = await helper.getAppInfo();
    console.log('📱 App info:', appInfo);
    
    expect(appInfo.name).toContain('TunnelForge');
    expect(appInfo.version).toBeTruthy();
  });

  test('should have proper system information', async () => {
    console.log('🧪 Testing system information...');
    
    const systemInfo = await helper.getSystemInfo();
    console.log('💻 System info:', systemInfo);
    
    expect(systemInfo.platform).toBeTruthy();
    expect(systemInfo.arch).toBeTruthy();
    expect(systemInfo.tauriVersion).toBeTruthy();
    
    // WSL-specific checks
    if (platformConfig.isWSL) {
      expect(systemInfo.isWSL).toBe(true);
    }
  });

  test('should handle window operations correctly', async () => {
    console.log('🧪 Testing window operations...');
    
    await helper.testWindowOperations();
    
    // Additional window-specific tests
    const windowTitle = await helper.page.evaluate(() => {
      return window.__TAURI__?.window?.getCurrentWindow()?.title?.();
    });
    
    expect(windowTitle).toContain('TunnelForge');
  });

  test('should handle file system operations', async () => {
    console.log('🧪 Testing file system operations...');
    
    await helper.testFileSystemOperations();
  });

  test('should handle shell operations securely', async () => {
    console.log('🧪 Testing shell operations...');
    
    await helper.testShellOperations();
  });

  test('should handle notifications', async () => {
    console.log('🧪 Testing notifications...');
    
    await helper.testNotifications();
  });

  test('should handle system tray functionality', async () => {
    console.log('🧪 Testing system tray...');
    
    await helper.testSystemTray();
  });

  test('should capture screenshots properly', async () => {
    console.log('🧪 Testing screenshot capture...');
    
    const screenshotPath = await helper.takeScreenshot('app-lifecycle-test');
    
    // Verify screenshot was created
    const fs = require('fs/promises');
    try {
      await fs.access(screenshotPath);
      console.log('✅ Screenshot created successfully');
    } catch (error) {
      throw new Error(`Screenshot not found at ${screenshotPath}`);
    }
  });

  test('should handle errors gracefully', async () => {
    console.log('🧪 Testing error handling...');
    
    // Try to invoke a non-existent command
    try {
      await helper.invokeTauriCommand('non_existent_command', [], { retries: 0 });
      throw new Error('Should have thrown an error');
    } catch (error) {
      expect(error.message).toContain('non_existent_command');
    }
    
    // Try invalid file operations
    try {
      await helper.invokeTauriCommand('tauri', ['fs', 'readTextFile'], {
        path: '/non/existent/file.txt'
      });
      throw new Error('Should have thrown an error');
    } catch (error) {
      expect(error.message).toBeTruthy();
    }
  });

  test('should maintain app state during test execution', async () => {
    console.log('🧪 Testing app state persistence...');
    
    // Get initial state
    const initialTitle = await helper.page.evaluate(() => {
      return window.__TAURI__?.window?.getCurrentWindow()?.title?.();
    });
    
    // Perform some operations
    await helper.invokeTauriCommand('tauri', ['app', 'info']);
    
    // Check state is maintained
    const finalTitle = await helper.page.evaluate(() => {
      return window.__TAURI__?.window?.getCurrentWindow()?.title?.();
    });
    
    expect(finalTitle).toBe(initialTitle);
  });

  // Platform-specific tests
  test.describe('Platform-specific functionality', () => {
    test('should handle WSL-specific features', async () => {
      test.skip(!platformConfig.isWSL, 'Skipping non-WSL environment');
      
      console.log('🧪 Testing WSL-specific features...');
      
      // Check WSL environment variables
      const wslEnv = await helper.page.evaluate(() => {
        return {
          display: process.env.DISPLAY,
          xdgRuntimeDir: process.env.XDG_RUNTIME_DIR,
        };
      });
      
      expect(wslEnv.display).toBeTruthy();
    });

    test('should handle Windows-specific features', async () => {
      test.skip(!platformConfig.isWindows, 'Skipping non-Windows environment');
      
      console.log('🧪 Testing Windows-specific features...');
      
      // Windows-specific tests would go here
      const isWindows = await helper.page.evaluate(() => {
        return navigator.platform.includes('Win');
      });
      
      expect(isWindows).toBe(true);
    });

    test('should handle macOS-specific features', async () => {
      test.skip(!platformConfig.isMacOS, 'Skipping non-macOS environment');
      
      console.log('🧪 Testing macOS-specific features...');
      
      // macOS-specific tests would go here
      const isMacOS = await helper.page.evaluate(() => {
        return navigator.platform.includes('Mac');
      });
      
      expect(isMacOS).toBe(true);
    });

    test('should handle Linux-specific features', async () => {
      test.skip(!platformConfig.isLinux || platformConfig.isWSL, 'Skipping non-Linux environment');
      
      console.log('🧪 Testing Linux-specific features...');
      
      // Linux-specific tests would go here
      const isLinux = await helper.page.evaluate(() => {
        return navigator.platform.includes('Linux');
      });
      
      expect(isLinux).toBe(true);
    });
  });

  test.describe('Performance and stability', () => {
    test('should handle rapid command execution', async () => {
      console.log('🧪 Testing rapid command execution...');
      
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(helper.invokeTauriCommand('tauri', ['app', 'info']));
      }
      
      const results = await Promise.all(promises);
      expect(results).toHaveLength(10);
      
      // All results should be valid
      results.forEach(result => {
        expect(result).toBeTruthy();
        expect(result.name).toContain('TunnelForge');
      });
    });

    test('should handle timeout scenarios', async () => {
      console.log('🧪 Testing timeout scenarios...');
      
      // Test with very short timeout
      try {
        await helper.invokeTauriCommand('tauri', ['app', 'info'], [], { timeout: 1 });
        throw new Error('Should have timed out');
      } catch (error) {
        expect(error.message).toContain('timeout');
      }
    });

    test('should maintain performance during extended operations', async () => {
      console.log('🧪 Testing extended operations performance...');
      
      const startTime = Date.now();
      
      // Perform multiple file operations
      for (let i = 0; i < 5; i++) {
        await helper.testFileSystemOperations();
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`⏱️ Extended operations took ${duration}ms`);
      
      // Should complete within reasonable time (adjust as needed)
      expect(duration).toBeLessThan(30000); // 30 seconds
    });
  });
});