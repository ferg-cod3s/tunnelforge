import { chromium, FullConfig } from '@playwright/test';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const sleep = promisify(setTimeout);

/**
 * Global setup for Tauri desktop app testing
 * 
 * This setup handles:
 * - Virtual display initialization for WSL/CI
 * - Tauri app startup verification
 * - Remote debugging connection setup
 * - Test environment preparation
 */

interface GlobalSetupContext {
  tauriProcess?: ChildProcessWithoutNullStreams;
  displayServer?: ChildProcessWithoutNullStreams;
  debugPort: number;
  appUrl: string;
}

const context: GlobalSetupContext = {
  debugPort: 9222,
  appUrl: 'http://localhost:1420',
};

async function setupVirtualDisplay(): Promise<void> {
  const isWSL = process.platform === 'linux' && process.env.WSL_DISTRO_NAME;
  const isCI = !!process.env.CI;
  
  if (!isWSL && !isCI) {
    console.log('🖥️ Running on native display, skipping virtual display setup');
    return;
  }

  console.log('🖥️ Setting up virtual display for WSL/CI...');
  
  // Set display environment variable
  process.env.DISPLAY = process.env.DISPLAY || ':99';
  
  // Start Xvfb for virtual display
  const xvfb = spawn('Xvfb', [
    process.env.DISPLAY,
    '-screen', '0', '1280x800x24',
    '-ac', '-nolisten', 'tcp',
    '-extension', 'GLX',
    '+render', '-noreset'
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, DISPLAY: process.env.DISPLAY }
  });

  context.displayServer = xvfb;
  
  // Wait for X server to be ready
  await sleep(3000);
  
  // Verify X server is running
  try {
    const { exec } = require('child_process');
    await promisify(exec)(`xdpyinfo -display ${process.env.DISPLAY}`);
    console.log('✅ Virtual display is ready');
  } catch (error) {
    console.error('❌ Failed to start virtual display:', error);
    throw error;
  }
}

async function waitForTauriApp(): Promise<void> {
  console.log('⏳ Waiting for Tauri app to initialize...');
  
  const maxWaitTime = 60000; // 60 seconds
  const checkInterval = 1000; // 1 second
  let attempts = 0;
  const maxAttempts = maxWaitTime / checkInterval;
  
  while (attempts < maxAttempts) {
    try {
      // Check if Tauri dev server is responding
      const response = await fetch(context.appUrl, {
        method: 'GET',
        timeout: 5000,
      });
      
      if (response.ok) {
        console.log('✅ Tauri app is ready');
        return;
      }
    } catch (error) {
      // App not ready yet, continue waiting
    }
    
    attempts++;
    await sleep(checkInterval);
    
    if (attempts % 10 === 0) {
      console.log(`⏳ Still waiting for Tauri app... (${attempts}/${maxAttempts})`);
    }
  }
  
  throw new Error(`Tauri app failed to start within ${maxWaitTime}ms`);
}

async function setupRemoteDebugging(): Promise<void> {
  console.log('🔧 Setting up remote debugging connection...');
  
  // Wait for Chrome remote debugging to be available
  const maxWaitTime = 30000; // 30 seconds
  const checkInterval = 1000; // 1 second
  let attempts = 0;
  const maxAttempts = maxWaitTime / checkInterval;
  
  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`http://localhost:${context.debugPort}/json/version`, {
        timeout: 5000,
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Remote debugging ready: ${data['Browser']} ${data['Version']}`);
        return;
      }
    } catch (error) {
      // Debug endpoint not ready yet
    }
    
    attempts++;
    await sleep(checkInterval);
  }
  
  console.warn('⚠️ Remote debugging not available, falling back to direct browser connection');
}

async function createTestDirectories(): Promise<void> {
  const testDirs = [
    'test-results/tauri-output',
    'test-results/tauri-screenshots',
    'test-results/tauri-videos',
    'test-results/tauri-traces',
  ];
  
  for (const dir of testDirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }
}

async function cleanupTestEnvironment(): Promise<void> {
  console.log('🧹 Cleaning up test environment...');
  
  // Clean up any previous test artifacts
  const cleanupFiles = [
    '/tmp/tauri-*.json',
    '/tmp/tunnelforge-*.log',
    '/tmp/playwright-*.log',
  ];
  
  for (const pattern of cleanupFiles) {
    try {
      const { exec } = require('child_process');
      await promisify(exec)(`rm -f ${pattern}`);
    } catch (error) {
      // Files might not exist
    }
  }
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  console.log('🚀 Starting Tauri desktop app test setup...');
  
  try {
    // Create test directories
    await createTestDirectories();
    
    // Clean up previous test environment
    await cleanupTestEnvironment();
    
    // Setup virtual display for WSL/CI
    await setupVirtualDisplay();
    
    // Wait for Tauri app to be ready (webServer should handle this)
    await waitForTauriApp();
    
    // Setup remote debugging connection
    await setupRemoteDebugging();
    
    // Store context for global teardown
    (global as any).__TAURI_TEST_CONTEXT__ = context;
    
    console.log('✅ Tauri test setup completed successfully');
    
  } catch (error) {
    console.error('❌ Tauri test setup failed:', error);
    
    // Cleanup on failure
    await globalTeardown(config);
    
    throw error;
  }
}

// Helper function to get test context
export function getTestContext(): GlobalSetupContext {
  return (global as any).__TAURI_TEST_CONTEXT__ || context;
}