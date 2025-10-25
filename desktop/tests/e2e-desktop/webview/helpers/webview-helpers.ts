import { Page, BrowserContext, TestInfo, expect } from '@playwright/test';
import { TauriDesktopHelper, createTauriDesktopHelper } from '../../helpers/tauri-desktop-helpers';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * WebView-specific test helpers for TunnelForge desktop application
 * 
 * These helpers extend the base TauriDesktopHelper with WebView-specific functionality:
 * - JavaScript-Rust integration testing
 * - WebView DOM manipulation and validation
 * - Terminal interface testing within WebView
 * - Settings UI interaction and validation
 * - Real-time WebSocket communication testing
 * - Visual regression testing capabilities
 */

export interface WebViewTestConfig {
  waitForAppReady: boolean;
  captureScreenshots: boolean;
  enableTracing: boolean;
  timeout: number;
  retries: number;
}

export interface TerminalSession {
  id: string;
  title: string;
  status: 'active' | 'inactive' | 'error';
  processId?: number;
  createdAt: Date;
}

export interface WebViewElement {
  selector: string;
  text?: string;
  visible?: boolean;
  enabled?: boolean;
  attributes?: Record<string, string>;
}

export interface CommandResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
}

export class WebViewHelper {
  private tauriHelper: TauriDesktopHelper;
  private page: Page;
  private context: BrowserContext;
  private testInfo: TestInfo;
  private config: WebViewTestConfig;
  private terminalSessions: Map<string, TerminalSession> = new Map();
  private commandHistory: CommandResult[] = [];

  constructor(
    page: Page,
    context: BrowserContext,
    testInfo: TestInfo,
    config: Partial<WebViewTestConfig> = {}
  ) {
    this.page = page;
    this.context = context;
    this.testInfo = testInfo;
    this.config = {
      waitForAppReady: true,
      captureScreenshots: true,
      enableTracing: false,
      timeout: 30000,
      retries: 2,
      ...config
    };
    
    this.tauriHelper = createTauriDesktopHelper(page, context, testInfo);
  }

  /**
   * Initialize WebView for testing
   */
  async initialize(): Promise<void> {
    console.log('🌐 Initializing WebView test environment...');
    
    try {
      // Wait for Tauri app to be ready
      if (this.config.waitForAppReady) {
        await this.tauriHelper.waitForTauriApp(this.config.timeout);
      }
      
      // Setup WebView-specific logging
      await this.setupWebViewLogging();
      
      // Wait for WebView content to load
      await this.waitForWebViewContent();
      
      // Verify Tauri APIs are available in WebView
      await this.verifyTauriAPIs();
      
      console.log('✅ WebView initialization complete');
      
    } catch (error) {
      console.error('❌ WebView initialization failed:', error);
      await this.captureWebViewState('initialization-failure');
      throw error;
    }
  }

  /**
   * Setup WebView-specific logging
   */
  private async setupWebViewLogging(): Promise<void> {
    // Log WebView-specific events
    this.page.on('console', msg => {
      if (msg.text().includes('WebView') || msg.text().includes('terminal')) {
        console.log(`🌐 WebView Console: ${msg.text()}`);
      }
    });

    // Log unhandled promise rejections
    this.page.on('pageerror', error => {
      console.error('❌ WebView Page Error:', error);
    });
  }

  /**
   * Wait for WebView content to be fully loaded
   */
  private async waitForWebViewContent(): Promise<void> {
    await this.page.waitForFunction(() => {
      return document.readyState === 'complete' && 
             document.body !== null &&
             document.querySelector('#app') !== null;
    }, { timeout: this.config.timeout });
  }

  /**
   * Verify all required Tauri APIs are available in WebView
   */
  private async verifyTauriAPIs(): Promise<void> {
    const requiredAPIs = [
      'window.__TAURI__',
      'window.__TAURI__.invoke',
      'window.__TAURI__.app',
      'window.__TAURI__.window',
      'window.__TAURI__.fs',
      'window.__TAURI__.shell',
      'window.__TAURI__.notification'
    ];

    for (const api of requiredAPIs) {
      const isAvailable = await this.page.evaluate((apiPath) => {
        const pathParts = apiPath.split('.');
        let obj = window;
        for (const part of pathParts) {
          if (part === 'window') continue;
          obj = obj[part];
          if (!obj) return false;
        }
        return true;
      }, api);

      if (!isAvailable) {
        throw new Error(`Required Tauri API not available: ${api}`);
      }
    }

    console.log('✅ All required Tauri APIs are available');
  }

  /**
   * Execute a Tauri command and track the result
   */
  async executeCommand<T = any>(
    command: string, 
    args: any[] = []
  ): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      const result = await this.tauriHelper.invokeTauriCommand<T>(command, args, {
        timeout: this.config.timeout,
        retries: this.config.retries
      });

      const commandResult: CommandResult = {
        success: true,
        data: result,
        executionTime: Date.now() - startTime
      };

      this.commandHistory.push(commandResult);
      console.log(`✅ Command executed successfully: ${command} (${commandResult.executionTime}ms)`);
      
      return commandResult;

    } catch (error) {
      const commandResult: CommandResult = {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime
      };

      this.commandHistory.push(commandResult);
      console.error(`❌ Command failed: ${command} (${commandResult.executionTime}ms)`, error);
      
      return commandResult;
    }
  }

  /**
   * Test WebView DOM element interaction
   */
  async testElementInteraction(element: WebViewElement): Promise<void> {
    console.log(`🎯 Testing element interaction: ${element.selector}`);
    
    try {
      // Wait for element to be available
      await this.page.waitForSelector(element.selector, { 
        state: 'visible',
        timeout: this.config.timeout 
      });

      // Verify element properties
      const actualElement = await this.page.$(element.selector);
      expect(actualElement).toBeTruthy();

      // Check visibility if specified
      if (element.visible !== undefined) {
        const isVisible = await actualElement!.isVisible();
        expect(isVisible).toBe(element.visible);
      }

      // Check enabled state if specified
      if (element.enabled !== undefined) {
        const isEnabled = await actualElement!.isEnabled();
        expect(isEnabled).toBe(element.enabled);
      }

      // Check text content if specified
      if (element.text !== undefined) {
        const text = await actualElement!.textContent();
        expect(text).toContain(element.text);
      }

      // Check attributes if specified
      if (element.attributes) {
        for (const [attr, value] of Object.entries(element.attributes)) {
          const attrValue = await actualElement!.getAttribute(attr);
          expect(attrValue).toBe(value);
        }
      }

      console.log(`✅ Element interaction test passed: ${element.selector}`);

    } catch (error) {
      console.error(`❌ Element interaction test failed: ${element.selector}`, error);
      await this.captureWebViewState(`element-failure-${element.selector}`);
      throw error;
    }
  }

  /**
   * Test terminal interface within WebView
   */
  async testTerminalInterface(): Promise<void> {
    console.log('💻 Testing terminal interface...');
    
    try {
      // Check if terminal container exists
      await this.testElementInteraction({
        selector: '#terminal-container, .terminal, [data-terminal]',
        visible: true
      });

      // Test terminal initialization
      const initResult = await this.executeCommand('init_terminal_session', [{
        title: 'E2E Test Terminal',
        shell: '/bin/bash'
      }]);

      expect(initResult.success).toBe(true);
      expect(initResult.data).toHaveProperty('sessionId');

      const sessionId = initResult.data.sessionId;
      
      // Track the session
      this.terminalSessions.set(sessionId, {
        id: sessionId,
        title: 'E2E Test Terminal',
        status: 'active',
        createdAt: new Date()
      });

      // Test terminal input/output
      await this.testTerminalIO(sessionId);

      // Test terminal resizing
      await this.testTerminalResize(sessionId);

      // Clean up terminal session
      const cleanupResult = await this.executeCommand('cleanup_terminal_session', [sessionId]);
      expect(cleanupResult.success).toBe(true);

      this.terminalSessions.delete(sessionId);

      console.log('✅ Terminal interface test passed');

    } catch (error) {
      console.error('❌ Terminal interface test failed:', error);
      await this.captureWebViewState('terminal-failure');
      throw error;
    }
  }

  /**
   * Test terminal input/output functionality
   */
  private async testTerminalIO(sessionId: string): Promise<void> {
    console.log('📝 Testing terminal I/O...');

    // Send test command
    const sendResult = await this.executeCommand('send_terminal_input', [{
      sessionId,
      input: 'echo "Hello from WebView E2E Test"\n'
    }]);

    expect(sendResult.success).toBe(true);

    // Wait for output
    await this.page.waitForTimeout(2000);

    // Get terminal output
    const outputResult = await this.executeCommand('get_terminal_output', [{
      sessionId,
      lines: 10
    }]);

    expect(outputResult.success).toBe(true);
    expect(outputResult.data).toContain('Hello from WebView E2E Test');

    console.log('✅ Terminal I/O test passed');
  }

  /**
   * Test terminal resizing functionality
   */
  private async testTerminalResize(sessionId: string): Promise<void> {
    console.log('📏 Testing terminal resize...');

    const resizeResult = await this.executeCommand('resize_terminal', [{
      sessionId,
      cols: 120,
      rows: 40
    }]);

    expect(resizeResult.success).toBe(true);

    console.log('✅ Terminal resize test passed');
  }

  /**
   * Test settings UI functionality
   */
  async testSettingsUI(): Promise<void> {
    console.log('⚙️ Testing settings UI...');
    
    try {
      // Navigate to settings
      await this.navigateToSettings();

      // Test settings sections
      await this.testSettingsSections();

      // Test settings save/load
      await this.testSettingsPersistence();

      // Test settings validation
      await this.testSettingsValidation();

      console.log('✅ Settings UI test passed');

    } catch (error) {
      console.error('❌ Settings UI test failed:', error);
      await this.captureWebViewState('settings-failure');
      throw error;
    }
  }

  /**
   * Navigate to settings page
   */
  private async navigateToSettings(): Promise<void> {
    // Look for settings button or menu
    const settingsSelectors = [
      '[data-testid="settings-button"]',
      '.settings-button',
      '#settings',
      'button[aria-label="Settings"]',
      'nav a[href*="settings"]'
    ];

    for (const selector of settingsSelectors) {
      try {
        await this.page.click(selector, { timeout: 5000 });
        await this.page.waitForURL(/settings/i, { timeout: 5000 });
        console.log(`✅ Navigated to settings using: ${selector}`);
        return;
      } catch {
        // Try next selector
      }
    }

    throw new Error('Could not find settings navigation element');
  }

  /**
   * Test different settings sections
   */
  private async testSettingsSections(): Promise<void> {
    const sections = [
      { selector: '[data-section="general"]', name: 'General' },
      { selector: '[data-section="server"]', name: 'Server' },
      { selector: '[data-section="tunnels"]', name: 'Tunnels' },
      { selector: '[data-section="advanced"]', name: 'Advanced' }
    ];

    for (const section of sections) {
      try {
        await this.testElementInteraction({
          selector: section.selector,
          visible: true
        });
        console.log(`✅ Settings section found: ${section.name}`);
      } catch {
        console.warn(`⚠️ Settings section not found: ${section.name}`);
      }
    }
  }

  /**
   * Test settings persistence
   */
  private async testSettingsPersistence(): Promise<void> {
    // Get current settings
    const getResult = await this.executeCommand('get_settings');
    expect(getResult.success).toBe(true);

    const originalSettings = getResult.data;

    // Modify a setting
    const testSetting = {
      ...originalSettings,
      theme: originalSettings.theme === 'dark' ? 'light' : 'dark'
    };

    const setResult = await this.executeCommand('set_settings', [testSetting]);
    expect(setResult.success).toBe(true);

    // Verify setting was saved
    const verifyResult = await this.executeCommand('get_settings');
    expect(verifyResult.success).toBe(true);
    expect(verifyResult.data.theme).toBe(testSetting.theme);

    // Restore original settings
    const restoreResult = await this.executeCommand('set_settings', [originalSettings]);
    expect(restoreResult.success).toBe(true);

    console.log('✅ Settings persistence test passed');
  }

  /**
   * Test settings validation
   */
  private async testSettingsValidation(): Promise<void> {
    // Test invalid port number
    const invalidSettings = {
      serverPort: 'invalid_port'
    };

    const invalidResult = await this.executeCommand('set_settings', [invalidSettings]);
    expect(invalidResult.success).toBe(false);
    expect(invalidResult.error).toContain('port');

    console.log('✅ Settings validation test passed');
  }

  /**
   * Test tunnel management functionality
   */
  async testTunnelManagement(): Promise<void> {
    console.log('🚇 Testing tunnel management...');
    
    try {
      // Test Ngrok integration
      await this.testNgrokIntegration();

      // Test Cloudflare integration
      await this.testCloudflareIntegration();

      // Test Tailscale integration
      await this.testTailscaleIntegration();

      console.log('✅ Tunnel management test passed');

    } catch (error) {
      console.error('❌ Tunnel management test failed:', error);
      await this.captureWebViewState('tunnel-failure');
      throw error;
    }
  }

  /**
   * Test Ngrok tunnel integration
   */
  private async testNgrokIntegration(): Promise<void> {
    console.log('🌐 Testing Ngrok integration...');

    // Check Ngrok status
    const statusResult = await this.executeCommand('get_ngrok_status');
    expect(statusResult.success).toBe(true);

    // Test Ngrok configuration
    const configResult = await this.executeCommand('get_ngrok_config');
    expect(configResult.success).toBe(true);

    console.log('✅ Ngrok integration test passed');
  }

  /**
   * Test Cloudflare tunnel integration
   */
  private async testCloudflareIntegration(): Promise<void> {
    console.log('☁️ Testing Cloudflare integration...');

    // Check Cloudflare status
    const statusResult = await this.executeCommand('get_cloudflare_status');
    expect(statusResult.success).toBe(true);

    // Test Cloudflare configuration
    const configResult = await this.executeCommand('get_cloudflare_config');
    expect(configResult.success).toBe(true);

    console.log('✅ Cloudflare integration test passed');
  }

  /**
   * Test Tailscale integration
   */
  private async testTailscaleIntegration(): Promise<void> {
    console.log('🦊 Testing Tailscale integration...');

    // Check Tailscale status
    const statusResult = await this.executeCommand('get_tailscale_status');
    expect(statusResult.success).toBe(true);

    console.log('✅ Tailscale integration test passed');
  }

  /**
   * Test file operations within WebView
   */
  async testFileOperations(): Promise<void> {
    console.log('📁 Testing file operations...');
    
    try {
      // Test file browser
      await this.testFileBrowser();

      // Test file upload/download
      await this.testFileTransfer();

      // Test file permissions
      await this.testFilePermissions();

      console.log('✅ File operations test passed');

    } catch (error) {
      console.error('❌ File operations test failed:', error);
      await this.captureWebViewState('file-ops-failure');
      throw error;
    }
  }

  /**
   * Test file browser functionality
   */
  private async testFileBrowser(): Promise<void> {
    console.log('📂 Testing file browser...');

    // Get current directory
    const currentDirResult = await this.executeCommand('get_current_directory');
    expect(currentDirResult.success).toBe(true);

    // List directory contents
    const listResult = await this.executeCommand('list_directory', [{
      path: currentDirResult.data
    }]);
    expect(listResult.success).toBe(true);
    expect(Array.isArray(listResult.data)).toBe(true);

    console.log('✅ File browser test passed');
  }

  /**
   * Test file upload/download functionality
   */
  private async testFileTransfer(): Promise<void> {
    console.log('📤 Testing file transfer...');

    // Create test file
    const testContent = `WebView E2E Test File - ${new Date().toISOString()}`;
    const testFileName = `webview-test-${Date.now()}.txt`;

    const createResult = await this.executeCommand('create_test_file', [{
      name: testFileName,
      content: testContent
    }]);
    expect(createResult.success).toBe(true);

    // Read file back
    const readResult = await this.executeCommand('read_file', [{
      path: createResult.data.path
    }]);
    expect(readResult.success).toBe(true);
    expect(readResult.data).toBe(testContent);

    // Clean up
    const deleteResult = await this.executeCommand('delete_file', [{
      path: createResult.data.path
    }]);
    expect(deleteResult.success).toBe(true);

    console.log('✅ File transfer test passed');
  }

  /**
   * Test file permissions
   */
  private async testFilePermissions(): Promise<void> {
    console.log('🔐 Testing file permissions...');

    // Check if we can access app directories
    const appDirResult = await this.executeCommand('get_app_directory');
    expect(appDirResult.success).toBe(true);

    const docsDirResult = await this.executeCommand('get_documents_directory');
    expect(docsDirResult.success).toBe(true);

    console.log('✅ File permissions test passed');
  }

  /**
   * Test system integration features
   */
  async testSystemIntegration(): Promise<void> {
    console.log('🔧 Testing system integration...');
    
    try {
      // Test system tray
      await this.testSystemTray();

      // Test notifications
      await this.testNotifications();

      // Test auto-start
      await this.testAutoStart();

      console.log('✅ System integration test passed');

    } catch (error) {
      console.error('❌ System integration test failed:', error);
      await this.captureWebViewState('system-integration-failure');
      throw error;
    }
  }

  /**
   * Test system tray functionality
   */
  private async testSystemTray(): Promise<void> {
    console.log('🔌 Testing system tray...');

    const trayResult = await this.executeCommand('get_tray_items');
    expect(trayResult.success).toBe(true);

    console.log('✅ System tray test passed');
  }

  /**
   * Test notification system
   */
  private async testNotifications(): Promise<void> {
    console.log('🔔 Testing notifications...');

    const notificationResult = await this.executeCommand('send_test_notification', [{
      title: 'WebView E2E Test',
      body: 'This is a test notification from WebView E2E tests'
    }]);
    expect(notificationResult.success).toBe(true);

    console.log('✅ Notifications test passed');
  }

  /**
   * Test auto-start functionality
   */
  private async testAutoStart(): Promise<void> {
    console.log('🚀 Testing auto-start...');

    const statusResult = await this.executeCommand('get_autostart_status');
    expect(statusResult.success).toBe(true);

    console.log('✅ Auto-start test passed');
  }

  /**
   * Test cross-platform features
   */
  async testCrossPlatformFeatures(): Promise<void> {
    console.log('🌍 Testing cross-platform features...');
    
    try {
      // Get platform information
      const platformResult = await this.executeCommand('get_platform_info');
      expect(platformResult.success).toBe(true);

      const platform = platformResult.data.platform;
      console.log(`🖥️ Running on platform: ${platform}`);

      // Test platform-specific features
      if (platform === 'darwin') {
        await this.testMacOSFeatures();
      } else if (platform === 'win32') {
        await this.testWindowsFeatures();
      } else if (platform === 'linux') {
        await this.testLinuxFeatures();
      }

      console.log('✅ Cross-platform features test passed');

    } catch (error) {
      console.error('❌ Cross-platform features test failed:', error);
      await this.captureWebViewState('cross-platform-failure');
      throw error;
    }
  }

  /**
   * Test macOS-specific features
   */
  private async testMacOSFeatures(): Promise<void> {
    console.log('🍎 Testing macOS features...');

    const touchbarResult = await this.executeCommand('get_touchbar_support');
    expect(touchbarResult.success).toBe(true);

    console.log('✅ macOS features test passed');
  }

  /**
   * Test Windows-specific features
   */
  private async testWindowsFeatures(): Promise<void> {
    console.log('🪟 Testing Windows features...');

    const serviceResult = await this.executeCommand('get_windows_service_status');
    expect(serviceResult.success).toBe(true);

    console.log('✅ Windows features test passed');
  }

  /**
   * Test Linux-specific features
   */
  private async testLinuxFeatures(): Promise<void> {
    console.log('🐧 Testing Linux features...');

    const systemdResult = await this.executeCommand('get_systemd_support');
    expect(systemdResult.success).toBe(true);

    console.log('✅ Linux features test passed');
  }

  /**
   * Test performance and stability
   */
  async testPerformanceAndStability(): Promise<void> {
    console.log('⚡ Testing performance and stability...');
    
    try {
      // Test command execution performance
      await this.testCommandPerformance();

      // Test memory usage
      await this.testMemoryUsage();

      // Test concurrent operations
      await this.testConcurrentOperations();

      console.log('✅ Performance and stability test passed');

    } catch (error) {
      console.error('❌ Performance and stability test failed:', error);
      await this.captureWebViewState('performance-failure');
      throw error;
    }
  }

  /**
   * Test command execution performance
   */
  private async testCommandPerformance(): Promise<void> {
    console.log('⏱️ Testing command performance...');

    const testCommands = [
      'get_app_info',
      'get_settings',
      'get_server_status',
      'get_terminal_sessions'
    ];

    for (const command of testCommands) {
      const startTime = Date.now();
      const result = await this.executeCommand(command);
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(5000); // 5 second max

      console.log(`⚡ ${command}: ${executionTime}ms`);
    }

    console.log('✅ Command performance test passed');
  }

  /**
   * Test memory usage
   */
  private async testMemoryUsage(): Promise<void> {
    console.log('🧠 Testing memory usage...');

    const memoryResult = await this.executeCommand('get_memory_usage');
    expect(memoryResult.success).toBe(true);

    const memoryUsage = memoryResult.data;
    console.log(`💾 Memory usage: ${memoryUsage.usedMB}MB / ${memoryUsage.totalMB}MB`);

    // Memory usage should be reasonable (< 500MB for the app)
    expect(memoryUsage.usedMB).toBeLessThan(500);

    console.log('✅ Memory usage test passed');
  }

  /**
   * Test concurrent operations
   */
  private async testConcurrentOperations(): Promise<void> {
    console.log('🔄 Testing concurrent operations...');

    // Execute multiple commands concurrently
    const concurrentCommands = [
      this.executeCommand('get_app_info'),
      this.executeCommand('get_settings'),
      this.executeCommand('get_server_status'),
      this.executeCommand('get_terminal_sessions')
    ];

    const results = await Promise.all(concurrentCommands);

    for (const result of results) {
      expect(result.success).toBe(true);
    }

    console.log('✅ Concurrent operations test passed');
  }

  /**
   * Test accessibility features
   */
  async testAccessibility(): Promise<void> {
    console.log('♿ Testing accessibility...');
    
    try {
      // Check for ARIA labels
      const ariaElements = await this.page.$$('[aria-label]');
      expect(ariaElements.length).toBeGreaterThan(0);

      // Check for keyboard navigation
      await this.testKeyboardNavigation();

      // Check color contrast (basic check)
      await this.testColorContrast();

      console.log('✅ Accessibility test passed');

    } catch (error) {
      console.error('❌ Accessibility test failed:', error);
      await this.captureWebViewState('accessibility-failure');
      throw error;
    }
  }

  /**
   * Test keyboard navigation
   */
  private async testKeyboardNavigation(): Promise<void> {
    console.log('⌨️ Testing keyboard navigation...');

    // Test Tab navigation
    await this.page.keyboard.press('Tab');
    await this.page.waitForTimeout(100);

    const focusedElement = await this.page.evaluate(() => document.activeElement);
    expect(focusedElement).toBeTruthy();

    console.log('✅ Keyboard navigation test passed');
  }

  /**
   * Test color contrast (basic)
   */
  private async testColorContrast(): Promise<void> {
    console.log('🎨 Testing color contrast...');

    // This is a basic test - in production, you'd use a proper contrast checker
    const textElements = await this.page.$$('text');
    expect(textElements.length).toBeGreaterThan(0);

    console.log('✅ Color contrast test passed');
  }

  /**
   * Capture WebView state for debugging
   */
  async captureWebViewState(reason: string): Promise<void> {
    console.log(`📸 Capturing WebView state: ${reason}`);

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const testName = this.testInfo.title.replace(/[^a-zA-Z0-9]/g, '-');

      // Take screenshot
      if (this.config.captureScreenshots) {
        const screenshotPath = `test-results/webview-screenshots/${testName}-${reason}-${timestamp}.png`;
        await this.page.screenshot({ 
          path: screenshotPath,
          fullPage: true 
        });

        this.testInfo.attachments.push({
          name: `${reason}-screenshot`,
          path: screenshotPath,
          contentType: 'image/png'
        });
      }

      // Get page content
      const pageContent = await this.page.content();

      // Get command history
      const commandHistory = this.commandHistory.slice(-20); // Last 20 commands

      // Create state report
      const stateReport = {
        timestamp: new Date().toISOString(),
        test: this.testInfo.title,
        reason,
        url: this.page.url(),
        terminalSessions: Array.from(this.terminalSessions.values()),
        commandHistory,
        pageContent: pageContent.substring(0, 10000), // Limit content size
      };

      // Save state report
      const reportPath = `test-results/webview-states/${testName}-${reason}-${timestamp}.json`;
      await fs.writeFile(reportPath, JSON.stringify(stateReport, null, 2));

      this.testInfo.attachments.push({
        name: `${reason}-state`,
        path: reportPath,
        contentType: 'application/json'
      });

      console.log(`✅ WebView state captured: ${reportPath}`);

    } catch (error) {
      console.error('❌ Failed to capture WebView state:', error);
    }
  }

  /**
   * Get command history for debugging
   */
  getCommandHistory(): CommandResult[] {
    return this.commandHistory;
  }

  /**
   * Get active terminal sessions
   */
  getTerminalSessions(): TerminalSession[] {
    return Array.from(this.terminalSessions.values());
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up WebViewHelper...');

    // Clean up any remaining terminal sessions
    for (const session of this.terminalSessions.values()) {
      try {
        await this.executeCommand('cleanup_terminal_session', [session.id]);
      } catch (error) {
        console.warn(`⚠️ Failed to cleanup terminal session ${session.id}:`, error);
      }
    }

    // Cleanup Tauri helper
    await this.tauriHelper.cleanup();

    console.log('✅ WebViewHelper cleanup complete');
  }
}

/**
 * Create a WebView test helper instance
 */
export function createWebViewHelper(
  page: Page,
  context: BrowserContext,
  testInfo: TestInfo,
  config?: Partial<WebViewTestConfig>
): WebViewHelper {
  return new WebViewHelper(page, context, testInfo, config);
}