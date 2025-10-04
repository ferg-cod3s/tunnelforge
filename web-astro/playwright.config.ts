import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Test Configuration for web-astro
 */
export default defineConfig({
  testDir: './e2e',

  /* Global setup */
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Parallel workers configuration */
  workers: (() => {
    if (process.env.PLAYWRIGHT_WORKERS) {
      const parsed = parseInt(process.env.PLAYWRIGHT_WORKERS, 10);
      if (!isNaN(parsed) && parsed > 0) {
        return parsed;
      }
      console.warn(`Invalid PLAYWRIGHT_WORKERS value: "${process.env.PLAYWRIGHT_WORKERS}". Using default.`);
    }
    // Use 1 worker to prevent resource conflicts
    return 1;
  })(),

  /* Test timeout */
  timeout: process.env.CI ? 20 * 1000 : 10 * 1000,

  /* Reporter to use */
  reporter: [
    ['html', { open: 'never' }],
    ...(process.env.CI ? [['github'] as const] : [['list'] as const]),
    ...(process.env.CI ? [['junit', { outputFile: 'test-results/junit.xml' }] as const] : []),
  ],

  /* Shared settings for all the projects below. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3001',

    /* Collect trace when retrying the failed test. */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Capture video on first retry */
    video: 'on-first-retry',

    /* Maximum time each action can take */
    actionTimeout: process.env.CI ? 5000 : 3000,

    /* Navigation timeout */
    navigationTimeout: process.env.CI ? 10000 : 5000,

    /* Run in headless mode for better performance */
    headless: true,

    /* Viewport size */
    viewport: { width: 1280, height: 1200 },

    /* Ignore HTTPS errors */
    ignoreHTTPSErrors: true,

    /* Browser launch options for better performance */
    launchOptions: {
      args: [
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-javascript-harmony-shipping',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
      ],
    },
  },

  /* Configure browser projects */
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
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'bun run dev --port 3001',
    port: 3001,
    reuseExistingServer: !process.env.CI,
    stdout: process.env.CI ? 'pipe' : 'ignore',
    stderr: process.env.CI ? 'pipe' : 'pipe',
    timeout: 20 * 1000,
    cwd: process.cwd(),
  },
});