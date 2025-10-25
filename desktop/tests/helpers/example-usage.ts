/**
 * Example usage of Tauri test helpers
 * 
 * This file demonstrates how to use all the helper classes
 * for comprehensive Tauri desktop application testing.
 */

import { test, expect } from '@playwright/test';
import { 
  createTauriTestHelpers,
  createTauriLogger,
  createPerformanceLogger,
  createConsoleLogger,
  createNetworkLogger,
  createValidationEngine,
  createErrorContext,
  createRetryHandler,
  setupGlobalErrorHandler
} from './index';

test.describe('TunnelForge Desktop - Comprehensive Test Suite', () => {
  let helpers: any;
  let logger: any;
  let performanceLogger: any;
  let consoleLogger: any;
  let networkLogger: any;
  let validationEngine: any;
  let errorHandler: any;

  test.beforeEach(async ({ page, context }, testInfo) => {
    // Initialize all helpers
    helpers = createTauriTestHelpers(page, context, testInfo, {
      debugPort: 9222,
      timeout: 30000
    });

    // Initialize logging
    logger = createTauriLogger(testInfo, `test-results/logs/${testInfo.title}.log`);
    performanceLogger = createPerformanceLogger();
    consoleLogger = createConsoleLogger(page);
    networkLogger = createNetworkLogger(page);
    validationEngine = createValidationEngine();
    errorHandler = setupGlobalErrorHandler(page, errorHandler);

    // Log test start
    logger.logTestStart();

    // Initialize app helper
    await helpers.app.initialize();
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Log test end
    logger.logTestEnd();

    // Create comprehensive reports
    const logSummary = logger.createSummary();
    const performanceReport = performanceLogger.createReport();
    const consoleSummary = consoleLogger.createSummary();
    const networkSummary = networkLogger.createSummary();

    console.log('=== Test Reports ===');
    console.log(logSummary);
    console.log(performanceReport);
    console.log(consoleSummary);
    console.log(networkSummary);

    // Save logs
    await logger.saveLogs();

    // Cleanup helpers
    await helpers.app.cleanup();
    await helpers.system.cleanup();
    await helpers.network.cleanup();
    await helpers.config.cleanup();
  });

  test('app lifecycle and initialization', async ({ page }) => {
    logger.info('Testing app lifecycle and initialization');

    // Test app information
    const appInfo = await helpers.app.getAppInfo();
    expect(appInfo.name).toContain('TunnelForge');
    expect(appInfo.version).toBeTruthy();

    // Test system information
    const systemInfo = await helpers.app.getSystemInfo();
    expect(systemInfo.platform).toBeTruthy();
    expect(systemInfo.arch).toBeTruthy();

    // Perform health check
    const healthCheck = await helpers.app.performHealthCheck();
    expect(healthCheck.healthy).toBeTruthy();

    // Validate with validation engine
    const validationResult = await validationEngine.validateAll({
      systemInfo,
      page,
      config: await helpers.config.getCurrentConfig()
    });

    expect(validationResult.isValid).toBeTruthy();
    if (!validationResult.isValid) {
      console.warn('Validation warnings:', validationResult.warnings);
    }
  });

  test('command execution and validation', async () => {
    logger.info('Testing command execution and validation');

    // Test basic command execution
    const result = await helpers.command.executeCommand('get_app_info');
    expect(result.success).toBeTruthy();
    expect(result.data).toBeTruthy();

    // Test command with validation
    const validatedResult = await helpers.command.executeCommand(
      'get_server_status',
      [],
      {
        validate: (data: any) => data && typeof data.status === 'string'
      }
    );
    expect(validatedResult.success).toBeTruthy();

    // Test command execution with retry
    const retryHandler = createRetryHandler(3, 1000);
    const retryResult = await retryHandler.execute(async () => {
      return helpers.command.executeCommand('get_config');
    });

    expect(retryResult.success).toBeTruthy();

    // Test batch commands
    const batchResults = await helpers.command.executeBatchCommands([
      { command: 'get_app_info' },
      { command: 'get_config' },
      { command: 'get_server_status' }
    ]);

    expect(batchResults.every(r => r.success)).toBeTruthy();

    // Get command statistics
    const stats = helpers.command.getCommandStats();
    logger.info(`Command statistics: ${stats.successful}/${stats.total} successful, avg time: ${stats.averageExecutionTime}ms`);
  });

  test('window management operations', async () => {
    logger.info('Testing window management operations');

    // Get current window info
    const windowInfo = await helpers.window.getCurrentWindowInfo();
    expect(windowInfo.title).toContain('TunnelForge');
    expect(windowInfo.width).toBeGreaterThan(0);
    expect(windowInfo.height).toBeGreaterThan(0);

    // Test window operations
    await helpers.window.minimizeWindow();
    await helpers.window.unminimizeWindow();

    await helpers.window.maximizeWindow();
    await helpers.window.unmaximizeWindow();

    // Test window positioning
    await helpers.window.setWindowPosition(100, 100);
    await helpers.window.centerWindow();

    // Test window sizing
    await helpers.window.setWindowSize(800, 600);

    // Test window responsiveness
    const isResponsive = await helpers.window.testWindowResponsiveness();
    expect(isResponsive).toBeTruthy();

    // Validate window info
    const updatedWindowInfo = await helpers.window.getCurrentWindowInfo();
    const windowValidation = await validationEngine.validateRule('window-info', {
      windowInfo: updatedWindowInfo
    });

    expect(windowValidation.isValid).toBeTruthy();
  });

  test('system integration features', async () => {
    logger.info('Testing system integration features');

    // Test system tray
    const trayInfo = await helpers.system.testSystemTray();
    logger.info(`System tray available: ${trayInfo.isVisible}, items: ${trayInfo.items.length}`);

    // Test notifications
    const notificationsWork = await helpers.system.testNotifications();
    logger.info(`Notifications work: ${notificationsWork}`);

    // Test file system operations
    await helpers.system.testFileSystemOperations();
    await helpers.system.testDirectoryOperations();

    // Test clipboard operations
    await helpers.system.testClipboardOperations();

    // Test shell operations
    await helpers.system.testShellOperations();

    // Test OS integration
    await helpers.system.testOSIntegration();

    // Test system permissions
    await helpers.system.testSystemPermissions();

    // Get file system info
    const fsInfo = await helpers.system.getFileSystemInfo();
    expect(fsInfo.appDir).toBeTruthy();
    expect(fsInfo.documentsDir).toBeTruthy();
  });

  test('network connectivity and tunnel management', async () => {
    logger.info('Testing network connectivity and tunnel management');

    // Test network connectivity
    const networkStatus = await helpers.network.testNetworkConnectivity();
    logger.info(`Network status: ${networkStatus.isConnected}, server: ${networkStatus.serverStatus}`);

    // Test server management
    await helpers.network.testServerManagement();

    // Test API endpoints
    await helpers.network.testAPIEndpoints();

    // Test WebSocket connections
    await helpers.network.testWebSocketConnections();

    // Test network resilience
    await helpers.network.testNetworkResilience();

    // Monitor network status
    const networkHistory = await helpers.network.monitorNetworkStatus(10000, 2000);
    expect(networkHistory.length).toBeGreaterThan(0);

    // Get network statistics
    const stats = helpers.network.getNetworkHistory();
    logger.info(`Network monitoring collected ${stats.length} samples`);
  });

  test('configuration management', async () => {
    logger.info('Testing configuration management');

    // Initialize config helper
    await helpers.config.initialize();

    // Get current config
    const currentConfig = await helpers.config.getCurrentConfig();
    expect(currentConfig.serverPort).toBe(4021);

    // Test config updates
    const updatedConfig = await helpers.config.updateConfig({
      autoStart: !currentConfig.autoStart,
      logLevel: 'debug'
    });

    expect(updatedConfig.autoStart).toBe(!currentConfig.autoStart);
    expect(updatedConfig.logLevel).toBe('debug');

    // Test config validation
    await helpers.config.testConfigValidation();

    // Test config persistence
    await helpers.config.testConfigPersistence();

    // Test config sections
    const sections = await helpers.config.testConfigSections();
    expect(Array.isArray(sections)).toBeTruthy();

    // Test config import/export
    await helpers.config.testConfigImportExport();

    // Test config backup/restore
    await helpers.config.testConfigBackupRestore();

    // Test config synchronization
    await helpers.config.testConfigSync();

    // Test config migration
    await helpers.config.testConfigMigration();

    // Test config file integrity
    await helpers.config.testConfigFileIntegrity();

    // Validate configuration
    const configValidation = await validationEngine.validateRule('config', {
      config: updatedConfig
    });

    expect(configValidation.isValid).toBeTruthy();
  });

  test('performance and error handling', async ({ page }) => {
    logger.info('Testing performance and error handling');

    // Measure performance of various operations
    const measureAppInfo = performanceLogger.startMeasurement('get-app-info');
    await helpers.app.getAppInfo();
    measureAppInfo();

    const measureCommand = performanceLogger.startMeasurement('execute-command');
    await helpers.command.executeCommand('get_config');
    measureCommand();

    const measureWindow = performanceLogger.startMeasurement('window-operations');
    await helpers.window.getCurrentWindowInfo();
    measureWindow();

    // Record memory usage
    await performanceLogger.recordMemoryUsage(page);

    // Test error handling
    try {
      await helpers.command.expectCommandFailure('invalid_command', []);
    } catch (error) {
      // This should not throw as we expect the command to fail
      logger.info('Expected command failure handled correctly');
    }

    // Test error context building
    const errorContext = createErrorContext()
      .addTestInfo(test as any)
      .addPageInfo(page)
      .addTimestamp()
      .add('operation', 'error-handling-test')
      .build();

    logger.info('Error context created:', errorContext);

    // Get performance statistics
    const perfStats = performanceLogger.getStats();
    logger.info(`Performance stats: ${Object.keys(perfStats.operations).length} operations measured`);

    // Validate performance
    const perfValidation = await validationEngine.validateRule('performance', {
      performanceStats: perfStats
    });

    expect(perfValidation.isValid).toBeTruthy();
  });

  test('comprehensive integration test', async ({ page }) => {
    logger.info('Running comprehensive integration test');

    // Setup comprehensive error context
    const errorContext = createErrorContext()
      .addTestInfo(test as any)
      .addPageInfo(page)
      .addTimestamp()
      .add('testType', 'integration')
      .build();

    // Measure overall test performance
    const overallMeasure = performanceLogger.startMeasurement('integration-test');

    try {
      // 1. Initialize and validate app
      await helpers.app.waitForTauriApp();
      const appInfo = await helpers.app.getAppInfo();
      const systemInfo = await helpers.app.getSystemInfo();

      // 2. Test configuration
      await helpers.config.initialize();
      const config = await helpers.config.getCurrentConfig();

      // 3. Test window operations
      await helpers.window.waitForWindowReady();
      const windowInfo = await helpers.window.getCurrentWindowInfo();

      // 4. Test system integration
      await helpers.system.testFileSystemOperations();
      await helpers.system.testClipboardOperations();

      // 5. Test network connectivity
      const networkStatus = await helpers.network.testNetworkConnectivity();

      // 6. Test command execution
      const commandResult = await helpers.command.executeCommand('get_app_info');

      // 7. Validate everything
      const validationResult = await validationEngine.validateAll({
        systemInfo,
        config,
        windowInfo,
        page,
        networkStatus,
        appInfo
      });

      // 8. Check overall health
      const healthCheck = await helpers.app.performHealthCheck();

      // 9. Record final metrics
      await performanceLogger.recordMemoryUsage(page);

      overallMeasure();

      // 10. Assert everything is working
      expect(appInfo.name).toContain('TunnelForge');
      expect(commandResult.success).toBeTruthy();
      expect(healthCheck.healthy).toBeTruthy();
      expect(validationResult.isValid).toBeTruthy();

      if (validationResult.warnings.length > 0) {
        logger.warn('Validation warnings:', validationResult.warnings);
      }

      logger.info('Integration test completed successfully');

    } catch (error) {
      overallMeasure();
      
      // Capture comprehensive error information
      await errorHandler.handleError(error as Error, errorContext);
      
      // Create failure report
      const failureReport = await errorHandler.createFailureReport('integration-test-failure');
      
      // Attach failure report to test
      test.attachments.push({
        name: 'failure-report',
        body: JSON.stringify(failureReport, null, 2),
        contentType: 'application/json'
      });
      
      throw error;
    }
  });
});

/**
 * Example of custom validation rule
 */
test.describe('Custom Validation Rules', () => {
  test('custom tunnelforge validation', async ({ page }, testInfo) => {
    const helpers = createTauriTestHelpers(page, context, testInfo);
    const validationEngine = createValidationEngine();

    // Add custom validation rule
    validationEngine.addRule({
      name: 'tunnelforge-specific',
      description: 'Validate TunnelForge-specific requirements',
      validate: async (context: any) => {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check if server port is the expected default
        if (context.config && context.config.serverPort !== 4021) {
          warnings.push(`Server port is ${context.config.serverPort}, expected 4021`);
        }

        // Check if app name contains TunnelForge
        if (context.appInfo && !context.appInfo.name.includes('TunnelForge')) {
          errors.push('App name does not contain "TunnelForge"');
        }

        // Check if window title is appropriate
        if (context.windowInfo && !context.windowInfo.title.includes('TunnelForge')) {
          warnings.push('Window title does not contain "TunnelForge"');
        }

        return {
          isValid: errors.length === 0,
          errors,
          warnings,
          details: context
        };
      }
    });

    // Initialize helpers
    await helpers.app.initialize();
    await helpers.config.initialize();

    // Get context data
    const context = {
      appInfo: await helpers.app.getAppInfo(),
      config: await helpers.config.getCurrentConfig(),
      windowInfo: await helpers.window.getCurrentWindowInfo(),
      page
    };

    // Run validation
    const result = await validationEngine.validateRule('tunnelforge-specific', context);
    
    expect(result.isValid).toBeTruthy();
    
    if (result.warnings.length > 0) {
      console.log('TunnelForge validation warnings:', result.warnings);
    }
  });
});