import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Enhanced Playwright configuration for TunnelForge Tauri Desktop App E2E tests
 * 
 * This configuration provides comprehensive Tauri integration with:
 * - WSL/X11 virtual display support
 * - Tauri dev server integration on port 1420
 * - Remote debugging for WebView testing
 * - Cross-platform compatibility (Windows/Linux/macOS)
 * - TunnelForge-specific port 4021 handling
 * - Advanced debugging and tracing capabilities
 * 
 * Testing Strategy:
 * - Primary: Connect to Tauri WebView via remote debugging (port 9222)
 * - Fallback: Direct browser connection to dev server (port 1420)
 * - Integration: Test TunnelForge backend on port 4021
 * - Desktop: Validate native desktop features (tray, notifications, etc.)
 * 
 * Environment Support:
 * - WSL2 with X11 forwarding
 * - Linux CI/CD with virtual displays
 * - Windows native testing
 * - macOS testing
 * 
 * @see https://playwright.dev/docs/test-configuration
 * @see https://tauri.app/v1/guides/testing/webdriver
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Environment detection
const isWSL = process.platform === 'linux' && process.env.WSL_DISTRO_NAME;
const isWSL2 = isWSL && process.env.WSL_INTEROP; // WSL2 detection
const isCI = !!process.env.CI;
const isHeadless = process.env.HEADED !== 'true';
const isDebug = process.env.DEBUG === 'true';

// TunnelForge and Tauri configuration
const TAURI_DEV_PORT = 1420; // Tauri dev server port
const TAURI_DEBUG_PORT = 9222; // Chrome remote debugging port for WebView
const TUNNELFORGE_SERVER_PORT = 4021; // TunnelForge backend port
const TAURI_APP_URL = `http://localhost:${TAURI_DEV_PORT}`;
const TUNNELFORGE_API_URL = `http://localhost:${TUNNELFORGE_SERVER_PORT}`;

// Virtual display configuration for WSL/CI
const VIRTUAL_DISPLAY = isWSL || isCI ? {
  display: process.env.DISPLAY || ':99',
  width: parseInt(process.env.VIRTUAL_DISPLAY_WIDTH || '1280'),
  height: parseInt(process.env.VIRTUAL_DISPLAY_HEIGHT || '800'),
  depth: 24,
  xvfbArgs: [
    '-screen', '0', `${process.env.VIRTUAL_DISPLAY_WIDTH || '1280'}x${process.env.VIRTUAL_DISPLAY_HEIGHT || '800'}x24`,
    '-ac', '-nolisten', 'tcp',
    '-extension', 'GLX',
    '+render', '-noreset',
    '-dpi', '96'
  ],
} : null;

// Browser launch arguments for Tauri WebView testing
const getTauriBrowserArgs = () => {
  const baseArgs = [
    // Remote debugging configuration
    `--remote-debugging-port=${TAURI_DEBUG_PORT}`,
    `--remote-allow-origins=http://localhost:${TAURI_DEV_PORT}`,
    
    // Security and compatibility
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process,VizDisplayCompositor',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-extensions',
    '--disable-plugins',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--disable-ipc-flooding-protection',
    
    // WebView specific
    '--disable-webgl',
    '--disable-webrtc',
    '--disable-canvas-aa',
    '--disable-3d-apis',
    
    // Performance
    '--max_old_space_size=4096',
    '--memory-pressure-off',
    
    // Testing specific
    '--disable-default-apps',
    '--disable-sync',
    '--no-first-run',
    '--disable-background-networking',
  ];

  // WSL/Linux specific optimizations
  if (isWSL || isCI) {
    baseArgs.push(
      '--disable-gpu',
      '--disable-software-rasterizer',
      '--disable-accelerated-2d-canvas',
      '--disable-accelerated-jpeg-decoding',
      '--disable-accelerated-mjpeg-decode',
      '--disable-accelerated-video-decode',
      '--disable-gpu-compositing',
      '--disable-gpu-sandbox'
    );
  }

  // Development specific
  if (!isHeadless && isDebug) {
    baseArgs.push(
      '--auto-open-devtools-for-tabs',
      '--enable-logging',
      '--v=1'
    );
  }

  return baseArgs;
};

export default defineConfig({
  testDir: './tests/e2e-tauri',
  
  // Test execution configuration
  fullyParallel: false, // Disable parallel for desktop app stability
  forbidOnly: isCI,
  retries: isCI ? 3 : 1, // More retries for CI environment
  workers: 1, // Always use 1 worker for desktop app testing
  
  // Comprehensive reporting
  reporter: [
    ['html', { 
      outputFolder: 'test-results/tauri-html-report',
      open: isHeadless ? 'never' : 'on-failure',
      host: '0.0.0.0', // Allow access from WSL
      port: 9323, // Different port to avoid conflicts
    }],
    ['json', { outputFile: 'test-results/tauri-results.json' }],
    ['junit', { outputFile: 'test-results/tauri-junit.xml' }],
    ['line'], // Console output
    ['github'], // GitHub Actions annotations
    ['html', { 
      outputFolder: 'test-results/tauri-html-report-inline',
      open: 'never',
      inline: true 
    }],
  ],
  
  // Global test configuration
  use: {
    // Base URLs
    baseURL: TAURI_APP_URL,
    
    // Timeouts - increased for desktop operations
    expect: {
      timeout: 20000, // 20 seconds for desktop assertions
    },
    actionTimeout: 25000, // 25 seconds for desktop actions
    navigationTimeout: 60000, // 60 seconds for app startup
    
    // Debugging and tracing
    trace: isDebug ? 'on' : 'retain-on-failure',
    screenshot: isDebug ? 'on' : 'only-on-failure',
    video: isDebug ? 'on' : 'retain-on-failure',
    
    // Viewport and display
    viewport: { 
      width: VIRTUAL_DISPLAY?.width || 1280, 
      height: VIRTUAL_DISPLAY?.height || 800 
    },
    
    // Network and security
    ignoreHTTPSErrors: true,
    bypassCSP: true,
    
    // Locale and timezone
    locale: 'en-US',
    timezoneId: 'America/New_York',
    
    // User agent
    userAgent: 'TunnelForge-E2E-Tests/1.0.0 Playwright',
    
    // Browser launch options
    launchOptions: {
      args: getTauriBrowserArgs(),
      headless: isHeadless,
      slowMo: isDebug ? 100 : 0,
      
      // Environment variables
      env: {
        ...process.env,
        // Display configuration
        ...(VIRTUAL_DISPLAY ? {
          DISPLAY: VIRTUAL_DISPLAY.display,
          XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || '/tmp',
        } : {}),
        
        // Tauri-specific
        TAURI_DEBUG: '1',
        TAURI_BUNDLE_IDENTIFIER: 'dev.tunnelforge.desktop.test',
        RUST_LOG: isDebug ? 'debug' : 'info',
        RUST_BACKTRACE: '1',
        
        // TunnelForge-specific
        TUNNELFORGE_TEST_MODE: 'true',
        TUNNELFORGE_SERVER_PORT: TUNNELFORGE_SERVER_PORT.toString(),
        TUNNELFORGE_API_URL: TUNNELFORGE_API_URL,
        
        // Testing
        NODE_ENV: 'test',
        PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || '0',
      },
      
      // WSL/Linux specific
      ...(isWSL || isCI ? {
        ignoreDefaultArgs: ['--enable-blink-features=IdleDetection'],
      } : {}),
    },
    
    // Context options
    contextOptions: {
      permissions: [
        'clipboard-read',
        'clipboard-write',
        'notifications',
        'system-startup',
      ],
      
      // Extra HTTP headers for TunnelForge API
      extraHTTPHeaders: {
        'X-TunnelForge-Test': 'true',
        'X-TunnelForge-Version': '1.0.0-test',
      },
    },
  },

  // Test projects configuration
  projects: [
    // Primary: Tauri WebView via remote debugging
    {
      name: 'tauri-webview',
      use: { 
        ...devices['Desktop Chrome'],
        // Connect to existing Tauri WebView
        connectOptions: {
          wsEndpoint: `ws://localhost:${TAURI_DEBUG_PORT}/devtools/browser`,
          timeout: 30000, // 30 seconds connection timeout
          headers: {
            'User-Agent': 'TunnelForge-E2E-WebView/1.0.0',
          },
        },
      },
      testMatch: [
        '**/tauri-*.spec.ts',
        '**/desktop-*.spec.ts',
        '**/webview-*.spec.ts',
      ],
      dependencies: ['tauri-setup'],
    },
    
    // Fallback: Direct browser to Tauri dev server
    {
      name: 'tauri-dev-server',
      use: { 
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            ...getTauriBrowserArgs(),
            `--proxy-server=http://localhost:${TUNNELFORGE_SERVER_PORT}`,
          ],
        },
      },
      testMatch: [
        '**/tauri-*.spec.ts',
        '**/desktop-*.spec.ts',
        '**/dev-server-*.spec.ts',
      ],
      dependencies: ['tauri-setup'],
    },
    
    // Setup project (runs first)
    {
      name: 'tauri-setup',
      testMatch: '**/global-setup.spec.ts',
      teardown: 'tauri-teardown',
    },
    
    // Cross-browser compatibility
    {
      name: 'firefox-webview',
      use: { 
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: {
            'media.navigator.streams.fake': true,
            'media.navigator.permission.disabled': true,
            'dom.webdriver.enabled': false,
            'security.fileuri.strict_origin_policy': false,
            'network.proxy.type': 0, // No proxy
          },
        },
      },
      testMatch: [
        '**/firefox-*.spec.ts',
        '**/cross-browser-*.spec.ts',
      ],
    },
    
    // WebKit for macOS testing
    {
      name: 'webkit-webview',
      use: { 
        ...devices['Desktop Safari'],
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
          ],
        },
      },
      testMatch: [
        '**/webkit-*.spec.ts',
        '**/safari-*.spec.ts',
      ],
      testIgnore: isWSL ? ['**/*.spec.ts'] : [], // Skip on WSL
    },
  ],

  // Global setup and teardown
  globalSetup: new URL('./tests/e2e-tauri/global-setup.ts', import.meta.url).href,
  globalTeardown: new URL('./tests/e2e-tauri/global-teardown.ts', import.meta.url).href,

  // Tauri dev server configuration
  webServer: {
    command: 'bun run tauri dev',
    port: TAURI_DEV_PORT,
    timeout: 180000, // 3 minutes for Tauri startup
    reuseExistingServer: !isCI,
    
    env: {
      // Test environment
      NODE_ENV: 'test',
      TUNNELFORGE_TEST_MODE: 'true',
      
      // Tauri configuration
      TAURI_DEBUG: '1',
      TAURI_BUNDLE_IDENTIFIER: 'dev.tunnelforge.desktop.test',
      RUST_LOG: isDebug ? 'debug' : 'info',
      RUST_BACKTRACE: '1',
      
      // TunnelForge backend configuration
      TUNNELFORGE_SERVER_PORT: TUNNELFORGE_SERVER_PORT.toString(),
      TUNNELFORGE_API_URL: TUNNELFORGE_API_URL,
      
      // Display configuration for WSL/CI
      ...(VIRTUAL_DISPLAY ? {
        DISPLAY: VIRTUAL_DISPLAY.display,
        XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || '/tmp',
        XVFB_SCREEN: '0 1280x800x24',
      } : {}),
      
      // Disable Sentry during tests
      SENTRY_GO_DSN: '',
      
      // Browser configuration
      BROWSER: 'none', // Prevent auto-opening browser
    },
    
    // Output handling
    stdout: isCI ? 'pipe' : 'inherit',
    stderr: isCI ? 'pipe' : 'inherit',
    
    // Health check
    async verifyPort(port) {
      console.log(`🔍 Verifying Tauri dev server on port ${port}...`);
      
      try {
        const response = await fetch(`http://localhost:${port}`, {
          method: 'GET',
          timeout: 5000,
        });
        
        if (response.ok) {
          const content = await response.text();
          // Check if it's a Tauri app
          if (content.includes('__TAURI__') || content.includes('TunnelForge')) {
            console.log('✅ Tauri dev server verified');
            return true;
          }
        }
      } catch (error) {
        console.log(`⏳ Tauri dev server not ready yet: ${error.message}`);
      }
      
      return false;
    },
  },

  // Output configuration
  outputDir: 'test-results/tauri-output',
  
  // Test patterns
  testMatch: [
    '**/*.spec.ts',
    '**/*.test.ts',
    '**/*.e2e.ts',
  ],
  
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/target/**', // Rust build artifacts
    '**/e2e-old/**', // Legacy tests
    '**/e2e-web/**', // Web-only tests
    '**/coverage/**',
    '**/.nyc_output/**',
  ],

  // Timeout configuration
  timeout: 120000, // 2 minutes per test
  globalTimeout: 900000, // 15 minutes total

  // Metadata for test organization and filtering
  metadata: {
    'test-type': 'tauri-desktop',
    'platform': 'cross-platform',
    'requires-display': isWSL || isCI,
    'requires-tauri': true,
    'tunnelforge-version': '1.0.0',
    'test-environment': process.env.NODE_ENV || 'test',
  },

  // Custom test configuration
  grep: process.env.GREP ? new RegExp(process.env.GREP) : undefined,
  grepInvert: process.env.GREP_INVERT ? new RegExp(process.env.GREP_INVERT) : undefined,
  
  // Update configuration
  updateSnapshots: process.env.UPDATE_SNAPSHOTS === 'true' ? 'all' : 'missing',
});