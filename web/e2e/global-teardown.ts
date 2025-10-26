/**
 * Global teardown for Playwright tests
 * Runs once after all tests
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function globalTeardown() {
  console.log('🧹 Starting global test teardown...');

  // Only kill the server if we started it
  if (process.env.BACKEND_ALREADY_RUNNING !== 'true') {
    const pid = process.env.BACKEND_SERVER_PID;
    if (pid) {
      console.log(`🛑 Stopping Go backend server (PID: ${pid})...`);
      try {
        await execAsync(`kill ${pid}`);
        console.log('✅ Backend server stopped');
      } catch (error) {
        console.error('❌ Failed to stop backend server:', error);
      }
    }
  } else {
    console.log('ℹ️ Backend server was already running, leaving it running');
  }

  console.log('✅ Global test teardown completed');
}
