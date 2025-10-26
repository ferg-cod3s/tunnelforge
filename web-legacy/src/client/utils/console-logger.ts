/**
 * Console Logger - Forwards browser console messages to the server
 *
 * This utility intercepts console.log, console.error, console.warn calls
 * and forwards them to the server for centralized logging.
 */

interface LogMessage {
  level: 'log' | 'error' | 'warn' | 'info' | 'debug';
  message: string;
  timestamp: string;
  url: string;
  userAgent: string;
}

class ConsoleLogger {
  private originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug,
  };

  private logBuffer: LogMessage[] = [];
  private flushInterval = 2000; // Flush every 2 seconds
  private maxBufferSize = 50;
  private flushTimer: number | null = null;

  constructor() {
    this.interceptConsole();
    this.startFlushTimer();
  }

  private interceptConsole() {
    // Intercept console.log
    console.log = (...args: any[]) => {
      this.originalConsole.log.apply(console, args);
      this.captureLog('log', args);
    };

    // Intercept console.error
    console.error = (...args: any[]) => {
      this.originalConsole.error.apply(console, args);
      this.captureLog('error', args);
    };

    // Intercept console.warn
    console.warn = (...args: any[]) => {
      this.originalConsole.warn.apply(console, args);
      this.captureLog('warn', args);
    };

    // Intercept console.info
    console.info = (...args: any[]) => {
      this.originalConsole.info.apply(console, args);
      this.captureLog('info', args);
    };

    // Intercept console.debug
    console.debug = (...args: any[]) => {
      this.originalConsole.debug.apply(console, args);
      this.captureLog('debug', args);
    };
  }

  private captureLog(level: LogMessage['level'], args: any[]) {
    try {
      // Format arguments into a string
      const message = args
        .map((arg) => {
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        })
        .join(' ');

      const logMessage: LogMessage = {
        level,
        message,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
      };

      this.logBuffer.push(logMessage);

      // Flush if buffer is full
      if (this.logBuffer.length >= this.maxBufferSize) {
        this.flush();
      }
    } catch (error) {
      // Don't let logging errors break the app
      this.originalConsole.error('ConsoleLogger error:', error);
    }
  }

  private startFlushTimer() {
    this.flushTimer = window.setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  private flush() {
    if (this.logBuffer.length === 0) {
      return;
    }

    const logs = [...this.logBuffer];
    this.logBuffer = [];

    // Send logs to server
    fetch('/api/client-logs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ logs }),
    }).catch((error) => {
      // Don't spam console with failed log submissions
      this.originalConsole.debug('Failed to send logs to server:', error);
    });
  }

  public destroy() {
    // Restore original console methods
    console.log = this.originalConsole.log;
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
    console.info = this.originalConsole.info;
    console.debug = this.originalConsole.debug;

    // Clear flush timer
    if (this.flushTimer !== null) {
      window.clearInterval(this.flushTimer);
    }

    // Final flush
    this.flush();
  }
}

// Create singleton instance
let consoleLogger: ConsoleLogger | null = null;

export function initConsoleLogger() {
  if (!consoleLogger) {
    consoleLogger = new ConsoleLogger();
  }
  return consoleLogger;
}

export function destroyConsoleLogger() {
  if (consoleLogger) {
    consoleLogger.destroy();
    consoleLogger = null;
  }
}
