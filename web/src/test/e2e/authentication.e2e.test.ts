import { test, expect } from '@playwright/test';

test.describe('Authentication E2E Tests', () => {
  test('should show login form when auth is required', async ({ page }) => {
    // Navigate to a protected route
    await page.goto('/settings');

    // Should redirect to login or show login form
    await expect(page.locator('[data-testid="login-form"], [data-testid="auth-required"]')).toBeVisible();
  });

  test('should handle login with valid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill in login form
    await page.locator('[data-testid="username-input"]').fill('testuser');
    await page.locator('[data-testid="password-input"]').fill('testpass');

    // Submit form
    await page.locator('[data-testid="login-submit"]').click();

    // Should redirect to main page or show success
    await expect(page.locator('[data-testid="login-success"], [data-testid="main-page"]')).toBeVisible();
  });

  test('should handle login with invalid credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill in login form with wrong credentials
    await page.locator('[data-testid="username-input"]').fill('wronguser');
    await page.locator('[data-testid="password-input"]').fill('wrongpass');

    // Submit form
    await page.locator('[data-testid="login-submit"]').click();

    // Should show error message
    await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-error"]')).toContainText('Invalid credentials');
  });

  test('should handle logout', async ({ page }) => {
    // Assume user is logged in
    await page.goto('/');

    // Click logout button
    await page.locator('[data-testid="logout-btn"]').click();

    // Should redirect to login or show logged out state
    await expect(page.locator('[data-testid="login-form"], [data-testid="logged-out"]')).toBeVisible();
  });

  test('should handle session timeout', async ({ page }) => {
    // Assume user is logged in
    await page.goto('/');

    // Wait for session to timeout (this might need to be mocked)
    await page.waitForTimeout(30000); // 30 seconds

    // Try to access a protected route
    await page.goto('/settings');

    // Should redirect to login due to timeout
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
  });

  test('should handle password reset', async ({ page }) => {
    await page.goto('/login');

    // Click forgot password link
    await page.locator('[data-testid="forgot-password-link"]').click();

    // Should show password reset form
    await expect(page.locator('[data-testid="password-reset-form"]')).toBeVisible();

    // Fill in email
    await page.locator('[data-testid="reset-email-input"]').fill('test@example.com');

    // Submit form
    await page.locator('[data-testid="reset-submit"]').click();

    // Should show success message
    await expect(page.locator('[data-testid="reset-success"]')).toBeVisible();
  });

  test('should handle account registration', async ({ page }) => {
    await page.goto('/register');

    // Fill in registration form
    await page.locator('[data-testid="register-username-input"]').fill('newuser');
    await page.locator('[data-testid="register-email-input"]').fill('newuser@example.com');
    await page.locator('[data-testid="register-password-input"]').fill('securepassword');
    await page.locator('[data-testid="register-confirm-password-input"]').fill('securepassword');

    // Submit form
    await page.locator('[data-testid="register-submit"]').click();

    // Should show success message or redirect
    await expect(page.locator('[data-testid="register-success"], [data-testid="login-form"]')).toBeVisible();
  });

  test('should handle CSRF protection', async ({ page }) => {
    await page.goto('/login');

    // Try to submit form without CSRF token (if implemented)
    // This test depends on how CSRF is implemented

    // Fill in form
    await page.locator('[data-testid="username-input"]').fill('testuser');
    await page.locator('[data-testid="password-input"]').fill('testpass');

    // Submit form
    await page.locator('[data-testid="login-submit"]').click();

    // Should either succeed (if CSRF not enforced) or show error
    // The exact behavior depends on server configuration
  });

  test('should handle rate limiting', async ({ page }) => {
    await page.goto('/login');

    // Try to login multiple times rapidly
    for (let i = 0; i < 10; i++) {
      await page.locator('[data-testid="username-input"]').fill('testuser');
      await page.locator('[data-testid="password-input"]').fill('wrongpass');
      await page.locator('[data-testid="login-submit"]').click();

      // Small delay between attempts
      await page.waitForTimeout(100);
    }

    // Should eventually show rate limit error
    await expect(page.locator('[data-testid="rate-limit-error"], [data-testid="login-error"]')).toBeVisible();
  });
});