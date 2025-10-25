import { execSync, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const sleep = promisify(setTimeout);

/**
 * WSL-specific helpers for Tauri desktop testing
 * 
 * These helpers provide functionality for:
 * - X11 display management in WSL
 * - WSL2 network configuration
 * - Windows integration from WSL
 * - Graphics acceleration workarounds
 * - WSL-specific debugging
 */

export interface WSLConfig {
  display: string;
  resolution: string;
  x11Running: boolean;
  wslVersion: 1 | 2;
  windowsHost: string;
  hasGuiSupport: boolean;
}

export interface X11Config {
  display: string;
  width: number;
  height: number;
  depth: number;
  xvfbArgs: string[];
}

/**
 * Detect WSL environment and configuration
 */
export async function detectWSLEnvironment(): Promise<WSLConfig> {
  const config: WSLConfig = {
    display: process.env.DISPLAY || ':99',
    resolution: '1280x800',
    x11Running: false,
    wslVersion: 1,
    windowsHost: '',
    hasGuiSupport: false,
  };

  try {
    // Detect WSL version
    try {
      const wslInfo = execSync('cat /proc/version', { encoding: 'utf8' });
      config.wslVersion = wslInfo.includes('WSL2') ? 2 : 1;
    } catch {
      config.wslVersion = 1;
    }

    // Get Windows host IP (for WSL2)
    if (config.wslVersion === 2) {
      try {
        const routeInfo = execSync('ip route show default', { encoding: 'utf8' });
        const match = routeInfo.match(/default via (\d+\.\d+\.\d+\.\d+)/);
        if (match) {
          config.windowsHost = match[1];
        }
      } catch {
        // Fallback to common WSL2 gateway
        config.windowsHost = '172.20.112.1';
      }
    }

    // Check if X11 is running
    try {
      execSync(`xdpyinfo -display ${config.display}`, { 
        stdio: 'pipe',
        timeout: 2000 
      });
      config.x11Running = true;
    } catch {
      config.x11Running = false;
    }

    // Check GUI support
    try {
      execSync('which Xvfb', { stdio: 'pipe' });
      config.hasGuiSupport = true;
    } catch {
      config.hasGuiSupport = false;
    }

    console.log('🔍 WSL Environment detected:', config);
    return config;

  } catch (error) {
    console.warn('⚠️ Error detecting WSL environment:', error);
    return config;
  }
}

/**
 * Setup X11 display for WSL
 */
export async function setupX11Display(config: WSLConfig): Promise<X11Config> {
  console.log('🖥️ Setting up X11 display for WSL...');

  const x11Config: X11Config = {
    display: config.display,
    width: 1280,
    height: 800,
    depth: 24,
    xvfbArgs: [
      '-screen', '0', '1280x800x24',
      '-ac', '-nolisten', 'tcp',
      '-extension', 'GLX',
      '+render', '-noreset',
      '-dpi', '96'
    ],
  };

  try {
    // Kill any existing Xvfb process
    try {
      execSync(`pkill -f "Xvfb ${config.display}"`, { stdio: 'pipe' });
      await sleep(1000);
    } catch {
      // No existing process
    }

    // Start Xvfb
    const xvfbProcess = spawn('Xvfb', [
      config.display,
      ...x11Config.xvfbArgs
    ], {
      stdio: 'pipe',
      detached: true,
    });

    // Store PID for cleanup
    process.env.XVFB_PID = xvfbProcess.pid.toString();

    // Wait for Xvfb to start
    await sleep(3000);

    // Verify display is working
    execSync(`DISPLAY=${config.display} xdpyinfo -display ${config.display}`, { 
      stdio: 'pipe',
      timeout: 5000 
    });

    console.log(`✅ X11 display ${config.display} is ready`);
    return x11Config;

  } catch (error) {
    console.warn('⚠️ Failed to setup X11 display:', error);
    throw new Error(`X11 display setup failed: ${error.message}`);
  }
}

/**
 * Setup WSL2 networking for Tauri debugging
 */
export async function setupWSL2Networking(config: WSLConfig): Promise<void> {
  if (config.wslVersion !== 2) {
    console.log('ℹ️ Skipping WSL2 networking setup (not WSL2)');
    return;
  }

  console.log('🌐 Setting up WSL2 networking...');

  try {
    // Setup port forwarding for Tauri debugging
    const ports = [1420, 4021, 9222]; // Tauri dev, TunnelForge, Debug
    
    for (const port of ports) {
      try {
        // This would need to be run from Windows PowerShell
        // For now, we'll just log what needs to be done
        console.log(`📝 Port forwarding needed: netsh interface portproxy add v4tov4 listenport=${port} listenaddress=0.0.0.0 connectport=${port} connectaddress=${config.windowsHost}`);
      } catch (error) {
        console.warn(`⚠️ Could not setup port forwarding for ${port}:`, error);
      }
    }

    // Check if ports are accessible
    for (const port of ports) {
      try {
        const response = await fetch(`http://localhost:${port}`, {
          method: 'HEAD',
          timeout: 1000,
        });
        console.log(`✅ Port ${port} is accessible`);
      } catch {
        console.log(`⏳ Port ${port} not yet accessible`);
      }
    }

  } catch (error) {
    console.warn('⚠️ WSL2 networking setup failed:', error);
  }
}

/**
 * Setup Windows integration from WSL
 */
export async function setupWindowsIntegration(config: WSLConfig): Promise<void> {
  console.log('🪟 Setting up Windows integration...');

  try {
    // Check if Windows paths are accessible
    try {
      execSync('ls /mnt/c/Windows', { stdio: 'pipe' });
      console.log('✅ Windows filesystem accessible');
    } catch {
      console.warn('⚠️ Windows filesystem not accessible');
    }

    // Check for Windows browsers
    const windowsBrowsers = [
      '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe',
      '/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      '/mnt/c/Program Files/Microsoft/Edge/Application/msedge.exe',
      '/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    ];

    let foundBrowser = '';
    for (const browser of windowsBrowsers) {
      try {
        await fs.access(browser);
        foundBrowser = browser;
        break;
      } catch {
        // Browser not found
      }
    }

    if (foundBrowser) {
      console.log(`✅ Windows browser found: ${foundBrowser}`);
      process.env.WINDOWS_BROWSER = foundBrowser;
    } else {
      console.warn('⚠️ No Windows browsers found');
    }

  } catch (error) {
    console.warn('⚠️ Windows integration setup failed:', error);
  }
}

/**
 * Apply WSL-specific graphics workarounds
 */
export function applyWSLGraphicsWorkarounds(): string[] {
  console.log('🎨 Applying WSL graphics workarounds...');

  const workarounds = [
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-accelerated-2d-canvas',
    '--disable-accelerated-jpeg-decoding',
    '--disable-accelerated-mjpeg-decode',
    '--disable-accelerated-video-decode',
    '--disable-gpu-compositing',
    '--disable-gpu-sandbox',
    '--disable-webgl',
    '--disable-webgl2',
    '--disable-3d-apis',
    '--disable-canvas-aa',
    '--disable-webrtc',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--disable-ipc-flooding-protection',
  ];

  console.log(`✅ Applied ${workarounds.length} graphics workarounds`);
  return workarounds;
}

/**
 * Setup WSL-specific environment variables
 */
export function setupWSLEnvironment(config: WSLConfig): Record<string, string> {
  console.log('🔧 Setting up WSL environment variables...');

  const envVars: Record<string, string> = {
    // Display configuration
    DISPLAY: config.display,
    XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || '/tmp',
    XVFB_SCREEN: '0 1280x800x24',
    
    // Graphics configuration
    LIBGL_ALWAYS_SOFTWARE: '1',
    MESA_GL_VERSION_OVERRIDE: '4.5',
    
    // Audio (if needed)
    PULSE_SERVER: config.wslVersion === 2 ? config.windowsHost : '/tmp/pulse-socket',
    
    // WSL specific
    WSLENV: 'DISPLAY:XDG_RUNTIME_DIR:PULSE_SERVER',
    
    // Testing specific
    TUNNELFORGE_WSL_MODE: 'true',
    TUNNELFORGE_WSL_VERSION: config.wslVersion.toString(),
    TUNNELFORGE_WINDOWS_HOST: config.windowsHost,
  };

  // Apply environment variables
  Object.assign(process.env, envVars);

  console.log('✅ WSL environment variables set up');
  return envVars;
}

/**
 * Cleanup WSL-specific resources
 */
export async function cleanupWSLResources(): Promise<void> {
  console.log('🧹 Cleaning up WSL resources...');

  try {
    // Kill Xvfb if we started it
    if (process.env.XVFB_PID) {
      try {
        process.kill(parseInt(process.env.XVFB_PID), 'SIGTERM');
        await sleep(1000);
        console.log('✅ Xvfb process terminated');
      } catch (error) {
        console.warn('⚠️ Failed to terminate Xvfb:', error);
      }
    }

    // Clean up any remaining X11 processes
    try {
      execSync('pkill -f "Xvfb"', { stdio: 'pipe' });
    } catch {
      // No processes to kill
    }

    // Clean up temporary files
    const tempPatterns = [
      '/tmp/.X11-unix/X99',
      '/tmp/.X99-lock',
      '/tmp/xvfb-run.*',
    ];

    for (const pattern of tempPatterns) {
      try {
        execSync(`rm -f ${pattern}`, { stdio: 'pipe' });
      } catch {
        // No files to clean
      }
    }

    console.log('✅ WSL resources cleaned up');

  } catch (error) {
    console.warn('⚠️ Error during WSL cleanup:', error);
  }
}

/**
 * Validate WSL setup before running tests
 */
export async function validateWSLSetup(): Promise<boolean> {
  console.log('✅ Validating WSL setup...');

  try {
    // Check basic requirements
    const requirements = [
      { cmd: 'Xvfb', name: 'Xvfb (virtual display)' },
      { cmd: 'xdpyinfo', name: 'X11 utilities' },
      { cmd: 'bun', name: 'Bun runtime' },
      { cmd: 'cargo', name: 'Rust/Cargo' },
    ];

    for (const { cmd, name } of requirements) {
      try {
        execSync(`which ${cmd}`, { stdio: 'pipe' });
        console.log(`✅ ${name} is available`);
      } catch {
        console.error(`❌ ${name} is missing`);
        return false;
      }
    }

    // Check display
    const display = process.env.DISPLAY || ':99';
    try {
      execSync(`xdpyinfo -display ${display}`, { 
        stdio: 'pipe',
        timeout: 2000 
      });
      console.log(`✅ Display ${display} is working`);
    } catch {
      console.error(`❌ Display ${display} is not working`);
      return false;
    }

    // Check network connectivity
    try {
      await fetch('http://localhost:1420', {
        method: 'HEAD',
        timeout: 1000,
      });
      console.log('✅ Network connectivity is working');
    } catch {
      console.log('⏳ Network connectivity not yet available (this may be normal)');
    }

    console.log('✅ WSL setup validation passed');
    return true;

  } catch (error) {
    console.error('❌ WSL setup validation failed:', error);
    return false;
  }
}

/**
 * Get WSL debugging information
 */
export async function getWSLDebugInfo(): Promise<Record<string, any>> {
  const debugInfo: Record<string, any> = {};

  try {
    // System information
    debugInfo.system = {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      wslVersion: execSync('cat /proc/version', { encoding: 'utf8' }).trim(),
      kernel: execSync('uname -r', { encoding: 'utf8' }).trim(),
    };

    // Display information
    debugInfo.display = {
      DISPLAY: process.env.DISPLAY,
      x11Running: false,
    };

    try {
      const displayInfo = execSync(`xdpyinfo -display ${process.env.DISPLAY || ':99'}`, { 
        encoding: 'utf8' 
      });
      debugInfo.display.x11Running = true;
      debugInfo.display.info = displayInfo;
    } catch {
      debugInfo.display.x11Running = false;
    }

    // Network information
    debugInfo.network = {
      interfaces: execSync('ip addr show', { encoding: 'utf8' }),
      routes: execSync('ip route show', { encoding: 'utf8' }),
    };

    // Process information
    debugInfo.processes = {
      xvfb: execSync('ps aux | grep Xvfb', { encoding: 'utf8' }),
      tauri: execSync('ps aux | grep tauri', { encoding: 'utf8' }),
    };

    // Environment variables
    debugInfo.environment = {
      DISPLAY: process.env.DISPLAY,
      XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR,
      PULSE_SERVER: process.env.PULSE_SERVER,
      LIBGL_ALWAYS_SOFTWARE: process.env.LIBGL_ALWAYS_SOFTWARE,
    };

  } catch (error) {
    debugInfo.error = error.message;
  }

  return debugInfo;
}