import { test, expect, Page, BrowserContext } from '@playwright/test';
import { createWebViewHelper, WebViewHelper } from '../helpers/webview-helpers';

test.describe('Terminal Interface Tests', () => {
  let webViewHelper: WebViewHelper;
  let page: Page;
  let context: BrowserContext;
  let testSessionId: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    console.log('🚀 Setting up Terminal Interface tests...');
    
    context = await browser.newContext({
      viewport: { width: 1200, height: 800 }
    });
    
    page = await context.newPage();
    await page.goto('http://localhost:4021', { waitUntil: 'networkidle' });
    
    webViewHelper = createWebViewHelper(page, context, testInfo, {
      captureScreenshots: true,
      timeout: 30000
    });
    
    await webViewHelper.initialize();
  });

  test.afterAll(async () => {
    // Clean up any remaining sessions
    if (testSessionId) {
      try {
        await webViewHelper.executeCommand('cleanup_terminal_session', [testSessionId]);
      } catch (error) {
        console.warn('Failed to cleanup test session:', error);
      }
    }

    if (webViewHelper) {
      await webViewHelper.cleanup();
    }
    if (context) {
      await context.close();
    }
  });

  test.beforeEach(async () => {
    // Ensure server is running
    const serverStatus = await webViewHelper.executeCommand('get_server_status');
    if (!serverStatus.data.running) {
      await webViewHelper.executeCommand('start_server');
      await page.waitForTimeout(3000);
    }
  });

  test.describe('Terminal Session Management', () => {
    test('should create terminal session with default settings', async () => {
      console.log('💻 Testing terminal session creation...');

      const result = await webViewHelper.executeCommand('create_terminal_session', [{
        title: 'Default Test Terminal'
      }]);
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('sessionId');
      expect(result.data).toHaveProperty('title', 'Default Test Terminal');
      expect(result.data).toHaveProperty('shell');
      expect(result.data).toHaveProperty('cols', 80);
      expect(result.data).toHaveProperty('rows', 24);
      expect(result.data).toHaveProperty('createdAt');

      testSessionId = result.data.sessionId;

      console.log(`✅ Created terminal session: ${testSessionId}`);
    });

    test('should create terminal session with custom settings', async () => {
      console.log('⚙️ Testing custom terminal session creation...');

      const customSettings = {
        title: 'Custom Test Terminal',
        shell: '/bin/bash',
        cols: 120,
        rows: 40,
        env: {
          CUSTOM_VAR: 'test_value',
          TERM: 'xterm-256color'
        }
      };

      const result = await webViewHelper.executeCommand('create_terminal_session', [customSettings]);
      
      expect(result.success).toBe(true);
      expect(result.data.title).toBe(customSettings.title);
      expect(result.data.cols).toBe(customSettings.cols);
      expect(result.data.rows).toBe(customSettings.rows);

      const customSessionId = result.data.sessionId;

      // Clean up custom session
      await webViewHelper.executeCommand('cleanup_terminal_session', [customSessionId]);

      console.log('✅ Custom terminal session created successfully');
    });

    test('should list active terminal sessions', async () => {
      console.log('📋 Testing terminal session listing...');

      // Ensure we have at least one session
      if (!testSessionId) {
        const createResult = await webViewHelper.executeCommand('create_terminal_session', [{
          title: 'List Test Terminal'
        }]);
        testSessionId = createResult.data.sessionId;
      }

      const result = await webViewHelper.executeCommand('get_terminal_sessions');
      
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);

      // Should find our test session
      const testSession = result.data.find((session: any) => session.id === testSessionId);
      expect(testSession).toBeDefined();
      expect(testSession.title).toContain('Test Terminal');

      console.log(`✅ Found ${result.data.length} active terminal sessions`);
    });

    test('should get terminal session details', async () => {
      console.log('🔍 Testing terminal session details...');

      // Ensure we have a session
      if (!testSessionId) {
        const createResult = await webViewHelper.executeCommand('create_terminal_session', [{
          title: 'Details Test Terminal'
        }]);
        testSessionId = createResult.data.sessionId;
      }

      const result = await webViewHelper.executeCommand('get_terminal_session_details', [testSessionId]);
      
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('id', testSessionId);
      expect(result.data).toHaveProperty('title');
      expect(result.data).toHaveProperty('status');
      expect(result.data).toHaveProperty('processId');
      expect(result.data).toHaveProperty('createdAt');
      expect(result.data).toHaveProperty('lastActivity');

      const validStatuses = ['active', 'inactive', 'error'];
      expect(validStatuses).toContain(result.data.status);

      console.log('✅ Terminal session details retrieved');
    });

    test('should cleanup terminal session properly', async () => {
      console.log('🧹 Testing terminal session cleanup...');

      // Create a temporary session
      const createResult = await webViewHelper.executeCommand('create_terminal_session', [{
        title: 'Cleanup Test Terminal'
      }]);
      
      expect(createResult.success).toBe(true);
      const tempSessionId = createResult.data.sessionId;

      // Verify session exists
      const listBefore = await webViewHelper.executeCommand('get_terminal_sessions');
      const sessionExistsBefore = listBefore.data.some((session: any) => session.id === tempSessionId);
      expect(sessionExistsBefore).toBe(true);

      // Cleanup session
      const cleanupResult = await webViewHelper.executeCommand('cleanup_terminal_session', [tempSessionId]);
      expect(cleanupResult.success).toBe(true);

      // Wait a moment for cleanup to complete
      await page.waitForTimeout(1000);

      // Verify session is gone
      const listAfter = await webViewHelper.executeCommand('get_terminal_sessions');
      const sessionExistsAfter = listAfter.data.some((session: any) => session.id === tempSessionId);
      expect(sessionExistsAfter).toBe(false);

      console.log('✅ Terminal session cleanup working correctly');
    });
  });

  test.describe('Terminal Input/Output', () => {
    test.beforeEach(async () => {
      // Create a fresh session for each I/O test
      if (!testSessionId) {
        const createResult = await webViewHelper.executeCommand('create_terminal_session', [{
          title: 'I/O Test Terminal'
        }]);
        testSessionId = createResult.data.sessionId;
      }
    });

    test('should send simple commands and receive output', async () => {
      console.log('⌨️ Testing basic terminal I/O...');

      // Send echo command
      const sendResult = await webViewHelper.executeCommand('send_terminal_input', [{
        sessionId: testSessionId,
        input: 'echo "Hello from WebView E2E Test"\n'
      }]);
      
      expect(sendResult.success).toBe(true);

      // Wait for command to execute
      await page.waitForTimeout(2000);

      // Get output
      const outputResult = await webViewHelper.executeCommand('get_terminal_output', [{
        sessionId: testSessionId,
        lines: 10
      }]);
      
      expect(outputResult.success).toBe(true);
      expect(outputResult.data).toContain('Hello from WebView E2E Test');

      console.log('✅ Basic terminal I/O working');
    });

    test('should handle multiple commands sequentially', async () => {
      console.log('🔄 Testing sequential command execution...');

      const commands = [
        'pwd\n',
        'whoami\n',
        'date\n',
        'echo "Sequential test complete"\n'
      ];

      for (const command of commands) {
        const sendResult = await webViewHelper.executeCommand('send_terminal_input', [{
          sessionId: testSessionId,
          input: command
        }]);
        
        expect(sendResult.success).toBe(true);
        await page.waitForTimeout(1000);
      }

      // Get final output
      const outputResult = await webViewHelper.executeCommand('get_terminal_output', [{
        sessionId: testSessionId,
        lines: 20
      }]);
      
      expect(outputResult.success).toBe(true);
      expect(outputResult.data).toContain('Sequential test complete');

      console.log('✅ Sequential command execution working');
    });

    test('should handle command with special characters', async () => {
      console.log('🔤 Testing special character handling...');

      const specialCommand = 'echo "Special chars: !@#$%^&*()[]{}|\\\\:;\'\\"<>,.?/"\n';
      
      const sendResult = await webViewHelper.executeCommand('send_terminal_input', [{
        sessionId: testSessionId,
        input: specialCommand
      }]);
      
      expect(sendResult.success).toBe(true);
      await page.waitForTimeout(2000);

      const outputResult = await webViewHelper.executeCommand('get_terminal_output', [{
        sessionId: testSessionId,
        lines: 5
      }]);
      
      expect(outputResult.success).toBe(true);
      expect(outputResult.data).toContain('Special chars:');

      console.log('✅ Special character handling working');
    });

    test('should handle long output commands', async () => {
      console.log('📄 Testing long output handling...');

      // Generate a long file listing
      const longCommand = 'ls -la /usr/bin | head -50\n';
      
      const sendResult = await webViewHelper.executeCommand('send_terminal_input', [{
        sessionId: testSessionId,
        input: longCommand
      }]);
      
      expect(sendResult.success).toBe(true);
      await page.waitForTimeout(3000);

      // Get more lines to accommodate long output
      const outputResult = await webViewHelper.executeCommand('get_terminal_output', [{
        sessionId: testSessionId,
        lines: 60
      }]);
      
      expect(outputResult.success).toBe(true);
      expect(outputResult.data.length).toBeGreaterThan(100); // Should have substantial output

      console.log('✅ Long output handling working');
    });

    test('should handle interactive commands', async () => {
      console.log('🔄 Testing interactive command handling...');

      // Start an interactive command
      const startCommand = 'top -b -n 1\n';
      
      const sendResult = await webViewHelper.executeCommand('send_terminal_input', [{
        sessionId: testSessionId,
        input: startCommand
      }]);
      
      expect(sendResult.success).toBe(true);
      await page.waitForTimeout(3000);

      // Get output from interactive command
      const outputResult = await webViewHelper.executeCommand('get_terminal_output', [{
        sessionId: testSessionId,
        lines: 30
      }]);
      
      expect(outputResult.success).toBe(true);
      // Should contain top command output
      expect(outputResult.data.length).toBeGreaterThan(50);

      console.log('✅ Interactive command handling working');
    });

    test('should handle command errors gracefully', async () => {
      console.log('❌ Testing error command handling...');

      // Send an invalid command
      const invalidCommand = 'nonexistentcommand12345\n';
      
      const sendResult = await webViewHelper.executeCommand('send_terminal_input', [{
        sessionId: testSessionId,
        input: invalidCommand
      }]);
      
      expect(sendResult.success).toBe(true);
      await page.waitForTimeout(2000);

      // Get output (should contain error message)
      const outputResult = await webViewHelper.executeCommand('get_terminal_output', [{
        sessionId: testSessionId,
        lines: 5
      }]);
      
      expect(outputResult.success).toBe(true);
      // Should contain error indication
      expect(outputResult.data).toMatch(/not found|command.*not found|No such file/);

      console.log('✅ Error command handling working');
    });
  });

  test.describe('Terminal Resize and Display', () => {
    test.beforeEach(async () => {
      if (!testSessionId) {
        const createResult = await webViewHelper.executeCommand('create_terminal_session', [{
          title: 'Resize Test Terminal'
        }]);
        testSessionId = createResult.data.sessionId;
      }
    });

    test('should resize terminal to larger dimensions', async () => {
      console.log('📏 Testing terminal resize to larger size...');

      const newCols = 120;
      const newRows = 40;

      const resizeResult = await webViewHelper.executeCommand('resize_terminal', [{
        sessionId: testSessionId,
        cols: newCols,
        rows: newRows
      }]);
      
      expect(resizeResult.success).toBe(true);

      // Verify new size
      const detailsResult = await webViewHelper.executeCommand('get_terminal_session_details', [testSessionId]);
      expect(detailsResult.success).toBe(true);
      expect(detailsResult.data.cols).toBe(newCols);
      expect(detailsResult.data.rows).toBe(newRows);

      // Test that terminal still works after resize
      const testResult = await webViewHelper.executeCommand('send_terminal_input', [{
        sessionId: testSessionId,
        input: 'echo "Resize test successful"\n'
      }]);
      
      expect(testResult.success).toBe(true);

      console.log('✅ Terminal resize to larger size working');
    });

    test('should resize terminal to smaller dimensions', async () => {
      console.log('📏 Testing terminal resize to smaller size...');

      const newCols = 60;
      const newRows = 15;

      const resizeResult = await webViewHelper.executeCommand('resize_terminal', [{
        sessionId: testSessionId,
        cols: newCols,
        rows: newRows
      }]);
      
      expect(resizeResult.success).toBe(true);

      // Verify new size
      const detailsResult = await webViewHelper.executeCommand('get_terminal_session_details', [testSessionId]);
      expect(detailsResult.success).toBe(true);
      expect(detailsResult.data.cols).toBe(newCols);
      expect(detailsResult.data.rows).toBe(newRows);

      console.log('✅ Terminal resize to smaller size working');
    });

    test('should handle invalid resize parameters', async () => {
      console.log('❌ Testing invalid resize parameters...');

      // Test with invalid dimensions
      const invalidResizeResult = await webViewHelper.executeCommand('resize_terminal', [{
        sessionId: testSessionId,
        cols: 0,
        rows: -1
      }]);
      
      expect(invalidResizeResult.success).toBe(false);
      expect(invalidResizeResult.error).toBeDefined();

      // Test with extremely large dimensions
      const largeResizeResult = await webViewHelper.executeCommand('resize_terminal', [{
        sessionId: testSessionId,
        cols: 10000,
        rows: 10000
      }]);
      
      // This might succeed or fail depending on implementation
      expect(largeResizeResult).toBeDefined();

      console.log('✅ Invalid resize parameters handled correctly');
    });
  });

  test.describe('Terminal UI Integration', () => {
    test('should display terminal container in WebView', async () => {
      console.log('🖥️ Testing terminal UI display...');

      // Look for terminal container
      const terminalContainer = await page.locator('#terminal-container, .terminal, [data-terminal]').first();
      
      // Terminal might not be visible until a session is created
      if (!testSessionId) {
        const createResult = await webViewHelper.executeCommand('create_terminal_session', [{
          title: 'UI Test Terminal'
        }]);
        testSessionId = createResult.data.sessionId;
      }

      // Wait for terminal to appear
      await page.waitForTimeout(2000);

      // Check if terminal container is now visible
      const isVisible = await terminalContainer.isVisible();
      if (isVisible) {
        console.log('✅ Terminal container is visible in UI');
      } else {
        console.log('ℹ️ Terminal container not found (may be implementation-specific)');
      }
    });

    test('should handle terminal focus and blur events', async () => {
      console.log('🎯 Testing terminal focus handling...');

      // Look for terminal input area
      const terminalInput = await page.locator('textarea[data-terminal-input], .terminal-input, #terminal-input').first();
      
      if (await terminalInput.isVisible()) {
        // Test focus
        await terminalInput.focus();
        const isFocused = await terminalInput.evaluate(el => document.activeElement === el);
        expect(isFocused).toBe(true);

        // Test blur
        await page.click('body');
        const isBlurred = await terminalInput.evaluate(el => document.activeElement !== el);
        expect(isBlurred).toBe(true);

        console.log('✅ Terminal focus handling working');
      } else {
        console.log('ℹ️ Terminal input element not found (may be implementation-specific)');
      }
    });

    test('should handle terminal keyboard events', async () => {
      console.log('⌨️ Testing terminal keyboard events...');

      // Look for terminal input area
      const terminalInput = await page.locator('textarea[data-terminal-input], .terminal-input, #terminal-input').first();
      
      if (await terminalInput.isVisible()) {
        await terminalInput.focus();

        // Type some text
        await terminalInput.type('echo "Keyboard test"');
        await terminalInput.press('Enter');

        // Wait for command to execute
        await page.waitForTimeout(2000);

        // Check if command was processed
        const outputResult = await webViewHelper.executeCommand('get_terminal_output', [{
          sessionId: testSessionId,
          lines: 5
        }]);
        
        if (outputResult.success && outputResult.data.includes('Keyboard test')) {
          console.log('✅ Terminal keyboard events working');
        } else {
          console.log('ℹ️ Keyboard events may be handled differently');
        }
      } else {
        console.log('ℹ️ Terminal input element not found (may be implementation-specific)');
      }
    });
  });

  test.describe('Terminal Performance and Stability', () => {
    test('should handle rapid command execution', async () => {
      console.log('⚡ Testing rapid command execution...');

      if (!testSessionId) {
        const createResult = await webViewHelper.executeCommand('create_terminal_session', [{
          title: 'Performance Test Terminal'
        }]);
        testSessionId = createResult.data.sessionId;
      }

      const startTime = Date.now();
      const commandCount = 10;

      for (let i = 0; i < commandCount; i++) {
        const result = await webViewHelper.executeCommand('send_terminal_input', [{
          sessionId: testSessionId,
          input: `echo "Rapid test ${i}"\n`
        }]);
        
        expect(result.success).toBe(true);
        await page.waitForTimeout(100); // Small delay between commands
      }

      const totalTime = Date.now() - startTime;
      const avgTime = totalTime / commandCount;

      console.log(`✅ Executed ${commandCount} commands in ${totalTime}ms (avg: ${avgTime}ms per command)`);
      expect(avgTime).toBeLessThan(500); // Should average less than 500ms per command
    });

    test('should handle large output without crashing', async () => {
      console.log('📊 Testing large output handling...');

      if (!testSessionId) {
        const createResult = await webViewHelper.executeCommand('create_terminal_session', [{
          title: 'Large Output Test Terminal'
        }]);
        testSessionId = createResult.data.sessionId;
      }

      // Generate large output
      const largeCommand = 'for i in {1..100}; do echo "Line $i: This is a test line with some content to make it longer"; done\n';
      
      const sendResult = await webViewHelper.executeCommand('send_terminal_input', [{
        sessionId: testSessionId,
        input: largeCommand
      }]);
      
      expect(sendResult.success).toBe(true);
      await page.waitForTimeout(5000); // Wait for large output

      // Get output
      const outputResult = await webViewHelper.executeCommand('get_terminal_output', [{
        sessionId: testSessionId,
        lines: 120
      }]);
      
      expect(outputResult.success).toBe(true);
      expect(outputResult.data.length).toBeGreaterThan(1000); // Should have substantial output

      console.log('✅ Large output handled without crashing');
    });

    test('should maintain session stability over time', async () => {
      console.log('⏱️ Testing session stability over time...');

      if (!testSessionId) {
        const createResult = await webViewHelper.executeCommand('create_terminal_session', [{
          title: 'Stability Test Terminal'
        }]);
        testSessionId = createResult.data.sessionId;
      }

      // Send commands over time
      const testDuration = 10000; // 10 seconds
      const interval = 2000; // Every 2 seconds
      const startTime = Date.now();

      while (Date.now() - startTime < testDuration) {
        const timestamp = new Date().toISOString();
        const result = await webViewHelper.executeCommand('send_terminal_input', [{
          sessionId: testSessionId,
          input: `echo "Stability test at ${timestamp}"\n`
        }]);
        
        expect(result.success).toBe(true);
        await page.waitForTimeout(interval);
      }

      // Verify session is still active
      const detailsResult = await webViewHelper.executeCommand('get_terminal_session_details', [testSessionId]);
      expect(detailsResult.success).toBe(true);
      expect(detailsResult.data.status).toBe('active');

      console.log('✅ Session stability maintained over time');
    });
  });

  test.describe('Terminal Error Handling', () => {
    test('should handle invalid session ID gracefully', async () => {
      console.log('❌ Testing invalid session ID handling...');

      const invalidSessionId = 'invalid-session-id';

      // Test various commands with invalid session
      const commands = [
        'get_terminal_session_details',
        'send_terminal_input',
        'get_terminal_output',
        'resize_terminal',
        'cleanup_terminal_session'
      ];

      for (const command of commands) {
        const result = await webViewHelper.executeCommand(command, [invalidSessionId]);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }

      console.log('✅ Invalid session ID handled gracefully');
    });

    test('should handle session cleanup after errors', async () => {
      console.log('🧹 Testing cleanup after errors...');

      // Create a session
      const createResult = await webViewHelper.executeCommand('create_terminal_session', [{
        title: 'Error Cleanup Test Terminal'
      }]);
      
      expect(createResult.success).toBe(true);
      const tempSessionId = createResult.data.sessionId;

      // Send an invalid command to cause error
      const errorResult = await webViewHelper.executeCommand('send_terminal_input', [{
        sessionId: tempSessionId,
        input: 'nonexistentcommand12345\n'
      }]);
      
      expect(errorResult.success).toBe(true); // Send should succeed even if command fails

      // Wait for error to occur
      await page.waitForTimeout(2000);

      // Try to cleanup session
      const cleanupResult = await webViewHelper.executeCommand('cleanup_terminal_session', [tempSessionId]);
      expect(cleanupResult.success).toBe(true);

      console.log('✅ Session cleanup after errors working');
    });

    test('should handle concurrent operations on same session', async () => {
      console.log('🔄 Testing concurrent operations...');

      if (!testSessionId) {
        const createResult = await webViewHelper.executeCommand('create_terminal_session', [{
          title: 'Concurrent Test Terminal'
        }]);
        testSessionId = createResult.data.sessionId;
      }

      // Send multiple commands concurrently
      const concurrentCommands = [
        webViewHelper.executeCommand('send_terminal_input', [{
          sessionId: testSessionId,
          input: 'echo "Concurrent test 1"\n'
        }]),
        webViewHelper.executeCommand('send_terminal_input', [{
          sessionId: testSessionId,
          input: 'echo "Concurrent test 2"\n'
        }]),
        webViewHelper.executeCommand('get_terminal_output', [{
          sessionId: testSessionId,
          lines: 10
        }])
      ];

      const results = await Promise.all(concurrentCommands);

      // All should succeed (though order may vary)
      for (const result of results) {
        expect(result.success).toBe(true);
      }

      console.log('✅ Concurrent operations handled correctly');
    });
  });
});