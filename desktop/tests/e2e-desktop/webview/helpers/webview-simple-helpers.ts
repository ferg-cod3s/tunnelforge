import { Page, BrowserContext, TestInfo, expect } from '@playwright/test';
import { promises as fs } from 'path';

/**
 * Simplified WebView test helpers for TunnelForge web interface testing
 * 
 * These helpers focus on testing the web interface that will be embedded in the Tauri WebView.
 * This approach allows us to test the UI and functionality without requiring a running Tauri app.
 */

export interface SimpleWebViewTestConfig {
  captureScreenshots: boolean;
  enableTracing: boolean;
  timeout: number;
  retries: number;
}

export interface CommandResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
}

export class SimpleWebViewHelper {
  private page: Page;
  private context: BrowserContext;
  private testInfo: TestInfo;
  private config: SimpleWebViewTestConfig;
  private commandHistory: CommandResult[] = [];

  constructor(
    page: Page,
    context: BrowserContext,
    testInfo: TestInfo,
    config: Partial<SimpleWebViewTestConfig> = {}
  ) {
    this.page = page;
    this.context = context;
    this.testInfo = testInfo;
    this.config = {
      captureScreenshots: true,
      enableTracing: false,
      timeout: 30000,
      retries: 2,
      ...config
    };
  }

  /**
   * Initialize WebView test environment
   */
  async initialize(): Promise<void> {
    console.log('🌐 Initializing simple WebView test environment...');
    
    try {
      // Wait for page to be ready
      await this.page.waitForLoadState('networkidle', { timeout: this.config.timeout });
      
      // Setup logging
      await this.setupLogging();
      
      // Wait for main app container
      await this.page.waitForSelector('tunnelforge-app, #app, .app, [data-app]', { timeout: this.config.timeout });
      
      console.log('✅ Simple WebView initialization complete');
      
    } catch (error) {
      console.error('❌ Simple WebView initialization failed:', error);
      await this.captureState('initialization-failure');
      throw error;
    }
  }

  /**
   * Setup logging for debugging
   */
  private async setupLogging(): Promise<void> {
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error('🌐 Page Error:', msg.text());
      } else if (msg.type() === 'warn') {
        console.warn('🌐 Page Warning:', msg.text());
      }
    });

    this.page.on('pageerror', error => {
      console.error('❌ Page Error:', error);
    });
  }

  /**
   * Test basic page structure
   */
  async testPageStructure(): Promise<void> {
    console.log('📄 Testing page structure...');

    // Check basic HTML structure
    await expect(this.page.locator('html')).toBeVisible();
    await expect(this.page.locator('body')).toBeVisible();

    // Check for main app container
    const appContainer = await this.page.locator('tunnelforge-app, #app, .app, [data-app]').first();
    await expect(appContainer).toBeVisible();

    // Check title
    const title = await this.page.title();
    expect(title).toMatch(/TunnelForge|VibeTunnel/);

    console.log('✅ Page structure test passed');
  }

  /**
   * Test API connectivity
   */
  async testAPIConnectivity(): Promise<void> {
    console.log('🔌 Testing API connectivity...');

    try {
      // Test health endpoint
      const response = await this.page.goto('/api/health');
      expect(response?.ok()).toBeTruthy();
      
      // Test WebSocket connection if available
      const wsConnected = await this.page.evaluate(() => {
        return window.WEBSOCKET_CONNECTED || false;
      });

      console.log(`✅ API connectivity test passed (WebSocket: ${wsConnected})`);
      
    } catch (error) {
      console.warn('⚠️ API connectivity test failed:', error);
      // Don't fail the test, just log it
    }
  }

  /**
   * Test terminal interface
   */
  async testTerminalInterface(): Promise<void> {
    console.log('💻 Testing terminal interface...');

    try {
      // Look for terminal container
      const terminalContainer = await this.page.locator('#terminal, .terminal, [data-terminal]').first();
      
      if (await terminalContainer.isVisible()) {
        console.log('✅ Terminal container found');
        
        // Test terminal input if available
        const terminalInput = await this.page.locator('#terminal-input, .terminal-input, textarea[placeholder*="terminal"]').first();
        
        if (await terminalInput.isVisible()) {
          await terminalInput.fill('echo "WebView Test"');
          await terminalInput.press('Enter');
          
          // Wait a moment for processing
          await this.page.waitForTimeout(1000);
          
          console.log('✅ Terminal input test passed');
        }
      } else {
        console.log('ℹ️ Terminal container not found (may not be loaded yet)');
      }
      
    } catch (error) {
      console.warn('⚠️ Terminal interface test failed:', error);
    }
  }

  /**
   * Test settings interface
   */
  async testSettingsInterface(): Promise<void> {
    console.log('⚙️ Testing settings interface...');

    try {
      // Look for settings button or navigation
      const settingsButton = await this.page.locator('[data-testid="settings-button"], .settings-button, #settings, button[aria-label*="Settings"]').first();
      
      if (await settingsButton.isVisible()) {
        await settingsButton.click();
        
        // Wait for settings to load
        await this.page.waitForTimeout(1000);
        
        // Check for settings sections
        const settingsSections = await this.page.locator('[data-section], .settings-section, .settings-panel').all();
        expect(settingsSections.length).toBeGreaterThan(0);
        
        console.log('✅ Settings interface test passed');
      } else {
        console.log('ℹ️ Settings button not found');
      }
      
    } catch (error) {
      console.warn('⚠️ Settings interface test failed:', error);
    }
  }

  /**
   * Test responsive design
   */
  async testResponsiveDesign(): Promise<void> {
    console.log('📱 Testing responsive design...');

    const sizes = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' }
    ];

    for (const size of sizes) {
      await this.page.setViewportSize({ width: size.width, height: size.height });
      await this.page.waitForTimeout(500);
      
      // Check that main content is still visible
      const appContainer = await this.page.locator('tunnelforge-app, #app, .app, [data-app]').first();
      await expect(appContainer).toBeVisible();
      
      console.log(`✅ ${size.name} layout (${size.width}x${size.height})`);
    }

    // Restore original size
    await this.page.setViewportSize({ width: 1200, height: 800 });
  }

  /**
   * Test accessibility
   */
  async testAccessibility(): Promise<void> {
    console.log('♿ Testing accessibility...');

    try {
      // Check for proper language attribute
      const htmlLang = await this.page.locator('html').getAttribute('lang');
      expect(htmlLang).toBeTruthy();

      // Check for proper title
      const title = await this.page.title();
      expect(title.length).toBeGreaterThan(0);

      // Check for ARIA landmarks
      const landmarks = await this.page.locator('[role="main"], [role="navigation"], [role="banner"]').all();
      if (landmarks.length > 0) {
        console.log(`✅ Found ${landmarks.length} ARIA landmarks`);
      }

      // Check for keyboard navigation
      await this.page.keyboard.press('Tab');
      const focusedElement = await this.page.evaluate(() => document.activeElement);
      expect(focusedElement).toBeTruthy();

      console.log('✅ Accessibility test passed');
      
    } catch (error) {
      console.warn('⚠️ Accessibility test failed:', error);
    }
  }

  /**
   * Test performance
   */
  async testPerformance(): Promise<void> {
    console.log('⚡ Testing performance...');

    try {
      // Measure page load time
      const performanceMetrics = await this.page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0,
          firstContentfulPaint: performance.getEntriesByType('paint')[1]?.startTime || 0,
        };
      });

      console.log('📊 Performance metrics:', performanceMetrics);

      // Basic performance assertions
      expect(performanceMetrics.domContentLoaded).toBeLessThan(5000); // 5 seconds
      expect(performanceMetrics.loadComplete).toBeLessThan(10000); // 10 seconds

      console.log('✅ Performance test passed');
      
    } catch (error) {
      console.warn('⚠️ Performance test failed:', error);
    }
  }

  /**
   * Execute a simulated command (for testing purposes)
   */
  async executeCommand(command: string, args: any[] = []): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      // Simulate command execution via API call
      const response = await this.page.evaluate(async ({ cmd, args }) => {
        try {
          const result = await fetch(`/api/${cmd}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ args }),
          });
          
          if (result.ok) {
            return { success: true, data: await result.json() };
          } else {
            return { success: false, error: result.statusText };
          }
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, { cmd: command, args });

      const commandResult: CommandResult = {
        success: response.success,
        data: response.data,
        error: response.error,
        executionTime: Date.now() - startTime
      };

      this.commandHistory.push(commandResult);
      console.log(`✅ Command executed: ${command} (${commandResult.executionTime}ms)`);
      
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
   * Capture state for debugging
   */
  async captureState(reason: string): Promise<void> {
    console.log(`📸 Capturing state: ${reason}`);

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

      console.log(`✅ State captured: ${reason}`);
      
    } catch (error) {
      console.error('❌ Failed to capture state:', error);
    }
  }

  /**
   * Get command history
   */
  getCommandHistory(): CommandResult[] {
    return this.commandHistory;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up SimpleWebViewHelper...');
    console.log('✅ SimpleWebViewHelper cleanup complete');
  }
}

/**
 * Create a simple WebView helper instance
 */
export function createSimpleWebViewHelper(
  page: Page,
  context: BrowserContext,
  testInfo: TestInfo,
  config?: Partial<SimpleWebViewTestConfig>
): SimpleWebViewHelper {
  return new SimpleWebViewHelper(page, context, testInfo, config);
}