/**
 * Utility functions for Tauri test helpers
 */

import { TestInfo } from '@playwright/test';
import { TestEnvironment, PlatformConfig, TestError } from './types';
import fs from 'fs/promises';
import path from 'path';

/**
 * Sleep utility
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Create a test error with additional context
 */
export function createTestError(
  message: string,
  code: string,
  context?: any
): TestError {
  const error = new Error(message) as TestError;
  error.code = code;
  error.context = context;
  error.timestamp = new Date();
  return error;
}

/**
 * Setup test environment paths and directories
 */
export function setupTestEnvironment(testInfo: TestInfo): TestEnvironment {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const testName = testInfo.title.replace(/[^a-zA-Z0-9]/g, '-');
  
  const baseDir = 'test-results';
  const testDir = path.join(baseDir, 'tauri-tests', testName);
  
  return {
    screenshotPath: path.join(testDir, 'screenshots', `${testName}-${timestamp}.png`),
    videoPath: path.join(testDir, 'videos', `${testName}-${timestamp}.webm`),
    tracePath: path.join(testDir, 'traces', `${testName}-${timestamp}.zip`),
    logPath: path.join(testDir, 'logs', `${testName}-${timestamp}.log`),
    tempDir: path.join(testDir, 'temp'),
    timestamp
  };
}

/**
 * Cleanup test environment
 */
export async function cleanupTestEnvironment(environment: TestEnvironment): Promise<void> {
  try {
    // Remove temp directory
    const tempDir = environment.tempDir;
    try {
      const files = await fs.readdir(tempDir);
      for (const file of files) {
        await fs.unlink(path.join(tempDir, file));
      }
      await fs.rmdir(tempDir);
    } catch {
      // Temp directory might not exist or be empty
    }
  } catch (error) {
    console.warn('⚠️ Failed to cleanup test environment:', error);
  }
}

/**
 * Check if running in WSL
 */
export function isWSL(): boolean {
  return process.platform === 'linux' && !!process.env.WSL_DISTRO_NAME;
}

/**
 * Check if running in CI
 */
export function isCI(): boolean {
  return !!process.env.CI;
}

/**
 * Format timestamp for logging
 */
export function formatTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Create error context for debugging
 */
export function createErrorContext(operation: string, additionalInfo?: any): any {
  return {
    operation,
    timestamp: new Date().toISOString(),
    platform: process.platform,
    nodeVersion: process.version,
    additionalInfo
  };
}

/**
 * Get platform-specific test configuration
 */
export function getPlatformConfig() {
  return {
    isWindows: process.platform === 'win32',
    isMacOS: process.platform === 'darwin',
    isLinux: process.platform === 'linux',
    isWSL: isWSL(),
    isCI: isCI(),
    arch: process.arch,
  };
}

/**
 * Create a Tauri helper instance
 */
export function createTauriHelper(
  page: any,
  context: any,
  testInfo: TestInfo,
  debugPort?: number
) {
  // This would be implemented based on the specific helper needed
  // For now, return a basic object
  return {
    page,
    context,
    testInfo,
    debugPort: debugPort || 9222,
    waitForTauriApp: () => page.waitForFunction(() => window.__TAURI__),
    invokeTauriCommand: (command: string, ...args: any[]) => 
      page.evaluate(([cmd, cmdArgs]) => window.__TAURI__.invoke(cmd, ...cmdArgs), [command, args])
  };
}

/**
 * Format duration in milliseconds to human readable format
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    return `${(ms / 60000).toFixed(1)}m`;
  }
}

/**
 * Format bytes to human readable format
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Generate a unique test ID
 */
export function generateTestId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`⚠️ Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error);
        await sleep(delay);
      }
    }
  }
  
  throw lastError!;
}

/**
 * Wait for a condition to be true with timeout
 */
export async function waitForCondition(
  condition: () => Promise<boolean>,
  timeout: number = 10000,
  interval: number = 500
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await sleep(interval);
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Validate JSON string
 */
export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize filename for cross-platform compatibility
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

/**
 * Get current timestamp in ISO format
 */
export function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Calculate percentage
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

/**
 * Clamp a number between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if an object is empty
 */
export function isEmpty(obj: any): boolean {
  if (obj == null) return true;
  if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
  return Object.keys(obj).length === 0;
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Generate a random string
 */
export function randomString(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Check if a port is valid
 */
export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

/**
 * Check if a URL is valid
 */
export function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract error message from error object
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}

/**
 * Create a promise that resolves after a timeout
 */
export function timeoutPromise<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

/**
 * Batch process items with concurrency limit
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number = 5
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Create a rate-limited function
 */
export function rateLimit<T extends (...args: any[]) => Promise<any>>(
  func: T,
  limit: number,
  interval: number
): T {
  let calls = 0;
  let lastReset = Date.now();
  
  return (async (...args: Parameters<T>) => {
    const now = Date.now();
    
    if (now - lastReset >= interval) {
      calls = 0;
      lastReset = now;
    }
    
    if (calls >= limit) {
      const waitTime = interval - (now - lastReset);
      await sleep(waitTime);
      calls = 0;
      lastReset = Date.now();
    }
    
    calls++;
    return func(...args);
  }) as T;
}