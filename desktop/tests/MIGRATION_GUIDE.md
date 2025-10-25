# Tauri Test Helpers Migration Guide

## Overview

This guide helps you migrate from the old Tauri test helpers to the new comprehensive test helper suite. The new suite provides enhanced functionality, better error handling, performance monitoring, and cross-platform compatibility.

## Quick Start

### Old Way
```typescript
import { createTauriHelper } from './helpers/tauri-helpers';

const helper = createTauriHelper(page, context, test.info);
await helper.waitForTauriApp();
const version = await helper.invokeTauriCommand('get_app_version');
```

### New Way
```typescript
import { createTauriTestHelpers } from '../helpers';

const helpers = await createTauriTestHelpers(page, context, test.info);
await helpers.app.navigateAndWait({ url: 'http://localhost:1420' });
const version = await helpers.command.executeWithRetry('get_app_version', []);
```

## Migration Mapping

### 1. App Lifecycle Management

| Old Method | New Method | Notes |
|------------|------------|-------|
| `waitForTauriApp()` | `app.navigateAndWait()` | Enhanced with URL and timeout options |
| `getAppInfo()` | `app.getAppInfo()` | Same interface, enhanced error handling |
| `waitForAppReady()` | `app.performHealthCheck()` | Comprehensive health validation |
| `takeScreenshot()` | `app.takeScreenshot()` | Enhanced with automatic naming |

### 2. Command Execution

| Old Method | New Method | Notes |
|------------|------------|-------|
| `invokeTauriCommand()` | `command.executeWithRetry()` | Automatic retry logic |
| N/A | `command.executeWithValidation()` | Built-in result validation |
| N/A | `command.executeBatch()` | Batch command execution |
| N/A | `command.measureCommandPerformance()` | Performance metrics |

### 3. File System Operations

| Old Method | New Method | Notes |
|------------|------------|-------|
| `testFileSystemOperations()` | `system.createTestFile()` | Individual file operations |
| N/A | `system.readTestFile()` | Read with validation |
| N/A | `system.checkFilePermissions()` | Permission checking |
| N/A | `system.createTestDirectory()` | Directory operations |

### 4. Window Operations

| Old Method | New Method | Notes |
|------------|------------|-------|
| `testWindowOperations()` | `window.getWindowState()` | Get current state |
| N/A | `window.performWindowOperation()` | Individual operations |
| N/A | `window.createWindow()` | Create new windows |
| N/A | `window.saveWindowState()` | State persistence |

### 5. System Integration

| Old Method | New Method | Notes |
|------------|------------|-------|
| `testSystemTray()` | `system.testSystemTray()` | Enhanced testing |
| `testNotifications()` | `system.sendNotification()` | Advanced options |
| N/A | `system.getSystemInfo()` | Comprehensive system info |
| N/A | `system.testPlatformSpecificFeatures()` | Platform-specific tests |

### 6. Network Operations

| Old Method | New Method | Notes |
|------------|------------|-------|
| N/A | `network.testBackendConnectivity()` | Connection testing |
| N/A | `network.createTestTunnel()` | Tunnel management |
| N/A | `network.measureNetworkPerformance()` | Performance metrics |

### 7. Configuration Management

| Old Method | New Method | Notes |
|------------|------------|-------|
| N/A | `config.loadConfiguration()` | Load with validation |
| N/A | `config.updateConfiguration()` | Safe updates |
| N/A | `config.validateConfiguration()` | Schema validation |

## Step-by-Step Migration

### Step 1: Update Imports

**Old:**
```typescript
import { createTauriHelper, getPlatformConfig } from './helpers/tauri-helpers';
```

**New:**
```typescript
import { createTauriTestHelpers } from '../helpers';
import type { TestConfig } from '../helpers/types';
```

### Step 2: Update Helper Initialization

**Old:**
```typescript
let helper: any;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  helper = createTauriHelper(page, context, test.info);
});
```

**New:**
```typescript
let helpers: any;

const testConfig: TestConfig = {
  timeouts: { default: 30000, long: 60000, command: 10000 },
  retries: { default: 3, network: 5, command: 2 },
  performance: { maxLoadTime: 30000, maxCommandTime: 5000 },
  logging: { enabled: true, level: 'info' }
};

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  helpers = await createTauriTestHelpers(page, context, test.info, testConfig);
});
```

### Step 3: Update Test Setup

**Old:**
```typescript
test.beforeEach(async () => {
  await page.goto('http://localhost:1420');
  await helper.waitForTauriApp();
  await helper.logConsoleMessages();
});
```

**New:**
```typescript
test.beforeEach(async () => {
  await helpers.app.navigateAndWait({
    url: 'http://localhost:1420',
    waitForSelector: 'body',
    timeout: testConfig.timeouts.default
  });
  
  await helpers.performance.startMonitoring();
  await helpers.logging.enableAll();
});
```

### Step 4: Update Test Methods

**Old:**
```typescript
test('should get app version', async () => {
  const version = await helper.invokeTauriCommand('get_app_version');
  expect(version).toMatch(/^\d+\.\d+\.\d+$/);
});
```

**New:**
```typescript
test('should get app version', async () => {
  const version = await helpers.command.executeWithRetry('get_app_version', [], {
    maxRetries: 3,
    timeout: 10000
  });
  expect(version).toMatch(/^\d+\.\d+\.\d+$/);
});
```

### Step 5: Update Cleanup

**Old:**
```typescript
test.afterAll(async () => {
  await context.close();
});
```

**New:**
```typescript
test.afterAll(async () => {
  if (helpers) {
    await helpers.cleanup();
    const report = await helpers.generateReport();
    console.log('📊 Test Report:', report);
  }
  await context.close();
});
```

## Enhanced Features

### 1. Performance Monitoring

```typescript
// Start monitoring
await helpers.performance.startMonitoring();

// Run your tests...

// Get metrics
const metrics = await helpers.performance.stopMonitoring();
console.log('📊 Performance:', metrics);
```

### 2. Advanced Error Handling

```typescript
const result = await helpers.command.executeWithErrorHandling(
  'risky_command',
  [],
  {
    expectedError: false,
    retryOnFailure: true,
    maxRetries: 3
  }
);

if (!result.success) {
  console.log('Command failed:', result.error);
}
```

### 3. Validation Framework

```typescript
const validation = await helpers.config.validateConfiguration(config);
if (!validation.valid) {
  console.log('Validation errors:', validation.errors);
}
```

### 4. Batch Operations

```typescript
const commands = [
  { command: 'get_app_version', args: [] },
  { command: 'get_platform_info', args: [] }
];

const results = await helpers.command.executeBatch(commands);
console.log('Batch results:', results);
```

## Configuration Options

### Test Configuration

```typescript
const testConfig: TestConfig = {
  timeouts: {
    default: 30000,    // Default timeout
    long: 60000,        // Long operations
    command: 10000,     // Command execution
    network: 15000,     // Network operations
    ui: 5000           // UI interactions
  },
  retries: {
    default: 3,         // Default retry count
    network: 5,         // Network operations
    command: 2          // Command execution
  },
  performance: {
    maxLoadTime: 30000,                     // Max app load time
    maxCommandTime: 5000,                   // Max command time
    maxMemoryUsage: 512 * 1024 * 1024,     // Max memory usage
    maxCpuUsage: 80                         // Max CPU usage %
  },
  logging: {
    enabled: true,        // Enable logging
    level: 'info',        // Log level
    includeConsole: true, // Include console logs
    includeNetwork: true, // Include network logs
    includePerformance: true // Include performance logs
  }
};
```

## Best Practices

### 1. Use Specific Helpers

**Good:**
```typescript
const version = await helpers.command.executeWithRetry('get_app_version', []);
const systemInfo = await helpers.system.getSystemInfo();
```

**Avoid:**
```typescript
// Don't access internal methods directly
const result = await helpers.page.evaluate(() => window.__TAURI__.invoke('get_app_version'));
```

### 2. Handle Errors Gracefully

```typescript
try {
  const result = await helpers.command.executeWithRetry('command', []);
  // Process result
} catch (error) {
  console.log('Command failed:', error);
  // Handle error appropriately
}
```

### 3. Use Performance Monitoring

```typescript
test.beforeEach(async () => {
  await helpers.performance.startMonitoring();
});

test.afterEach(async () => {
  const metrics = await helpers.performance.stopMonitoring();
  // Assert performance requirements
  expect(metrics.loadTime).toBeLessThan(5000);
});
```

### 4. Leverage Validation

```typescript
const config = await helpers.config.loadConfiguration();
const validation = await helpers.config.validateConfiguration(config);

if (!validation.valid) {
  throw new Error(`Configuration invalid: ${validation.errors.join(', ')}`);
}
```

## Troubleshooting

### Common Issues

1. **Helper Initialization Fails**
   - Ensure page and context are properly initialized
   - Check that Tauri app is running on expected URL

2. **Command Timeouts**
   - Increase timeout in test configuration
   - Check if command exists in Tauri backend

3. **Performance Monitoring Issues**
   - Ensure monitoring is started before operations
   - Check that browser supports performance APIs

4. **Validation Failures**
   - Review validation rules in configuration
   - Check if schema matches expected format

### Debug Mode

Enable debug logging for troubleshooting:

```typescript
const testConfig: TestConfig = {
  logging: {
    enabled: true,
    level: 'debug',
    includeConsole: true,
    includeNetwork: true,
    includePerformance: true
  }
};
```

## Migration Checklist

- [ ] Update import statements
- [ ] Replace helper initialization
- [ ] Update test setup methods
- [ ] Migrate individual test methods
- [ ] Add performance monitoring
- [ ] Implement proper error handling
- [ ] Add validation where appropriate
- [ ] Update cleanup procedures
- [ ] Configure test timeouts and retries
- [ ] Test migration with existing test suite

## Support

For migration issues:
1. Check the [API documentation](./helpers/README.md)
2. Review [example usage](./helpers/example-usage.ts)
3. Run validation tests: `npm run test:helpers`
4. Check migration examples in `tauri-app-lifecycle.enhanced.spec.ts`