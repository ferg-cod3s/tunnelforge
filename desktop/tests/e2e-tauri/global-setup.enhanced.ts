import { chromium, FullConfig, Browser, BrowserContext } from '@playwright/test';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { createTestDirectories, cleanupTestArtifacts, getPlatformInfo } from '../fixtures/tauri-fixtures.js';

const sleep = promisify(setTimeout);

/**
 * Enhanced global setup for Tauri desktop app testing
 * 
 * This setup provides comprehensive environment preparation:
 * - WSL/X11 virtual display initialization
 * - Tauri app startup and verification
 * - Remote debugging connection setup
 * - TunnelForge server health check
 * - Cross-platform compatibility handling
 * - Advanced debugging and logging
 */

interface EnhancedGlobalSetupContext {
  tauriProcess?: ChildProcessWithoutNullStreams;
  displayServer?: ChildProcessWithoutNullStreams;
  tunnelForgeServer?: ChildProcessWithoutNullStreams;
  browser?: Browser;
  context?: BrowserContext;
  debugPort: number;
  appUrl: string;
  serverPort: number;
  platformInfo: ReturnType<typeof getPlatformInfo>;
  startTime: number;
}

const context: EnhancedGlobalSetupContext = {
  debugPort: 9222,
  appUrl: 'http://localhost:1420',
  serverPort: 4021,
  platformInfo: getPlatformInfo(),
  startTime: Date.now(),
};

/**
 * Setup virtual display for WSL/CI environments
 */
async function setupVirtualDisplay(): Promise<void> {
  const { isWSL, isCI } = context.platformInfo;
  
  if (!isWSL && !isCI) {
    console.log('🖥️ Running on native display, skipping virtual display setup');
    return;
  }

  console.log('🖥️ Setting up enhanced virtual display for WSL/CI...');
  
  // Set display environment variable
  const display = process.env.DISPLAY || ':99';
  process.env.DISPLAY = display;
  
  // Kill any existing Xvfb processes
  try {
    const { exec } = require('child_process');
    await promisify(exec)(`pkill -f "Xvfb.*${display}" || true`);
    await sleep(1000);
  } catch (error) {
    // No existing processes to kill
  }

  // Start Xvfb with enhanced configuration
  const xvfbArgs = [
    display,
    '-screen', '0', '1280x800x24',
    '-ac', '-nolisten', 'tcp',
    '-extension', 'GLX',
    '+render', '-noreset',
    '-dpi', '96',
    '-extension', 'Composite',
    '-extension', 'DAMAGE',
    '-extension', 'MIT-SHM',
    '-shmem',
  ];

  // WSL2 specific optimizations
  if (context.platformInfo.isWSL2) {
    xvfbArgs.push('-extension', 'GLX', '-glx', '-noreset');
  }

  const xvfb = spawn('Xvfb', xvfbArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { 
      ...process.env, 
      DISPLAY: display,
      XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || '/tmp',
    },
  });

  context.displayServer = xvfb;
  
  // Handle Xvfb output
  xvfb.stdout?.on('data', (data) => {
    console.log(`🖥️ Xvfb: ${data.toString()}`);
  });

  xvfb.stderr?.on('data', (data) => {
    console.error(`❌ Xvfb Error: ${data.toString()}`);
  });

  xvfb.on('close', (code) => {
    console.log(`🖥️ Xvfb process exited with code ${code}`);
  });

  // Wait for X server to be ready
  await sleep(3000);
  
  // Verify X server is running
  try {
    const { exec } = require('child_process');
    await promisify(exec)(`DISPLAY=${display} xdpyinfo -display ${display}`);
    console.log('✅ Enhanced virtual display is ready');
  } catch (error) {
    console.error('❌ Failed to start virtual display:', error);
    throw new Error(`Virtual display setup failed: ${error.message}`);
  }
}

/**
 * Wait for Tauri app to be fully initialized
 */
async function waitForTauriApp(): Promise<void> {
  console.log('⏳ Waiting for Tauri app initialization...');
  
  const maxWaitTime = 90000; // 90 seconds
  const checkInterval = 2000; // 2 seconds
  let attempts = 0;
  const maxAttempts = maxWaitTime / checkInterval;
  
  while (attempts < maxAttempts) {
    try {
      // Check if Tauri dev server is responding
      const response = await fetch(context.appUrl, {
        method: 'GET',
        timeout: 10000,
        headers: {
          'User-Agent': 'TunnelForge-E2E-Setup/1.0.0',
        },
      });
      
      if (response.ok) {
        const content = await response.text();
        
        // Verify it's a Tauri app
        if (content.includes('__TAURI__') || 
            content.includes('TunnelForge') ||
            content.includes('tauri')) {
          console.log('✅ Tauri app is ready');
          
          // Additional verification for remote debugging
          await verifyRemoteDebugging();
          return;
        }
      }
    } catch (error) {
      // App not ready yet
    }
    
    attempts++;
    await sleep(checkInterval);
    
    if (attempts % 5 === 0) {
      console.log(`⏳ Still waiting for Tauri app... (${attempts}/${maxAttempts})`);
    }
  }
  
  throw new Error(`Tauri app failed to start within ${maxWaitTime}ms`);
}

/**
 * Verify remote debugging connection
 */
async function verifyRemoteDebugging(): Promise<void> {
  console.log('🔧 Verifying remote debugging connection...');
  
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
        
        // Test WebSocket connection
        const wsResponse = await fetch(`http://localhost:${context.debugPort}/json`, {
          timeout: 5000,
        });
        
        if (wsResponse.ok) {
          const wsData = await wsResponse.json();
          if (wsData.length > 0) {
            console.log(`✅ WebSocket debugging endpoint available`);
            return;
          }
        }
      }
    } catch (error) {
      // Debug endpoint not ready yet
    }
    
    attempts++;
    await sleep(checkInterval);
  }
  
  console.warn('⚠️ Remote debugging not available, will use direct browser connection');
}

/**
 * Check TunnelForge server health
 */
async function checkTunnelForgeServer(): Promise<void> {
  console.log('🔧 Checking TunnelForge server health...');
  
  try {
    const response = await fetch(`http://localhost:${context.serverPort}/health`, {
      method: 'GET',
      timeout: 5000,
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ TunnelForge server is healthy: ${JSON.stringify(data)}`);
    } else {
      console.warn('⚠️ TunnelForge server responded with error:', response.status);
    }
  } catch (error) {
    console.warn('⚠️ TunnelForge server not available:', error.message);
    console.log('ℹ️ Tests will continue but server-dependent tests may fail');
  }
}

/**
 * Setup browser for debugging
 */
async function setupDebugBrowser(): Promise<void> {
  if (context.platformInfo.isDebug) {
    console.log('🔧 Setting up debug browser...');
    
    try {
      context.browser = await chromium.launch({
        headless: false,
        args: [
          `--remote-debugging-port=${context.debugPort + 1}`,
          '--auto-open-devtools-for-tabs',
        ],
      });
      
      context.context = await context.browser.newContext();
      console.log('✅ Debug browser ready');
    } catch (error) {
      console.warn('⚠️ Failed to setup debug browser:', error.message);
    }
  }
}

/**
 * Create comprehensive test directories
 */
async function setupTestEnvironment(): Promise<void> {
  console.log('📁 Setting up test environment...');
  
  // Create test directories
  await createTestDirectories();
  
  // Clean up previous artifacts
  await cleanupTestArtifacts();
  
  // Create test data directory
  const testDataDir = path.join(process.cwd(), 'test-data');
  try {
    await fs.mkdir(testDataDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
  
  // Create test configuration file
  const testConfig = {
    platform: context.platformInfo,
    debugPort: context.debugPort,
    appUrl: context.appUrl,
    serverPort: context.serverPort,
    startTime: context.startTime,
    testEnv: {
      NODE_ENV: process.env.NODE_ENV,
      DISPLAY: process.env.DISPLAY,
      TUNNELFORGE_TEST_MODE: process.env.TUNNELFORGE_TEST_MODE,
    },
  };
  
  await fs.writeFile(
    path.join(testDataDir, 'test-config.json'),
    JSON.stringify(testConfig, null, 2)
  );
  
  console.log('✅ Test environment ready');
}

/**
 * Log system information for debugging
 */
async function logSystemInfo(): Promise<void> {
  console.log('📊 System Information:');
  console.log(`   Platform: ${context.platformInfo.platform}`);
  console.log(`   Architecture: ${context.platformInfo.arch}`);
  console.log(`   WSL: ${context.platformInfo.isWSL}`);
  console.log(`   WSL2: ${context.platformInfo.isWSL2}`);
  console.log(`   CI: ${context.platformInfo.isCI}`);
  console.log(`   Headless: ${context.platformInfo.isHeadless}`);
  console.log(`   Debug: ${context.platformInfo.isDebug}`);
  console.log(`   Display: ${process.env.DISPLAY || 'default'}`);
  console.log(`   Debug Port: ${context.debugPort}`);
  console.log(`   App URL: ${context.appUrl}`);
  console.log(`   Server Port: ${context.serverPort}`);
  
  // Log environment variables
  const testEnvVars = [
    'NODE_ENV',
    'DISPLAY',
    'XDG_RUNTIME_DIR',
    'TUNNELFORGE_TEST_MODE',
    'TAURI_DEBUG',
    'RUST_LOG',
  ];
  
  console.log('🔧 Environment Variables:');
  testEnvVars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      console.log(`   ${varName}: ${value}`);
    }
  });
}

/**
 * Main global setup function
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  console.log('🚀 Starting enhanced Tauri desktop app test setup...');
  
  const setupStartTime = Date.now();
  
  try {
    // Log system information
    await logSystemInfo();
    
    // Setup test environment
    await setupTestEnvironment();
    
    // Setup virtual display for WSL/CI
    await setupVirtualDisplay();
    
    // Setup debug browser if needed
    await setupDebugBrowser();
    
    // Wait for Tauri app to be ready (webServer should handle this)
    await waitForTauriApp();
    
    // Check TunnelForge server
    await checkTunnelForgeServer();
    
    // Store context for global teardown
    (global as any).__TAURI_TEST_CONTEXT__ = context;
    
    const setupDuration = Date.now() - setupStartTime;
    console.log(`✅ Enhanced Tauri test setup completed in ${setupDuration}ms`);
    
  } catch (error) {
    console.error('❌ Enhanced Tauri test setup failed:', error);
    
    // Cleanup on failure
    await globalTeardown(config);
    
    throw error;
  }
}

/**
 * Get test context
 */
export function getTestContext(): EnhancedGlobalSetupContext {
  return (global as any).__TAURI_TEST_CONTEXT__ || context;
}

/**
 * Cleanup function for manual cleanup
 */
export async function cleanup(): Promise<void> {
  console.log('🧹 Manual cleanup...');
  
  // Cleanup display server
  if (context.displayServer && !context.displayServer.killed) {
    context.displayServer.kill('SIGTERM');
    await sleep(2000);
    if (!context.displayServer.killed) {
      context.displayServer.kill('SIGKILL');
    }
  }
  
  // Cleanup browser
  if (context.browser) {
    await context.browser.close();
  }
  
  console.log('✅ Manual cleanup completed');
}