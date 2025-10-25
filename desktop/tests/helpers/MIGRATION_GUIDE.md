# Tauri Test Helpers Migration Guide

This guide helps you migrate from the basic Tauri helpers to the comprehensive test helper framework.

## Overview

The new comprehensive test helper framework provides:
- **Enhanced Error Handling**: Context-aware error handling with retry logic
- **Performance Monitoring**: Built-in performance metrics and logging
- **Cross-Platform Support**: WSL compatibility and platform-specific features
- **Advanced Validation**: Comprehensive validation framework
- **Resource Management**: Automatic cleanup and resource tracking
- **Type Safety**: Full TypeScript support with comprehensive interfaces

## Quick Migration

### Old Way (Basic Helpers)

```typescript
import { createTauriHelper } from './helpers/tauri-helpers';

const helper = createTauriHelper(page, context, test.info);
await helper.waitForTauriApp();
const version = await helper.invokeTauriCommand('get_app_version');
```

### New Way (Comprehensive Framework)

```typescript
import { createTauriTestHelpers } from '../helpers';

const helpers = await createTauriTestHelpers(page, context, test.info);
await helpers.tauriApp.waitForAppReady();
const version = await helpers.command.executeCommand('get_app_version');
```

## Detailed Migration

### 1. Import Changes

**Before:**
```typescript
import { createTauriHelper, getPlatformConfig } from './helpers/tauri-helpers';
```

**After:**
```typescript
import { createTauriTestHelpers, getPlatformConfig } from '../helpers';
```

### 2. Helper Initialization

**Before:**
```typescript
let helper: any;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  helper = createTauriHelper(page, context, test.info);
});
```

**After:**
```typescript
let helpers: any;
let config: TunnelForgeTestConfig;

test.beforeAll(async ({ browser }) => {
  config = {
    timeouts: { default: 30000, network: 15000, command: 10000, ui: 5000 },
    retries: { default: 3, network: 5, command: 2 },
    performance: { enableMetrics: true, screenshotOnFailure: true },
    network: { baseUrl: 'http://localhost:1420', apiEndpoint: 'http://localhost:4021' },
    platform: getPlatformConfig(),
    wsl: { enabled: getPlatformConfig().isWSL }
  };

  context = await browser.newContext();
  page = await context.newPage();
  helpers = await createTauriTestHelpers(page, context, test.info, config);
});
```

### 3. App Initialization

**Before:**
```typescript
await helper.waitForTauriApp();
await helper.waitForAppReady();
```

**After:**
```typescript
await helpers.tauriApp.navigateToApp();
await helpers.tauriApp.waitForAppReady();

// Enhanced health check
const healthStatus = await helpers.tauriApp.performHealthCheck();
```

### 4. Command Execution

**Before:**
```typescript
const version = await helper.invokeTauriCommand('get_app_version');
const platformInfo = await helper.invokeTauriCommand('get_platform_info');
```

**After:**
```typescript
// Simple command execution
const versionResult = await helpers.command.executeCommand('get_app_version');
const version = versionResult.data;

// Command with validation and retry
const platformResult = await helpers.command.executeCommand('get_platform_info', {}, {
  timeout: 5000,
  retries: 2,
  validate: (result) => result && result.platform
});

// Batch command execution
const batchResults = await helpers.command.executeBatchCommands([
  { command: 'get_app_version', args: {} },
  { command: 'get_platform_info', args: {} }
]);
```

### 5. File System Operations

**Before:**
```typescript
await helper.testFileSystemOperations();
```

**After:**
```typescript
// Individual file operations
const writeResult = await helpers.system.writeTextFile('test.txt', 'content', {
  createDir: true,
  validate: true
});

const readResult = await helpers.system.readTextFile('test.txt');
const exists = await helpers.system.fileExists('test.txt');
const deleteResult = await helpers.system.deleteFile('test.txt');

// Directory operations
const createDirResult = await helpers.system.createDirectory('test-dir', {
  recursive: true
});

const listResult = await helpers.system.listDirectory('test-dir');
const deleteDirResult = await helpers.system.deleteDirectory('test-dir', {
  recursive: true
});
```

### 6. Window Operations

**Before:**
```typescript
await helper.testWindowOperations();
```

**After:**
```typescript
// Get window information
const windowInfo = await helpers.window.getCurrentWindowInfo();

// Window state management
await helpers.window.minimizeWindow();
await helpers.window.waitForWindowState('minimized');
await helpers.window.restoreWindow();

// Window positioning and sizing
await helpers.window.setWindowPosition(100, 100);
await helpers.window.setWindowSize(800, 600);

// Window creation and management
const newWindow = await helpers.window.createWindow({
  url: 'http://localhost:1420/settings',
  width: 600,
  height: 400
});
```

### 7. Configuration Management

**Before:**
```typescript
// No configuration management in basic helpers
```

**After:**
```typescript
// Set and get configuration
const config = { theme: 'dark', autoStart: true };
await helpers.config.setConfig('user-preferences', config);
const retrieved = await helpers.config.getConfig('user-preferences');

// Configuration validation
const validation = await helpers.config.validateConfig(config);

// Configuration backup and restore
const backup = await helpers.config.backupConfig('user-preferences');
await helpers.config.restoreConfig('user-preferences', backup.data.backupId);
```

### 8. Network Operations

**Before:**
```typescript
// No network operations in basic helpers
```

**After:**
```typescript
// Backend connectivity
const connectivity = await helpers.network.testBackendConnectivity();

// Tunnel management
const tunnel = await helpers.network.createTestTunnel({
  type: 'http',
  localPort: 4021,
  subdomain: 'test'
});

const tunnelStatus = await helpers.network.getTunnelStatus(tunnel.data.id);
await helpers.network.closeTunnel(tunnel.data.id);

// Network diagnostics
const diagnostics = await helpers.network.runNetworkDiagnostics();
```

### 9. Error Handling

**Before:**
```typescript
try {
  await helper.invokeTauriCommand('invalid_command');
  expect.fail('Should have thrown an error');
} catch (error) {
  expect(error).toBeDefined();
}
```

**After:**
```typescript
// Built-in error handling with context
const result = await helpers.command.executeCommand('invalid_command', {}, {
  retries: 1,
  timeout: 5000
});

expect(result.success).toBe(false);
expect(result.error).toBeDefined();

// Error recovery
const recovery = await helpers.tauriApp.recoverFromError(result.error);
expect(recovery.recovered).toBe(true);
```

### 10. Performance Monitoring

**Before:**
```typescript
// No performance monitoring in basic helpers
```

**After:**
```typescript
// Start performance logging
await helpers.logging.startPerformanceLogging();

// Get performance metrics
const metrics = await helpers.tauriApp.getPerformanceMetrics();
const memoryMetrics = await helpers.tauriApp.getMemoryMetrics();

// Stop performance logging
const performanceReport = await helpers.logging.stopPerformanceLogging();
```

### 11. Screenshots and Attachments

**Before:**
```typescript
await helper.takeScreenshot('test-screenshot');
```

**After:**
```typescript
// Enhanced screenshot with metadata
await helpers.tauriApp.takeScreenshot('test-screenshot', {
  fullPage: true,
  metadata: { test: 'integration', phase: 'setup' }
});

// Automatic screenshot on failure (configured in setup)
// Screenshots are automatically attached to test reports
```

### 12. Cleanup

**Before:**
```typescript
test.afterAll(async () => {
  await context.close();
});
```

**After:**
```typescript
test.afterAll(async () => {
  // Comprehensive cleanup
  if (helpers) {
    await helpers.cleanup();
  }
  await context.close();
});
```

## Configuration Options

The new framework supports extensive configuration:

```typescript
const config: TunnelForgeTestConfig = {
  timeouts: {
    default: 30000,    // Default timeout for operations
    network: 15000,    // Network operation timeout
    command: 10000,    // Command execution timeout
    ui: 5000          // UI interaction timeout
  },
  retries: {
    default: 3,        // Default retry count
    network: 5,        // Network operation retries
    command: 2         // Command execution retries
  },
  performance: {
    enableMetrics: true,           // Enable performance metrics
    screenshotOnFailure: true,    // Auto-screenshot on failure
    videoRecording: true          // Record test videos
  },
  network: {
    baseUrl: 'http://localhost:1420',
    apiEndpoint: 'http://localhost:4021',
    timeout: 15000
  },
  platform: getPlatformConfig(),
  wsl: {
    enabled: getPlatformConfig().isWSL,
    displayServer: 'x11',
    audioSupport: false
  }
};
```

## Validation Framework

The new framework includes comprehensive validation:

```typescript
// System validation
const systemValidation = await helpers.validation.validateSystem();

// Configuration validation
const configValidation = await helpers.validation.validateConfig(config);

// Network validation
const networkValidation = await helpers.validation.validateNetwork();

// Custom validation rules
const customRules = [
  {
    name: 'tunnelforge-server',
    validate: (data) => data.port === 4021,
    message: 'Server port must be 4021'
  }
];

const customValidation = await helpers.validation.validateWithRules(data, customRules);
```

## Migration Checklist

- [ ] Update import statements
- [ ] Replace helper initialization
- [ ] Update app initialization calls
- [ ] Migrate command execution to use new API
- [ ] Replace file system operations with new methods
- [ ] Update window operations
- [ ] Add configuration management where needed
- [ ] Implement network operations testing
- [ ] Add performance monitoring
- [ ] Update error handling patterns
- [ ] Configure comprehensive cleanup
- [ ] Add validation framework usage
- [ ] Update test configuration

## Benefits of Migration

1. **Better Error Handling**: Context-aware errors with automatic retry
2. **Performance Insights**: Built-in performance monitoring and metrics
3. **Cross-Platform Support**: Enhanced WSL and platform-specific features
4. **Type Safety**: Full TypeScript support with comprehensive interfaces
5. **Resource Management**: Automatic cleanup and resource tracking
6. **Validation Framework**: Comprehensive validation for all components
7. **Enhanced Debugging**: Better logging and error context
8. **Scalability**: Designed for large-scale test suites

## Example: Complete Migrated Test

```typescript
import { test, expect } from '@playwright/test';
import { createTauriTestHelpers, getPlatformConfig } from '../helpers';

test.describe('Migrated Test Suite', () => {
  let helpers: any;
  let config: TunnelForgeTestConfig;

  test.beforeAll(async ({ browser }) => {
    config = {
      timeouts: { default: 30000, network: 15000, command: 10000, ui: 5000 },
      retries: { default: 3, network: 5, command: 2 },
      performance: { enableMetrics: true, screenshotOnFailure: true },
      network: { baseUrl: 'http://localhost:1420', apiEndpoint: 'http://localhost:4021' },
      platform: getPlatformConfig(),
      wsl: { enabled: getPlatformConfig().isWSL }
    };

    const context = await browser.newContext();
    const page = await context.newPage();
    helpers = await createTauriTestHelpers(page, context, test.info, config);
  });

  test.afterAll(async () => {
    if (helpers) {
      await helpers.cleanup();
    }
  });

  test('should demonstrate migrated functionality', async () => {
    // Enhanced app initialization
    await helpers.tauriApp.navigateToApp();
    const healthCheck = await helpers.tauriApp.performHealthCheck();
    expect(healthCheck.healthy).toBe(true);

    // Advanced command execution
    const versionResult = await helpers.command.executeCommand('get_app_version', {}, {
      validate: (result) => typeof result === 'string' && result.match(/^\d+\.\d+\.\d+$/)
    });
    expect(versionResult.success).toBe(true);

    // Configuration management
    const testConfig = { theme: 'dark', migrated: true };
    await helpers.config.setConfig('migration-test', testConfig);
    const retrieved = await helpers.config.getConfig('migration-test');
    expect(retrieved.data).toEqual(testConfig);

    // Network testing
    const connectivity = await helpers.network.testBackendConnectivity();
    expect(connectivity.connected).toBe(true);

    // Performance monitoring
    const metrics = await helpers.tauriApp.getPerformanceMetrics();
    expect(metrics.startupTime).toBeLessThan(30000);
  });
});
```

## Troubleshooting

### Common Issues

1. **Import Errors**: Ensure correct import path `../helpers`
2. **Type Errors**: Make sure to import `TunnelForgeTestConfig` type
3. **Async Initialization**: Remember to `await` the helper creation
4. **Configuration**: Provide proper configuration object
5. **Cleanup**: Always call `helpers.cleanup()` in afterAll

### Getting Help

- Check the comprehensive documentation in `README.md`
- Review example usage in `example-usage.ts`
- Look at the enhanced test files for patterns
- Check type definitions in `types.ts` for available options

This migration guide should help you transition smoothly to the comprehensive Tauri test helper framework while taking advantage of all the enhanced features and capabilities.