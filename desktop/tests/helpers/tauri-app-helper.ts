/**
 * TauriAppHelper - App Lifecycle and Management
 * 
 * Provides comprehensive functionality for managing Tauri desktop application
 * lifecycle, initialization, health checks, and basic operations.
 */

import { Page, BrowserContext, TestInfo } from '@playwright/test';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { 
  TauriAppInfo, 
  SystemInfo, 
  TestEnvironment, 
  TestError,
  HelperConfig,
  PerformanceMetrics
} from './types';
import { setupTestEnvironment, createTestError, sleep } from './utils';

const sleep = promisify(setTimeout);

export class TauriAppHelper {
  private page: Page;
  private context: BrowserContext;
  private testInfo: TestInfo;
  private config: HelperConfig;
  private testEnvironment: TestEnvironment;
  private metrics: PerformanceMetrics;
  private isInitialized: boolean = false;

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
      timeout: 30000,
      retries: 3,
      screenshotOnFailure: true,
      videoRecording: false,
      traceRecording: false,
      logLevel: 'info',
      tempDir: 'test-results/temp',
      ...config
    };
    this.testEnvironment = setupTestEnvironment(testInfo);
    this.metrics = {
      commandExecutionTimes: {},
      memoryUsage: [],
      cpuUsage: [],
      networkRequests: 0,
      errors: 0
    };
  }

  /**
   * Initialize the Tauri app helper and wait for app to be ready
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing TauriAppHelper...');
    
    try {
      // Ensure test directories exist
      await this.ensureTestDirectories();
      
      // Setup logging and error handling
      await this.setupLogging();
      
      // Wait for Tauri app to be fully initialized
      await this.waitForTauriApp();
      
      // Get initial app information
      await this.validateAppInfo();
      
      // Setup performance monitoring
      await this.setupPerformanceMonitoring();
      
      this.isInitialized = true;
      console.log('✅ TauriAppHelper initialized successfully');
      
    } catch (error) {
      console.error('❌ TauriAppHelper initialization failed:', error);
      await this.captureFailure('initialization-failure', error as Error);
      throw error;
    }
  }

  /**
   * Wait for Tauri app to be fully initialized with comprehensive checks
   */
  async waitForTauriApp(timeout?: number): Promise<void> {
    const actualTimeout = timeout || this.config.timeout;
    console.log(`⏳ Waiting for Tauri app initialization (timeout: ${actualTimeout}ms)...`);
    
    try {
      // Wait for page load
      await this.page.waitForLoadState('networkidle', { timeout: actualTimeout });
      
      // Wait for Tauri API to be available
      await this.page.waitForFunction(() => {
        return typeof window !== 'undefined' && 
               window.__TAURI__ && 
               window.__TAURI__.invoke &&
               window.__TAURI__.app &&
               window.__TAURI__.window;
      }, { timeout: actualTimeout });
      
      // Wait for app-specific initialization
      await this.page.waitForFunction(() => {
        return document.readyState === 'complete' && 
               (!window.__TAURI_APP_READY__ || window.__TAURI_APP_READY__ === true);
      }, { timeout: actualTimeout });
      
      // Additional wait for any async initialization
      await sleep(2000);
      
      // Verify app is responsive
      await this.page.evaluate(() => document.title);
      
      console.log('✅ Tauri app is fully initialized');
      
    } catch (error) {
      console.error('❌ Tauri app initialization failed:', error);
      await this.captureFailure('tauri-initialization-failure', error as Error);
      throw error;
    }
  }

  /**
   * Get comprehensive Tauri app information
   */
  async getAppInfo(): Promise<TauriAppInfo> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    
    try {
      const info = await this.page.evaluate(() => {
        const app = window.__TAURI__?.app;
        const platform = window.__TAURI__?.platform;
        
        return {
          version: app?.getVersion?.() || 'unknown',
          name: app?.getName?.() || 'TunnelForge',
          platform: platform?.platform || 'unknown',
          arch: platform?.arch || 'unknown',
          tauriVersion: app?.getTauriVersion?.() || 'unknown',
        };
      });
      
      // Add build date if available
      const buildDate = await this.page.evaluate(() => {
        return window.__TAURI_APP_BUILD_DATE__ || 'unknown';
      });
      
      const appInfo: TauriAppInfo = {
        ...info,
        buildDate: buildDate !== 'unknown' ? buildDate : undefined
      };
      
      // Record metrics
      this.recordMetric('getAppInfo', Date.now() - startTime);
      
      console.log('📋 App info:', appInfo);
      return appInfo;
      
    } catch (error) {
      console.error('❌ Failed to get app info:', error);
      throw createTestError('Failed to get app info', 'GET_APP_INFO', { error });
    }
  }

  /**
   * Get system and environment information
   */
  async getSystemInfo(): Promise<SystemInfo> {
    this.ensureInitialized();
    
    const startTime = Date.now();
    
    try {
      const systemInfo = await this.page.evaluate(() => ({
        platform: navigator.platform,
        userAgent: navigator.userAgent,
        language: navigator.language,
        onLine: navigator.onLine,
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
      }));
      
      const info: SystemInfo = {
        platform: systemInfo.platform,
        arch: process.arch,
        nodeVersion: process.version,
        tauriVersion: await this.page.evaluate(() => 
          window.__TAURI__?.app?.getTauriVersion?.() || 'unknown'
        ),
        isWSL: process.platform === 'linux' && !!process.env.WSL_DISTRO_NAME,
        isCI: !!process.env.CI,
        display: process.env.DISPLAY,
        locale: systemInfo.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      
      // Record metrics
      this.recordMetric('getSystemInfo', Date.now() - startTime);
      
      console.log('🖥️ System info:', info);
      return info;
      
    } catch (error) {
      console.error('❌ Failed to get system info:', error);
      throw createTestError('Failed to get system info', 'GET_SYSTEM_INFO', { error });
    }
  }

  /**
   * Wait for Tauri app to be ready for interaction
   */
  async waitForAppReady(): Promise<void> {
    console.log('⏳ Waiting for Tauri app to be ready...');
    
    try {
      // Wait for page to load
      await this.page.waitForLoadState('networkidle');
      
      // Wait for Tauri API
      await this.page.waitForFunction(() => {
        return typeof window !== 'undefined' && 
               window.__TAURI__ && 
               window.__TAURI__.invoke;
      }, { timeout: 15000 });
      
      // Additional wait for app initialization
      await this.sleep(2000);
      
      console.log('✅ Tauri app is ready');
    } catch (error) {
      console.error('❌ Failed to wait for app readiness:', error);
      throw error;
    }
  }

  /**
   * Perform comprehensive app health check
   */
  async performHealthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    this.ensureInitialized();
    
    console.log('🏥 Performing app health check...');
    
    const issues: string[] = [];
    
    try {
      // Check Tauri API availability
      const tauriAvailable = await this.page.evaluate(() => {
        return !!(window.__TAURI__ && 
                  window.__TAURI__.invoke && 
                  window.__TAURI__.app && 
                  window.__TAURI__.window);
      });
      
      if (!tauriAvailable) {
        issues.push('Tauri API not available');
      }
      
      // Check app responsiveness
      try {
        const title = await this.page.evaluate(() => document.title);
        if (!title) {
          issues.push('App title not accessible');
        }
      } catch (error) {
        issues.push('App not responsive');
      }
      
      // Check memory usage (if available)
      try {
        const memoryInfo = await this.page.evaluate(() => {
          return (performance as any).memory;
        });
        
        if (memoryInfo && memoryInfo.usedJSHeapSize > 500 * 1024 * 1024) { // 500MB
          issues.push('High memory usage detected');
        }
      } catch {
        // Memory info not available, ignore
      }
      
      // Check for JavaScript errors
      const jsErrors = await this.page.evaluate(() => {
        return (window as any).__tauri_test_errors || [];
      });
      
      if (jsErrors.length > 0) {
        issues.push(`JavaScript errors detected: ${jsErrors.length}`);
      }
      
      const healthy = issues.length === 0;
      
      console.log(healthy ? '✅ App health check passed' : `⚠️ App health issues found: ${issues.join(', ')}`);
      
      return { healthy, issues };
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
      issues.push(`Health check error: ${(error as Error).message}`);
      return { healthy: false, issues };
    }
  }

  /**
   * Restart the Tauri application
   */
  async restartApp(): Promise<void> {
    console.log('🔄 Restarting Tauri application...');
    
    try {
      // Close current app
      await this.page.close();
      
      // Wait a moment
      await sleep(2000);
      
      // Create new page (this would need to be implemented based on your test setup)
      // This is a placeholder - actual implementation depends on your test framework
      console.warn('⚠️ App restart not fully implemented - requires test framework integration');
      
    } catch (error) {
      console.error('❌ Failed to restart app:', error);
      throw createTestError('Failed to restart app', 'RESTART_APP', { error });
    }
  }

  /**
   * Get current app performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    this.ensureInitialized();
    
    try {
      // Get current memory usage
      const memoryInfo = await this.page.evaluate(() => {
        return (performance as any).memory;
      });
      
      if (memoryInfo) {
        this.metrics.memoryUsage.push(memoryInfo.usedJSHeapSize);
      }
      
      // Get network request count
      const networkRequests = await this.page.evaluate(() => {
        return (window as any).__tauri_network_requests || 0;
      });
      
      this.metrics.networkRequests = networkRequests;
      
      return { ...this.metrics };
      
    } catch (error) {
      console.error('❌ Failed to get performance metrics:', error);
      return this.metrics;
    }
  }

  /**
   * Take a screenshot with enhanced metadata
   */
  async takeScreenshot(name?: string): Promise<string> {
    const screenshotName = name || `${this.testInfo.title}-${Date.now()}`;
    const screenshotPath = path.join(
      path.dirname(this.testEnvironment.screenshotPath),
      `${screenshotName}.png`
    );
    
    try {
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
      
    } catch (error) {
      console.error('❌ Failed to take screenshot:', error);
      throw createTestError('Failed to take screenshot', 'TAKE_SCREENSHOT', { error });
    }
  }

  /**
   * Cleanup resources and finalize testing
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up TauriAppHelper...');
    
    try {
      // Save performance metrics
      await this.savePerformanceMetrics();
      
      // Save test logs
      await this.saveTestLogs();
      
      // Cleanup temporary files
      await this.cleanupTempFiles();
      
      console.log('✅ TauriAppHelper cleanup completed');
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }

  // Private helper methods

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw createTestError('TauriAppHelper not initialized', 'NOT_INITIALIZED');
    }
  }

  private async ensureTestDirectories(): Promise<void> {
    const directories = [
      path.dirname(this.testEnvironment.screenshotPath),
      path.dirname(this.testEnvironment.logPath),
      this.config.tempDir,
    ];
    
    for (const dir of directories) {
      try {
        await fs.mkdir(dir, { recursive: true });
      } catch (error) {
        console.warn(`⚠️ Failed to create directory ${dir}:`, error);
      }
    }
  }

  private async setupLogging(): Promise<void> {
    // Log console messages
    this.page.on('console', msg => {
      const text = msg.text();
      const type = msg.type();
      
      if (type === 'error') {
        this.metrics.errors++;
      }
      
      console.log(`🔍 Tauri Console [${type.toUpperCase()}]: ${text}`);
    });
    
    // Log page errors
    this.page.on('pageerror', error => {
      this.metrics.errors++;
      console.error('❌ Tauri Page Error:', error);
    });
  }

  private async validateAppInfo(): Promise<void> {
    const appInfo = await this.getAppInfo();
    
    if (!appInfo.name || !appInfo.version) {
      throw createTestError('Invalid app info', 'INVALID_APP_INFO', appInfo);
    }
    
    if (!appInfo.name.includes('TunnelForge')) {
      console.warn('⚠️ App name does not contain "TunnelForge"');
    }
  }

  private async setupPerformanceMonitoring(): Promise<void> {
    // Monitor network requests
    await this.page.evaluate(() => {
      let requestCount = 0;
      (window as any).__tauri_network_requests = 0;
      
      // Override fetch to count requests
      const originalFetch = window.fetch;
      window.fetch = function(...args: any[]) {
        requestCount++;
        (window as any).__tauri_network_requests = requestCount;
        return originalFetch.apply(this, args);
      };
    });
  }

  private recordMetric(operation: string, duration: number): void {
    if (!this.metrics.commandExecutionTimes[operation]) {
      this.metrics.commandExecutionTimes[operation] = [];
    }
    this.metrics.commandExecutionTimes[operation].push(duration);
  }

  private async captureFailure(reason: string, error: Error): Promise<void> {
    if (this.config.screenshotOnFailure) {
      await this.takeScreenshot(`failure-${reason}`);
    }
    
    // Create failure report
    const failureReport = {
      timestamp: new Date().toISOString(),
      test: this.testInfo.title,
      reason,
      error: error.message,
      stack: error.stack,
      url: this.page.url(),
      metrics: this.metrics,
    };
    
    const reportPath = path.join(
      path.dirname(this.testEnvironment.logPath),
      `failure-${reason}-${Date.now()}.json`
    );
    
    try {
      await fs.writeFile(reportPath, JSON.stringify(failureReport, null, 2));
      console.log(`📄 Failure report saved: ${reportPath}`);
    } catch (writeError) {
      console.warn('⚠️ Failed to save failure report:', writeError);
    }
  }

  private async savePerformanceMetrics(): Promise<void> {
    const metricsPath = path.join(
      path.dirname(this.testEnvironment.logPath),
      `performance-${this.testInfo.title}-${Date.now()}.json`
    );
    
    try {
      await fs.writeFile(metricsPath, JSON.stringify(this.metrics, null, 2));
      console.log(`📊 Performance metrics saved: ${metricsPath}`);
    } catch (error) {
      console.warn('⚠️ Failed to save performance metrics:', error);
    }
  }

  private async saveTestLogs(): Promise<void> {
    // This would collect and save any test-specific logs
    // Implementation depends on your logging strategy
  }

  private async cleanupTempFiles(): Promise<void> {
    try {
      const tempDir = this.config.tempDir;
      const files = await fs.readdir(tempDir);
      
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        const stat = await fs.stat(filePath);
        
        // Remove files older than 1 hour
        if (Date.now() - stat.mtime.getTime() > 60 * 60 * 1000) {
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to cleanup temp files:', error);
    }
  }
}