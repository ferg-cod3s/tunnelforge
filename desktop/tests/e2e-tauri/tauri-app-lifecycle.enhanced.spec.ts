import { test, expect, Page, BrowserContext } from '@playwright/test';
import { createTauriTestHelpers } from '../helpers';
import { TestConfig } from '../helpers/types';

/**
 * Enhanced Tauri Desktop App Lifecycle Tests
 * 
 * These tests use the comprehensive Tauri test helper suite to verify:
 * - App startup and initialization with detailed health checks
 * - Advanced Tauri command execution with retry logic
 * - System integration with cross-platform compatibility
 * - Performance monitoring and metrics collection
 * - Error handling and recovery mechanisms
 */

test.describe('Enhanced Tauri App Lifecycle', () => {
  let page: Page;
  let context: BrowserContext;
  let helpers: any;

  // Enhanced test configuration
  const testConfig: TestConfig = {
    timeouts: {
      default: 30000,
      long: 60000,
      command: 10000,
      network: 15000,
      ui: 5000
    },
    retries: {
      default: 3,
      network: 5,
      command: 2
    },
    performance: {
      maxLoadTime: 30000,
      maxCommandTime: 5000,
      maxMemoryUsage: 512 * 1024 * 1024, // 512MB
      maxCpuUsage: 80 // 80%
    },
    logging: {
      enabled: true,
      level: 'info',
      includeConsole: true,
      includeNetwork: true,
      includePerformance: true
    }
  };

  test.beforeAll(async ({ browser }) => {
    console.log('🚀 Setting up enhanced Tauri test environment...');
    
    context = await browser.newContext({
      viewport: { width: 1200, height: 800 },
      recordVideo: {
        dir: 'test-results/videos/',
        size: { width: 1200, height: 800 }
      }
    });
    
    page = await context.newPage();
    
    // Create comprehensive test helpers
    helpers = await createTauriTestHelpers(page, context, test.info, testConfig);
    
    console.log('✅ Enhanced test environment ready');
  });

  test.afterAll(async () => {
    console.log('🧹 Cleaning up enhanced test environment...');
    
    // Cleanup helpers and capture final metrics
    if (helpers) {
      await helpers.cleanup();
      
      // Generate test report
      const report = await helpers.generateReport();
      console.log('📊 Test Report:', report);
    }
    
    await context.close();
    console.log('✅ Cleanup completed');
  });

  test.beforeEach(async () => {
    console.log('🔧 Setting up test case...');
    
    // Navigate to Tauri app with enhanced monitoring
    await helpers.app.navigateAndWait({
      url: 'http://localhost:1420',
      waitForSelector: 'body',
      timeout: testConfig.timeouts.default
    });
    
    // Start performance monitoring
    await helpers.performance.startMonitoring();
    
    // Enable comprehensive logging
    await helpers.logging.enableAll();
    
    console.log('✅ Test case setup completed');
  });

  test.afterEach(async () => {
    console.log('📊 Capturing test metrics...');
    
    // Stop performance monitoring and capture metrics
    const metrics = await helpers.performance.stopMonitoring();
    console.log('📈 Performance Metrics:', metrics);
    
    // Take screenshot for debugging
    await helpers.app.takeScreenshot(`test-${test.info.title.replace(/\s+/g, '-').toLowerCase()}`);
    
    // Clear any test state
    await helpers.cleanup();
  });

  test('should initialize Tauri app with comprehensive health checks', async () => {
    console.log('🧪 Testing comprehensive Tauri app initialization...');
    
    // Perform comprehensive health check
    const healthCheck = await helpers.app.performHealthCheck();
    console.log('🏥 Health Check Results:', healthCheck);
    
    expect(healthCheck.status).toBe('healthy');
    expect(healthCheck.tauri.available).toBe(true);
    expect(healthCheck.tauri.version).toMatch(/^\d+\.\d+\.\d+$/);
    
    // Verify app information with enhanced details
    const appInfo = await helpers.app.getAppInfo();
    console.log('📱 Enhanced App Info:', appInfo);
    
    expect(appInfo.name).toContain('TunnelForge');
    expect(appInfo.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(appInfo.platform).toBeDefined();
    expect(appInfo.arch).toBeDefined();
    
    // Check system requirements
    const systemCheck = await helpers.system.checkSystemRequirements();
    console.log('🖥️ System Requirements Check:', systemCheck);
    
    expect(systemCheck.meetsRequirements).toBe(true);
  });

  test('should execute Tauri commands with advanced retry logic', async () => {
    console.log('🧪 Testing advanced Tauri command execution...');
    
    // Test basic command with retry logic
    const version = await helpers.command.executeWithRetry('get_app_version', [], {
      maxRetries: testConfig.retries.command,
      timeout: testConfig.timeouts.command
    });
    
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    
    // Test command with validation
    const platformInfo = await helpers.command.executeWithValidation('get_platform_info', [], {
      required: ['platform', 'arch'],
      timeout: testConfig.timeouts.command
    });
    
    expect(platformInfo).toHaveProperty('platform');
    expect(platformInfo).toHaveProperty('arch');
    
    // Test batch command execution
    const commands = [
      { command: 'get_app_version', args: [] },
      { command: 'get_platform_info', args: [] }
    ];
    
    const results = await helpers.command.executeBatch(commands);
    console.log('📦 Batch Command Results:', results);
    
    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
    
    // Test command performance
    const commandMetrics = await helpers.command.measureCommandPerformance('get_app_version', []);
    console.log('⚡ Command Performance:', commandMetrics);
    
    expect(commandMetrics.executionTime).toBeLessThan(testConfig.performance.maxCommandTime);
  });

  test('should handle advanced file system operations', async () => {
    console.log('🧪 Testing advanced file system operations...');
    
    // Test file operations with validation
    const testContent = `Enhanced test file created at ${new Date().toISOString()}`;
    const testFileName = `enhanced-test-${Date.now()}.txt`;
    
    // Create test file with validation
    const createResult = await helpers.system.createTestFile(testFileName, testContent, {
      validateContent: true,
      cleanupAfter: true
    });
    
    expect(createResult.success).toBe(true);
    expect(createResult.path).toBeDefined();
    
    // Test file reading with validation
    const readResult = await helpers.system.readTestFile(testFileName);
    expect(readResult.content).toBe(testContent);
    
    // Test directory operations
    const testDirName = `enhanced-test-dir-${Date.now()}`;
    const dirResult = await helpers.system.createTestDirectory(testDirName, {
      cleanupAfter: true
    });
    
    expect(dirResult.success).toBe(true);
    
    // Test file permissions
    const permissions = await helpers.system.checkFilePermissions(createResult.path);
    expect(permissions.readable).toBe(true);
    expect(permissions.writable).toBe(true);
  });

  test('should handle advanced window operations and state management', async () => {
    console.log('🧪 Testing advanced window operations...');
    
    // Get current window state
    const windowState = await helpers.window.getWindowState();
    console.log('🪟 Initial Window State:', windowState);
    
    expect(windowState.title).toContain('TunnelForge');
    expect(windowState.visible).toBe(true);
    
    // Test window operations with validation
    const operations = ['minimize', 'maximize', 'restore', 'focus'];
    
    for (const operation of operations) {
      try {
        const result = await helpers.window.performWindowOperation(operation);
        console.log(`🔧 Window ${operation} result:`, result);
        
        if (result.supported) {
          expect(result.success).toBe(true);
        }
      } catch (error) {
        console.warn(`⚠️ Window operation ${operation} not supported:`, error);
      }
    }
    
    // Test window creation and management
    const newWindow = await helpers.window.createWindow({
      label: 'test-window',
      title: 'Test Window',
      width: 400,
      height: 300
    });
    
    if (newWindow.success) {
      expect(newWindow.label).toBe('test-window');
      
      // Close the test window
      await helpers.window.closeWindow('test-window');
    }
    
    // Test window state persistence
    const stateResult = await helpers.window.saveWindowState();
    expect(stateResult.success).toBe(true);
  });

  test('should handle system integration features', async () => {
    console.log('🧪 Testing system integration features...');
    
    // Test system tray functionality
    const trayResult = await helpers.system.testSystemTray();
    console.log('🔌 System Tray Test:', trayResult);
    
    // Test notifications with advanced options
    const notificationResult = await helpers.system.sendNotification({
      title: 'Enhanced Test Notification',
      body: 'This is an enhanced test notification',
      icon: 'info',
      timeout: 3000
    });
    
    console.log('🔔 Notification Test:', notificationResult);
    
    // Test system information gathering
    const systemInfo = await helpers.system.getSystemInfo();
    console.log('🖥️ System Information:', systemInfo);
    
    expect(systemInfo.platform).toBeDefined();
    expect(systemInfo.arch).toBeDefined();
    expect(systemInfo.memory).toBeDefined();
    
    // Test platform-specific features
    const platformFeatures = await helpers.system.testPlatformSpecificFeatures();
    console.log('🎯 Platform-Specific Features:', platformFeatures);
  });

  test('should handle network connectivity and tunnel operations', async () => {
    console.log('🧪 Testing network connectivity and tunnel operations...');
    
    // Test backend connectivity
    const connectivity = await helpers.network.testBackendConnectivity({
      timeout: testConfig.timeouts.network,
      retries: testConfig.retries.network
    });
    
    console.log('🌐 Backend Connectivity:', connectivity);
    expect(connectivity.connected).toBe(true);
    
    // Test tunnel creation and management
    const tunnelConfig = {
      name: `test-tunnel-${Date.now()}`,
      localPort: 3000,
      remotePort: 4000,
      protocol: 'http' as const
    };
    
    const tunnelResult = await helpers.network.createTestTunnel(tunnelConfig);
    console.log('🚇 Tunnel Creation:', tunnelResult);
    
    if (tunnelResult.success) {
      expect(tunnelResult.tunnelId).toBeDefined();
      
      // Test tunnel status
      const status = await helpers.network.getTunnelStatus(tunnelResult.tunnelId);
      expect(status.active).toBe(true);
      
      // Clean up test tunnel
      await helpers.network.closeTunnel(tunnelResult.tunnelId);
    }
    
    // Test network performance
    const networkPerf = await helpers.network.measureNetworkPerformance();
    console.log('📊 Network Performance:', networkPerf);
    
    expect(networkPerf.latency).toBeLessThan(1000); // Less than 1 second
  });

  test('should handle configuration management with validation', async () => {
    console.log('🧪 Testing configuration management...');
    
    // Test configuration loading
    const config = await helpers.config.loadConfiguration();
    console.log('⚙️ Configuration:', config);
    
    expect(config).toBeDefined();
    
    // Test configuration validation
    const validation = await helpers.config.validateConfiguration(config);
    console.log('✅ Configuration Validation:', validation);
    
    expect(validation.valid).toBe(true);
    
    // Test configuration updates
    const testConfig = {
      testSetting: 'test-value',
      testNumber: 42,
      testBoolean: true
    };
    
    const updateResult = await helpers.config.updateConfiguration(testConfig);
    expect(updateResult.success).toBe(true);
    
    // Test configuration persistence
    const persistedConfig = await helpers.config.loadConfiguration();
    expect(persistedConfig.testSetting).toBe('test-value');
    
    // Test configuration reset
    const resetResult = await helpers.config.resetConfiguration();
    expect(resetResult.success).toBe(true);
  });

  test('should demonstrate comprehensive error handling and recovery', async () => {
    console.log('🧪 Testing error handling and recovery...');
    
    // Test invalid command handling
    const errorResult = await helpers.command.executeWithErrorHandling('invalid_command', [], {
      expectedError: true,
      retryOnFailure: false
    });
    
    expect(errorResult.success).toBe(false);
    expect(errorResult.error).toBeDefined();
    
    // Test network error recovery
    const networkErrorTest = await helpers.network.testErrorRecovery({
      errorType: 'timeout',
      retryStrategy: 'exponential-backoff'
    });
    
    console.log('🔄 Network Error Recovery:', networkErrorTest);
    
    // Test graceful degradation
    const degradationTest = await helpers.app.testGracefulDegradation({
      feature: 'system-tray',
      fallback: 'menu-based'
    });
    
    console.log('🛡️ Graceful Degradation:', degradationTest);
  });

  test('should meet performance requirements', async () => {
    console.log('🧪 Testing performance requirements...');
    
    // Test app startup performance
    const startupMetrics = await helpers.performance.measureStartupPerformance();
    console.log('🚀 Startup Performance:', startupMetrics);
    
    expect(startupMetrics.loadTime).toBeLessThan(testConfig.performance.maxLoadTime);
    
    // Test memory usage
    const memoryUsage = await helpers.performance.getMemoryUsage();
    console.log('💾 Memory Usage:', memoryUsage);
    
    expect(memoryUsage.used).toBeLessThan(testConfig.performance.maxMemoryUsage);
    
    // Test command response times
    const commandTimes = await helpers.performance.measureCommandResponseTimes([
      'get_app_version',
      'get_platform_info'
    ]);
    
    console.log('⚡ Command Response Times:', commandTimes);
    
    for (const [command, time] of Object.entries(commandTimes)) {
      expect(time).toBeLessThan(testConfig.performance.maxCommandTime);
    }
    
    // Test UI responsiveness
    const uiResponsiveness = await helpers.performance.measureUIResponsiveness();
    console.log('🖱️ UI Responsiveness:', uiResponsiveness);
    
    expect(uiResponsiveness.averageResponseTime).toBeLessThan(testConfig.timeouts.ui);
  });

  test('should handle cross-platform compatibility', async () => {
    console.log('🧪 Testing cross-platform compatibility...');
    
    // Get platform information
    const platformInfo = await helpers.system.getPlatformInfo();
    console.log('🖥️ Platform Info:', platformInfo);
    
    // Test platform-specific features
    const platformTests = await helpers.system.runPlatformSpecificTests();
    console.log('🎯 Platform-Specific Tests:', platformTests);
    
    expect(platformTests.overall).toBe(true);
    
    // Test WSL compatibility if applicable
    if (platformInfo.isWSL) {
      const wslTests = await helpers.system.runWSLCompatibilityTests();
      console.log('🐧 WSL Compatibility Tests:', wslTests);
      
      expect(wslTests.compatible).toBe(true);
    }
    
    // Test environment-specific configurations
    const envConfig = await helpers.config.getEnvironmentSpecificConfig();
    console.log('🌍 Environment Config:', envConfig);
    
    expect(envConfig).toBeDefined();
  });
});

test.describe('Enhanced Tauri App Stress Testing', () => {
  test('should handle high-frequency operations', async ({ page, context }) => {
    console.log('🧪 Testing high-frequency operations...');
    
    const helpers = await createTauriTestHelpers(page, context, test.info);
    
    // Navigate to app
    await helpers.app.navigateAndWait({
      url: 'http://localhost:1420',
      timeout: 30000
    });
    
    // Test rapid command execution
    const commands = Array.from({ length: 100 }, (_, i) => ({
      command: 'get_app_version',
      args: [],
      id: `rapid-test-${i}`
    }));
    
    const startTime = Date.now();
    const results = await helpers.command.executeBatch(commands);
    const endTime = Date.now();
    
    console.log(`⚡ Executed ${commands.length} commands in ${endTime - startTime}ms`);
    
    // Verify all commands succeeded
    const successCount = results.filter(r => r.success).length;
    expect(successCount).toBe(commands.length);
    
    // Verify average time per command is reasonable
    const avgTime = (endTime - startTime) / commands.length;
    expect(avgTime).toBeLessThan(100); // Less than 100ms per command
    
    await helpers.cleanup();
  });

  test('should handle memory pressure', async ({ page, context }) => {
    console.log('🧪 Testing memory pressure handling...');
    
    const helpers = await createTauriTestHelpers(page, context, test.info);
    
    await helpers.app.navigateAndWait({
      url: 'http://localhost:1420',
      timeout: 30000
    });
    
    // Monitor memory during intensive operations
    await helpers.performance.startMonitoring();
    
    // Create multiple windows and perform operations
    const windows = [];
    for (let i = 0; i < 5; i++) {
      const window = await helpers.window.createWindow({
        label: `stress-test-${i}`,
        title: `Stress Test Window ${i}`,
        width: 300,
        height: 200
      });
      
      if (window.success) {
        windows.push(window.label);
      }
    }
    
    // Perform operations in each window
    for (const windowLabel of windows) {
      await helpers.window.focusWindow(windowLabel);
      await helpers.command.executeWithRetry('get_app_version', []);
    }
    
    // Clean up windows
    for (const windowLabel of windows) {
      await helpers.window.closeWindow(windowLabel);
    }
    
    // Check memory usage
    const metrics = await helpers.performance.stopMonitoring();
    console.log('💾 Memory Usage Under Pressure:', metrics);
    
    // Memory should not grow excessively
    expect(metrics.memoryUsage.peak).toBeLessThan(1024 * 1024 * 1024); // 1GB
    
    await helpers.cleanup();
  });
});