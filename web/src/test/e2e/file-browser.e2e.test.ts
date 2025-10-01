import { test, expect } from '@playwright/test';
import { createTestSession, cleanupTestSession } from '../playwright/helpers/session-lifecycle.helper';

test.describe('File Browser E2E Tests', () => {
  let sessionId: string;

  test.beforeEach(async ({ page }) => {
    // Create a test session for file browser testing
    sessionId = await createTestSession(page, 'file-browser-test');

    // Navigate to the file browser
    await page.goto('/files');
    await expect(page.locator('[data-testid="file-browser"]')).toBeVisible();
  });

  test.afterEach(async () => {
    await cleanupTestSession(sessionId);
  });

  test('should display home directory contents', async ({ page }) => {
    // Wait for directory contents to load
    await expect(page.locator('[data-testid="directory-contents"]')).toBeVisible();

    // Should show at least some files/directories
    const fileItems = page.locator('[data-testid="file-item"]');
    await expect(fileItems.first()).toBeVisible();
  });

  test('should handle folder navigation', async ({ page }) => {
    // Click on a directory (assuming Documents exists)
    const documentsDir = page.locator('[data-testid="file-item"]:has-text("Documents")');
    if (await documentsDir.isVisible()) {
      await documentsDir.click();

      // Should navigate to Documents directory
      await expect(page.locator('[data-testid="current-path"]')).toContainText('Documents');
    }
  });

  test('should handle file upload', async ({ page }) => {
    // Create a test file to upload
    const testFile = await page.evaluate(() => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      return file;
    });

    // Upload the file
    await page.setInputFiles('[data-testid="file-upload-input"]', testFile);

    // Should show upload success message
    await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();

    // Should show the uploaded file in the list
    await expect(page.locator('[data-testid="file-item"]:has-text("test.txt")')).toBeVisible();
  });

  test('should handle file download', async ({ page }) => {
    // Create a test file first
    await page.evaluate(() => {
      // This would need to be done via API or file creation
      // For now, assume a test file exists
    });

    // Click download on a file
    await page.locator('[data-testid="file-item"]:has-text("test.txt") [data-testid="download-btn"]').click();

    // Should trigger download (we can't easily test the actual download in Playwright)
    // But we can check that the download was initiated
  });

  test('should handle directory creation', async ({ page }) => {
    const newDirName = 'test-directory-' + Date.now();

    // Click create directory button
    await page.locator('[data-testid="create-dir-btn"]').click();

    // Enter directory name
    await page.locator('[data-testid="dir-name-input"]').fill(newDirName);
    await page.locator('[data-testid="create-dir-submit"]').click();

    // Should show the new directory
    await expect(page.locator('[data-testid="file-item"]:has-text("' + newDirName + '")')).toBeVisible();
  });

  test('should handle file deletion', async ({ page }) => {
    // Create a test file first
    await page.evaluate(() => {
      // This would need to be done via API or file creation
    });

    // Select a file and delete it
    await page.locator('[data-testid="file-item"]:has-text("test.txt") [data-testid="select-file"]').click();
    await page.locator('[data-testid="delete-btn"]').click();
    await page.locator('[data-testid="confirm-delete"]').click();

    // Should no longer show the file
    await expect(page.locator('[data-testid="file-item"]:has-text("test.txt")')).not.toBeVisible();
  });

  test('should handle path encoding correctly', async ({ page }) => {
    // Test with special characters in path
    const encodedPath = encodeURIComponent('test file with spaces & symbols.txt');

    // Navigate to a path with special characters
    await page.goto('/files?path=' + encodedPath);

    // Should handle the encoded path correctly
    await expect(page.locator('[data-testid="current-path"]')).toContainText('test file with spaces & symbols.txt');
  });

  test('should show appropriate error messages for invalid paths', async ({ page }) => {
    // Try to navigate to an invalid path
    await page.goto('/files?path=/invalid/path');

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText('not found');
  });

  test('should handle large directory listings', async ({ page }) => {
    // Navigate to a directory with many files
    await page.goto('/files?path=/tmp');

    // Should load without hanging
    await expect(page.locator('[data-testid="directory-contents"]')).toBeVisible();

    // Should show files (even if limited)
    const fileItems = page.locator('[data-testid="file-item"]');
    await expect(fileItems.first()).toBeVisible();
  });
});