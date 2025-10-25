/**
 * Error handling utilities for Tauri test helpers
 */

import { TestError, FailureReport } from './types';
import { Page, TestInfo } from '@playwright/test';
import { getTimestamp, formatDuration, createTestError } from './utils';

/**
 * Enhanced error handler for Tauri tests
 */
export class TauriErrorHandler {
  private page: Page;
  private testInfo: TestInfo;
  private errors: TestError[] = [];
  private screenshots: string[] = [];

  constructor(page: Page, testInfo: TestInfo) {
    this.page = page;
    this.testInfo = testInfo;
  }

  /**
   * Handle a test error with comprehensive context capture
   */
  async handleError(error: Error, context?: any): Promise<TestError> {
    const testError = createTestError(error.message, 'TEST_ERROR', context);
    
    // Capture additional context
    testError.screenshot = await this.captureErrorScreenshot();
    
    // Store error
    this.errors.push(testError);
    
    // Log error
    console.error('❌ Tauri Test Error:', {
      message: testError.message,
      code: testError.code,
      context: testError.context,
      timestamp: testError.timestamp,
      screenshot: testError.screenshot
    });
    
    return testError;
  }

  /**
   * Capture screenshot on error
   */
  private async captureErrorScreenshot(): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const screenshotName = `error-${this.testInfo.title}-${timestamp}.png`;
      const screenshotPath = `test-results/error-screenshots/${screenshotName}`;
      
      await this.page.screenshot({ 
        path: screenshotPath,
        fullPage: true 
      });
      
      this.screenshots.push(screenshotPath);
      
      // Attach to test info
      this.testInfo.attachments.push({
        name: screenshotName,
        path: screenshotPath,
        contentType: 'image/png'
      });
      
      return screenshotPath;
    } catch (screenshotError) {
      console.warn('⚠️ Failed to capture error screenshot:', screenshotError);
      return '';
    }
  }

  /**
   * Create comprehensive failure report
   */
  async createFailureReport(reason: string): Promise<FailureReport> {
    try {
      const pageContent = await this.page.content();
      const consoleMessages = await this.getPageConsoleMessages();
      const systemInfo = await this.getSystemInfo();
      
      const report: FailureReport = {
        timestamp: getTimestamp(),
        test: this.testInfo.title,
        reason,
        url: this.page.url(),
        systemInfo,
        consoleMessages,
        pageContent: pageContent.substring(0, 10000), // Limit content size
        screenshot: this.screenshots[this.screenshots.length - 1] || '',
        error: this.errors[this.errors.length - 1]
      };
      
      return report;
    } catch (error) {
      console.error('❌ Failed to create failure report:', error);
      throw error;
    }
  }

  /**
   * Get page console messages
   */
  private async getPageConsoleMessages(): Promise<string[]> {
    const messages: string[] = [];
    
    // This would need to be set up in advance
    // For now, return empty array
    return messages;
  }

  /**
   * Get system information
   */
  private async getSystemInfo(): Promise<any> {
    try {
      return await this.page.evaluate(() => ({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        onLine: navigator.onLine,
        cookieEnabled: navigator.cookieEnabled,
        doNotTrack: navigator.doNotTrack,
        screenResolution: `${screen.width}x${screen.height}`,
        colorDepth: screen.colorDepth,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }));
    } catch {
      return {};
    }
  }

  /**
   * Get all errors
   */
  getErrors(): TestError[] {
    return [...this.errors];
  }

  /**
   * Get all screenshots
   */
  getScreenshots(): string[] {
    return [...this.screenshots];
  }

  /**
   * Clear errors and screenshots
   */
  clear(): void {
    this.errors = [];
    this.screenshots = [];
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    byCode: Record<string, number>;
    byType: Record<string, number>;
  } {
    const byCode: Record<string, number> = {};
    const byType: Record<string, number> = {};
    
    for (const error of this.errors) {
      // Count by error code
      const code = error.code || 'UNKNOWN';
      byCode[code] = (byCode[code] || 0) + 1;
      
      // Count by error type
      const type = error.constructor.name;
      byType[type] = (byType[type] || 0) + 1;
    }
    
    return {
      total: this.errors.length,
      byCode,
      byType
    };
  }
}

/**
 * Retry mechanism with exponential backoff
 */
export class RetryHandler {
  private maxRetries: number;
  private baseDelay: number;
  private maxDelay: number;

  constructor(maxRetries: number = 3, baseDelay: number = 1000, maxDelay: number = 10000) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(
    fn: () => Promise<T>,
    shouldRetry?: (error: Error, attempt: number) => boolean
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === this.maxRetries) {
          break;
        }
        
        if (shouldRetry && !shouldRetry(lastError, attempt + 1)) {
          break;
        }
        
        const delay = Math.min(this.baseDelay * Math.pow(2, attempt), this.maxDelay);
        console.warn(`⚠️ Attempt ${attempt + 1} failed, retrying in ${formatDuration(delay)}:`, lastError.message);
        await this.sleep(delay);
      }
    }
    
    throw lastError!;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Timeout handler for operations
 */
export class TimeoutHandler {
  /**
   * Execute a function with timeout
   */
  static async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage?: string
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(timeoutMessage || `Operation timed out after ${formatDuration(timeoutMs)}`));
      }, timeoutMs);
    });
    
    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Create a timeout wrapper for a function
   */
  static withTimeoutWrapper<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    timeoutMs: number,
    timeoutMessage?: string
  ): T {
    return (async (...args: Parameters<T>) => {
      return this.withTimeout(fn(...args), timeoutMs, timeoutMessage);
    }) as T;
  }
}

/**
 * Circuit breaker pattern for handling repeated failures
 */
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60000,
    private monitoringPeriod: number = 10000
  ) {}

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  /**
   * Get current state
   */
  getState(): string {
    return this.state;
  }

  /**
   * Get failure count
   */
  getFailureCount(): number {
    return this.failures;
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.failures = 0;
    this.state = 'CLOSED';
    this.lastFailureTime = 0;
  }
}

/**
 * Error context builder
 */
export class ErrorContextBuilder {
  private context: any = {};

  /**
   * Add context information
   */
  add(key: string, value: any): this {
    this.context[key] = value;
    return this;
  }

  /**
   * Add page information
   */
  addPageInfo(page: Page): this {
    this.context.url = page.url();
    this.context.title = page.title();
    return this;
  }

  /**
   * Add test information
   */
  addTestInfo(testInfo: TestInfo): this {
    this.context.testTitle = testInfo.title;
    this.context.testFile = testInfo.file;
    this.context.testLine = testInfo.line;
    this.context.testColumn = testInfo.column;
    return this;
  }

  /**
   * Add system information
   */
  async addSystemInfo(page: Page): Promise<this> {
    try {
      this.context.systemInfo = await page.evaluate(() => ({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        onLine: navigator.onLine,
        screenResolution: `${screen.width}x${screen.height}`,
      }));
    } catch {
      // Ignore errors
    }
    return this;
  }

  /**
   * Add timestamp
   */
  addTimestamp(): this {
    this.context.timestamp = getTimestamp();
    return this;
  }

  /**
   * Build the context object
   */
  build(): any {
    return { ...this.context };
  }

  /**
   * Reset the builder
   */
  reset(): this {
    this.context = {};
    return this;
  }
}

/**
 * Global error handler setup
 */
export function setupGlobalErrorHandler(page: Page, errorHandler: TauriErrorHandler): void {
  // Handle page errors
  page.on('pageerror', async (error) => {
    await errorHandler.handleError(error, { type: 'pageerror' });
  });

  // Handle request failures
  page.on('requestfailed', async (request) => {
    const error = new Error(`Request failed: ${request.url()} - ${request.failure()?.errorText}`);
    await errorHandler.handleError(error, { 
      type: 'requestfailed',
      url: request.url(),
      failure: request.failure()
    });
  });

  // Handle console errors
  page.on('console', async (msg) => {
    if (msg.type() === 'error') {
      const error = new Error(`Console error: ${msg.text()}`);
      await errorHandler.handleError(error, { 
        type: 'console',
        message: msg.text(),
        location: msg.location()
      });
    }
  });
}

/**
 * Create error context builder
 */
export function createErrorContext(): ErrorContextBuilder {
  return new ErrorContextBuilder();
}

/**
 * Create retry handler
 */
export function createRetryHandler(
  maxRetries?: number,
  baseDelay?: number,
  maxDelay?: number
): RetryHandler {
  return new RetryHandler(maxRetries, baseDelay, maxDelay);
}

/**
 * Create circuit breaker
 */
export function createCircuitBreaker(
  failureThreshold?: number,
  recoveryTimeout?: number,
  monitoringPeriod?: number
): CircuitBreaker {
  return new CircuitBreaker(failureThreshold, recoveryTimeout, monitoringPeriod);
}