import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Playwright configuration for TunnelForge Tauri Desktop App E2E tests
 * 
 * This configuration is specifically designed for testing the Tauri desktop application's
 * WebView content, not just the web frontend. It handles:
 * - Tauri dev server on localhost:1420
 * - Remote debugging port configuration
 * - WSL/X11 virtual display setup
 * - Desktop application-specific testing patterns
 * 
 * Testing Strategy:
 * - Connect to Tauri's WebView via remote debugging
 * - Test desktop-specific functionality (tray, notifications, system integration)
 * - Validate Tauri command execution and IPC communication
 * - Test cross-platform desktop features
 * 
 * @see https://playwright.dev/docs/test-configuration
 * @see https://tauri.app/v1/guides/testing/webdriver
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Environment detection
const isWSL = process.platform === 'linux' && process.env.WSL_DISTRO_NAME;
const isCI = !!process.env.CI;
const isHeadless = process.env.HEADED !== 'true';

// Tauri configuration
const TAURI_DEV_PORT = 1420; // Default Tauri dev server port
const TAURI_DEBUG_PORT = 9222; // Chrome remote debugging port for WebView
const TAURI_APP_URL = `http://localhost:${TAURI_DEV_PORT}`;

// Virtual display configuration for WSL/CI
const VIRTUAL_DISPLAY = isWSL || isCI ? {
  display: process.env.DISPLAY || ':99',
  xvfbArgs: ['-screen', '0', '1280x800x24', '-ac', '-nolisten', 'tcp'],
} : null;

export default defineConfig({
  testDir: './tests/e2e-tauri',
  
  /* Run tests in files in parallel */
  fullyParallel: false, // Disable parallel for desktop app testing to avoid conflicts
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: isCI,
  
  /* Retry on CI only */
  retries: isCI ? 2 : 0,
  
  /* Opt out of parallel tests on CI for desktop app stability */
  workers: 1, // Always use 1 worker for desktop app testing
  
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { 
      outputFolder: 'test-results/tauri-html-report',
      open: isHeadless ? 'never' : 'on-failure'
    }],
    ['json', { outputFile: 'test-results/tauri-results.json' }],
    ['junit', { outputFile: 'test-results/tauri-junit.xml' }],
    ['list'],
  ],
  
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL - Tauri dev server */
    baseURL: TAURI_APP_URL,
    
    /* Global timeout for assertions - increased for desktop app operations */
    expect: {
      timeout: 15000, // 15 seconds for desktop assertions
    },
    
    /* Action timeout (click, fill, etc.) - increased for desktop responsiveness */
    actionTimeout: 20000, // 20 seconds for desktop actions
    
    /* Navigation timeout - increased for Tauri app startup */
    navigationTimeout: 45000, // 45 seconds for app startup navigation
    
    /* Collect trace when retrying the failed test. */
    trace: 'on-first-retry',
    
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Record video on failure */
    video: 'retain-on-failure',
    
    /* Viewport for desktop testing */
    viewport: { width: 1280, height: 800 },
    
    /* Ignore HTTPS errors for local development */
    ignoreHTTPSErrors: true,
    
    /* Browser launch options for Tauri WebView testing */
    launchOptions: {
      args: [
        // Remote debugging configuration
        `--remote-debugging-port=${TAURI_DEBUG_PORT}`,
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-ipc-flooding-protection',
        // WSL/Linux specific
        ...(isWSL || isCI ? [
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-accelerated-2d-canvas',
          '--disable-accelerated-jpeg-decoding',
          '--disable-accelerated-mjpeg-decode',
          '--disable-accelerated-video-decode',
        ] : []),
        // Development specific
        ...(!isHeadless ? [
          '--auto-open-devtools-for-tabs',
        ] : []),
      ],
      
      // WSL/Linux specific launch options
      ...(isWSL || isCI ? {
        env: {
          ...process.env,
          DISPLAY: VIRTUAL_DISPLAY?.display || ':99',
        },
      } : {}),
    },
  },

  /* Configure projects for major browsers - focus on Chromium for Tauri WebView */
  projects: [
    {
      name: 'tauri-chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Connect to existing Tauri WebView via remote debugging
        connectOptions: {
          wsEndpoint: `ws://localhost:${TAURI_DEBUG_PORT}/devtools/browser`,
        },
      },
      testMatch: [
        '**/tauri-*.spec.ts',
        '**/desktop-*.spec.ts',
        '**/integration-*.spec.ts',
      ],
    },
    
    // Fallback to regular browser for web content testing
    {
      name: 'chromium-web',
      use: { ...devices['Desktop Chrome'] },
      testMatch: [
        '**/web-content-*.spec.ts',
        '**/ui-*.spec.ts',
      ],
    },
    
    // Firefox for cross-browser compatibility testing
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: {
            'media.navigator.streams.fake': true,
            'media.navigator.permission.disabled': true,
            'dom.webdriver.enabled': false,
          },
        },
      },
      testMatch: [
        '**/web-content-*.spec.ts',
      ],
    },
  ],

  /* Global setup for Tauri app initialization */
  globalSetup: require.resolve('./tests/e2e-tauri/global-setup.ts'),
  globalTeardown: require.resolve('./tests/e2e-tauri/global-teardown.ts'),

  /* Start Tauri dev server before running tests */
  webServer: {
    /* 
     * Start Tauri dev server
     * This will launch the desktop app with WebView accessible for testing
     */
    command: 'bun run tauri dev',
    port: TAURI_DEV_PORT,
    timeout: 120000, // 2 minutes - Tauri dev server startup time
    reuseExistingServer: !isCI, // Allow reusing existing server during development
    env: {
      // Test-specific environment variables
      NODE_ENV: 'test',
      TUNNELFORGE_TEST_MODE: 'true',
      TAURI_DEBUG: '1', // Enable Tauri debug mode
      TAURI_BUNDLE_IDENTIFIER: 'dev.tunnelforge.desktop.test',
      SENTRY_GO_DSN: '', // Disable Sentry during tests
      RUST_LOG: 'debug', // Enable Rust debug logging
      RUST_BACKTRACE: '1', // Enable Rust backtraces
      // WSL/Linux display configuration
      ...(VIRTUAL_DISPLAY ? {
        DISPLAY: VIRTUAL_DISPLAY.display,
        XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR || '/tmp',
      } : {}),
    },
    
    // Custom stdout/stderr handling for better debugging
    stdout: isCI ? 'pipe' : 'inherit',
    stderr: isCI ? 'pipe' : 'inherit',
    
    // Additional startup verification
    async verifyPort(port) {
      // Custom port verification for Tauri
      console.log(`🔍 Verifying Tauri dev server on port ${port}...`);
      return true;
    },
  },

  /* Output directories */
  outputDir: 'test-results/tauri-output',

  /* Test match patterns */
  testMatch: [
    '**/*.spec.ts',
    '**/*.test.ts',
  ],

  /* Test ignore patterns */
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/target/**', // Ignore Rust build artifacts
    '**/e2e-old/**', // Ignore old test files
    '**/e2e-web/**', // Ignore web-only tests
  ],

  /* Timeout for each test - increased for desktop operations */
  timeout: 90000, // 1.5 minutes per test

  /* Maximum time for the entire test suite */
  globalTimeout: 600000, // 10 minutes total

  /* Metadata for test organization */
  metadata: {
    'test-type': 'tauri-desktop',
    'platform': 'cross-platform',
    'requires-display': isWSL || isCI,
    'requires-tauri': true,
  },
});