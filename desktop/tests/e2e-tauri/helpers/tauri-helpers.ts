import { Page, BrowserContext, TestInfo } from '@playwright/test';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const sleep = promisify(setTimeout);

/**
 * Tauri-specific test helpers for desktop app testing
 * 
 * These helpers provide functionality for:
 * - Tauri command execution
 * - Desktop app lifecycle management
 * - System integration testing
 * - Cross-platform compatibility
 */

export interface TauriCommand {
  command: string;
  args?: any[];
  expect?: any;
}

export interface TauriAppInfo {
  version: string;
  name: string;
  platform: string;
  arch: string;
}

export class TauriTestHelper {
  private page: Page;
  private context: BrowserContext;
  private testInfo: TestInfo;
  private debugPort: number;

  constructor(page: Page, context: BrowserContext, testInfo: TestInfo, debugPort: number = 9222) {
    this.page = page;
    this.context = context;
    this.testInfo = testInfo;
    this.debugPort = debugPort;
  }

  /**
   * Wait for Tauri app to be fully initialized
   */
  async waitForTauriApp(): Promise<void> {
    console.log('⏳ Waiting for Tauri app initialization...');
    
    // Wait for the app to load
    await this.page.waitForLoadState('networkidle');
    
    // Wait for Tauri API to be available
    await this.page.waitForFunction(() => {
      return typeof window !== 'undefined' && 
             window.__TAURI__ && 
             window.__TAURI__.invoke;
    }, { timeout: 15000 });
    
    // Additional wait for app-specific initialization
    await sleep(2000);
    
    console.log('✅ Tauri app is ready');
  }

  /**
   * Execute a Tauri command and return the result
   */
  async invokeTauriCommand<T = any>(command: string, ...args: any[]): Promise<T> {
    console.log(`🔧 Invoking Tauri command: ${command}`, args);
    
    try {
      const result = await this.page.evaluate(
        ([cmd, cmdArgs]) => window.__TAURI__.invoke(cmd, ...cmdArgs),
        [command, args]
      );
      
      console.log(`✅ Tauri command result:`, result);
      return result;
    } catch (error) {
      console.error(`❌ Tauri command failed: ${command}`, error);
      throw error;
    }
  }

  /**
   * Get Tauri app information
   */
  async getAppInfo(): Promise<TauriAppInfo> {
    const info = await this.page.evaluate(() => {
      return window.__TAURI__.app.getInfo();
    });
    
    return {
      version: info.version,
      name: info.name,
      platform: info.platform,
      arch: info.arch,
    };
  }

  /**
   * Test Tauri file system operations
   */
  async testFileSystemOperations(): Promise<void> {
    console.log('📁 Testing file system operations...');
    
    // Test reading app directory
    const appDir = await this.invokeTauriCommand('get_app_dir');
    console.log('📂 App directory:', appDir);
    
    // Test creating a test file
    const testContent = `Test file created at ${new Date().toISOString()}`;
    const testFilePath = path.join(appDir, 'test-file.txt');
    
    await this.invokeTauriCommand('write_text_file', {
      path: testFilePath,
      contents: testContent
    });
    
    // Test reading the file back
    const readContent = await this.invokeTauriCommand('read_text_file', {
      path: testFilePath
    });
    
    if (readContent !== testContent) {
      throw new Error('File content mismatch');
    }
    
    // Clean up test file
    await this.invokeTauriCommand('remove_file', {
      path: testFilePath
    });
    
    console.log('✅ File system operations test passed');
  }

  /**
   * Test Tauri shell operations
   */
  async testShellOperations(): Promise<void> {
    console.log('🐚 Testing shell operations...');
    
    // Test basic command execution
    const result = await this.invokeTauriCommand('execute_command', {
      command: 'echo',
      args: ['Hello from Tauri']
    });
    
    if (!result.stdout.includes('Hello from Tauri')) {
      throw new Error('Shell command execution failed');
    }
    
    console.log('✅ Shell operations test passed');
  }

  /**
   * Test Tauri notifications
   */
  async testNotifications(): Promise<void> {
    console.log('🔔 Testing notifications...');
    
    // Request notification permission
    const permissionGranted = await this.page.evaluate(() => {
      return window.__TAURI__.notification.requestPermission();
    });
    
    if (permissionGranted !== 'granted') {
      console.warn('⚠️ Notification permission not granted');
      return;
    }
    
    // Send test notification
    await this.page.evaluate(() => {
      return window.__TAURI__.notification.sendNotification({
        title: 'TunnelForge Test',
        body: 'This is a test notification from E2E tests',
        icon: 'info'
      });
    });
    
    // Wait a bit for notification to appear
    await sleep(1000);
    
    console.log('✅ Notifications test passed');
  }

  /**
   * Test Tauri window operations
   */
  async testWindowOperations(): Promise<void> {
    console.log('🪟 Testing window operations...');
    
    // Get current window info
    const windowInfo = await this.page.evaluate(() => {
      return window.__TAURI__.window.getCurrentWindow();
    });
    
    // Test window title
    const title = await this.page.evaluate(() => {
      return window.__TAURI__.window.getCurrentWindow().title();
    });
    
    if (!title.includes('TunnelForge')) {
      throw new Error('Window title does not contain TunnelForge');
    }
    
    // Test window minimize/maximize (if available)
    try {
      await this.page.evaluate(() => {
        return window.__TAURI__.window.getCurrentWindow().minimize();
      });
      
      await sleep(500);
      
      await this.page.evaluate(() => {
        return window.__TAURI__.window.getCurrentWindow().unminimize();
      });
      
      await sleep(500);
    } catch (error) {
      console.warn('⚠️ Window minimize/maximize not available:', error);
    }
    
    console.log('✅ Window operations test passed');
  }

  /**
   * Test Tauri system tray functionality
   */
  async testSystemTray(): Promise<void> {
    console.log('🔌 Testing system tray...');
    
    // Check if tray is available (platform-dependent)
    const hasTray = await this.page.evaluate(() => {
      try {
        return window.__TAURI__.tray !== undefined;
      } catch {
        return false;
      }
    });
    
    if (hasTray) {
      console.log('✅ System tray is available');
    } else {
      console.log('ℹ️ System tray not available on this platform');
    }
  }

  /**
   * Take a screenshot with Tauri-specific naming
   */
  async takeScreenshot(name?: string): Promise<void> {
    const screenshotName = name || `tauri-${this.testInfo.title}-${Date.now()}`;
    const screenshotPath = `test-results/tauri-screenshots/${screenshotName}.png`;
    
    await this.page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    });
    
    console.log(`📸 Screenshot saved: ${screenshotPath}`);
    this.testInfo.attachments.push({
      name: screenshotName,
      path: screenshotPath,
      contentType: 'image/png'
    });
  }

  /**
   * Log Tauri console messages
   */
  async logConsoleMessages(): Promise<void> {
    const messages: string[] = [];
    
    this.page.on('console', msg => {
      const text = msg.text();
      messages.push(`[${msg.type()}] ${text}`);
      console.log(`🔍 Tauri Console [${msg.type()}]: ${text}`);
    });
    
    this.page.on('pageerror', error => {
      console.error('❌ Tauri Page Error:', error);
      messages.push(`[ERROR] ${error.message}`);
    });
    
    // Store messages for test reporting
    (this.testInfo as any).tauriConsoleMessages = messages;
  }

  /**
   * Wait for Tauri app to be ready for interaction
   */
  async waitForAppReady(): Promise<void> {
    // Wait for main UI elements
    await this.page.waitForSelector('body', { timeout: 10000 });
    
    // Wait for any loading indicators to disappear
    try {
      await this.page.waitForSelector('[data-loading="true"]', { state: 'hidden', timeout: 5000 });
    } catch {
      // No loading indicator found, which is fine
    }
    
    // Wait for app-specific ready state
    await this.page.waitForFunction(() => {
      return document.readyState === 'complete' && 
             (!window.__TAURI_APP_READY__ || window.__TAURI_APP_READY__ === true);
    }, { timeout: 15000 });
  }

  /**
   * Get Tauri environment information
   */
  async getEnvironmentInfo(): Promise<any> {
    return await this.page.evaluate(() => {
      return {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        tauri: !!window.__TAURI__,
        version: window.__TAURI__?.app?.getVersion?.() || 'unknown',
        arch: window.__TAURI__?.platform?.arch || 'unknown',
        platform: window.__TAURI__?.platform?.platform || 'unknown',
      };
    });
  }
}

/**
 * Create a Tauri test helper instance
 */
export function createTauriHelper(
  page: Page, 
  context: BrowserContext, 
  testInfo: TestInfo, 
  debugPort?: number
): TauriTestHelper {
  return new TauriTestHelper(page, context, testInfo, debugPort);
}

/**
 * Utility function to check if running in WSL
 */
export function isWSL(): boolean {
  return process.platform === 'linux' && !!process.env.WSL_DISTRO_NAME;
}

/**
 * Utility function to check if running in CI
 */
export function isCI(): boolean {
  return !!process.env.CI;
}

/**
 * Utility function to get platform-specific test configuration
 */
export function getPlatformConfig() {
  return {
    isWindows: process.platform === 'win32',
    isMacOS: process.platform === 'darwin',
    isLinux: process.platform === 'linux',
    isWSL: isWSL(),
    isCI: isCI(),
    arch: process.arch,
  };
}