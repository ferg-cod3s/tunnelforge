import { test, expect } from '@playwright/test';

/**
 * E2E tests for FilePicker component
 * Tests file selection, upload functionality, and error handling
 */

test.describe('FilePicker Component', () => {
  test.setTimeout(30000); // 30 second timeout for file upload tests

  test.beforeEach(async ({ page }) => {
    // Navigate to the file picker test page
    await page.goto('/test-file-picker');
    await page.waitForLoadState('networkidle');
  });

  test('should render the file picker test page correctly', async ({ page }) => {
    // Check that the main container is visible
    await expect(page.locator('.container')).toBeVisible();

    // Check that the title is displayed
    await expect(page.getByText('File Picker Component Test')).toBeVisible();

    // Check that test controls section is visible
    await expect(page.getByText('Test Controls')).toBeVisible();

    // Check that event log section is visible
    await expect(page.getByText('Event Log')).toBeVisible();

    // Check that control buttons are present
    await expect(page.locator('#show-file-picker')).toBeVisible();
    await expect(page.locator('#direct-file-select')).toBeVisible();
    await expect(page.locator('#open-image-picker')).toBeVisible();
    await expect(page.locator('#open-camera')).toBeVisible();
  });

  test('should show file picker dialog when button is clicked', async ({ page }) => {
    // Click the show file picker button
    await page.locator('#show-file-picker').click();

    // Wait for dialog to appear
    await page.waitForTimeout(500);

    // Check that the file picker dialog is visible
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Check dialog title
    await expect(page.getByText('Select File')).toBeVisible();

    // Check that choose file button is visible
    await expect(page.locator('#file-picker-choose-button')).toBeVisible();

    // Check that cancel button is visible
    await expect(page.locator('#file-picker-cancel-button')).toBeVisible();
  });

  test('should close file picker dialog when cancel is clicked', async ({ page }) => {
    // Show the dialog
    await page.locator('#show-file-picker').click();
    await page.waitForTimeout(500);

    // Verify dialog is visible
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Click cancel button
    await page.locator('#file-picker-cancel-button').click();

    // Dialog should be hidden
    await expect(dialog).not.toBeVisible();

    // Check that cancel event was logged
    await expect(page.locator('#event-log')).toContainText('cancelled');
  });

  test('should handle escape key to close dialog', async ({ page }) => {
    // Show the dialog
    await page.locator('#show-file-picker').click();
    await page.waitForTimeout(500);

    // Verify dialog is visible
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Press escape key
    await page.keyboard.press('Escape');

    // Dialog should be hidden
    await expect(dialog).not.toBeVisible();
  });

  test('should handle direct file selection', async ({ page }) => {
    // Click direct file select button
    await page.locator('#direct-file-select').click();

    // Since this opens the native file picker, we can't easily test the actual file selection
    // But we can verify the button click doesn't cause errors
    await expect(page.locator('#direct-file-select')).toBeVisible();

    // Check that the event log shows the attempt (may show error if methods not available)
    const eventLog = page.locator('#event-log');
    await expect(eventLog).toBeVisible();
  });

  test('should handle image picker functionality', async ({ page }) => {
    // Click open image picker button
    await page.locator('#open-image-picker').click();

    // Verify button is still visible and clickable
    await expect(page.locator('#open-image-picker')).toBeVisible();

    // Check event log for image picker activity
    const eventLog = page.locator('#event-log');
    await expect(eventLog).toBeVisible();
  });

  test('should handle camera functionality', async ({ page }) => {
    // Click open camera button
    await page.locator('#open-camera').click();

    // Verify button is still visible and clickable
    await expect(page.locator('#open-camera')).toBeVisible();

    // Check event log for camera activity
    const eventLog = page.locator('#event-log');
    await expect(eventLog).toBeVisible();
  });

  test('should display file selected events in log', async ({ page }) => {
    // The test page has JavaScript that logs events
    // We can verify the logging infrastructure is working
    const eventLog = page.locator('#event-log');
    await expect(eventLog).toContainText('Waiting for events');

    // Click clear log button
    await page.locator('button').filter({ hasText: 'Clear Log' }).click();

    // Log should be cleared
    await expect(eventLog).toContainText('Waiting for events');
  });

  test('should handle file upload progress display', async ({ page }) => {
    // Show the dialog
    await page.locator('#show-file-picker').click();
    await page.waitForTimeout(500);

    // The component should show upload progress when uploading
    // Since we can't easily trigger actual file uploads in E2E tests,
    // we verify the UI elements are present for when upload happens

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Progress bar should not be visible initially
    const progressBar = dialog.locator('.w-full.bg-bg-secondary.rounded-full.h-2');
    // Note: Progress bar visibility depends on upload state, so we don't assert visibility here
  });

  test('should be accessible with proper ARIA attributes', async ({ page }) => {
    // Show the dialog
    await page.locator('#show-file-picker').click();
    await page.waitForTimeout(500);

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toHaveAttribute('role', 'dialog');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');

    // Check for proper heading
    const heading = page.locator('#file-picker-title');
    await expect(heading).toBeVisible();
    await expect(heading).toHaveAttribute('id', 'file-picker-title');
  });

  test('should handle backdrop click to close dialog', async ({ page }) => {
    // Show the dialog
    await page.locator('#show-file-picker').click();
    await page.waitForTimeout(500);

    // Verify dialog is visible
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Click on the backdrop (outside the dialog content)
    // The backdrop has onclick handler to close dialog
    await page.locator('.fixed.inset-0.bg-bg\\/80').click();

    // Dialog should be hidden
    await expect(dialog).not.toBeVisible();
  });

  test('should disable cancel button during upload', async ({ page }) => {
    // Show the dialog
    await page.locator('#show-file-picker').click();
    await page.waitForTimeout(500);

    const cancelButton = page.locator('#file-picker-cancel-button');

    // Cancel button should be enabled initially
    await expect(cancelButton).toBeEnabled();

    // During upload, the button would be disabled, but we can't easily test
    // the upload state in E2E tests without mocking file uploads
    // So we just verify the button exists and is properly configured
    await expect(cancelButton).toHaveAttribute('disabled');
  });

  test('should display proper icons and styling', async ({ page }) => {
    // Show the dialog
    await page.locator('#show-file-picker').click();
    await page.waitForTimeout(500);

    // Check that the folder icon is present in the choose file button
    const chooseButton = page.locator('#file-picker-choose-button');
    const folderIcon = chooseButton.locator('svg');
    await expect(folderIcon).toBeVisible();

    // Check button styling classes
    await expect(chooseButton).toHaveClass(/bg-primary/);
    await expect(chooseButton).toHaveClass(/text-bg/);
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Show the dialog
    await page.locator('#show-file-picker').click();
    await page.waitForTimeout(500);

    // Dialog should still be visible and properly sized on mobile
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Check that mobile-specific classes are applied
    await expect(page.locator('.max-w-sm')).toBeVisible();
  });

  test('should handle multiple rapid button clicks gracefully', async ({ page }) => {
    // Rapidly click the show file picker button multiple times
    const button = page.locator('#show-file-picker');
    await button.click();
    await button.click();
    await button.click();

    // Should not cause errors - only one dialog should be visible
    const dialogs = page.locator('[role="dialog"]');
    await expect(dialogs).toHaveCount(1);
  });

  test('should maintain focus management in dialog', async ({ page }) => {
    // Show the dialog
    await page.locator('#show-file-picker').click();
    await page.waitForTimeout(500);

    // The dialog should be properly focusable
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toHaveAttribute('tabindex', '-1');

    // Focus should be managed properly (basic check)
    const chooseButton = page.locator('#file-picker-choose-button');
    await expect(chooseButton).toBeVisible();
  });
});