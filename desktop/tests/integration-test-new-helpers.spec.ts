import { test, expect } from '@playwright/test';
import { createTauriTestHelpers } from './helpers';

/**
 * Integration test for the new Tauri test helpers
 * 
 * This test validates that the new helper suite works correctly
 * and can be used for actual testing scenarios.
 */

test.describe('New Tauri Helpers Integration', () => {
  test('should create and initialize helpers successfully', async ({ page, context }, testInfo) => {
    console.log('🧪 Testing helper creation and initialization...');
    
    // Create helpers with basic configuration
    const helpers = await createTauriTestHelpers(page, context, testInfo);
    
    // Verify all helper instances are created
    expect(helpers.app).toBeDefined();
    expect(helpers.command).toBeDefined();
    expect(helpers.window).toBeDefined();
    expect(helpers.system).toBeDefined();
    expect(helpers.network).toBeDefined();
    expect(helpers.config).toBeDefined();
    expect(helpers.performance).toBeDefined();
    expect(helpers.logging).toBeDefined();
    expect(helpers.validation).toBeDefined();
    
    console.log('✅ All helper instances created successfully');
    
    // Test helper cleanup
    await helpers.cleanup();
    console.log('✅ Helper cleanup completed');
  });

  test('should handle helper configuration correctly', async ({ page, context }, testInfo) => {
    console.log('🧪 Testing helper configuration...');
    
    const testConfig = {
      timeouts: {
        default: 15000,
        long: 30000,
        command: 5000,
        network: 10000,
        ui: 3000
      },
      retries: {
        default: 2,
        network: 3,
        command: 1
      },
      performance: {
        maxLoadTime: 15000,
        maxCommandTime: 3000,
        maxMemoryUsage: 256 * 1024 * 1024,
        maxCpuUsage: 70
      },
      logging: {
        enabled: true,
        level: 'info',
        includeConsole: true,
        includeNetwork: false,
        includePerformance: true
      }
    };
    
    // Create helpers with custom configuration
    const helpers = await createTauriTestHelpers(page, context, testInfo, testConfig);
    
    // Verify configuration is applied
    expect(helpers.config).toBeDefined();
    
    // Test configuration loading
    const config = await helpers.config.loadConfiguration();
    console.log('📋 Loaded configuration:', config);
    
    await helpers.cleanup();
    console.log('✅ Configuration test completed');
  });

  test('should demonstrate basic helper functionality', async ({ page, context }, testInfo) => {
    console.log('🧪 Testing basic helper functionality...');
    
    const helpers = await createTauriTestHelpers(page, context, testInfo);
    
    // Test app helper functionality
    console.log('📱 Testing app helper...');
    
    // Test navigation (without actual Tauri app)
    try {
      await helpers.app.navigateAndWait({
        url: 'about:blank',
        timeout: 5000
      });
      console.log('✅ App navigation works');
    } catch (error) {
      console.log('ℹ️ App navigation test skipped (expected without Tauri app)');
    }
    
    // Test command helper functionality
    console.log('🔧 Testing command helper...');
    
    // Test error handling with invalid command
    const errorResult = await helpers.command.executeWithErrorHandling(
      'test_invalid_command',
      [],
      {
        expectedError: true,
        retryOnFailure: false
      }
    );
    
    expect(errorResult.success).toBe(false);
    expect(errorResult.error).toBeDefined();
    console.log('✅ Command error handling works');
    
    // Test window helper functionality
    console.log('🪟 Testing window helper...');
    
    const windowState = await helpers.window.getWindowState();
    expect(windowState).toBeDefined();
    expect(windowState.title).toBeDefined();
    console.log('✅ Window state retrieval works');
    
    // Test system helper functionality
    console.log('🖥️ Testing system helper...');
    
    const platformInfo = await helpers.system.getPlatformInfo();
    expect(platformInfo).toBeDefined();
    expect(platformInfo.platform).toBeDefined();
    console.log('✅ Platform info retrieval works');
    
    // Test network helper functionality
    console.log('🌐 Testing network helper...');
    
    const networkTest = await helpers.network.testBasicConnectivity();
    expect(networkTest).toBeDefined();
    console.log('✅ Basic connectivity test works');
    
    // Test config helper functionality
    console.log('⚙️ Testing config helper...');
    
    const validationRules = await helpers.config.getValidationRules();
    expect(validationRules).toBeDefined();
    console.log('✅ Config validation rules work');
    
    // Test performance helper functionality
    console.log('📊 Testing performance helper...');
    
    await helpers.performance.startMonitoring();
    
    // Simulate some work
    await page.waitForTimeout(100);
    
    const metrics = await helpers.performance.stopMonitoring();
    expect(metrics).toBeDefined();
    expect(metrics.duration).toBeGreaterThan(0);
    console.log('✅ Performance monitoring works');
    
    // Test logging helper functionality
    console.log('📝 Testing logging helper...');
    
    await helpers.logging.enableAll();
    
    const logEntry = await helpers.logging.logTestEvent('integration-test', {
      action: 'helper-validation',
      status: 'success'
    });
    
    expect(logEntry).toBeDefined();
    console.log('✅ Logging functionality works');
    
    // Test validation helper functionality
    console.log('✅ Testing validation helper...');
    
    const validationResult = await helpers.validation.validateSystemRequirements();
    expect(validationResult).toBeDefined();
    console.log('✅ Validation functionality works');
    
    await helpers.cleanup();
    console.log('✅ All basic functionality tests completed');
  });

  test('should handle error scenarios gracefully', async ({ page, context }, testInfo) => {
    console.log('🧪 Testing error handling scenarios...');
    
    const helpers = await createTauriTestHelpers(page, context, testInfo);
    
    // Test command timeout
    const timeoutResult = await helpers.command.executeWithTimeout(
      'test_timeout_command',
      [],
      100 // Very short timeout
    );
    
    expect(timeoutResult.timedOut).toBe(true);
    console.log('✅ Command timeout handling works');
    
    // Test invalid window operation
    const windowError = await helpers.window.performWindowOperation('invalid_operation');
    expect(windowError.success).toBe(false);
    console.log('✅ Invalid window operation handling works');
    
    // Test network error recovery
    const networkErrorTest = await helpers.network.simulateNetworkError();
    expect(networkErrorTest).toBeDefined();
    console.log('✅ Network error simulation works');
    
    await helpers.cleanup();
    console.log('✅ Error handling tests completed');
  });

  test('should generate comprehensive reports', async ({ page, context }, testInfo) => {
    console.log('🧪 Testing report generation...');
    
    const helpers = await createTauriTestHelpers(page, context, testInfo);
    
    // Perform some operations to generate data
    await helpers.performance.startMonitoring();
    await helpers.logging.enableAll();
    
    // Simulate test activities
    await page.waitForTimeout(50);
    await helpers.command.executeWithErrorHandling('test_command', [], {
      expectedError: true
    });
    
    const metrics = await helpers.performance.stopMonitoring();
    
    // Generate comprehensive report
    const report = await helpers.generateReport();
    
    expect(report).toBeDefined();
    expect(report.summary).toBeDefined();
    expect(report.performance).toBeDefined();
    expect(report.errors).toBeDefined();
    expect(report.logs).toBeDefined();
    
    console.log('📊 Generated report summary:', report.summary);
    console.log('✅ Report generation works');
    
    await helpers.cleanup();
    console.log('✅ Report generation test completed');
  });

  test('should demonstrate cross-platform compatibility', async ({ page, context }, testInfo) => {
    console.log('🧪 Testing cross-platform compatibility...');
    
    const helpers = await createTauriTestHelpers(page, context, testInfo);
    
    // Test platform detection
    const platformInfo = await helpers.system.getPlatformInfo();
    console.log('🖥️ Detected platform:', platformInfo);
    
    expect(platformInfo.platform).toBeDefined();
    expect(platformInfo.arch).toBeDefined();
    expect(platformInfo.isWindows !== undefined).toBe(true);
    expect(platformInfo.isMacOS !== undefined).toBe(true);
    expect(platformInfo.isLinux !== undefined).toBe(true);
    expect(platformInfo.isWSL !== undefined).toBe(true);
    
    // Test platform-specific configurations
    const platformConfig = await helpers.config.getEnvironmentSpecificConfig();
    expect(platformConfig).toBeDefined();
    
    // Test WSL detection if applicable
    if (platformInfo.isWSL) {
      const wslInfo = await helpers.system.getWSLInfo();
      expect(wslInfo).toBeDefined();
      console.log('🐧 WSL Info:', wslInfo);
    }
    
    console.log('✅ Cross-platform compatibility test completed');
    
    await helpers.cleanup();
  });
});

test.describe('New Tauri Helpers Performance', () => {
  test('should meet performance requirements', async ({ page, context }, testInfo) => {
    console.log('🧪 Testing helper performance...');
    
    const startTime = Date.now();
    
    // Test helper creation performance
    const helpers = await createTauriTestHelpers(page, context, testInfo);
    const creationTime = Date.now() - startTime;
    
    console.log(`⏱️ Helper creation time: ${creationTime}ms`);
    expect(creationTime).toBeLessThan(1000); // Should create within 1 second
    
    // Test operation performance
    const operationStart = Date.now();
    
    await Promise.all([
      helpers.system.getPlatformInfo(),
      helpers.window.getWindowState(),
      helpers.config.getValidationRules()
    ]);
    
    const operationTime = Date.now() - operationStart;
    console.log(`⏱️ Parallel operations time: ${operationTime}ms`);
    expect(operationTime).toBeLessThan(500); // Should complete within 500ms
    
    // Test cleanup performance
    const cleanupStart = Date.now();
    await helpers.cleanup();
    const cleanupTime = Date.now() - cleanupStart;
    
    console.log(`⏱️ Cleanup time: ${cleanupTime}ms`);
    expect(cleanupTime).toBeLessThan(1000); // Should cleanup within 1 second
    
    console.log('✅ Performance requirements met');
  });
});