/**
 * Tauri Test Helpers - Comprehensive Desktop Testing Utilities
 * 
 * This module provides a complete suite of test helpers for Tauri desktop applications,
 * organized by functionality and designed for comprehensive cross-platform testing.
 * 
 * Main Helper Categories:
 * - TauriAppHelper: App lifecycle and management
 * - CommandHelper: Tauri command execution and validation  
 * - WindowHelper: Desktop window operations and testing
 * - SystemHelper: System tray, notifications, file system
 * - NetworkHelper: Backend connectivity and tunnel testing
 * - ConfigHelper: Configuration management testing
 * 
 * Features:
 * - Type-safe TypeScript implementations
 * - Comprehensive error handling and logging
 * - WSL compatibility where applicable
 * - Integration with Playwright page objects
 * - Support for async/await patterns
 * - Proper cleanup and resource management
 */

export { TauriAppHelper } from './tauri-app-helper';
export { CommandHelper } from './command-helper';
export { WindowHelper } from './window-helper';
export { SystemHelper } from './system-helper';
export { NetworkHelper } from './network-helper';
export { ConfigHelper } from './config-helper';

// Export all types
export * from './types';

export {
  createTauriHelper,
  isWSL,
  isCI,
  getPlatformConfig,
  setupTestEnvironment,
  cleanupTestEnvironment
} from './utils';

// Convenience factory function to create all helpers
export function createTauriTestHelpers(
  page: any,
  context: any,
  testInfo: any,
  options: { debugPort?: number; timeout?: number } = {}
) {
  const { debugPort = 9222, timeout = 30000 } = options;
  
  return {
    tauriApp: new TauriAppHelper(page, context, testInfo, debugPort),
    command: new CommandHelper(page, context, testInfo, debugPort),
    window: new WindowHelper(page, context, testInfo, debugPort),
    system: new SystemHelper(page, context, testInfo, debugPort),
    network: new NetworkHelper(page, context, testInfo, debugPort),
    config: new ConfigHelper(page, context, testInfo, debugPort),
    utils: {
      sleep: (await import('./utils')).sleep,
      generateTestId: (await import('./utils')).generateTestId,
      formatTimestamp: (await import('./utils')).formatTimestamp,
      createErrorContext: (await import('./utils')).createErrorContext,
      getPlatformConfig: (await import('./utils')).getPlatformConfig
    },
    logging: await import('./logging'),
    validation: await import('./validation'),
    cleanup: async () => {
      console.log('🧹 Cleaning up test helpers...');
    }
  };
}

export * from './error-handling';
export * from './logging';
export * from './validation';