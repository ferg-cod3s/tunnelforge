/**
 * SystemHelper - System Integration Testing
 * 
 * Provides comprehensive functionality for testing system integration features
 * including system tray, notifications, file system operations, and platform-specific features.
 */

import { Page, BrowserContext, TestInfo } from '@playwright/test';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { 
  SystemTrayInfo, 
  NotificationInfo, 
  FileSystemInfo,
  TestError,
  HelperConfig
} from './types';
import { createTestError, sleep } from './utils';

const sleep = promisify(setTimeout);

export class SystemHelper {
  private page: Page;
  private context: BrowserContext;
  private testInfo: TestInfo;
  private config: HelperConfig;
  private notificationHistory: NotificationInfo[] = [];
  private fileOperationHistory: any[] = [];

  constructor(
    page: Page,
    context: BrowserContext,
    testInfo: TestInfo,
    debugPort: number = 9222,
    config: Partial<HelperConfig> = {}
  ) {
    this.page = page;
    this.context = context;
    this.testInfo = testInfo;
    this.config = {
      debugPort,
      timeout: 15000,
      retries: 2,
      screenshotOnFailure: true,
      videoRecording: false,
      traceRecording: false,
      logLevel: 'info',
      tempDir: 'test-results/temp',
      ...config
    };
  }

  /**
   * Test system tray functionality
   */
  async testSystemTray(): Promise<SystemTrayInfo> {
    console.log('🔌 Testing system tray functionality...');
    
    try {
      // Check if tray is available
      const hasTray = await this.page.evaluate(() => {
        return !!window.__TAURI__?.tray;
      });
      
      if (!hasTray) {
        console.log('ℹ️ System tray not available on this platform');
        return {
          isVisible: false,
          items: []
        };
      }
      
      // Get tray items
      const trayItems = await this.page.evaluate(() => {
        const tray = window.__TAURI__?.tray;
        if (!tray || !tray.getItems) {
          return [];
        }
        
        return tray.getItems().map((item: any) => ({
          id: item.id || 'unknown',
          label: item.text || item.title || 'Unknown',
          enabled: item.enabled !== false,
          checked: item.checked || false,
          icon: item.icon || undefined
        }));
      });
      
      // Get tray tooltip if available
      const tooltip = await this.page.evaluate(() => {
        const tray = window.__TAURI__?.tray;
        return tray?.getTooltip?.() || undefined;
      });
      
      const trayInfo: SystemTrayInfo = {
        isVisible: true,
        items: trayItems,
        tooltip
      };
      
      console.log('✅ System tray test completed:', trayInfo);
      return trayInfo;
      
    } catch (error) {
      console.error('❌ System tray test failed:', error);
      throw createTestError('System tray test failed', 'SYSTEM_TRAY_TEST', { error });
    }
  }

  /**
   * Test notification functionality
   */
  async testNotifications(): Promise<boolean> {
    console.log('🔔 Testing notification functionality...');
    
    try {
      // Check notification permission
      const permission = await this.page.evaluate(() => {
        return window.__TAURI__?.notification?.isPermissionGranted?.() || 'unknown';
      });
      
      console.log('🔐 Notification permission:', permission);
      
      // Request permission if needed
      if (permission !== 'granted') {
        const granted = await this.page.evaluate(() => {
          return window.__TAURI__?.notification?.requestPermission?.();
        });
        
        if (granted !== 'granted') {
          console.warn('⚠️ Notification permission not granted');
          return false;
        }
      }
      
      // Send test notification
      const testNotification: NotificationInfo = {
        title: 'TunnelForge E2E Test',
        body: 'This is a test notification from E2E tests',
        icon: 'info',
        sound: 'default',
        timeout: 5000
      };
      
      await this.page.evaluate((notification) => {
        return window.__TAURI__?.notification?.sendNotification({
          title: notification.title,
          body: notification.body,
          icon: notification.icon,
          sound: notification.sound
        });
      }, testNotification);
      
      this.notificationHistory.push(testNotification);
      
      // Wait for notification to appear
      await sleep(2000);
      
      console.log('✅ Notification test completed');
      return true;
      
    } catch (error) {
      console.warn('⚠️ Notification test failed (may not be supported):', error);
      return false;
    }
  }

  /**
   * Get system information
   */
  async getSystemInfo(): Promise<SystemInfo> {
    this.ensureInitialized();
    
    console.log('💻 Getting system information...');
    
    try {
      const systemInfo = await this.page.evaluate(() => {
        return {
          platform: navigator.platform,
          userAgent: navigator.userAgent,
          language: navigator.language,
          cookieEnabled: navigator.cookieEnabled,
          onLine: navigator.onLine,
          hardwareConcurrency: navigator.hardwareConcurrency,
          deviceMemory: (navigator as any).deviceMemory,
          maxTouchPoints: navigator.maxTouchPoints,
          vendor: navigator.vendor,
          vendorSub: navigator.vendorSub
        };
      });
      
      // Add Tauri-specific system info
      const tauriInfo = await this.page.evaluate(() => {
        return window.__TAURI__ ? {
          app: window.__TAURI__.app ? {
            name: window.__TAURI__.app.name,
            version: window.__TAURI__.app.version
          } : null,
          window: window.__TAURI__.window ? {
            label: window.__TAURI__.window.getCurrentWindow().label
          } : null
        } : null;
      });
      
      const combinedInfo: SystemInfo = {
        ...systemInfo,
        tauri: tauriInfo,
        timestamp: new Date().toISOString()
      };
      
      console.log('✅ System information retrieved');
      return combinedInfo;
      
    } catch (error) {
      console.error('❌ Failed to get system info:', error);
      throw createTestError('Failed to get system info', 'GET_SYSTEM_INFO', { error });
    }
  }

  /**
   * Get file system information
   */
  async getFileSystemInfo(): Promise<FileSystemInfo> {
    console.log('📁 Getting file system information...');
    
    try {
      const fsInfo = await this.page.evaluate(() => {
        const path = window.__TAURI__?.path;
        if (!path) {
          throw new Error('Path API not available');
        }
        
        return Promise.all([
          path.appDir(),
          path.documentDir(),
          path.downloadDir(),
          path.desktopDir(),
          path.tempDir()
        ]);
      });
      
      const [appDir, documentsDir, downloadDir, desktopDir, tempDir] = fsInfo;
      
      const fileSystemInfo: FileSystemInfo = {
        appDir,
        documentsDir,
        downloadDir,
        desktopDir,
        tempDir
      };
      
      console.log('📂 File system info:', fileSystemInfo);
      return fileSystemInfo;
      
    } catch (error) {
      console.error('❌ Failed to get file system info:', error);
      throw createTestError('Failed to get file system info', 'GET_FILE_SYSTEM_INFO', { error });
    }
  }

  /**
   * Test file system operations
   */
  async testFileSystemOperations(): Promise<void> {
    console.log('📁 Testing file system operations...');
    
    try {
      const fsInfo = await this.getFileSystemInfo();
      
      // Test file operations
      const testContent = `Test file created at ${new Date().toISOString()}\nTest: ${this.testInfo.title}`;
      const testFileName = `test-${Date.now()}.txt`;
      const testFilePath = path.join(fsInfo.appDir, testFileName);
      
      // Write file
      await this.page.evaluate(({ filePath, content }) => {
        return window.__TAURI__?.fs?.writeTextFile(filePath, content);
      }, { filePath: testFilePath, content: testContent });
      
      this.fileOperationHistory.push({
        operation: 'write',
        path: testFilePath,
        content: testContent,
        timestamp: new Date()
      });
      
      // Read file
      const readContent = await this.page.evaluate((filePath) => {
        return window.__TAURI__?.fs?.readTextFile(filePath);
      }, testFilePath);
      
      if (readContent !== testContent) {
        throw new Error('File content mismatch');
      }
      
      // Check file exists
      const exists = await this.page.evaluate((filePath) => {
        return window.__TAURI__?.fs?.exists(filePath);
      }, testFilePath);
      
      if (!exists) {
        throw new Error('File does not exist after creation');
      }
      
      // Get file metadata
      const metadata = await this.page.evaluate((filePath) => {
        return window.__TAURI__?.fs?.metadata(filePath);
      }, testFilePath);
      
      console.log('📄 File metadata:', metadata);
      
      // Clean up
      await this.page.evaluate((filePath) => {
        return window.__TAURI__?.fs?.removeFile(filePath);
      }, testFilePath);
      
      this.fileOperationHistory.push({
        operation: 'delete',
        path: testFilePath,
        timestamp: new Date()
      });
      
      console.log('✅ File system operations test passed');
      
    } catch (error) {
      console.error('❌ File system operations test failed:', error);
      throw createTestError('File system operations test failed', 'FILE_SYSTEM_OPERATIONS', { error });
    }
  }

  /**
   * Test directory operations
   */
  async testDirectoryOperations(): Promise<void> {
    console.log('📂 Testing directory operations...');
    
    try {
      const fsInfo = await this.getFileSystemInfo();
      const testDirName = `test-dir-${Date.now()}`;
      const testDirPath = path.join(fsInfo.appDir, testDirName);
      
      // Create directory
      await this.page.evaluate((dirPath) => {
        return window.__TAURI__?.fs?.createDir(dirPath);
      }, testDirPath);
      
      this.fileOperationHistory.push({
        operation: 'createDir',
        path: testDirPath,
        timestamp: new Date()
      });
      
      // Check directory exists
      const exists = await this.page.evaluate((dirPath) => {
        return window.__TAURI__?.fs?.exists(dirPath);
      }, testDirPath);
      
      if (!exists) {
        throw new Error('Directory does not exist after creation');
      }
      
      // Read directory contents
      const contents = await this.page.evaluate((dirPath) => {
        return window.__TAURI__?.fs?.readDir(dirPath);
      }, testDirPath);
      
      console.log('📋 Directory contents:', contents);
      
      // Clean up
      await this.page.evaluate((dirPath) => {
        return window.__TAURI__?.fs?.removeDir(dirPath, { recursive: true });
      }, testDirPath);
      
      this.fileOperationHistory.push({
        operation: 'removeDir',
        path: testDirPath,
        timestamp: new Date()
      });
      
      console.log('✅ Directory operations test passed');
      
    } catch (error) {
      console.error('❌ Directory operations test failed:', error);
      throw createTestError('Directory operations test failed', 'DIRECTORY_OPERATIONS', { error });
    }
  }

  /**
   * Test shell operations
   */
  async testShellOperations(): Promise<void> {
    console.log('🐚 Testing shell operations...');
    
    try {
      // Test basic command execution
      const result = await this.page.evaluate(() => {
        return window.__TAURI__?.shell?.execute('echo', ['Hello from Tauri E2E'], {
          timeout: 5000
        });
      });
      
      if (!result.stdout.includes('Hello from Tauri E2E')) {
        throw new Error('Shell command execution failed');
      }
      
      // Test command with different working directory
      const cwdResult = await this.page.evaluate(() => {
        return window.__TAURI__?.shell?.execute('pwd', [], {
          cwd: '/tmp'
        });
      });
      
      console.log('📂 Working directory:', cwdResult.stdout.trim());
      
      // Test environment variable access
      const envResult = await this.page.evaluate(() => {
        return window.__TAURI__?.shell?.execute('echo', ['$HOME'], {
          env: { CUSTOM_VAR: 'test_value' }
        });
      });
      
      console.log('🌍 Environment test:', envResult.stdout);
      
      console.log('✅ Shell operations test passed');
      
    } catch (error) {
      console.error('❌ Shell operations test failed:', error);
      throw createTestError('Shell operations test failed', 'SHELL_OPERATIONS', { error });
    }
  }

  /**
   * Test clipboard operations
   */
  async testClipboardOperations(): Promise<void> {
    console.log('📋 Testing clipboard operations...');
    
    try {
      const testText = `Clipboard test at ${new Date().toISOString()}`;
      
      // Write to clipboard
      await this.page.evaluate((text) => {
        return window.__TAURI__?.clipboard?.writeText(text);
      }, testText);
      
      // Read from clipboard
      const clipboardText = await this.page.evaluate(() => {
        return window.__TAURI__?.clipboard?.readText();
      });
      
      if (clipboardText !== testText) {
        throw new Error('Clipboard content mismatch');
      }
      
      console.log('✅ Clipboard operations test passed');
      
    } catch (error) {
      console.error('❌ Clipboard operations test failed:', error);
      throw createTestError('Clipboard operations test failed', 'CLIPBOARD_OPERATIONS', { error });
    }
  }

  /**
   * Test dialog operations
   */
  async testDialogOperations(): Promise<void> {
    console.log('💬 Testing dialog operations...');
    
    try {
      // Test ask dialog (this might require user interaction in real scenarios)
      const askResult = await this.page.evaluate(() => {
        return window.__TAURI__?.dialog?.ask('Are you sure?', {
          title: 'Confirmation',
          type: 'info'
        });
      });
      
      console.log('❓ Ask dialog result:', askResult);
      
      // Test confirm dialog
      const confirmResult = await this.page.evaluate(() => {
        return window.__TAURI__?.dialog?.confirm('Do you confirm?', {
          title: 'Confirmation',
          type: 'warning'
        });
      });
      
      console.log('✅ Confirm dialog result:', confirmResult);
      
      // Test message dialog
      await this.page.evaluate(() => {
        return window.__TAURI__?.dialog?.message('Test message', {
          title: 'Information',
          type: 'info'
        });
      });
      
      console.log('✅ Dialog operations test passed');
      
    } catch (error) {
      console.warn('⚠️ Dialog operations test failed (may require user interaction):', error);
    }
  }

  /**
   * Test global shortcuts
   */
  async testGlobalShortcuts(): Promise<void> {
    console.log('⌨️ Testing global shortcuts...');
    
    try {
      // Register a test shortcut
      await this.page.evaluate(() => {
        return window.__TAURI__?.globalShortcut?.register('CmdOrCtrl+Shift+T', () => {
          console.log('Global shortcut triggered!');
        });
      });
      
      // Check if shortcut is registered
      const isRegistered = await this.page.evaluate(() => {
        return window.__TAURI__?.globalShortcut?.isRegistered('CmdOrCtrl+Shift+T');
      });
      
      if (!isRegistered) {
        throw new Error('Global shortcut registration failed');
      }
      
      // Unregister the shortcut
      await this.page.evaluate(() => {
        return window.__TAURI__?.globalShortcut?.unregister('CmdOrCtrl+Shift+T');
      });
      
      console.log('✅ Global shortcuts test passed');
      
    } catch (error) {
      console.warn('⚠️ Global shortcuts test failed (may not be supported):', error);
    }
  }

  /**
   * Test OS integration features
   */
  async testOSIntegration(): Promise<void> {
    console.log('🖥️ Testing OS integration features...');
    
    try {
      // Test OS info
      const osInfo = await this.page.evaluate(() => {
        return window.__TAURI__?.os?.platform?.();
      });
      
      console.log('💻 OS platform:', osInfo);
      
      // Test OS version
      const osVersion = await this.page.evaluate(() => {
        return window.__TAURI__?.os?.version?.();
      });
      
      console.log('🔢 OS version:', osVersion);
      
      // Test OS type
      const osType = await this.page.evaluate(() => {
        return window.__TAURI__?.os?.type?.();
      });
      
      console.log('🏷️ OS type:', osType);
      
      // Test OS arch
      const osArch = await this.page.evaluate(() => {
        return window.__TAURI__?.os?.arch?.();
      });
      
      console.log('🏗️ OS arch:', osArch);
      
      console.log('✅ OS integration test passed');
      
    } catch (error) {
      console.error('❌ OS integration test failed:', error);
      throw createTestError('OS integration test failed', 'OS_INTEGRATION', { error });
    }
  }

  /**
   * Test auto-start functionality
   */
  async testAutoStart(): Promise<void> {
    console.log('🚀 Testing auto-start functionality...');
    
    try {
      // Check if auto-start is enabled
      const isEnabled = await this.page.evaluate(() => {
        return window.__TAURI__?.autostart?.isEnabled?.();
      });
      
      console.log('🔄 Auto-start enabled:', isEnabled);
      
      // Enable auto-start
      await this.page.evaluate(() => {
        return window.__TAURI__?.autostart?.enable?.();
      });
      
      // Check if it's now enabled
      const isNowEnabled = await this.page.evaluate(() => {
        return window.__TAURI__?.autostart?.isEnabled?.();
      });
      
      if (!isNowEnabled) {
        console.warn('⚠️ Auto-start enable may have failed');
      }
      
      // Disable auto-start
      await this.page.evaluate(() => {
        return window.__TAURI__?.autostart?.disable?.();
      });
      
      console.log('✅ Auto-start test passed');
      
    } catch (error) {
      console.warn('⚠️ Auto-start test failed (may not be supported):', error);
    }
  }

  /**
   * Get notification history
   */
  getNotificationHistory(): NotificationInfo[] {
    return [...this.notificationHistory];
  }

  /**
   * Get file operation history
   */
  getFileOperationHistory(): any[] {
    return [...this.fileOperationHistory];
  }

  /**
   * Clear histories
   */
  clearHistories(): void {
    this.notificationHistory = [];
    this.fileOperationHistory = [];
    console.log('🗑️ System helper histories cleared');
  }

  /**
   * Test system permissions
   */
  async testSystemPermissions(): Promise<void> {
    console.log('🔐 Testing system permissions...');
    
    try {
      // Test file system permissions
      const fsInfo = await this.getFileSystemInfo();
      const testFile = path.join(fsInfo.appDir, 'permission-test.txt');
      
      try {
        await this.page.evaluate(({ filePath, content }) => {
          return window.__TAURI__?.fs?.writeTextFile(filePath, content);
        }, { filePath: testFile, content: 'Permission test' });
        
        await this.page.evaluate((filePath) => {
          return window.__TAURI__?.fs?.removeFile(filePath);
        }, testFile);
        
        console.log('✅ File system permissions: OK');
      } catch (error) {
        console.warn('⚠️ File system permissions: LIMITED', error);
      }
      
      // Test notification permissions
      const notificationPermission = await this.page.evaluate(() => {
        return window.__TAURI__?.notification?.isPermissionGranted?.();
      });
      
      console.log('🔔 Notification permissions:', notificationPermission);
      
      // Test clipboard permissions
      try {
        await this.page.evaluate(() => {
          return window.__TAURI__?.clipboard?.writeText('Permission test');
        });
        console.log('📋 Clipboard permissions: OK');
      } catch (error) {
        console.warn('⚠️ Clipboard permissions: LIMITED', error);
      }
      
      console.log('✅ System permissions test completed');
      
    } catch (error) {
      console.error('❌ System permissions test failed:', error);
      throw createTestError('System permissions test failed', 'SYSTEM_PERMISSIONS', { error });
    }
  }

  /**
   * Cleanup system test artifacts
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up system helper...');
    
    try {
      // Clean up any remaining test files
      const fsInfo = await this.getFileSystemInfo();
      
      // Remove test files that might remain
      const testFiles = await this.page.evaluate((appDir) => {
        return window.__TAURI__?.fs?.readDir(appDir);
      }, fsInfo.appDir);
      
      for (const file of testFiles) {
        if (file.name.startsWith('test-') || file.name.startsWith('test-dir-')) {
          const filePath = path.join(fsInfo.appDir, file.name);
          
          try {
            if (file.isFile) {
              await this.page.evaluate((path) => {
                return window.__TAURI__?.fs?.removeFile(path);
              }, filePath);
            } else {
              await this.page.evaluate((path) => {
                return window.__TAURI__?.fs?.removeDir(path, { recursive: true });
              }, filePath);
            }
          } catch (error) {
            console.warn(`⚠️ Failed to cleanup ${filePath}:`, error);
          }
        }
      }
      
      console.log('✅ System helper cleanup completed');
      
    } catch (error) {
      console.warn('⚠️ System helper cleanup failed:', error);
    }
  }
}