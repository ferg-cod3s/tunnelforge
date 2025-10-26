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
    baseURL: 'http://localhost:4021',

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
  },

  /* Configure browser projects */
  projects: process.env.CROSS_BROWSER ? [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
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
          ],
        },
      },
    },
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: {
            'media.navigator.streams.fake': true,
            'media.navigator.permission.disabled': true,
          },
        },
      },
    },
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
      },
    },
  ] : [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
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
          ],
        },
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'cd ../server && go run cmd/server/main.go',
    port: 4021,
    reuseExistingServer: !process.env.CI,
    stdout: process.env.CI ? 'pipe' : 'ignore',
    stderr: process.env.CI ? 'pipe' : 'pipe',
    timeout: 30 * 1000,
    cwd: process.cwd(),
  },
});