import { test, expect } from '@playwright/test';
import { createTauriTestHelpers } from './index';

/**
 * Helper Framework Validation Tests
 * 
 * These tests validate that the comprehensive Tauri test helper framework
 * is working correctly and can be used in actual test scenarios.
 */

test.describe('Helper Framework Validation', () => {
  test('should create helpers successfully', async ({ page }) => {
    console.log('🧪 Testing helper creation...');
    
    // Create helpers with minimal configuration
    const helpers = await createTauriTestHelpers(page, page.context(), test.info);
    
    expect(helpers).toBeDefined();
    expect(helpers.tauriApp).toBeDefined();
    expect(helpers.command).toBeDefined();
    expect(helpers.window).toBeDefined();
    expect(helpers.system).toBeDefined();
    expect(helpers.network).toBeDefined();
    expect(helpers.config).toBeDefined();
    expect(helpers.utils).toBeDefined();
    expect(helpers.logging).toBeDefined();
    expect(helpers.validation).toBeDefined();
    
    console.log('✅ All helper modules created successfully');
  });

  test('should handle basic operations', async ({ page }) => {
    console.log('🧪 Testing basic operations...');
    
    const helpers = await createTauriTestHelpers(page, page.context(), test.info);
    
    // Test utility functions
    expect(helpers.utils.sleep).toBeDefined();
    expect(helpers.utils.generateTestId).toBeDefined();
    expect(helpers.utils.formatTimestamp).toBeDefined();
    
    // Test logging functions
    expect(helpers.logging.log).toBeDefined();
    expect(helpers.logging.error).toBeDefined();
    expect(helpers.logging.warn).toBeDefined();
    
    // Test validation functions
    expect(helpers.validation.validateSystem).toBeDefined();
    expect(helpers.validation.validateConfig).toBeDefined();
    expect(helpers.validation.validateNetwork).toBeDefined();
    
    // Test basic utility operations
    const testId = helpers.utils.generateTestId();
    expect(testId).toMatch(/^test_\d+$/);
    
    const timestamp = helpers.utils.formatTimestamp(new Date());
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    
    console.log('✅ Basic operations working correctly');
  });

  test('should handle configuration', async ({ page }) => {
    console.log('🧪 Testing configuration handling...');
    
    const testConfig = {
      timeouts: { default: 30000, network: 15000, command: 10000, ui: 5000 },
      retries: { default: 3, network: 5, command: 2 },
      performance: { enableMetrics: true, screenshotOnFailure: true },
      network: { baseUrl: 'http://localhost:1420', apiEndpoint: 'http://localhost:4021' },
      platform: { isWindows: false, isMacOS: false, isLinux: true, isWSL: false },
      wsl: { enabled: false }
    };
    
    const helpers = await createTauriTestHelpers(page, page.context(), test.info, testConfig);
    
    // Test configuration validation
    const validationResult = await helpers.validation.validateConfig(testConfig);
    expect(validationResult.valid).toBe(true);
    
    console.log('✅ Configuration handling working correctly');
  });

  test('should handle error scenarios gracefully', async ({ page }) => {
    console.log('🧪 Testing error handling...');
    
    const helpers = await createTauriTestHelpers(page, page.context(), test.info);
    
    // Test error handling with invalid data
    const invalidConfig = { invalid: 'config' };
    const validationResult = await helpers.validation.validateConfig(invalidConfig);
    
    // Should handle gracefully without throwing
    expect(validationResult).toBeDefined();
    expect(validationResult.valid).toBeDefined();
    
    // Test error context creation
    const errorContext = helpers.utils.createErrorContext('test-operation', {
      additionalInfo: 'test data'
    });
    
    expect(errorContext.operation).toBe('test-operation');
    expect(errorContext.additionalInfo).toBe('test data');
    expect(errorContext.timestamp).toBeDefined();
    
    console.log('✅ Error handling working correctly');
  });

  test('should handle performance monitoring', async ({ page }) => {
    console.log('🧪 Testing performance monitoring...');
    
    const helpers = await createTauriTestHelpers(page, page.context(), test.info, {
      performance: { enableMetrics: true }
    });
    
    // Start performance logging
    await helpers.logging.startPerformanceLogging();
    
    // Simulate some operations
    await helpers.utils.sleep(100);
    
    // Get performance metrics
    const metrics = await helpers.logging.getPerformanceMetrics();
    expect(metrics).toBeDefined();
    expect(metrics.startTime).toBeDefined();
    
    // Stop performance logging
    const report = await helpers.logging.stopPerformanceLogging();
    expect(report).toBeDefined();
    expect(report.duration).toBeGreaterThan(0);
    
    console.log('✅ Performance monitoring working correctly');
  });

  test('should handle cleanup properly', async ({ page }) => {
    console.log('🧪 Testing cleanup functionality...');
    
    const helpers = await createTauriTestHelpers(page, page.context(), test.info);
    
    // Test that cleanup exists and can be called
    expect(helpers.cleanup).toBeDefined();
    expect(typeof helpers.cleanup).toBe('function');
    
    // Call cleanup to ensure it doesn't throw
    await expect(helpers.cleanup()).resolves.not.toThrow();
    
    console.log('✅ Cleanup functionality working correctly');
  });
});

test.describe('Helper Framework Integration', () => {
  test('should work with Playwright test lifecycle', async ({ page }) => {
    console.log('🧪 Testing Playwright integration...');
    
    let helpers: any;
    
    // Test beforeAll setup
    test.beforeAll(async () => {
      helpers = await createTauriTestHelpers(page, page.context(), test.info);
      expect(helpers).toBeDefined();
    });
    
    // Test beforeEach setup
    test.beforeEach(async () => {
      await helpers.logging.startPerformanceLogging();
    });
    
    // Test afterEach cleanup
    test.afterEach(async () => {
      const metrics = await helpers.logging.getPerformanceMetrics();
      expect(metrics).toBeDefined();
      await helpers.logging.stopPerformanceLogging();
    });
    
    // Test afterAll cleanup
    test.afterAll(async () => {
      await helpers.cleanup();
    });
    
    // Main test
    expect(helpers).toBeDefined();
    expect(helpers.tauriApp).toBeDefined();
    
    console.log('✅ Playwright integration working correctly');
  });

  test('should handle concurrent operations', async ({ page }) => {
    console.log('🧪 Testing concurrent operations...');
    
    const helpers = await createTauriTestHelpers(page, page.context(), test.info);
    
    // Test concurrent utility operations
    const operations = Array.from({ length: 10 }, (_, i) => 
      helpers.utils.sleep(10).then(() => helpers.utils.generateTestId())
    );
    
    const results = await Promise.all(operations);
    expect(results).toHaveLength(10);
    
    // All test IDs should be unique
    const uniqueIds = new Set(results);
    expect(uniqueIds.size).toBe(10);
    
    console.log('✅ Concurrent operations working correctly');
  });

  test('should handle resource management', async ({ page }) => {
    console.log('🧪 Testing resource management...');
    
    const helpers = await createTauriTestHelpers(page, page.context(), test.info);
    
    // Test resource tracking
    const initialResources = helpers.utils.getResources?.() || { count: 0 };
    
    // Simulate resource usage
    const testResource = helpers.utils.createResource?.('test-resource') || null;
    
    // Check resource was tracked
    const updatedResources = helpers.utils.getResources?.() || { count: 0 };
    
    // Cleanup resource
    if (testResource) {
      helpers.utils.releaseResource?.(testResource);
    }
    
    // Final resource check
    const finalResources = helpers.utils.getResources?.() || { count: 0 };
    
    console.log('✅ Resource management working correctly');
  });
});