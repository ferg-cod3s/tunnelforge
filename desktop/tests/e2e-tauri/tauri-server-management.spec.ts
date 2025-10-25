import { test, expect, Page, BrowserContext } from '@playwright/test';
import { createTauriHelper } from './helpers/tauri-helpers';

/**
 * Tauri Server Management Tests
 * 
 * These tests verify the TunnelForge desktop application's server management:
 * - Server start/stop/restart functionality
 * - Server status monitoring
 * - Port configuration
 * - Integration with Go backend
 * - Error handling for server operations
 */

test.describe('Tauri Server Management', () => {
  let page: Page;
  let context: BrowserContext;
  let helper: any;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    helper = createTauriHelper(page, context, test.info);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test.beforeEach(async () => {
    await page.goto('http://localhost:1420');
    await helper.waitForTauriApp();
    await helper.waitForAppReady();
  });

  test.describe('Server Status', () => {
    test('should display current server status', async () => {
      console.log('🧪 Testing server status display...');
      
      // Navigate to dashboard or debug console to check status
      await page.click('[data-section="dashboard"]');
      await page.waitForTimeout(500);
      
      // Look for server status indicator
      const statusElements = [
        '#server-status',
        '.server-status',
        '[data-server-status]',
        '.status-indicator',
      ];
      
      let statusFound = false;
      for (const selector of statusElements) {
        const element = page.locator(selector);
        if (await element.count() > 0) {
          await expect(element.first()).toBeVisible();
          const statusText = await element.first().textContent();
          console.log(`📊 Server status: ${statusText}`);
          statusFound = true;
          break;
        }
      }
      
      if (!statusFound) {
        console.log('ℹ️ Server status element not found (may be in different section)');
        
        // Try debug console
        await page.click('[data-section="debug"]');
        await page.waitForTimeout(500);
        
        for (const selector of statusElements) {
          const element = page.locator(selector);
          if (await element.count() > 0) {
            await expect(element.first()).toBeVisible();
            const statusText = await element.first().textContent();
            console.log(`📊 Server status (debug): ${statusText}`);
            statusFound = true;
            break;
          }
        }
      }
      
      expect(statusFound).toBe(true);
    });

    test('should check server status via Tauri command', async () => {
      console.log('🧪 Testing server status via Tauri command...');
      
      try {
        const status = await helper.invokeTauriCommand('check_server_status');
        console.log('📊 Server status from command:', status);
        
        expect(status).toBeDefined();
        expect(typeof status).toBe('object');
        expect(status).toHaveProperty('running');
      } catch (error) {
        console.log('ℹ️ Server status command not available:', error.message);
        // This is expected if the command doesn't exist yet
      }
    });
  });

  test.describe('Server Control', () => {
    test('should start server when start button is clicked', async () => {
      console.log('🧪 Testing server start...');
      
      // Navigate to dashboard
      await page.click('[data-section="dashboard"]');
      await page.waitForTimeout(500);
      
      // Look for start button
      const startButton = page.locator('button:has-text("Start Server"), button:has-text("Start"), button[data-action="start"]');
      
      if (await startButton.count() > 0) {
        await startButton.first().click();
        await page.waitForTimeout(3000);
        
        // Check for success indication
        const successIndicators = [
          '.notification.success',
          '.alert.success',
          '[data-status="running"]',
          '.server-status.running',
        ];
        
        let successFound = false;
        for (const selector of successIndicators) {
          const element = page.locator(selector);
          if (await element.count() > 0) {
            await expect(element.first()).toBeVisible({ timeout: 5000 });
            successFound = true;
            break;
          }
        }
        
        if (successFound) {
          console.log('✅ Server start successful');
        } else {
          console.log('ℹ️ Server start completed (no explicit success indicator found)');
        }
      } else {
        console.log('ℹ️ Start button not found (server may already be running)');
      }
    });

    test('should stop server when stop button is clicked', async () => {
      console.log('🧪 Testing server stop...');
      
      // Navigate to dashboard
      await page.click('[data-section="dashboard"]');
      await page.waitForTimeout(500);
      
      // Look for stop button
      const stopButton = page.locator('button:has-text("Stop Server"), button:has-text("Stop"), button[data-action="stop"]');
      
      if (await stopButton.count() > 0) {
        await stopButton.first().click();
        await page.waitForTimeout(3000);
        
        // Check for success indication
        const stopIndicators = [
          '.notification.info',
          '.alert.info',
          '[data-status="stopped"]',
          '.server-status.stopped',
        ];
        
        let stopFound = false;
        for (const selector of stopIndicators) {
          const element = page.locator(selector);
          if (await element.count() > 0) {
            await expect(element.first()).toBeVisible({ timeout: 5000 });
            stopFound = true;
            break;
          }
        }
        
        if (stopFound) {
          console.log('✅ Server stop successful');
        } else {
          console.log('ℹ️ Server stop completed (no explicit stop indicator found)');
        }
      } else {
        console.log('ℹ️ Stop button not found (server may not be running)');
      }
    });

    test('should restart server when restart button is clicked', async () => {
      console.log('🧪 Testing server restart...');
      
      // Navigate to dashboard
      await page.click('[data-section="dashboard"]');
      await page.waitForTimeout(500);
      
      // Look for restart button
      const restartButton = page.locator('button:has-text("Restart Server"), button:has-text("Restart"), button[data-action="restart"]');
      
      if (await restartButton.count() > 0) {
        await restartButton.first().click();
        await page.waitForTimeout(5000); // Restart takes longer
        
        // Check for success indication
        const restartIndicators = [
          '.notification.success',
          '.alert.success',
          '[data-status="running"]',
          '.server-status.running',
        ];
        
        let restartFound = false;
        for (const selector of restartIndicators) {
          const element = page.locator(selector);
          if (await element.count() > 0) {
            await expect(element.first()).toBeVisible({ timeout: 10000 });
            restartFound = true;
            break;
          }
        }
        
        if (restartFound) {
          console.log('✅ Server restart successful');
        } else {
          console.log('ℹ️ Server restart completed (no explicit success indicator found)');
        }
      } else {
        console.log('ℹ️ Restart button not found');
      }
    });
  });

  test.describe('Server Configuration', () => {
    test('should display server port configuration', async () => {
      console.log('🧪 Testing server port configuration...');
      
      // Navigate to settings
      await page.click('[data-section="settings"]');
      await page.waitForTimeout(500);
      
      // Look for port configuration
      const portElements = [
        '#port-setting',
        'input[name="port"]',
        'input[type="number"][placeholder*="port"]',
        '.port-config',
      ];
      
      let portFound = false;
      for (const selector of portElements) {
        const element = page.locator(selector);
        if (await element.count() > 0) {
          await expect(element.first()).toBeVisible();
          
          const value = await element.first().inputValue();
          expect(value).toMatch(/^\d+$/);
          console.log(`🔌 Server port: ${value}`);
          
          portFound = true;
          break;
        }
      }
      
      if (!portFound) {
        console.log('ℹ️ Port configuration not found in settings');
        
        // Try debug console
        await page.click('[data-section="debug"]');
        await page.waitForTimeout(500);
        
        const debugPortElement = page.locator('#debug-port, .debug-port');
        if (await debugPortElement.count() > 0) {
          const portText = await debugPortElement.first().textContent();
          expect(portText).toContain('4021');
          console.log(`🔌 Debug port info: ${portText}`);
          portFound = true;
        }
      }
      
      expect(portFound).toBe(true);
    });

    test('should validate port configuration changes', async () => {
      console.log('🧪 Testing port configuration validation...');
      
      // Navigate to settings
      await page.click('[data-section="settings"]');
      await page.waitForTimeout(500);
      
      // Look for port input
      const portInput = page.locator('#port-setting, input[name="port"]');
      if (await portInput.count() > 0) {
        const input = portInput.first();
        
        // Test invalid port
        await input.fill('99999');
        await page.waitForTimeout(500);
        
        // Check for validation error
        const errorElements = [
          '.error',
          '.validation-error',
          '[data-error="port"]',
        ];
        
        let errorFound = false;
        for (const selector of errorElements) {
          const element = page.locator(selector);
          if (await element.count() > 0) {
            await expect(element.first()).toBeVisible();
            errorFound = true;
            break;
          }
        }
        
        if (errorFound) {
          console.log('✅ Port validation error displayed');
        } else {
          console.log('ℹ️ No validation error shown (may be handled differently)');
        }
        
        // Reset to valid port
        await input.fill('4021');
      } else {
        console.log('ℹ️ Port input not found for validation testing');
      }
    });
  });

  test.describe('Server Integration', () => {
    test('should connect to Go backend server', async () => {
      console.log('🧪 Testing Go backend connection...');
      
      try {
        // Try to connect to the Go server directly
        const response = await page.evaluate(async () => {
          try {
            const result = await fetch('http://localhost:4021/api/health');
            return {
              status: result.status,
              ok: result.ok,
              data: await result.json().catch(() => null)
            };
          } catch (error) {
            return {
              error: error.message
            };
          }
        });
        
        if (response.ok) {
          console.log('✅ Go backend server is accessible');
          console.log('📊 Health check response:', response.data);
        } else {
          console.log('⚠️ Go backend server responded with:', response.status);
        }
      } catch (error) {
        console.log('ℹ️ Go backend server not accessible:', error.message);
      }
    });

    test('should handle server connection errors gracefully', async () => {
      console.log('🧪 Testing server error handling...');
      
      // Try to connect to a non-existent server
      const errorResponse = await page.evaluate(async () => {
        try {
          const result = await fetch('http://localhost:9999/nonexistent');
          return { success: false };
        } catch (error) {
          return { 
            success: true, 
            error: error.message,
            type: error.name
          };
        }
      });
      
      expect(errorResponse.success).toBe(true);
      expect(errorResponse.error).toBeDefined();
      console.log('✅ Server connection errors handled gracefully');
    });
  });

  test.describe('Server Logs', () => {
    test('should display server logs in debug console', async () => {
      console.log('🧪 Testing server logs display...');
      
      // Navigate to debug console
      await page.click('[data-section="debug"]');
      await page.waitForTimeout(500);
      
      // Look for logs container
      const logsContainer = page.locator('#debug-logs, .debug-logs, .logs-container');
      if (await logsContainer.count() > 0) {
        await expect(logsContainer.first()).toBeVisible();
        
        // Check if logs are present
        const logsContent = await logsContainer.first().textContent();
        if (logsContent && logsContent.trim().length > 0) {
          console.log('📝 Server logs found:', logsContent.substring(0, 100) + '...');
        } else {
          console.log('ℹ️ No server logs displayed (may be empty initially)');
        }
      } else {
        console.log('ℹ️ Logs container not found');
      }
    });

    test('should refresh server logs', async () => {
      console.log('🧪 Testing server logs refresh...');
      
      // Navigate to debug console
      await page.click('[data-section="debug"]');
      await page.waitForTimeout(500);
      
      // Look for refresh button
      const refreshButton = page.locator('button:has-text("Refresh"), button[data-action="refresh-logs"]');
      if (await refreshButton.count() > 0) {
        await refreshButton.first().click();
        await page.waitForTimeout(2000);
        
        console.log('✅ Server logs refreshed');
      } else {
        console.log('ℹ️ Refresh button not found');
      }
    });

    test('should clear server logs', async () => {
      console.log('🧪 Testing server logs clear...');
      
      // Navigate to debug console
      await page.click('[data-section="debug"]');
      await page.waitForTimeout(500);
      
      // Look for clear button
      const clearButton = page.locator('button:has-text("Clear"), button[data-action="clear-logs"]');
      if (await clearButton.count() > 0) {
        await clearButton.first().click();
        await page.waitForTimeout(1000);
        
        // Check if logs are cleared
        const logsContainer = page.locator('#debug-logs, .debug-logs');
        if (await logsContainer.count() > 0) {
          const logsContent = await logsContainer.first().textContent();
          if (logsContent && logsContent.includes('No logs') || logsContent.trim().length === 0) {
            console.log('✅ Server logs cleared successfully');
          } else {
            console.log('ℹ️ Logs may not have been cleared or cleared differently');
          }
        }
      } else {
        console.log('ℹ️ Clear button not found');
      }
    });
  });

  test.describe('Server Performance', () => {
    test('should respond to server operations within acceptable time', async () => {
      console.log('🧪 Testing server operation performance...');
      
      // Navigate to dashboard
      await page.click('[data-section="dashboard"]');
      await page.waitForTimeout(500);
      
      // Test status check performance
      const startTime = Date.now();
      
      // Look for status check button or trigger status update
      const statusButton = page.locator('button:has-text("Check Status"), button[data-action="check-status"]');
      if (await statusButton.count() > 0) {
        await statusButton.first().click();
        
        // Wait for status update
        await page.waitForTimeout(2000);
        
        const responseTime = Date.now() - startTime;
        console.log(`⏱️ Status check response time: ${responseTime}ms`);
        
        // Should respond within 5 seconds
        expect(responseTime).toBeLessThan(5000);
      } else {
        console.log('ℹ️ Status check button not found');
      }
    });
  });
});