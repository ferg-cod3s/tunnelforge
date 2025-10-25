import { chromium, FullConfig } from '@playwright/test';
import { execSync, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const sleep = promisify(setTimeout);

/**
 * Global setup for Tauri desktop E2E tests
 * 
 * This setup handles:
 * - WSL/X11 virtual display initialization
 * - Tauri app startup verification
 * - Remote debugging port setup
 * - Environment validation
 * - Test dependencies verification
 */

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Tauri E2E test global setup...');
  
  const isWSL = process.platform === 'linux' && process.env.WSL_DISTRO_NAME;
  const isCI = !!process.env.CI;
  const isHeadless = process.env.HEADED !== 'true';
  
  try {
    // 1. Setup virtual display for WSL/CI
    if (isWSL || isCI) {
      await setupVirtualDisplay();
    }
    
    // 2. Verify Tauri dependencies
    await verifyTauriDependencies();
    
    // 3. Setup test environment
    await setupTestEnvironment();
    
    // 4. Wait for Tauri app to be ready
    await waitForTauriApp();
    
    // 5. Verify remote debugging connection
    if (!isHeadless) {
      await verifyRemoteDebugging();
    }
    
    console.log('✅ Tauri E2E test global setup completed successfully');
    
    // Store global state for tests
    process.env.TAURI_SETUP_COMPLETE = 'true';
    process.env.TAURI_SETUP_TIME = new Date().toISOString();
    
  } catch (error) {
    console.error('❌ Tauri E2E test global setup failed:', error);
    throw error;
  }
}

/**
 * Setup virtual display for WSL/CI environments
 */
async function setupVirtualDisplay() {
  console.log('🖥️ Setting up virtual display...');
  
  const display = process.env.DISPLAY || ':99';
  
  try {
    // Check if Xvfb is available
    execSync('which Xvfb', { stdio: 'pipe' });
    
    // Kill any existing Xvfb process on this display
    try {
      execSync(`pkill -f "Xvfb ${display}"`, { stdio: 'pipe' });
      await sleep(1000);
    } catch {
      // No existing process, that's fine
    }
    
    // Start Xvfb
    const xvfbProcess = spawn('Xvfb', [
      display,
      '-screen', '0', '1280x800x24',
      '-ac', '-nolisten', 'tcp',
      '-extension', 'GLX',
      '+render', '-noreset',
      '-dpi', '96'
    ], {
      stdio: isCI ? 'pipe' : 'inherit',
      detached: true,
    });
    
    // Store Xvfb PID for cleanup
    process.env.XVFB_PID = xvfbProcess.pid.toString();
    
    // Wait for Xvfb to start
    await sleep(2000);
    
    // Verify display is working
    execSync(`DISPLAY=${display} xdpyinfo -display ${display}`, { 
      stdio: 'pipe',
      timeout: 5000 
    });
    
    console.log(`✅ Virtual display ${display} is ready`);
    
  } catch (error) {
    console.warn('⚠️ Virtual display setup failed, continuing without it:', error.message);
  }
}

/**
 * Verify Tauri dependencies are installed
 */
async function verifyTauriDependencies() {
  console.log('🔍 Verifying Tauri dependencies...');
  
  const requiredCommands = [
    { cmd: 'cargo', name: 'Rust/Cargo' },
    { cmd: 'bun', name: 'Bun runtime' },
    { cmd: 'tauri', name: 'Tauri CLI' },
  ];
  
  for (const { cmd, name } of requiredCommands) {
    try {
      const version = execSync(`${cmd} --version`, { encoding: 'utf8' }).trim();
      console.log(`✅ ${name}: ${version}`);
    } catch (error) {
      throw new Error(`❌ ${name} not found: ${error.message}`);
    }
  }
  
  // Verify Tauri project structure
  const tauriConfigPath = path.join(process.cwd(), 'src-tauri', 'tauri.conf.json');
  try {
    await fs.access(tauriConfigPath);
    console.log('✅ Tauri configuration found');
  } catch (error) {
    throw new Error('❌ Tauri configuration not found');
  }
}

/**
 * Setup test environment and directories
 */
async function setupTestEnvironment() {
  console.log('📁 Setting up test environment...');
  
  const testDirs = [
    'test-results/tauri-output',
    'test-results/tauri-screenshots',
    'test-results/tauri-videos',
    'test-results/tauri-traces',
  ];
  
  for (const dir of testDirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    } catch (error) {
      // Directory might already exist
    }
  }
  
  // Create test fixtures if they don't exist
  const fixturesDir = 'tests/e2e-desktop/fixtures';
  try {
    await fs.mkdir(fixturesDir, { recursive: true });
    
    // Create test data files
    const testConfig = {
      testMode: true,
      mockData: true,
      testPorts: {
        tauri: 1420,
        tunnelForge: 4021,
        debugging: 9222,
      },
      timeouts: {
        startup: 60000,
        action: 25000,
        navigation: 45000,
      },
    };
    
    await fs.writeFile(
      path.join(fixturesDir, 'test-config.json'),
      JSON.stringify(testConfig, null, 2)
    );
    
  } catch (error) {
    console.warn('⚠️ Failed to create test fixtures:', error.message);
  }
}

/**
 * Wait for Tauri app to be ready
 */
async function waitForTauriApp() {
  console.log('⏳ Waiting for Tauri app to be ready...');
  
  const maxWaitTime = 120000; // 2 minutes
  const checkInterval = 2000; // 2 seconds
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      // Check if Tauri dev server is responding
      const response = await fetch('http://localhost:1420', {
        method: 'GET',
        timeout: 5000,
      });
      
      if (response.ok) {
        const content = await response.text();
        
        // Check if it's actually a Tauri app
        if (content.includes('__TAURI__') || 
            content.includes('TunnelForge') ||
            content.includes('tauri')) {
          console.log('✅ Tauri app is ready');
          return;
        }
      }
    } catch (error) {
      // Server not ready yet, continue waiting
    }
    
    console.log(`⏳ Still waiting for Tauri app... (${Math.floor((Date.now() - startTime) / 1000)}s)`);
    await sleep(checkInterval);
  }
  
  throw new Error('❌ Tauri app failed to start within timeout period');
}

/**
 * Verify remote debugging connection
 */
async function verifyRemoteDebugging() {
  console.log('🔍 Verifying remote debugging connection...');
  
  const debugPort = 9222;
  const maxWaitTime = 30000; // 30 seconds
  const checkInterval = 1000; // 1 second
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    try {
      const response = await fetch(`http://localhost:${debugPort}/json/version`, {
        method: 'GET',
        timeout: 2000,
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Remote debugging is available:', data.Browser);
        return;
      }
    } catch (error) {
      // Debug endpoint not ready yet
    }
    
    await sleep(checkInterval);
  }
  
  console.warn('⚠️ Remote debugging not available, continuing without it');
}

/**
 * Cleanup function for global setup
 */
async function cleanup() {
  console.log('🧹 Cleaning up global setup...');
  
  // Kill Xvfb if we started it
  if (process.env.XVFB_PID) {
    try {
      process.kill(parseInt(process.env.XVFB_PID), 'SIGTERM');
      console.log('✅ Xvfb process terminated');
    } catch (error) {
      console.warn('⚠️ Failed to terminate Xvfb:', error.message);
    }
  }
  
  // Clean up any other processes
  try {
    execSync('pkill -f "tauri dev"', { stdio: 'pipe' });
    await sleep(1000);
  } catch {
    // No processes to kill
  }
}

// Handle cleanup on exit
process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

export default globalSetup;