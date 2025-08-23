import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VerbosityLevel } from '../../server/utils/logger';
import { parseVerbosityFromEnv } from '../../server/utils/verbosity-parser';

describe('CLI Verbosity Environment Variables', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules to ensure fresh imports
    vi.resetModules();
    // Clone the original env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  async function getVerbosityFromEnv(): Promise<VerbosityLevel | undefined> {
    // Use the shared parser
    return parseVerbosityFromEnv();
  }

  describe('TUNNELFORGE_LOG_LEVEL', () => {
    it('should parse silent level', async () => {
      process.env.TUNNELFORGE_LOG_LEVEL = 'silent';
      const level = await getVerbosityFromEnv();
      expect(level).toBe(VerbosityLevel.SILENT);
    });

    it('should parse error level', async () => {
      process.env.TUNNELFORGE_LOG_LEVEL = 'error';
      const level = await getVerbosityFromEnv();
      expect(level).toBe(VerbosityLevel.ERROR);
    });

    it('should parse warn level', async () => {
      process.env.TUNNELFORGE_LOG_LEVEL = 'warn';
      const level = await getVerbosityFromEnv();
      expect(level).toBe(VerbosityLevel.WARN);
    });

    it('should parse info level', async () => {
      process.env.TUNNELFORGE_LOG_LEVEL = 'info';
      const level = await getVerbosityFromEnv();
      expect(level).toBe(VerbosityLevel.INFO);
    });

    it('should parse verbose level', async () => {
      process.env.TUNNELFORGE_LOG_LEVEL = 'verbose';
      const level = await getVerbosityFromEnv();
      expect(level).toBe(VerbosityLevel.VERBOSE);
    });

    it('should parse debug level', async () => {
      process.env.TUNNELFORGE_LOG_LEVEL = 'debug';
      const level = await getVerbosityFromEnv();
      expect(level).toBe(VerbosityLevel.DEBUG);
    });

    it('should be case-insensitive', async () => {
      process.env.TUNNELFORGE_LOG_LEVEL = 'DEBUG';
      const level = await getVerbosityFromEnv();
      expect(level).toBe(VerbosityLevel.DEBUG);

      process.env.TUNNELFORGE_LOG_LEVEL = 'WaRn';
      const level2 = await getVerbosityFromEnv();
      expect(level2).toBe(VerbosityLevel.WARN);
    });

    it('should return undefined for invalid values', async () => {
      process.env.TUNNELFORGE_LOG_LEVEL = 'invalid';
      const level = await getVerbosityFromEnv();
      expect(level).toBeUndefined();
    });
  });

  describe('TUNNELFORGE_DEBUG (backward compatibility)', () => {
    it('should enable debug mode with value 1', async () => {
      process.env.TUNNELFORGE_DEBUG = '1';
      const level = await getVerbosityFromEnv();
      expect(level).toBe(VerbosityLevel.DEBUG);
    });

    it('should enable debug mode with value true', async () => {
      process.env.TUNNELFORGE_DEBUG = 'true';
      const level = await getVerbosityFromEnv();
      expect(level).toBe(VerbosityLevel.DEBUG);
    });

    it('should not enable debug mode with other values', async () => {
      process.env.TUNNELFORGE_DEBUG = '0';
      const level = await getVerbosityFromEnv();
      expect(level).toBeUndefined();

      process.env.TUNNELFORGE_DEBUG = 'false';
      const level2 = await getVerbosityFromEnv();
      expect(level2).toBeUndefined();
    });

    it('should NOT override valid TUNNELFORGE_LOG_LEVEL when set', async () => {
      process.env.TUNNELFORGE_LOG_LEVEL = 'warn';
      process.env.TUNNELFORGE_DEBUG = '1';
      const level = await getVerbosityFromEnv();
      expect(level).toBe(VerbosityLevel.WARN); // TUNNELFORGE_LOG_LEVEL takes precedence
    });
  });
});
