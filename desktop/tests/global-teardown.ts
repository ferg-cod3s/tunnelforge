/**
 * Global teardown for TunnelForge Desktop E2E tests
 *
 * This file is run once after all tests complete.
 * It handles cleanup and resource deallocation.
 */

import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting TunnelForge Desktop E2E Test Teardown');

  // Clean up any remaining test processes
  // (Most cleanup should already be handled by individual tests)

  // Generate test summary
  const testResultsPath = path.join(process.cwd(), 'test-results');

  if (fs.existsSync(testResultsPath)) {
    try {
      const files = fs.readdirSync(testResultsPath);
      const screenshots = files.filter(f => f.endsWith('.png')).length;
      const videos = files.filter(f => f.endsWith('.webm')).length;
      const traces = files.filter(f => f.endsWith('.zip')).length;

      console.log('📊 Test artifacts generated:');
      console.log(`  - Screenshots: ${screenshots}`);
      console.log(`  - Videos: ${videos}`);
      console.log(`  - Traces: ${traces}`);

      if (screenshots + videos + traces > 0) {
        console.log(`📁 Test artifacts saved in: ${testResultsPath}`);
      }
    } catch (error) {
      console.warn('Could not analyze test results:', error);
    }
  }

  // Log completion
  console.log('✅ Global teardown completed successfully');
}

export default globalTeardown;
