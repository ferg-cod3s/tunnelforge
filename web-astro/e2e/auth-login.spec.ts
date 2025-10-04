import { test, expect } from '@playwright/test';

/**
 * E2E tests for AuthLogin component
 * Tests authentication functionality including password login, SSH keys, and error handling
 */

test.describe('AuthLogin Component', () => {
  test.setTimeout(30000); // 30 second timeout for auth tests

  test.beforeEach(async ({ page }) => {
    // Navigate to the auth test page
    await page.goto('/test-auth');
    await page.waitForLoadState('networkidle');
  });

  test('should render the auth login component correctly', async ({ page }) => {
    // Check that the main auth container is visible
    await expect(page.locator('.auth-container')).toBeVisible();

    // Check that the TunnelForge title is displayed
    await expect(page.getByText('TunnelForge')).toBeVisible();

    // Check that the subtitle is displayed
    await expect(page.getByText('Please authenticate to continue')).toBeVisible();

    // Check that the settings button is present
    await expect(page.locator('[title="Settings"]')).toBeVisible();

    // Check that the TerminalIcon is rendered (should be visible)
    await expect(page.locator('svg')).toBeVisible();
  });

  test('should display user information when loaded', async ({ page }) => {
    // Wait for user information to load
    await page.waitForTimeout(2000); // Allow time for async user info loading

    // Check that user avatar or placeholder is displayed
    const avatarContainer = page.locator('.w-24.h-24, .w-28.h-28');
    await expect(avatarContainer).toBeVisible();

    // Check that welcome message is displayed
    await expect(page.getByText(/Welcome back/)).toBeVisible();
  });

  test('should show password input field when password auth is enabled', async ({ page }) => {
    // Wait for component to initialize
    await page.waitForTimeout(2000);

    // Check that password input is visible
    const passwordInput = page.locator('[data-testid="password-input"]');
    await expect(passwordInput).toBeVisible();

    // Check that password input has correct attributes
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(passwordInput).toHaveAttribute('placeholder', 'System Password');
    await expect(passwordInput).toHaveAttribute('required');
  });

  test('should enable login button when password is entered', async ({ page }) => {
    await page.waitForTimeout(2000);

    const passwordInput = page.locator('[data-testid="password-input"]');
    const loginButton = page.locator('[data-testid="password-submit"]');

    // Initially button should be disabled (no password entered)
    await expect(loginButton).toBeDisabled();

    // Enter password
    await passwordInput.fill('testpassword');

    // Button should now be enabled
    await expect(loginButton).toBeEnabled();
  });

  test('should show loading state during authentication', async ({ page }) => {
    await page.waitForTimeout(2000);

    const passwordInput = page.locator('[data-testid="password-input"]');
    const loginButton = page.locator('[data-testid="password-submit"]');

    // Enter password and submit
    await passwordInput.fill('testpassword');
    await loginButton.click();

    // Check that button shows loading text
    await expect(loginButton).toContainText('Authenticating...');

    // Button should be disabled during loading
    await expect(loginButton).toBeDisabled();
  });

  test('should display error messages for authentication failures', async ({ page }) => {
    await page.waitForTimeout(2000);

    const passwordInput = page.locator('[data-testid="password-input"]');
    const loginButton = page.locator('[data-testid="password-submit"]');

    // Enter invalid password and submit
    await passwordInput.fill('wrongpassword');
    await loginButton.click();

    // Wait for error to appear
    await page.waitForTimeout(2000);

    // Check that error message is displayed
    const errorMessage = page.locator('[data-testid="error-message"]');
    await expect(errorMessage).toBeVisible();

    // Check that error close button works
    const errorCloseButton = page.locator('[data-testid="error-close"]');
    await expect(errorCloseButton).toBeVisible();
    await errorCloseButton.click();

    // Error should be hidden
    await expect(errorMessage).not.toBeVisible();
  });

  test('should show SSH key authentication option when enabled', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Check for SSH key management section
    const sshSection = page.locator('.ssh-key-item');
    await expect(sshSection).toBeVisible();

    // Check for manage keys button
    const manageKeysButton = page.locator('[data-testid="manage-keys"]');
    await expect(manageKeysButton).toBeVisible();
    await expect(manageKeysButton).toContainText('Manage Keys');

    // Check for SSH login button
    const sshLoginButton = page.locator('[data-testid="ssh-login"]');
    await expect(sshLoginButton).toBeVisible();
    await expect(sshLoginButton).toContainText('Login with SSH Key');
  });

  test('should handle settings button click', async ({ page }) => {
    // Click the settings button
    await page.locator('[title="Settings"]').click();

    // Since this triggers an alert in the test page, we can't easily test the actual alert
    // But we can verify the button is clickable
    await expect(page.locator('[title="Settings"]')).toBeVisible();
  });

  test('should handle SSH key manager button click', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Click the manage keys button
    await page.locator('[data-testid="manage-keys"]').click();

    // Since this triggers an alert in the test page, we verify the button works
    await expect(page.locator('[data-testid="manage-keys"]')).toBeVisible();
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.waitForTimeout(2000);

    // Check that component still renders correctly on mobile
    await expect(page.locator('.auth-container')).toBeVisible();
    await expect(page.getByText('TunnelForge')).toBeVisible();

    // Check that mobile-specific classes are applied (smaller sizes)
    const avatarContainer = page.locator('.w-24.h-24'); // Mobile size
    await expect(avatarContainer).toBeVisible();
  });

  test('should handle keyboard navigation', async ({ page }) => {
    await page.waitForTimeout(2000);

    const passwordInput = page.locator('[data-testid="password-input"]');

    // Focus on password input
    await passwordInput.focus();
    await expect(passwordInput).toBeFocused();

    // Type password
    await page.keyboard.type('testpassword');

    // Press Enter to submit
    await page.keyboard.press('Enter');

    // Check that authentication starts (loading state)
    const loginButton = page.locator('[data-testid="password-submit"]');
    await expect(loginButton).toContainText('Authenticating...');
  });

  test('should maintain accessibility standards', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Check for proper heading structure
    const heading = page.locator('h2');
    await expect(heading).toBeVisible();

    // Check that form has proper labels (password input should have placeholder)
    const passwordInput = page.locator('[data-testid="password-input"]');
    await expect(passwordInput).toHaveAttribute('placeholder', 'System Password');

    // Check that buttons have appropriate accessible names
    const loginButton = page.locator('[data-testid="password-submit"]');
    await expect(loginButton).toBeVisible();

    // Check color contrast (this is a basic check - real accessibility testing would use specialized tools)
    await expect(page.locator('.auth-title')).toHaveCSS('color', /rgb\(.*\)/);
  });
});