interface LogLevel {
  log: 'log';
  warn: 'warn';
  error: 'error';
  debug: 'debug';
}

type LogMethod = (...args: unknown[]) => void;

interface Logger {
  log: LogMethod;
  warn: LogMethod;
  error: LogMethod;
  debug: LogMethod;
}

let debugMode = false;

/**
 * Enable or disable debug mode for all loggers
 * @param enabled - Whether to enable debug logging
 */
export function setDebugMode(enabled: boolean): void {
  debugMode = enabled;
}

/**
 * Creates a logger instance for a specific module
 * @param moduleName - The name of the module for log context
 * @returns Logger instance with log, warn, error, and debug methods
 */
export function createLogger(moduleName: string): Logger {
  const createLogMethod = (level: keyof LogLevel): LogMethod => {
    return (...args: unknown[]) => {
      // Skip debug logs if debug mode is disabled
      if (level === 'debug' && !debugMode) return;

      // Log to browser console
      console[level](`[${moduleName}]`, ...args);
    };
  };

  return {
    log: createLogMethod('log'),
    warn: createLogMethod('warn'),
    error: createLogMethod('error'),
    debug: createLogMethod('debug'),
  };
}