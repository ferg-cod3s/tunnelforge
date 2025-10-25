# Tauri Test Helpers - Comprehensive Desktop Testing Utilities

This directory contains a comprehensive suite of test helpers specifically designed for Tauri desktop application testing. These helpers provide type-safe, well-structured utilities for testing all aspects of your Tauri application.

## 📁 Structure

```
helpers/
├── index.ts                 # Main export file
├── types.ts                 # TypeScript type definitions
├── tauri-app-helper.ts      # App lifecycle and management
├── command-helper.ts        # Tauri command execution
├── window-helper.ts         # Desktop window operations
├── system-helper.ts         # System integration testing
├── network-helper.ts        # Network connectivity testing
├── config-helper.ts         # Configuration management
├── utils.ts                 # Utility functions
├── error-handling.ts        # Error handling utilities
├── logging.ts               # Logging and performance tracking
├── validation.ts            # Validation utilities
├── example-usage.ts         # Comprehensive examples
└── README.md                # This file
```

## 🚀 Quick Start

### Installation

```bash
# The helpers are already included in your test structure
# Simply import and use them in your test files
```

## Usage

### Basic Usage

```typescript
import { test, expect } from '@playwright/test';
import { createTauriTestHelpers } from './helpers';

test('basic app test', async ({ page, context }, testInfo) => {
  // Create all helpers
  const helpers = createTauriTestHelpers(page, context, testInfo);
  
  // Initialize app
  await helpers.app.initialize();
  
  // Test app info
  const appInfo = await helpers.app.getAppInfo();
  expect(appInfo.name).toContain('TunnelForge');
  
  // Test command execution
  const result = await helpers.command.executeCommand('get_config');
  expect(result.success).toBeTruthy();
  
  // Test window operations
  const windowInfo = await helpers.window.getCurrentWindowInfo();
  expect(windowInfo.title).toContain('TunnelForge');
});
```

### Advanced Usage with Logging and Validation

```typescript
import { 
  createTauriTestHelpers,
  createTauriLogger,
  createValidationEngine,
  createErrorContext
} from './helpers';

test('comprehensive test', async ({ page, context }, testInfo) => {
  // Create helpers with configuration
  const helpers = createTauriTestHelpers(page, context, testInfo, {
    debugPort: 9222,
    timeout: 30000
  });
  
  // Setup logging
  const logger = createTauriLogger(testInfo, 'test-results/logs/test.log');
  const validationEngine = createValidationEngine();
  
  try {
    // Initialize and test
    await helpers.app.initialize();
    logger.info('App initialized successfully');
    
    // Validate system
    const systemInfo = await helpers.app.getSystemInfo();
    const validationResult = await validationEngine.validateAll({
      systemInfo,
      page,
      config: await helpers.config.getCurrentConfig()
    });
    
    expect(validationResult.isValid).toBeTruthy();
    
  } catch (error) {
    // Create error context
    const errorContext = createErrorContext()
      .addTestInfo(testInfo)
      .addPageInfo(page)
      .addTimestamp()
      .build();
    
    logger.error('Test failed', { error, context: errorContext });
    throw error;
  }
});
```

## 📚 Helper Classes

### TauriAppHelper

Manages app lifecycle, initialization, and health monitoring.

```typescript
// Initialize app
await helpers.app.initialize();

// Get app information
const appInfo = await helpers.app.getAppInfo();

// Get system information
const systemInfo = await helpers.app.getSystemInfo();

// Perform health check
const healthCheck = await helpers.app.performHealthCheck();

// Get performance metrics
const metrics = await helpers.app.getPerformanceMetrics();

// Take screenshot
const screenshotPath = await helpers.app.takeScreenshot('test-screenshot');
```

### CommandHelper

Handles Tauri command execution with comprehensive error handling and validation.

```typescript
// Execute basic command
const result = await helpers.command.executeCommand('get_config');

// Execute with validation
const validatedResult = await helpers.command.executeCommand(
  'get_server_status',
  [],
  {
    validate: (data) => data && typeof data.status === 'string',
    timeout: 10000,
    retries: 3
  }
);

// Execute multiple commands
const results = await helpers.command.executeCommands([
  { command: 'get_app_info' },
  { command: 'get_config' },
  { command: 'get_server_status' }
]);

// Execute in parallel
const parallelResults = await helpers.command.executeCommandsParallel(commands);

// Expect command to fail
await helpers.command.expectCommandFailure('invalid_command');

// Get command statistics
const stats = helpers.command.getCommandStats();
```

### WindowHelper

Manages desktop window operations and testing.

```typescript
// Get window information
const windowInfo = await helpers.window.getCurrentWindowInfo();

// Get all windows
const allWindows = await helpers.window.getAllWindows();

// Create new window
const newWindow = await helpers.window.createWindow({
  title: 'Test Window',
  width: 800,
  height: 600
});

// Window operations
await helpers.window.minimizeWindow();
await helpers.window.maximizeWindow();
await helpers.window.centerWindow();

// Set window properties
await helpers.window.setWindowSize(1024, 768);
await helpers.window.setWindowPosition(100, 100);
await helpers.window.setWindowTitle('New Title');

// Test window responsiveness
const isResponsive = await helpers.window.testWindowResponsiveness();
```

### SystemHelper

Tests system integration features like tray, notifications, and file operations.

```typescript
// Test system tray
const trayInfo = await helpers.system.testSystemTray();

// Test notifications
const notificationsWork = await helpers.system.testNotifications();

// Test file system operations
await helpers.system.testFileSystemOperations();
await helpers.system.testDirectoryOperations();

// Test clipboard operations
await helpers.system.testClipboardOperations();

// Test shell operations
await helpers.system.testShellOperations();

// Test OS integration
await helpers.system.testOSIntegration();

// Get file system info
const fsInfo = await helpers.system.getFileSystemInfo();
```

### NetworkHelper

Handles network connectivity, tunnel management, and server testing.

```typescript
// Test network connectivity
const networkStatus = await helpers.network.testNetworkConnectivity();

// Test server management
await helpers.network.testServerManagement();

// Test tunnel operations
await helpers.network.testTunnelOperations();

// Test API endpoints
await helpers.network.testAPIEndpoints();

// Test WebSocket connections
await helpers.network.testWebSocketConnections();

// Monitor network status
const history = await helpers.network.monitorNetworkStatus(30000, 5000);
```

### ConfigHelper

Manages configuration testing and validation.

```typescript
// Initialize config helper
await helpers.config.initialize();

// Get current configuration
const config = await helpers.config.getCurrentConfig();

// Update configuration
const updatedConfig = await helpers.config.updateConfig({
  autoStart: true,
  logLevel: 'debug'
});

// Test configuration features
await helpers.config.testConfigPersistence();
await helpers.config.testConfigValidation();
await helpers.config.testConfigImportExport();
await helpers.config.testConfigBackupRestore();

// Reset to defaults
await helpers.config.resetToDefaults();
```

## 🔧 Utilities

### Error Handling

```typescript
import { 
  createErrorContext,
  createRetryHandler,
  setupGlobalErrorHandler
} from './helpers';

// Create error context
const errorContext = createErrorContext()
  .addTestInfo(testInfo)
  .addPageInfo(page)
  .addTimestamp()
  .add('operation', 'test-operation')
  .build();

// Setup retry logic
const retryHandler = createRetryHandler(3, 1000);
const result = await retryHandler.execute(async () => {
  return helpers.command.executeCommand('unstable_command');
});

// Setup global error handling
const errorHandler = setupGlobalErrorHandler(page, errorHandler);
```

### Logging

```typescript
import { 
  createTauriLogger,
  createPerformanceLogger,
  createConsoleLogger,
  createNetworkLogger
} from './helpers';

// Create logger
const logger = createTauriLogger(testInfo, 'test-results/logs/test.log');

// Log messages
logger.info('Test started');
logger.warn('Warning message');
logger.error('Error message', { context: 'additional-data' });

// Performance logging
const perfLogger = createPerformanceLogger();
const measure = perfLogger.startMeasurement('operation');
// ... perform operation
measure();

// Console logging
const consoleLogger = createConsoleLogger(page);
const errors = consoleLogger.getErrors();

// Network logging
const networkLogger = createNetworkLogger(page);
const failedRequests = networkLogger.getFailedRequests();
```

### Validation

```typescript
import { createValidationEngine } from './helpers';

// Create validation engine
const validationEngine = createValidationEngine();

// Add custom validation rule
validationEngine.addRule({
  name: 'custom-rule',
  description: 'Custom validation rule',
  validate: async (context) => {
    // Custom validation logic
    return {
      isValid: true,
      errors: [],
      warnings: [],
      details: context
    };
  }
});

// Run validation
const result = await validationEngine.validateAll({
  systemInfo,
  config,
  page
});

// Run specific rule
const ruleResult = await validationEngine.validateRule('custom-rule', context);
```

## 🎯 Best Practices

### 1. Initialization

Always initialize helpers before using them:

```typescript
test.beforeEach(async ({ page, context }, testInfo) => {
  const helpers = createTauriTestHelpers(page, context, testInfo);
  await helpers.app.initialize();
  await helpers.config.initialize();
});
```

### 2. Error Handling

Use comprehensive error handling with context:

```typescript
try {
  await helpers.command.executeCommand('risky_command');
} catch (error) {
  const errorContext = createErrorContext()
    .addTestInfo(testInfo)
    .addPageInfo(page)
    .add('command', 'risky_command')
    .build();
  
  logger.error('Command failed', { error, context: errorContext });
  throw error;
}
```

### 3. Cleanup

Always cleanup resources in afterEach:

```typescript
test.afterEach(async () => {
  await helpers.app.cleanup();
  await helpers.system.cleanup();
  await helpers.network.cleanup();
  await helpers.config.cleanup();
  await logger.saveLogs();
});
```

### 4. Validation

Use validation to ensure app state:

```typescript
// Validate after operations
const validationResult = await validationEngine.validateAll({
  systemInfo: await helpers.app.getSystemInfo(),
  config: await helpers.config.getCurrentConfig(),
  windowInfo: await helpers.window.getCurrentWindowInfo(),
  page
});

expect(validationResult.isValid).toBeTruthy();
```

### 5. Performance Monitoring

Track performance of critical operations:

```typescript
const measure = performanceLogger.startMeasurement('critical-operation');
await helpers.command.executeCommand('critical_command');
measure();

// Check performance stats
const stats = performanceLogger.getStats();
expect(stats.operations['critical-operation'].average).toBeLessThan(1000);
```

## 🔧 Configuration

### Helper Configuration

```typescript
const helpers = createTauriTestHelpers(page, context, testInfo, {
  debugPort: 9222,        // Debug port for Tauri
  timeout: 30000,          // Default timeout
  retries: 3,              // Default retry count
  screenshotOnFailure: true, // Take screenshots on failure
  videoRecording: false,    // Enable video recording
  traceRecording: false,   // Enable trace recording
  logLevel: 'info',        // Logging level
  tempDir: 'test-results/temp' // Temporary directory
});
```

### Logging Configuration

```typescript
const logger = createTauriLogger(
  testInfo,                           // Test info
  'test-results/logs/test.log',       // Log file path
  'debug'                            // Log level
);
```

## 📊 Reports and Metrics

### Test Reports

The helpers automatically generate comprehensive reports:

- **Log Summary**: Test execution summary with counts and timings
- **Performance Report**: Operation timings and memory usage
- **Console Summary**: Browser console messages and errors
- **Network Summary**: Network requests and failures
- **Validation Report**: Validation results and warnings

### Metrics Tracking

```typescript
// Command execution metrics
const commandStats = helpers.command.getCommandStats();
console.log(`Commands: ${commandStats.successful}/${commandStats.total} successful`);

// Performance metrics
const perfStats = performanceLogger.getStats();
console.log(`Average response time: ${perfStats.operations['api-call'].average}ms`);

// Error metrics
const errorStats = errorHandler.getErrorStats();
console.log(`Total errors: ${errorStats.total}`);
```

## 🐛 Debugging

### Debug Mode

Enable debug mode for detailed logging:

```typescript
const helpers = createTauriTestHelpers(page, context, testInfo, {
  logLevel: 'debug'
});

const logger = createTauriLogger(testInfo, undefined, 'debug');
```

### Screenshots

Automatic screenshots on failure:

```typescript
// Manual screenshot
await helpers.app.takeScreenshot('before-operation');

// Automatic on error (configured in helper options)
// Screenshots are saved to test-results/tauri-screenshots/
```

### Console Logging

Capture browser console output:

```typescript
const consoleLogger = createConsoleLogger(page);

// Get all console messages
const messages = consoleLogger.getMessages();

// Get only errors
const errors = consoleLogger.getErrors();

// Create summary
const summary = consoleLogger.createSummary();
console.log(summary);
```

## 🔄 Integration with CI/CD

### Environment Detection

The helpers automatically detect CI environments:

```typescript
import { isCI, isWSL, getPlatformConfig } from './helpers';

if (isCI()) {
  // CI-specific configuration
  helpers = createTauriTestHelpers(page, context, testInfo, {
    timeout: 60000,  // Longer timeout in CI
    retries: 5        // More retries in CI
  });
}

if (isWSL()) {
  // WSL-specific configuration
  console.log('Running in WSL environment');
}
```

### Test Reports for CI

Generate reports suitable for CI:

```typescript
test.afterEach(async () => {
  // Save comprehensive reports
  const reports = {
    log: logger.createSummary(),
    performance: performanceLogger.createReport(),
    console: consoleLogger.createSummary(),
    network: networkLogger.createSummary(),
    validation: validationResult
  };
  
  // Save as JSON for CI processing
  testInfo.attachments.push({
    name: 'test-reports',
    body: JSON.stringify(reports, null, 2),
    contentType: 'application/json'
  });
});
```

## 📝 Examples

See `example-usage.ts` for comprehensive examples of:

- Basic helper usage
- Error handling patterns
- Performance monitoring
- Validation implementation
- Integration testing
- Custom validation rules

## 🤝 Contributing

When adding new helpers or features:

1. Follow the existing patterns and naming conventions
2. Add comprehensive TypeScript types
3. Include error handling and logging
4. Add examples to the example-usage.ts file
5. Update this README with new functionality

## 📄 License

These helpers are part of the TunnelForge project and follow the same license terms.