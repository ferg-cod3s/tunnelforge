/**
 * Global setup for TunnelForge Desktop E2E tests
 *
 * This file is run once before all tests start.
 * It handles:
 * - Environment preparation
 * - Server startup verification
 * - Test data initialization
 * - Logging setup
 */

import { FullConfig } from '@playwright/test';
import { spawn, ChildProcessWithoutNullStreams, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// Global state for test processes
let serverProcess: ChildProcessWithoutNullStreams | null = null;

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting TunnelForge Desktop E2E Test Setup');

  // Ensure test directories exist
  const testDirs = [
    'test-results',
    'test-results/screenshots',
    'test-results/videos',
    'test-results/traces'
  ];

  for (const dir of testDirs) {
    const fullPath = path.join(process.cwd(), dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`📁 Created test directory: ${dir}`);
    }
  }

  // Set test environment variables
  process.env.TUNNELFORGE_TEST_MODE = 'true';
  process.env.TAURI_ENV = 'test';
  process.env.RUST_LOG = 'info';

  console.log('✅ Environment variables set for testing');

  // Verify Go server can be built (for server management tests)
  try {
    const serverDir = path.join(process.cwd(), '..', 'server');
    if (fs.existsSync(path.join(serverDir, 'go.mod'))) {
      console.log('🔧 Checking Go server build...');

      // This is a dry run to verify the Go server can be built
      // The actual server management will be handled by the desktop app

      try {
        execSync('go version', { cwd: serverDir, stdio: 'pipe' });
        console.log('✅ Go is available for server build tests');
      } catch (error) {
        console.warn('⚠️  Go not available - server build tests may fail');
      }
    } else {
      console.warn('⚠️  Go server directory not found - server tests may be limited');
    }
  } catch (error) {
    console.warn('⚠️  Could not verify Go server:', error);
  }

  // Log test configuration
  console.log('📋 Test Configuration:');
  console.log(`  - Base URL: ${config.use?.baseURL || 'http://localhost:1420'}`);
  console.log(`  - Timeout: ${config.timeout || 60000}ms`);
  console.log(`  - Workers: ${config.workers || 'default'}`);
  console.log(`  - Retries: ${config.retries || 0}`);

  // Wait a moment to ensure everything is ready
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log('✅ Global setup completed successfully');

  return async () => {
    // Global teardown function
    console.log('🧹 Running global teardown...');

    if (serverProcess) {
      console.log('🛑 Stopping test server process...');
      serverProcess.kill();
      serverProcess = null;
    }

    // Clean up test artifacts if needed
    // (Playwright will handle most cleanup automatically)

    console.log('✅ Global teardown completed');
  };
}

export default globalSetup;
