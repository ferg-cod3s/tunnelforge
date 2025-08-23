import { parseVerbosityLevel, VerbosityLevel } from './logger.js';

/**
 * Parse verbosity level from environment variables
 * Checks TUNNELFORGE_LOG_LEVEL first, then falls back to TUNNELFORGE_DEBUG for backward compatibility
 * @returns The parsed verbosity level or undefined if not set
 */
export function parseVerbosityFromEnv(): VerbosityLevel | undefined {
  // Check TUNNELFORGE_LOG_LEVEL first
  if (process.env.TUNNELFORGE_LOG_LEVEL) {
    const parsed = parseVerbosityLevel(process.env.TUNNELFORGE_LOG_LEVEL);
    if (parsed !== undefined) {
      return parsed;
    }
    // Warn about invalid value
    console.warn(`Invalid TUNNELFORGE_LOG_LEVEL: ${process.env.TUNNELFORGE_LOG_LEVEL}`);
    console.warn('Valid levels: silent, error, warn, info, verbose, debug');
  }

  // Check legacy TUNNELFORGE_DEBUG for backward compatibility
  if (process.env.TUNNELFORGE_DEBUG === '1' || process.env.TUNNELFORGE_DEBUG === 'true') {
    return VerbosityLevel.DEBUG;
  }

  return undefined;
}
