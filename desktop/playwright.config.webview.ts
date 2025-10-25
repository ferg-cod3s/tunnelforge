import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Playwright configuration for TunnelForge WebView E2E tests
 * 
 * This configuration specifically tests the WebView integration within the Tauri desktop app.
 * It connects to the TunnelForge backend on port 4021 and tests the WebView functionality.
 * 
 * Testing Strategy:
 * - Connect to running TunnelForge server on port 4021
 * - Test WebView initialization and Tauri API availability
 * - Test terminal interface within WebView
 * - Test settings UI and system integration
 * - Test cross-platform features
 * - Test performance and stability
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Environment detection
const isWSL = process.platform === 'linux' && process.env.WSL_DISTRO_NAME;
const isCI = !!process.env.CI;
const isHeadless = process.env.HEADED !== 'true';
const isDebug = process.env.DEBUG === 'true';

// TunnelForge configuration
const TUNNELFORGE_SERVER_PORT = 4021;
const TUNNELFORGE_API_URL = `http://localhost:${TUNNELFORGE_SERVER_PORT}`;

// Virtual display configuration for WSL/CI
const VIRTUAL_DISPLAY = isWSL || isCI ? {
  display: process.env.DISPLAY || ':99',
  width: parseInt(process.env.VIRTUAL_DISPLAY_WIDTH || '1280'),
  height: parseInt(process.env.VIRTUAL_DISPLAY_HEIGHT || '800'),
} : null;

export default defineConfig({
  testDir: './tests/e2e-desktop',
  
  // Test execution configuration
  fullyParallel: false, // Disable parallel for WebView stability
  forbidOnly: isCI,
  retries: isCI ? 3 : 1,
  workers: 1, // Always use 1 worker for WebView testing
  
  // Comprehensive reporting
  reporter: [
    ['html', { 
      outputFolder: 'test-results/webview-html-report',
      open: isHeadless ? 'never' : 'on-failure',
      host: '0.0.0.0',
      port: 9324,
    }],
    ['json', { outputFile: 'test-results/webview-results.json' }],
    ['junit', { outputFile: 'test-results/webview-junit.xml' }],
    ['line'],
    ['github'],
  ],
  
  // Global test configuration
  use: {
    // Base URLs
    baseURL: TUNNELFORGE_API_URL,
    
    // Timeouts - increased for WebView operations
    expect: {
      timeout: 25000, // 25 seconds for WebView assertions
    },
    actionTimeout: 30000, // 30 seconds for WebView actions
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
    userAgent: 'TunnelForge-WebView-E2E-Tests/1.0.0 Playwright',
    
    // Browser launch options
    launchOptions: {
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
        args: [
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-accelerated-2d-canvas',
          '--disable-accelerated-jpeg-decoding',
          '--disable-accelerated-mjpeg-decode',
          '--disable-accelerated-video-decode',
          '--disable-gpu-compositing',
          '--disable-gpu-sandbox',
          '--no-sandbox',
          '--disable-dev-shm-usage',
        ],
      } : {}),
    },
    
    // Context options
    contextOptions: {
      // Valid Playwright permissions
      permissions: [
        'clipboard-read',
        'clipboard-write',
        'notifications',
      ],
      
      // Extra HTTP headers for TunnelForge API
      extraHTTPHeaders: {
        'X-TunnelForge-Test': 'true',
        'X-TunnelForge-Version': '1.0.0-test',
        'X-TunnelForge-Test-Type': 'webview',
      },
    },
  },

  // Test projects configuration
  projects: [
    // Primary: WebView testing with Chrome
    {
      name: 'webview-chrome',
      use: { 
        ...devices['Desktop Chrome'],
        testIdAttribute: 'data-testid',
      },
      testMatch: [
        '**/webview/**/*.spec.ts',
      ],
    },
    
    // Cross-browser testing with Firefox
    {
      name: 'webview-firefox',
      use: { 
        ...devices['Desktop Firefox'],
        testIdAttribute: 'data-testid',
        launchOptions: {
          firefoxUserPrefs: {
            'media.navigator.streams.fake': true,
            'media.navigator.permission.disabled': true,
            'dom.webdriver.enabled': false,
            'security.fileuri.strict_origin_policy': false,
            'network.proxy.type': 0,
          },
        },
      },
      testMatch: [
        '**/webview/**/*.spec.ts',
      ],
      testIgnore: isWSL ? ['**/*.spec.ts'] : [], // Skip on WSL for Firefox
    },
    
    // WebKit for macOS testing
    {
      name: 'webview-webkit',
      use: { 
        ...devices['Desktop Safari'],
        testIdAttribute: 'data-testid',
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
          ],
        },
      },
      testMatch: [
        '**/webview/**/*.spec.ts',
      ],
      testIgnore: isWSL ? ['**/*.spec.ts'] : [], // Skip on WSL for WebKit
    },
  ],

  // Start TunnelForge server before running tests
  webServer: {
    command: 'cd ../.. && go run ./server/cmd/server/main.go',
    port: TUNNELFORGE_SERVER_PORT,
    timeout: 120000, // 2 minutes for server startup
    reuseExistingServer: !isCI,
    
    env: {
      // Test environment
      NODE_ENV: 'test',
      TUNNELFORGE_TEST_MODE: 'true',
      
      // Server configuration
      PORT: TUNNELFORGE_SERVER_PORT.toString(),
      
      // Display configuration for WSL/CI
      ...(VIRTUAL_DISPLAY ? {
        DISPLAY: VIRTUAL_DISPLAY.display,
        XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || '/tmp',
      } : {}),
      
      // Disable Sentry during tests
      SENTRY_GO_DSN: '',
      
      // Testing flags
      TUNNELFORGE_LOG_LEVEL: isDebug ? 'debug' : 'info',
      TUNNELFORGE_ENABLE_CORS: 'true',
    },
    
    // Output handling
    stdout: isCI ? 'pipe' : 'inherit',
    stderr: isCI ? 'pipe' : 'inherit',
    
    // Health check
    async verifyPort(port) {
      console.log(`🔍 Verifying TunnelForge server on port ${port}...`);
      
      try {
        const response = await fetch(`http://localhost:${port}/health`, {
          method: 'GET',
          timeout: 5000,
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'ok') {
            console.log('✅ TunnelForge server verified');
            return true;
          }
        }
      } catch (error) {
        // Try root endpoint as fallback
        try {
          const response = await fetch(`http://localhost:${port}`, {
            method: 'GET',
            timeout: 5000,
          });
          
          if (response.ok) {
            console.log('✅ TunnelForge server verified (root endpoint)');
            return true;
          }
        } catch (fallbackError) {
          console.log(`⏳ TunnelForge server not ready yet: ${error.message}`);
        }
      }
      
      return false;
    },
  },

  // Output configuration
  outputDir: 'test-results/webview-output',
  
  // Test patterns
  testMatch: [
    '**/webview/**/*.spec.ts',
    '**/webview-*.spec.ts',
  ],
  
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/target/**', // Rust build artifacts
    '**/e2e-old/**', // Legacy tests
    '**/coverage/**',
    '**/.nyc_output/**',
  ],

  // Timeout configuration
  timeout: 120000, // 2 minutes per test
  globalTimeout: 900000, // 15 minutes total

  // Metadata for test organization and filtering
  metadata: {
    'test-type': 'webview-desktop',
    'platform': 'cross-platform',
    'requires-display': isWSL || isCI,
    'requires-tunnelforge-server': true,
    'tunnelforge-version': '1.0.0',
    'test-environment': process.env.NODE_ENV || 'test',
  },

  // Custom test configuration
  grep: process.env.GREP ? new RegExp(process.env.GREP) : undefined,
  grepInvert: process.env.GREP_INVERT ? new RegExp(process.env.GREP_INVERT) : undefined,
  
  // Update configuration
  updateSnapshots: process.env.UPDATE_SNAPSHOTS === 'true' ? 'all' : 'missing',
});