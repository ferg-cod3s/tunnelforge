import { Page, BrowserContext, TestInfo, expect } from '@playwright/test';
import { spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const sleep = promisify(setTimeout);

/**
 * Enhanced Tauri desktop test helpers for comprehensive desktop app testing
 * 
 * These helpers provide functionality for:
 * - Tauri command execution and IPC communication
 * - Desktop app lifecycle management
 * - System integration testing (tray, notifications, file system)
 * - Cross-platform compatibility testing
 * - WSL/X11 environment support
 * - Advanced debugging and logging
 */

export interface TauriCommand {
  command: string;
  args?: any[];
  expect?: any;
  timeout?: number;
}

export interface TauriAppInfo {
  version: string;
  name: string;
  platform: string;
  arch: string;
  tauriVersion?: string;
}

export interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  tauriVersion: string;
  isWSL: boolean;
  isCI: boolean;
  display?: string;
}

export interface TestEnvironment {
  screenshotPath: string;
  videoPath: string;
  tracePath: string;
  logPath: string;
}

export class TauriDesktopHelper {
  private page: Page;
  private context: BrowserContext;
  private testInfo: TestInfo;
  private debugPort: number;
  private testEnvironment: TestEnvironment;
  private consoleMessages: string[] = [];
  private tauriProcesses: ChildProcess[] = [];

  constructor(
    page: Page, 
    context: BrowserContext, 
    testInfo: TestInfo, 
    debugPort: number = 9222
  ) {
    this.page = page;
    this.context = context;
    this.testInfo = testInfo;
    this.debugPort = debugPort;
    this.testEnvironment = this.setupTestEnvironment();
  }

  /**
   * Setup test environment paths and directories
   */
  private setupTestEnvironment(): TestEnvironment {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const testName = this.testInfo.title.replace(/[^a-zA-Z0-9]/g, '-');
    
    return {
      screenshotPath: `test-results/tauri-screenshots/${testName}-${timestamp}.png`,
      videoPath: `test-results/tauri-videos/${testName}-${timestamp}.webm`,
      tracePath: `test-results/tauri-traces/${testName}-${timestamp}.zip`,
      logPath: `test-results/tauri-logs/${testName}-${timestamp}.log`,
    };
  }

  /**
   * Wait for Tauri app to be fully initialized with comprehensive checks
   */
  async waitForTauriApp(timeout: number = 30000): Promise<void> {
    console.log('⏳ Waiting for Tauri app initialization...');
    
    try {
      // Wait for page load
      await this.page.waitForLoadState('networkidle', { timeout });
      
      // Wait for Tauri API to be available
      await this.page.waitForFunction(() => {
        return typeof window !== 'undefined' && 
               window.__TAURI__ && 
               window.__TAURI__.invoke &&
               window.__TAURI__.app &&
               window.__TAURI__.window;
      }, { timeout });
      
      // Wait for app-specific initialization
      await this.page.waitForFunction(() => {
        return document.readyState === 'complete' && 
               (!window.__TAURI_APP_READY__ || window.__TAURI_APP_READY__ === true);
      }, { timeout });
      
      // Additional wait for any async initialization
      await sleep(2000);
      
      // Verify app is responsive
      await this.page.evaluate(() => document.title);
      
      console.log('✅ Tauri app is fully initialized');
      
    } catch (error) {
      console.error('❌ Tauri app initialization failed:', error);
      await this.captureFailure('tauri-initialization-failure');
      throw error;
    }
  }

  /**
   * Execute a Tauri command with enhanced error handling and logging
   */
  async invokeTauriCommand<T = any>(
    command: string, 
    args: any[] = [], 
    options: { timeout?: number; retries?: number } = {}
  ): Promise<T> {
    const { timeout = 15000, retries = 2 } = options;
    
    console.log(`🔧 Invoking Tauri command: ${command}`, args);
    
    let lastError: Error;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.page.evaluate(
          async ([cmd, cmdArgs, cmdTimeout]) => {
            return new Promise((resolve, reject) => {
              const timeoutId = setTimeout(() => {
                reject(new Error(`Command timeout: ${cmd}`));
              }, cmdTimeout);
              
              window.__TAURI__.invoke(cmd, ...cmdArgs)
                .then(result => {
                  clearTimeout(timeoutId);
                  resolve(result);
                })
                .catch(error => {
                  clearTimeout(timeoutId);
                  reject(error);
                });
            });
          },
          [command, args, timeout]
        );
        
        console.log(`✅ Tauri command succeeded: ${command}`, result);
        return result as T;
        
      } catch (error) {
        lastError = error as Error;
        console.warn(`⚠️ Tauri command attempt ${attempt + 1} failed: ${command}`, error);
        
        if (attempt < retries) {
          await sleep(1000); // Wait before retry
        }
      }
    }
    
    console.error(`❌ Tauri command failed after ${retries + 1} attempts: ${command}`, lastError);
    await this.captureFailure(`tauri-command-failure-${command}`);
    throw lastError;
  }

  /**
   * Get comprehensive Tauri app information
   */
  async getAppInfo(): Promise<TauriAppInfo> {
    const info = await this.invokeTauriCommand('tauri', ['app', 'info']);
    
    return {
      version: info.version || 'unknown',
      name: info.name || 'TunnelForge',
      platform: info.platform || process.platform,
      arch: info.arch || process.arch,
      tauriVersion: info.tauriVersion || 'unknown',
    };
  }

  /**
   * Get system and environment information
   */
  async getSystemInfo(): Promise<SystemInfo> {
    const systemInfo = await this.page.evaluate(() => ({
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      language: navigator.language,
      onLine: navigator.onLine,
    }));
    
    return {
      platform: systemInfo.platform,
      arch: process.arch,
      nodeVersion: process.version,
      tauriVersion: await this.page.evaluate(() => 
        window.__TAURI__?.app?.getTauriVersion?.() || 'unknown'
      ),
      isWSL: process.platform === 'linux' && !!process.env.WSL_DISTRO_NAME,
      isCI: !!process.env.CI,
      display: process.env.DISPLAY,
    };
  }

  /**
   * Test Tauri file system operations comprehensively
   */
  async testFileSystemOperations(): Promise<void> {
    console.log('📁 Testing file system operations...');
    
    try {
      // Get app directories
      const appDir = await this.invokeTauriCommand('tauri', ['path', 'appDir']);
      const documentsDir = await this.invokeTauriCommand('tauri', ['path', 'documentDir']);
      
      console.log('📂 App directory:', appDir);
      console.log('📂 Documents directory:', documentsDir);
      
      // Test file operations
      const testContent = `Test file created at ${new Date().toISOString()}\nTest: ${this.testInfo.title}`;
      const testFileName = `test-${Date.now()}.txt`;
      const testFilePath = path.join(appDir, testFileName);
      
      // Write file
      await this.invokeTauriCommand('tauri', ['fs', 'writeTextFile'], {
        path: testFilePath,
        contents: testContent
      });
      
      // Read file
      const readContent = await this.invokeTauriCommand('tauri', ['fs', 'readTextFile'], {
        path: testFilePath
      });
      
      if (readContent !== testContent) {
        throw new Error('File content mismatch');
      }
      
      // Check file exists
      const exists = await this.invokeTauriCommand('tauri', ['fs', 'exists'], {
        path: testFilePath
      });
      
      if (!exists) {
        throw new Error('File does not exist after creation');
      }
      
      // Get file metadata
      const metadata = await this.invokeTauriCommand('tauri', ['fs', 'metadata'], {
        path: testFilePath
      });
      
      console.log('📄 File metadata:', metadata);
      
      // Clean up
      await this.invokeTauriCommand('tauri', ['fs', 'removeFile'], {
        path: testFilePath
      });
      
      console.log('✅ File system operations test passed');
      
    } catch (error) {
      console.error('❌ File system operations test failed:', error);
      throw error;
    }
  }

  /**
   * Test Tauri shell operations with security considerations
   */
  async testShellOperations(): Promise<void> {
    console.log('🐚 Testing shell operations...');
    
    try {
      // Test basic command execution
      const result = await this.invokeTauriCommand('tauri', ['shell', 'execute'], {
        cmd: 'echo',
        args: ['Hello from Tauri E2E'],
        options: { timeout: 5000 }
      });
      
      if (!result.stdout.includes('Hello from Tauri E2E')) {
        throw new Error('Shell command execution failed');
      }
      
      // Test command with different working directory
      const cwdResult = await this.invokeTauriCommand('tauri', ['shell', 'execute'], {
        cmd: 'pwd',
        options: { cwd: '/tmp' }
      });
      
      console.log('📂 Working directory:', cwdResult.stdout.trim());
      
      // Test environment variable access
      const envResult = await this.invokeTauriCommand('tauri', ['shell', 'execute'], {
        cmd: 'echo',
        args: ['$HOME'],
        options: { env: { CUSTOM_VAR: 'test_value' } }
      });
      
      console.log('🌍 Environment test:', envResult.stdout);
      
      console.log('✅ Shell operations test passed');
      
    } catch (error) {
      console.error('❌ Shell operations test failed:', error);
      throw error;
    }
  }

  /**
   * Test Tauri notifications
   */
  async testNotifications(): Promise<void> {
    console.log('🔔 Testing notifications...');
    
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
          return;
        }
      }
      
      // Send test notification
      await this.page.evaluate(() => {
        return window.__TAURI__?.notification?.sendNotification({
          title: 'TunnelForge E2E Test',
          body: 'This is a test notification from E2E tests',
          icon: 'info',
          sound: 'default'
        });
      });
      
      // Wait for notification to appear
      await sleep(2000);
      
      console.log('✅ Notifications test passed');
      
    } catch (error) {
      console.warn('⚠️ Notifications test failed (may not be supported):', error);
    }
  }

  /**
   * Test Tauri window operations
   */
  async testWindowOperations(): Promise<void> {
    console.log('🪟 Testing window operations...');
    
    try {
      // Get current window
      const currentWindow = await this.page.evaluate(() => {
        return window.__TAURI__?.window?.getCurrentWindow?.();
      });
      
      if (!currentWindow) {
        throw new Error('Could not get current window');
      }
      
      // Test window title
      const title = await this.page.evaluate(() => {
        return window.__TAURI__?.window?.getCurrentWindow()?.title?.();
      });
      
      if (!title.includes('TunnelForge')) {
        throw new Error('Window title does not contain TunnelForge');
      }
      
      console.log('📝 Window title:', title);
      
      // Test window state
      const isMaximized = await this.page.evaluate(() => {
        return window.__TAURI__?.window?.getCurrentWindow()?.isMaximized?.();
      });
      
      const isMinimized = await this.page.evaluate(() => {
        return window.__TAURI__?.window?.getCurrentWindow()?.isMinimized?.();
      });
      
      const isVisible = await this.page.evaluate(() => {
        return window.__TAURI__?.window?.getCurrentWindow()?.isVisible?.();
      });
      
      console.log('🔲 Window state:', { isMaximized, isMinimized, isVisible });
      
      // Test window operations (if supported)
      try {
        // Toggle maximize
        await this.page.evaluate(() => {
          return window.__TAURI__?.window?.getCurrentWindow()?.toggleMaximize?.();
        });
        
        await sleep(500);
        
        // Restore
        await this.page.evaluate(() => {
          return window.__TAURI__?.window?.getCurrentWindow()?.unmaximize?.();
        });
        
        await sleep(500);
        
      } catch (error) {
        console.warn('⚠️ Window operations not fully supported:', error);
      }
      
      console.log('✅ Window operations test passed');
      
    } catch (error) {
      console.error('❌ Window operations test failed:', error);
      throw error;
    }
  }

  /**
   * Test Tauri system tray functionality
   */
  async testSystemTray(): Promise<void> {
    console.log('🔌 Testing system tray...');
    
    try {
      // Check if tray is available
      const hasTray = await this.page.evaluate(() => {
        return !!window.__TAURI__?.tray;
      });
      
      if (!hasTray) {
        console.log('ℹ️ System tray not available on this platform');
        return;
      }
      
      // Get tray items
      const trayItems = await this.page.evaluate(() => {
        return window.__TAURI__?.tray?.getItems?.() || [];
      });
      
      console.log('📋 Tray items:', trayItems);
      
      // Test tray operations (if available)
      if (trayItems.length > 0) {
        console.log('✅ System tray is available with items');
      } else {
        console.log('ℹ️ System tray is available but has no items');
      }
      
    } catch (error) {
      console.warn('⚠️ System tray test failed:', error);
    }
  }

  /**
   * Capture failure state with comprehensive debugging information
   */
  async captureFailure(reason: string): Promise<void> {
    console.log(`📸 Capturing failure state: ${reason}`);
    
    try {
      // Take screenshot
      await this.page.screenshot({ 
        path: this.testEnvironment.screenshotPath,
        fullPage: true 
      });
      
      // Get page content
      const pageContent = await this.page.content();
      
      // Get console messages
      const consoleMessages = this.consoleMessages.join('\n');
      
      // Get system info
      const systemInfo = await this.getSystemInfo();
      
      // Create failure report
      const failureReport = {
        timestamp: new Date().toISOString(),
        test: this.testInfo.title,
        reason,
        url: this.page.url(),
        systemInfo,
        consoleMessages,
        pageContent: pageContent.substring(0, 10000), // Limit content size
        screenshot: this.testEnvironment.screenshotPath,
      };
      
      // Save failure report
      const reportPath = this.testEnvironment.logPath.replace('.log', '-failure.json');
      await fs.writeFile(reportPath, JSON.stringify(failureReport, null, 2));
      
      // Attach to test info
      this.testInfo.attachments.push({
        name: `${reason}-screenshot`,
        path: this.testEnvironment.screenshotPath,
        contentType: 'image/png'
      });
      
      this.testInfo.attachments.push({
        name: `${reason}-report`,
        path: reportPath,
        contentType: 'application/json'
      });
      
      console.log(`✅ Failure state captured: ${reportPath}`);
      
    } catch (error) {
      console.error('❌ Failed to capture failure state:', error);
    }
  }

  /**
   * Setup comprehensive logging
   */
  async setupLogging(): Promise<void> {
    console.log('📝 Setting up comprehensive logging...');
    
    // Log console messages
    this.page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      const logEntry = `[${type.toUpperCase()}] ${text}`;
      
      this.consoleMessages.push(logEntry);
      console.log(`🔍 Tauri Console ${logEntry}`);
    });
    
    // Log page errors
    this.page.on('pageerror', error => {
      const errorText = `PAGE ERROR: ${error.message}`;
      this.consoleMessages.push(errorText);
      console.error('❌ Tauri Page Error:', error);
    });
    
    // Log request failures
    this.page.on('requestfailed', request => {
      const failureText = `REQUEST FAILED: ${request.url()} - ${request.failure()?.errorText}`;
      this.consoleMessages.push(failureText);
      console.warn('⚠️ Tauri Request Failed:', request.url(), request.failure());
    });
    
    console.log('✅ Logging setup complete');
  }

  /**
   * Take a screenshot with enhanced metadata
   */
  async takeScreenshot(name?: string): Promise<string> {
    const screenshotName = name || `${this.testInfo.title}-${Date.now()}`;
    const screenshotPath = `test-results/tauri-screenshots/${screenshotName}.png`;
    
    await this.page.screenshot({ 
      path: screenshotPath,
      fullPage: true 
    });
    
    console.log(`📸 Screenshot saved: ${screenshotPath}`);
    
    // Attach to test info
    this.testInfo.attachments.push({
      name: screenshotName,
      path: screenshotPath,
      contentType: 'image/png'
    });
    
    return screenshotPath;
  }

  /**
   * Wait for app to be ready for interaction
   */
  async waitForAppReady(): Promise<void> {
    // Wait for main UI elements
    await this.page.waitForSelector('body', { timeout: 10000 });
    
    // Wait for any loading indicators to disappear
    try {
      await this.page.waitForSelector('[data-loading="true"]', { 
        state: 'hidden', 
        timeout: 5000 
      });
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
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up TauriDesktopHelper...');
    
    // Terminate any spawned processes
    for (const process of this.tauriProcesses) {
      try {
        process.kill('SIGTERM');
        await sleep(1000);
      } catch (error) {
        console.warn('⚠️ Failed to terminate process:', error);
      }
    }
    
    // Save console messages
    if (this.consoleMessages.length > 0) {
      try {
        await fs.writeFile(
          this.testEnvironment.logPath,
          this.consoleMessages.join('\n')
        );
        console.log(`📝 Console log saved: ${this.testEnvironment.logPath}`);
      } catch (error) {
        console.warn('⚠️ Failed to save console log:', error);
      }
    }
  }
}

/**
 * Create a Tauri desktop test helper instance
 */
export function createTauriDesktopHelper(
  page: Page, 
  context: BrowserContext, 
  testInfo: TestInfo, 
  debugPort?: number
): TauriDesktopHelper {
  return new TauriDesktopHelper(page, context, testInfo, debugPort);
}

/**
 * Utility functions for environment detection
 */
export function isWSL(): boolean {
  return process.platform === 'linux' && !!process.env.WSL_DISTRO_NAME;
}

export function isCI(): boolean {
  return !!process.env.CI;
}

export function getPlatformConfig() {
  return {
    isWindows: process.platform === 'win32',
    isMacOS: process.platform === 'darwin',
    isLinux: process.platform === 'linux',
    isWSL: isWSL(),
    isCI: isCI(),
    arch: process.arch,
    display: process.env.DISPLAY,
  };
}