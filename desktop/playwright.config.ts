import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Playwright configuration for TunnelForge Web E2E tests
 * 
 * This configuration tests the TunnelForge web frontend by connecting to
 * the Go backend server on port 4021 (instead of the non-existent Tauri HTTP server).
 * 
 * Strategy:
 * - Week 1: Test web frontend (Playwright on Go server port 4021)
 * - Week 2: Expand web test coverage 
 * - Week 3: Add WebDriver tests for native Tauri desktop app
 * 
 * @see https://playwright.dev/docs/test-configuration
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: './tests/e2e-web',
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : 1,
  
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'test-results/playwright-html-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
  ],
  
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL - Go server on port 4021 (not Tauri on 1420) */
    baseURL: 'http://localhost:4021',
    
    /* Global timeout for assertions */
    expect: {
      timeout: 10000, // 10 seconds for web assertions
    },
    
    /* Action timeout (click, fill, etc.) */
    actionTimeout: 15000, // 15 seconds for web actions
    
    /* Navigation timeout */
    navigationTimeout: 30000, // 30 seconds for page navigation
    
    /* Collect trace when retrying the failed test. */
    trace: 'on-first-retry',
    
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Record video on failure */
    video: 'retain-on-failure',
    
    /* Viewport for desktop testing */
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  /* Start web server before running tests */
  webServer: {
    /* 
     * Start Go server instead of Tauri dev mode
     * This is much simpler and actually works since Go server exposes HTTP on 4021
     */
    command: 'cd ../.. && go run ./server/cmd/server/main.go',
    port: 4021,
    timeout: 120000, // 2 minutes - Go server starts much faster than Tauri
    reuseExistingServer: true, // Allow reusing existing server during development
    env: {
      // Test-specific environment variables
      PORT: '4021',
      TUNNELFORGE_TEST_MODE: 'true',
      SENTRY_GO_DSN: '', // Disable Sentry during tests
    },
  },

  /* Output directories */
  outputDir: 'test-results/output',

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
    '**/*-old/**', // Ignore backup tests
  ],

  /* Timeout for each test */
  timeout: 60000, // 1 minute per test

  /* Maximum time for the entire test suite */
  globalTimeout: 600000, // 10 minutes total
});
