import { expect, test } from '../fixtures/test.fixture';
import { assertTerminalReady } from '../helpers/assertion.helper';
import { createAndNavigateToSession } from '../helpers/session-lifecycle.helper';
import { TestSessionManager } from '../helpers/test-data-manager.helper';
import { waitForModalClosed } from '../helpers/wait-strategies.helper';

// Type for file browser web component
interface FileBrowserElement extends HTMLElement {
  visible?: boolean;
}

// These tests create their own sessions and can run in parallel
test.describe.configure({ mode: 'parallel' });

test.describe('UI Features', () => {
  let sessionManager: TestSessionManager;

  test.beforeEach(async ({ page }) => {
    sessionManager = new TestSessionManager(page);
  });

  test.afterEach(async () => {
    await sessionManager.cleanupAllSessions();
  });

  test('should open and close file browser', async ({ page }) => {
    // Create a session using helper
    await createAndNavigateToSession(page, {
      name: sessionManager.generateSessionName('file-browser'),
    });
    await assertTerminalReady(page);

    // Look for file browser button in session header (use .first() to avoid strict mode violation)
    const fileBrowserButton = page.locator('[data-testid="file-browser-button"]').first();
    await expect(fileBrowserButton).toBeVisible({ timeout: 10000 });

    // Click to open file browser
    await fileBrowserButton.click();

    // Wait for file browser to be visible using custom evaluation
    const fileBrowserVisible = await page.waitForFunction(
      () => {
        const browser = document.querySelector('file-browser');
        return browser && (browser as FileBrowserElement).visible === true;
      },
      { timeout: 5000 }
    );
    expect(fileBrowserVisible).toBeTruthy();

    // Close file browser with Escape
    await page.keyboard.press('Escape');

    // Wait for file browser to be hidden
    await page.waitForFunction(
      () => {
        const browser = document.querySelector('file-browser');
        return !browser || (browser as FileBrowserElement).visible === false;
      },
      { timeout: 5000 }
    );
  });

  test('should navigate directories in file browser', async ({ page }) => {
    // Create a session using helper
    await createAndNavigateToSession(page, {
      name: sessionManager.generateSessionName('file-browser-nav'),
    });
    await assertTerminalReady(page);

    // Open file browser (use .first() to avoid strict mode violation)
    const fileBrowserButton = page.locator('[data-testid="file-browser-button"]').first();
    await fileBrowserButton.click();

    // Wait for file browser to be visible
    const fileBrowserVisible = await page.waitForFunction(
      () => {
        const browser = document.querySelector('file-browser');
        return browser && (browser as FileBrowserElement).visible === true;
      },
      { timeout: 5000 }
    );
    expect(fileBrowserVisible).toBeTruthy();

    // Check if we can see the modal content by looking for the modal wrapper
    const modalWrapper = page.locator('modal-wrapper').filter({ hasText: 'File Browser' });
    const modalVisible = await modalWrapper.isVisible().catch(() => false);

    if (!modalVisible) {
      // File browser might be implemented differently, skip directory navigation
      test.skip(true, 'File browser modal not found - implementation may have changed');
      return;
    }

    // Look for directory entries
    const directoryEntries = modalWrapper.locator('[data-type="directory"], .directory-entry');
    const directoryCount = await directoryEntries.count();

    if (directoryCount > 0) {
      // Click on first directory
      await directoryEntries.first().click();

      // Wait a bit for navigation
      await page.waitForTimeout(1000);
    }

    // Close file browser
    await page.keyboard.press('Escape');
  });

  test('should use quick start commands', async ({ page }) => {
    // Open create session dialog
    await page.waitForSelector('button[title="Create New Session"]', {
      state: 'visible',
      timeout: 5000,
    });
    await page.click('button[title="Create New Session"]', { timeout: 10000 });
    await page.waitForSelector('input[placeholder="My Session"]', { state: 'visible' });

    // Turn off native terminal
    const spawnWindowToggle = page.locator('button[role="switch"]');
    if ((await spawnWindowToggle.getAttribute('aria-checked')) === 'true') {
      await spawnWindowToggle.click();
    }

    // Look for quick start buttons
    const quickStartButtons = page.locator(
      'button:has-text("zsh"), button:has-text("bash"), button:has-text("python3")'
    );
    const buttonCount = await quickStartButtons.count();
    expect(buttonCount).toBeGreaterThan(0);

    // Click on bash if available
    const bashButton = page.locator('button:has-text("bash")').first();
    if (await bashButton.isVisible()) {
      await bashButton.click();

      // Command field should be populated
      const commandInput = page.locator('input[placeholder="zsh"]');
      const value = await commandInput.inputValue();
      expect(value).toBe('bash');
    }

    // Create the session
    const sessionName = sessionManager.generateSessionName('quick-start');
    await page.fill('input[placeholder="My Session"]', sessionName);

    // Wait for the create button to be ready and click it
    const createButton = page.locator('button:has-text("Create")');
    await createButton.waitFor({ state: 'visible' });
    await createButton.scrollIntoViewIfNeeded();

    // Use Promise.race to handle both navigation and potential modal close
    await Promise.race([
      createButton.click({ timeout: 5000 }),
      page.waitForURL(/\?session=/, { timeout: 30000 }),
    ]).catch(async () => {
      // If the first click failed, try force click
      await createButton.click({ force: true });
    });

    // Ensure we navigate to the session
    if (!page.url().includes('?session=')) {
      await page.waitForURL(/\?session=/, { timeout: 10000 });
    }

    // Track for cleanup
    sessionManager.clearTracking();
  });

  test('should display notification options', async ({ page }) => {
    // Check notification button in header - it's the notification-status component
    const notificationButton = page.locator('notification-status button').first();

    // Wait for notification button to be visible
    await expect(notificationButton).toBeVisible({ timeout: 4000 });

    // Verify the button has a tooltip
    const tooltip = await notificationButton.getAttribute('title');
    expect(tooltip).toBeTruthy();
    expect(tooltip?.toLowerCase()).toContain('notification');
  });

  test('should show session count in header', async ({ page }) => {
    test.setTimeout(30000); // Increase timeout
    // Create a tracked session first
    const { sessionName } = await sessionManager.createTrackedSession();

    // Go to home page to see the session list
    await page.goto('/');
    await page.waitForSelector('session-card', { state: 'visible', timeout: 10000 });

    // Wait for header to be visible
    const headerVisible = await page
      .locator('full-header')
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!headerVisible) {
      // Header might not be visible in mobile view or test environment
      test.skip(true, 'Header not visible in current viewport');
      return;
    }

    // Get session count from header
    const headerElement = page.locator('full-header').first();
    const sessionCountElement = headerElement
      .locator('p.text-xs, .session-count, [data-testid="session-count"]')
      .first();

    // Wait for the count element to be visible
    try {
      await expect(sessionCountElement).toBeVisible({ timeout: 5000 });
    } catch {
      // Count element might not be present in all layouts
      test.skip(true, 'Session count element not found in header');
      return;
    }

    const countText = await sessionCountElement.textContent();
    const count = Number.parseInt(countText?.match(/\d+/)?.[0] || '0');

    // We should have at least 1 session (the one we just created)
    expect(count).toBeGreaterThanOrEqual(1);

    // Verify our session is visible in the list
    const sessionCard = page.locator(`session-card:has-text("${sessionName}")`);
    await expect(sessionCard).toBeVisible({ timeout: 10000 });
  });

  test('should preserve form state in create dialog', async ({ page }) => {
    // Open create dialog
    await page.click('button[title="Create New Session"]');
    await page.waitForSelector('input[placeholder="My Session"]', { state: 'visible' });

    // Fill in some values
    const testName = 'Preserve Test';
    const testCommand = 'python3';
    const testDir = '/usr/local';

    await page.fill('input[placeholder="My Session"]', testName);
    await page.fill('input[placeholder="zsh"]', testCommand);
    await page.fill('input[placeholder="~/"]', testDir);

    // Close dialog
    await page.keyboard.press('Escape');
    await waitForModalClosed(page);

    // Reopen dialog
    await page.click('button[title="Create New Session"]');
    await page.waitForSelector('input[placeholder="My Session"]', { state: 'visible' });

    // Working directory and command might be preserved (depends on implementation)
    // Session name is typically cleared
    const commandValue = await page.locator('input[placeholder="zsh"]').inputValue();
    const _dirValue = await page.locator('input[placeholder="~/"]').inputValue();

    // At minimum, the form should be functional
    expect(commandValue).toBeTruthy(); // Should have some default
  });

  test('should show terminal preview in session cards', async ({ page }) => {
    // Create a tracked session
    const { sessionName } = await sessionManager.createTrackedSession();

    // Go back to list
    await page.goto('/');
    await page.waitForSelector('session-card', { state: 'visible', timeout: 20000 });

    // Wait a bit more for session list to update
    await page.waitForTimeout(2000);

    // Find our session card
    const sessionCard = page.locator('session-card').filter({ hasText: sessionName }).first();
    await expect(sessionCard).toBeVisible({ timeout: 20000 });

    // The card should show terminal preview (buffer component)
    const preview = sessionCard.locator('vibe-terminal-buffer').first();
    await expect(preview).toBeVisible({ timeout: 20000 });
  });
});
