/**
 * Logging utilities for Tauri test helpers
 */

import { LogEntry, TestMetrics } from './types';
import { Page, TestInfo } from '@playwright/test';
import { getTimestamp, formatDuration, formatBytes } from './utils';
import fs from 'fs/promises';
import path from 'path';

/**
 * Enhanced logger for Tauri tests
 */
export class TauriLogger {
  private logs: LogEntry[] = [];
  private testInfo: TestInfo;
  private logFile?: string;
  private logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info';
  private metrics: TestMetrics;

  constructor(testInfo: TestInfo, logFile?: string, logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info') {
    this.testInfo = testInfo;
    this.logFile = logFile;
    this.logLevel = logLevel;
    this.metrics = {
      startTime: new Date(),
      commandsExecuted: 0,
      commandsFailed: 0,
      screenshotsTaken: 0,
      errors: []
    };
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: any): void {
    this.log('debug', message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: any): void {
    this.log('info', message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: any): void {
    this.log('warn', message, context);
  }

  /**
   * Log an error message
   */
  error(message: string, context?: any): void {
    this.log('error', message, context);
    this.metrics.errors.push({
      message,
      context,
      timestamp: new Date(),
      code: 'LOG_ERROR'
    });
  }

  /**
   * Log a message with specified level
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, context?: any): void {
    const logEntry: LogEntry = {
      timestamp: getTimestamp(),
      level,
      message,
      context,
      source: this.testInfo.title
    };

    this.logs.push(logEntry);

    // Console output
    const emoji = this.getLevelEmoji(level);
    const formattedMessage = `${emoji} [${level.toUpperCase()}] ${message}`;
    
    if (level === 'error') {
      console.error(formattedMessage, context || '');
    } else if (level === 'warn') {
      console.warn(formattedMessage, context || '');
    } else {
      console.log(formattedMessage, context || '');
    }
  }

  /**
   * Get emoji for log level
   */
  private getLevelEmoji(level: string): string {
    switch (level) {
      case 'debug': return '🐛';
      case 'info': return 'ℹ️';
      case 'warn': return '⚠️';
      case 'error': return '❌';
      default: return '📝';
    }
  }

  /**
   * Log command execution
   */
  logCommand(command: string, args: any[], success: boolean, duration: number): void {
    this.metrics.commandsExecuted++;
    
    if (!success) {
      this.metrics.commandsFailed++;
    }

    const level = success ? 'info' : 'error';
    const message = `Command ${success ? 'succeeded' : 'failed'}: ${command} (${formatDuration(duration)})`;
    
    this.log(level, message, {
      command,
      args,
      duration,
      success
    });
  }

  /**
   * Log screenshot taken
   */
  logScreenshot(path: string, name?: string): void {
    this.metrics.screenshotsTaken++;
    this.info(`Screenshot taken: ${name || path}`, { path, name });
  }

  /**
   * Log test start
   */
  logTestStart(): void {
    this.info(`Test started: ${this.testInfo.title}`, {
      file: this.testInfo.file,
      line: this.testInfo.line
    });
  }

  /**
   * Log test end
   */
  logTestEnd(): void {
    this.metrics.endTime = new Date();
    this.metrics.duration = this.metrics.endTime.getTime() - this.metrics.startTime.getTime();
    
    this.info(`Test completed: ${this.testInfo.title}`, {
      duration: formatDuration(this.metrics.duration),
      commandsExecuted: this.metrics.commandsExecuted,
      commandsFailed: this.metrics.commandsFailed,
      screenshotsTaken: this.metrics.screenshotsTaken,
      errors: this.metrics.errors.length
    });
  }

  /**
   * Get all logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: 'debug' | 'info' | 'warn' | 'error'): LogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Get test metrics
   */
  getMetrics(): TestMetrics {
    return { ...this.metrics };
  }

  /**
   * Save logs to file
   */
  async saveLogs(): Promise<void> {
    if (!this.logFile) {
      return;
    }

    try {
      const logData = {
        testInfo: {
          title: this.testInfo.title,
          file: this.testInfo.file,
          line: this.testInfo.line
        },
        metrics: this.metrics,
        logs: this.logs
      };

      await fs.mkdir(path.dirname(this.logFile), { recursive: true });
      await fs.writeFile(this.logFile, JSON.stringify(logData, null, 2));
      
      this.info(`Logs saved to: ${this.logFile}`);
    } catch (error) {
      console.error('❌ Failed to save logs:', error);
    }
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }

  /**
   * Create log summary
   */
  createSummary(): string {
    const summary = [];
    
    summary.push(`=== Test Log Summary: ${this.testInfo.title} ===`);
    summary.push(`Duration: ${formatDuration(this.metrics.duration || 0)}`);
    summary.push(`Commands: ${this.metrics.commandsExecuted} executed, ${this.metrics.commandsFailed} failed`);
    summary.push(`Screenshots: ${this.metrics.screenshotsTaken}`);
    summary.push(`Errors: ${this.metrics.errors.length}`);
    
    const logCounts = {
      debug: this.getLogsByLevel('debug').length,
      info: this.getLogsByLevel('info').length,
      warn: this.getLogsByLevel('warn').length,
      error: this.getLogsByLevel('error').length
    };
    
    summary.push(`Log entries: ${logCounts.debug} debug, ${logCounts.info} info, ${logCounts.warn} warn, ${logCounts.error} error`);
    
    if (this.metrics.errors.length > 0) {
      summary.push('\n=== Errors ===');
      for (const error of this.metrics.errors) {
        summary.push(`- ${error.message}`);
      }
    }
    
    return summary.join('\n');
  }
}

/**
 * Performance logger for tracking test performance
 */
export class PerformanceLogger {
  private measurements: Map<string, number[]> = new Map();
  private memoryMeasurements: number[] = [];

  /**
   * Start measuring an operation
   */
  startMeasurement(name: string): () => void {
    const startTime = Date.now();
    
    return () => {
      const duration = Date.now() - startTime;
      
      if (!this.measurements.has(name)) {
        this.measurements.set(name, []);
      }
      
      this.measurements.get(name)!.push(duration);
    };
  }

  /**
   * Record memory usage
   */
  async recordMemoryUsage(page: Page): Promise<void> {
    try {
      const memoryInfo = await page.evaluate(() => {
        return (performance as any).memory;
      });
      
      if (memoryInfo) {
        this.memoryMeasurements.push(memoryInfo.usedJSHeapSize);
      }
    } catch {
      // Memory info not available
    }
  }

  /**
   * Get performance statistics
   */
  getStats(): {
    operations: Record<string, {
      count: number;
      average: number;
      min: number;
      max: number;
      total: number;
    }>;
    memory: {
      count: number;
      average: number;
      min: number;
      max: number;
      current?: number;
    };
  } {
    const operations: any = {};
    
    for (const [name, measurements] of this.measurements.entries()) {
      const count = measurements.length;
      const total = measurements.reduce((sum, val) => sum + val, 0);
      const average = total / count;
      const min = Math.min(...measurements);
      const max = Math.max(...measurements);
      
      operations[name] = {
        count,
        average,
        min,
        max,
        total
      };
    }
    
    const memoryStats: any = {
      count: this.memoryMeasurements.length,
      average: 0,
      min: 0,
      max: 0
    };
    
    if (this.memoryMeasurements.length > 0) {
      memoryStats.average = this.memoryMeasurements.reduce((sum, val) => sum + val, 0) / this.memoryMeasurements.length;
      memoryStats.min = Math.min(...this.memoryMeasurements);
      memoryStats.max = Math.max(...this.memoryMeasurements);
      memoryStats.current = this.memoryMeasurements[this.memoryMeasurements.length - 1];
    }
    
    return {
      operations,
      memory: memoryStats
    };
  }

  /**
   * Create performance report
   */
  createReport(): string {
    const stats = this.getStats();
    const report = [];
    
    report.push('=== Performance Report ===');
    
    // Operation statistics
    report.push('\n--- Operations ---');
    for (const [name, stat] of Object.entries(stats.operations)) {
      report.push(`${name}:`);
      report.push(`  Count: ${stat.count}`);
      report.push(`  Average: ${formatDuration(stat.average)}`);
      report.push(`  Min: ${formatDuration(stat.min)}`);
      report.push(`  Max: ${formatDuration(stat.max)}`);
      report.push(`  Total: ${formatDuration(stat.total)}`);
    }
    
    // Memory statistics
    report.push('\n--- Memory Usage ---');
    report.push(`Measurements: ${stats.memory.count}`);
    if (stats.memory.count > 0) {
      report.push(`Average: ${formatBytes(stats.memory.average)}`);
      report.push(`Min: ${formatBytes(stats.memory.min)}`);
      report.push(`Max: ${formatBytes(stats.memory.max)}`);
      if (stats.memory.current) {
        report.push(`Current: ${formatBytes(stats.memory.current)}`);
      }
    }
    
    return report.join('\n');
  }

  /**
   * Clear measurements
   */
  clear(): void {
    this.measurements.clear();
    this.memoryMeasurements = [];
  }
}

/**
 * Console logger for capturing browser console output
 */
export class ConsoleLogger {
  private consoleMessages: any[] = [];
  private page: Page;

  constructor(page: Page) {
    this.page = page;
    this.setupConsoleCapture();
  }

  /**
   * Setup console message capture
   */
  private setupConsoleCapture(): void {
    this.page.on('console', (msg) => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        timestamp: getTimestamp()
      });
    });

    this.page.on('pageerror', (error) => {
      this.consoleMessages.push({
        type: 'error',
        text: error.message,
        stack: error.stack,
        timestamp: getTimestamp()
      });
    });
  }

  /**
   * Get console messages
   */
  getMessages(): any[] {
    return [...this.consoleMessages];
  }

  /**
   * Get messages by type
   */
  getMessagesByType(type: string): any[] {
    return this.consoleMessages.filter(msg => msg.type === type);
  }

  /**
   * Get error messages
   */
  getErrors(): any[] {
    return this.getMessagesByType('error');
  }

  /**
   * Get warnings
   */
  getWarnings(): any[] {
    return this.getMessagesByType('warning');
  }

  /**
   * Create console summary
   */
  createSummary(): string {
    const summary = [];
    const counts = this.consoleMessages.reduce((acc, msg) => {
      acc[msg.type] = (acc[msg.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    summary.push('=== Console Summary ===');
    for (const [type, count] of Object.entries(counts)) {
      summary.push(`${type}: ${count}`);
    }

    const errors = this.getErrors();
    if (errors.length > 0) {
      summary.push('\n--- Console Errors ---');
      for (const error of errors.slice(0, 10)) { // Limit to first 10
        summary.push(`- ${error.text}`);
      }
      if (errors.length > 10) {
        summary.push(`... and ${errors.length - 10} more errors`);
      }
    }

    return summary.join('\n');
  }

  /**
   * Clear console messages
   */
  clear(): void {
    this.consoleMessages = [];
  }
}

/**
 * Network logger for capturing network activity
 */
export class NetworkLogger {
  private networkRequests: any[] = [];
  private page: Page;

  constructor(page: Page) {
    this.page = page;
    this.setupNetworkCapture();
  }

  /**
   * Setup network request capture
   */
  private setupNetworkCapture(): void {
    this.page.on('request', (request) => {
      this.networkRequests.push({
        type: 'request',
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        timestamp: getTimestamp()
      });
    });

    this.page.on('response', (response) => {
      this.networkRequests.push({
        type: 'response',
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        headers: response.headers(),
        timestamp: getTimestamp()
      });
    });

    this.page.on('requestfailed', (request) => {
      this.networkRequests.push({
        type: 'requestfailed',
        url: request.url(),
        failure: request.failure(),
        timestamp: getTimestamp()
      });
    });
  }

  /**
   * Get network requests
   */
  getRequests(): any[] {
    return [...this.networkRequests];
  }

  /**
   * Get failed requests
   */
  getFailedRequests(): any[] {
    return this.networkRequests.filter(req => req.type === 'requestfailed');
  }

  /**
   * Get requests by URL pattern
   */
  getRequestsByPattern(pattern: RegExp): any[] {
    return this.networkRequests.filter(req => pattern.test(req.url));
  }

  /**
   * Create network summary
   */
  createSummary(): string {
    const summary = [];
    const counts = this.networkRequests.reduce((acc, req) => {
      acc[req.type] = (acc[req.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    summary.push('=== Network Summary ===');
    for (const [type, count] of Object.entries(counts)) {
      summary.push(`${type}: ${count}`);
    }

    const failedRequests = this.getFailedRequests();
    if (failedRequests.length > 0) {
      summary.push('\n--- Failed Requests ---');
      for (const req of failedRequests.slice(0, 10)) { // Limit to first 10
        summary.push(`- ${req.url}: ${req.failure?.errorText || 'Unknown error'}`);
      }
      if (failedRequests.length > 10) {
        summary.push(`... and ${failedRequests.length - 10} more failures`);
      }
    }

    return summary.join('\n');
  }

  /**
   * Clear network requests
   */
  clear(): void {
    this.networkRequests = [];
  }
}

/**
 * Create a Tauri logger
 */
export function createTauriLogger(
  testInfo: TestInfo,
  logFile?: string,
  logLevel?: 'debug' | 'info' | 'warn' | 'error'
): TauriLogger {
  return new TauriLogger(testInfo, logFile, logLevel);
}

/**
 * Create a performance logger
 */
export function createPerformanceLogger(): PerformanceLogger {
  return new PerformanceLogger();
}

/**
 * Create a console logger
 */
export function createConsoleLogger(page: Page): ConsoleLogger {
  return new ConsoleLogger(page);
}

/**
 * Create a network logger
 */
export function createNetworkLogger(page: Page): NetworkLogger {
  return new NetworkLogger(page);
}