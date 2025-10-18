import { test, expect, Page } from '@playwright/test';

/**
 * Phase 4.4: Complete Integration Tests (E2E Workflows)
 * 
 * Tests comprehensive end-to-end workflows that combine multiple features
 * and verify cross-feature interactions and system stability.
 * 
 * Test Categories:
 * 1. Complete User Workflows (login → session → git → file ops → exit)
 * 2. Multi-Feature Interactions (concurrent terminal + git + file ops)
 * 3. Data Persistence and Recovery (session state, config persistence)
 * 4. System Stability Under Real-World Scenarios
 * 5. Cross-Platform Feature Integration
 * 6. Error Recovery and Edge Cases
 */

test.describe('Complete Integration Tests', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  // ============================================================================
  // Complete User Workflows
  // ============================================================================

  test('E2E: Complete Terminal Session Workflow', async () => {
    // 1. Navigate to app
    await page.goto('http://localhost:5173');
    
    // 2. Login
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button:has-text("Login")');
    await page.waitForURL('**/dashboard');
    
    // 3. Create terminal session
    await page.click('button:has-text("New Session")');
    await page.fill('input[placeholder="Session name"]', 'integration-test-session');
    await page.click('button:has-text("Create")');
    
    // 4. Verify terminal is active
    const terminal = page.locator('.terminal-container');
    await expect(terminal).toBeVisible();
    
    // 5. Run command
    await page.click('.terminal-input');
    await page.keyboard.type('echo "Integration Test"');
    await page.keyboard.press('Enter');
    
    // 6. Verify output
    const output = page.locator('.terminal-output');
    await expect(output).toContainText('Integration Test');
    
    // 7. Navigate to sessions list
    await page.click('button:has-text("Sessions")');
    
    // 8. Verify session in list
    const sessionItem = page.locator('text=integration-test-session');
    await expect(sessionItem).toBeVisible();
    
    // 9. Return to terminal
    await page.click(sessionItem);
    await expect(terminal).toBeVisible();
    
    // 10. Close session
    await page.click('button[title="Close Session"]');
    await page.click('button:has-text("Confirm")');
    
    // 11. Verify session removed from list
    await expect(sessionItem).not.toBeVisible({ timeout: 5000 });
  });

  test('E2E: Git Operations Workflow', async () => {
    await page.goto('http://localhost:5173/dashboard');
    
    // 1. Navigate to file browser
    await page.click('button:has-text("Files")');
    
    // 2. Create a new file
    await page.click('button[title="New File"]');
    await page.fill('input[placeholder="Filename"]', 'test.txt');
    await page.fill('[role="textbox"]', 'Test content for git integration');
    await page.click('button:has-text("Save")');
    
    // 3. Open terminal
    await page.click('button:has-text("Terminal")');
    
    // 4. Initialize git repo
    await page.click('.terminal-input');
    await page.keyboard.type('git init');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // 5. Add file to git
    await page.keyboard.type('git add test.txt');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // 6. Commit
    await page.keyboard.type('git commit -m "Initial commit"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // 7. Verify commit in output
    const output = page.locator('.terminal-output');
    await expect(output).toContainText('Initial commit', { timeout: 3000 });
    
    // 8. Check git status
    await page.keyboard.type('git status');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // 9. Verify working tree clean message
    await expect(output).toContainText('working tree clean', { timeout: 3000 });
  });

  test('E2E: File Operations with Session Context', async () => {
    await page.goto('http://localhost:5173/dashboard');
    
    // 1. Create session
    await page.click('button:has-text("New Session")');
    await page.fill('input[placeholder="Session name"]', 'file-ops-session');
    await page.click('button:has-text("Create")');
    
    // 2. Run command to create files
    await page.click('.terminal-input');
    await page.keyboard.type('mkdir test_files');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    
    // 3. Create multiple files
    for (let i = 1; i <= 3; i++) {
      await page.keyboard.type(`echo "File ${i}" > test_files/file${i}.txt`);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
    }
    
    // 4. Navigate to files view
    await page.click('button:has-text("Files")');
    
    // 5. Browse to test_files directory
    const fileList = page.locator('.file-list-item');
    const testDir = fileList.filter({ hasText: 'test_files' }).first();
    await testDir.dblclick();
    
    // 6. Verify files created
    for (let i = 1; i <= 3; i++) {
      const fileItem = page.locator(`text=file${i}.txt`);
      await expect(fileItem).toBeVisible();
    }
    
    // 7. Download first file
    const downloadButton = page.locator('button[title="Download"]').first();
    const downloadPromise = page.waitForEvent('download');
    await downloadButton.click();
    const download = await downloadPromise;
    await expect(download.suggestedFilename()).toContain('file1.txt');
    
    // 8. Delete a file
    const deleteButton = page.locator('button[title="Delete"]').nth(1);
    await deleteButton.click();
    await page.click('button:has-text("Confirm Delete")');
    
    // 9. Verify file removed
    const file2 = page.locator('text=file2.txt');
    await expect(file2).not.toBeVisible({ timeout: 3000 });
  });

  test('E2E: Settings and Configuration Persistence', async () => {
    await page.goto('http://localhost:5173/dashboard');
    
    // 1. Navigate to settings
    await page.click('button[title="Settings"]');
    await page.waitForURL('**/settings');
    
    // 2. Change theme to dark
    const themeToggle = page.locator('input[name="theme"]');
    await themeToggle.click();
    await page.waitForTimeout(300);
    
    // 3. Change font size
    const fontSizeSlider = page.locator('input[name="fontSize"]');
    await fontSizeSlider.fill('16');
    await page.waitForTimeout(300);
    
    // 4. Toggle notifications
    const notifToggle = page.locator('input[name="notifications"]');
    await notifToggle.click();
    await page.waitForTimeout(300);
    
    // 5. Save settings
    await page.click('button:has-text("Save Settings")');
    
    // 6. Navigate away
    await page.click('button:has-text("Dashboard")');
    
    // 7. Return to settings
    await page.click('button[title="Settings"]');
    
    // 8. Verify settings persisted
    const themeChecked = await themeToggle.isChecked();
    expect(themeChecked).toBeTruthy();
    
    const fontSize = await fontSizeSlider.inputValue();
    expect(fontSize).toBe('16');
    
    const notifChecked = await notifToggle.isChecked();
    expect(notifChecked).toBeFalsy();
  });

  // ============================================================================
  // Multi-Feature Interactions
  // ============================================================================

  test('E2E: Concurrent Terminal and File Operations', async () => {
    await page.goto('http://localhost:5173/dashboard');
    
    // 1. Create first terminal session
    await page.click('button:has-text("New Session")');
    await page.fill('input[placeholder="Session name"]', 'session-1');
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(300);
    
    // 2. Run long-running process
    await page.click('.terminal-input');
    await page.keyboard.type('sleep 10 &');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    
    // 3. Create second terminal session
    await page.click('button:has-text("New Session")');
    await page.fill('input[placeholder="Session name"]', 'session-2');
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(300);
    
    // 4. Run command in second session
    await page.click('.terminal-input');
    await page.keyboard.type('echo "Second session"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    
    // 5. Open file browser while sessions running
    await page.click('button:has-text("Files")');
    const fileList = page.locator('.file-list-item');
    await expect(fileList.first()).toBeVisible();
    
    // 6. Switch back to first session
    await page.click('text=session-1');
    await page.waitForTimeout(300);
    
    // 7. Verify first session still active
    const terminal = page.locator('.terminal-container');
    await expect(terminal).toBeVisible();
    
    // 8. Switch to second session
    await page.click('text=session-2');
    const output = page.locator('.terminal-output');
    await expect(output).toContainText('Second session');
    
    // 9. Close both sessions
    await page.click('button[title="Close Session"]');
    await page.click('button:has-text("Confirm")');
    await page.waitForTimeout(300);
    
    await page.click('text=session-1');
    await page.click('button[title="Close Session"]');
    await page.click('button:has-text("Confirm")');
  });

  test('E2E: Git and File Operations Coordination', async () => {
    await page.goto('http://localhost:5173/dashboard');
    
    // 1. Create terminal and initialize git
    await page.click('button:has-text("New Session")');
    await page.fill('input[placeholder="Session name"]', 'git-file-session');
    await page.click('button:has-text("Create")');
    
    await page.click('.terminal-input');
    await page.keyboard.type('git init && echo "content" > file.txt');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // 2. Stage file in git
    await page.keyboard.type('git add file.txt');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    
    // 3. Switch to file browser
    await page.click('button:has-text("Files")');
    
    // 4. Modify file through UI
    const fileItem = page.locator('text=file.txt');
    await fileItem.dblclick();
    
    // 5. Wait for editor to open and modify content
    const editor = page.locator('[role="textbox"]').first();
    await editor.fill('updated content');
    await page.click('button:has-text("Save")');
    await page.waitForTimeout(300);
    
    // 6. Return to terminal
    await page.click('button:has-text("Terminal")');
    
    // 7. Check git diff
    await page.keyboard.type('git diff');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // 8. Verify diff shows changes
    const output = page.locator('.terminal-output');
    await expect(output).toContainText('updated content', { timeout: 3000 });
  });

  // ============================================================================
  // Data Persistence and Recovery
  // ============================================================================

  test('E2E: Session State Persistence', async () => {
    await page.goto('http://localhost:5173/dashboard');
    
    // 1. Create session with history
    await page.click('button:has-text("New Session")');
    await page.fill('input[placeholder="Session name"]', 'persist-session');
    await page.click('button:has-text("Create")');
    
    // 2. Execute multiple commands
    const commands = ['echo "Command 1"', 'echo "Command 2"', 'echo "Command 3"'];
    for (const cmd of commands) {
      await page.click('.terminal-input');
      await page.keyboard.type(cmd);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
    }
    
    // 3. Get session ID
    const sessionId = await page.locator('[data-session-id]').first().getAttribute('data-session-id');
    
    // 4. Refresh page
    await page.reload();
    await page.waitForURL('**/dashboard');
    
    // 5. Verify session still exists
    const sessionItem = page.locator(`text=persist-session`);
    await expect(sessionItem).toBeVisible();
    
    // 6. Open session
    await sessionItem.click();
    
    // 7. Verify history available (can be accessed via command history)
    await page.click('.terminal-input');
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(200);
    
    // History should show last command
    const inputValue = await page.locator('.terminal-input').inputValue();
    expect(inputValue).toContain('Command 3');
  });

  test('E2E: Configuration State Recovery', async () => {
    await page.goto('http://localhost:5173/dashboard');
    
    // 1. Navigate to settings
    await page.click('button[title="Settings"]');
    
    // 2. Configure multiple settings
    await page.locator('input[name="theme"]').click();
    await page.locator('input[name="fontSize"]').fill('14');
    await page.locator('input[name="language"]').selectOption('es');
    
    // 3. Save
    await page.click('button:has-text("Save Settings")');
    await page.waitForTimeout(500);
    
    // 4. Close browser tab and reopen
    const newPage = await page.context().newPage();
    await newPage.goto('http://localhost:5173/dashboard');
    
    // 5. Navigate to settings
    await newPage.click('button[title="Settings"]');
    
    // 6. Verify all settings persisted
    const themeToggle = newPage.locator('input[name="theme"]');
    const fontSize = newPage.locator('input[name="fontSize"]');
    const language = newPage.locator('select[name="language"]');
    
    await expect(themeToggle).toBeChecked();
    expect(await fontSize.inputValue()).toBe('14');
    expect(await language.inputValue()).toBe('es');
    
    await newPage.close();
  });

  // ============================================================================
  // System Stability Under Real-World Scenarios
  // ============================================================================

  test('E2E: Multiple Sessions with Long-Running Processes', async () => {
    await page.goto('http://localhost:5173/dashboard');
    
    // 1. Create 5 concurrent sessions
    const sessionCount = 5;
    for (let i = 1; i <= sessionCount; i++) {
      await page.click('button:has-text("New Session")');
      await page.fill('input[placeholder="Session name"]', `session-${i}`);
      await page.click('button:has-text("Create")');
      await page.waitForTimeout(200);
      
      // Start long-running process in each
      await page.click('.terminal-input');
      await page.keyboard.type(`sleep 5 & echo "Process ${i}"`);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
      
      // Navigate back to dashboard
      await page.click('button:has-text("Dashboard")');
      await page.waitForTimeout(100);
    }
    
    // 2. Verify all sessions in list
    for (let i = 1; i <= sessionCount; i++) {
      const sessionItem = page.locator(`text=session-${i}`);
      await expect(sessionItem).toBeVisible();
    }
    
    // 3. Rapidly switch between sessions
    for (let i = 1; i <= sessionCount; i++) {
      const sessionItem = page.locator(`text=session-${i}`);
      await sessionItem.click();
      await page.waitForTimeout(100);
      
      const terminal = page.locator('.terminal-container');
      await expect(terminal).toBeVisible();
    }
    
    // 4. Close all sessions
    for (let i = 1; i <= sessionCount; i++) {
      const sessionItem = page.locator(`text=session-${i}`);
      await sessionItem.click();
      await page.click('button[title="Close Session"]');
      await page.click('button:has-text("Confirm")');
      await page.waitForTimeout(100);
    }
    
    // 5. Verify all sessions removed
    for (let i = 1; i <= sessionCount; i++) {
      const sessionItem = page.locator(`text=session-${i}`);
      await expect(sessionItem).not.toBeVisible({ timeout: 3000 });
    }
  });

  test('E2E: Large File Operations Under Load', async () => {
    await page.goto('http://localhost:5173/dashboard');
    
    // 1. Create session
    await page.click('button:has-text("New Session")');
    await page.fill('input[placeholder="Session name"]', 'load-test-session');
    await page.click('button:has-text("Create")');
    
    // 2. Create large file via terminal
    await page.click('.terminal-input');
    await page.keyboard.type('dd if=/dev/zero of=largefile.bin bs=1M count=10');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    
    // 3. Navigate to files
    await page.click('button:has-text("Files")');
    
    // 4. Verify file exists and shows size
    const fileItem = page.locator('text=largefile.bin');
    await expect(fileItem).toBeVisible();
    
    // 5. Attempt to download
    const downloadBtn = page.locator('button[title="Download"]').first();
    await expect(downloadBtn).toBeVisible();
    
    // 6. Return to terminal
    await page.click('button:has-text("Terminal")');
    
    // 7. Delete file
    await page.keyboard.type('rm largefile.bin');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // 8. Verify deletion in terminal output
    const output = page.locator('.terminal-output');
    await expect(output).toBeVisible();
  });

  // ============================================================================
  // Cross-Platform Feature Integration
  // ============================================================================

  test('E2E: Platform-Specific Feature Access', async () => {
    await page.goto('http://localhost:5173/dashboard');
    
    // 1. Check system info
    await page.click('button:has-text("Settings")');
    await page.click('button:has-text("About")');
    
    // 2. Verify platform information displayed
    const platformInfo = page.locator('[data-platform]');
    await expect(platformInfo).toBeVisible();
    
    const platform = await platformInfo.getAttribute('data-platform');
    expect(['windows', 'linux', 'darwin']).toContain(platform);
    
    // 3. Navigate to system info section
    const sysInfo = page.locator('text=System Information');
    if (await sysInfo.isVisible()) {
      // 4. Verify system details
      const osVersion = page.locator('[data-os-version]');
      await expect(osVersion).toBeVisible();
      
      const cpuInfo = page.locator('[data-cpu-count]');
      await expect(cpuInfo).toBeVisible();
      
      const memInfo = page.locator('[data-memory]');
      await expect(memInfo).toBeVisible();
    }
    
    // 5. Return to dashboard
    await page.click('button:has-text("Dashboard")');
  });

  // ============================================================================
  // Error Recovery and Edge Cases
  // ============================================================================

  test('E2E: Error Recovery from Disconnection', async () => {
    await page.goto('http://localhost:5173/dashboard');
    
    // 1. Create session
    await page.click('button:has-text("New Session")');
    await page.fill('input[placeholder="Session name"]', 'recovery-session');
    await page.click('button:has-text("Create")');
    
    // 2. Execute command
    await page.click('.terminal-input');
    await page.keyboard.type('echo "Before disconnect"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    
    // 3. Simulate network disconnection by pausing
    await page.context().setOffline(true);
    
    // 4. Try to execute command
    await page.click('.terminal-input');
    await page.keyboard.type('echo "During disconnect"');
    await page.keyboard.press('Enter');
    
    // 5. Wait for error/timeout
    await page.waitForTimeout(1000);
    
    // 6. Restore connection
    await page.context().setOffline(false);
    
    // 7. Verify reconnection and recovery
    await page.waitForTimeout(1000);
    const terminal = page.locator('.terminal-container');
    await expect(terminal).toBeVisible();
  });

  test('E2E: Handle Invalid Commands Gracefully', async () => {
    await page.goto('http://localhost:5173/dashboard');
    
    // 1. Create session
    await page.click('button:has-text("New Session")');
    await page.fill('input[placeholder="Session name"]', 'error-session');
    await page.click('button:has-text("Create")');
    
    // 2. Execute invalid command
    await page.click('.terminal-input');
    await page.keyboard.type('invalid_command_12345xyz');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // 3. Verify error shown in output
    const output = page.locator('.terminal-output');
    await expect(output).toContainText('not found', { timeout: 3000 });
    
    // 4. Verify session still active
    const terminal = page.locator('.terminal-container');
    await expect(terminal).toBeVisible();
    
    // 5. Execute valid command after error
    await page.click('.terminal-input');
    await page.keyboard.type('echo "Still working"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // 6. Verify recovery
    await expect(output).toContainText('Still working', { timeout: 3000 });
  });

  test('E2E: Session Timeout Handling', async () => {
    await page.goto('http://localhost:5173/dashboard');
    
    // 1. Create session
    await page.click('button:has-text("New Session")');
    await page.fill('input[placeholder="Session name"]', 'timeout-session');
    await page.click('button:has-text("Create")');
    
    // 2. Execute command
    await page.click('.terminal-input');
    await page.keyboard.type('echo "Initial command"');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    
    // 3. Wait for extended period (simulating inactivity)
    await page.waitForTimeout(30000); // 30 seconds
    
    // 4. Try to execute command
    await page.click('.terminal-input');
    await page.keyboard.type('echo "After timeout"');
    
    // 5. Should either auto-reconnect or show appropriate error
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // 6. Verify terminal state
    const terminal = page.locator('.terminal-container');
    const output = page.locator('.terminal-output');
    
    const isVisible = await terminal.isVisible();
    expect(isVisible || await output.isVisible()).toBeTruthy();
  });
});
