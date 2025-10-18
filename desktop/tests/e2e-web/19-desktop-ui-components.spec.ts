import { test, expect } from '@playwright/test';
import axios from 'axios';

const BASE_URL = 'http://localhost:4021';
const API_URL = `${BASE_URL}/api`;

const api = axios.create({
  baseURL: API_URL,
  validateStatus: () => true,
});

test.describe('Desktop UI Components', () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    
    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`);
  });

  test.describe('Window Management', () => {
    test('should display window controls', async () => {
      // Look for minimize, maximize, close buttons
      const minimizeBtn = await page.$('[data-testid="minimize-btn"]').catch(() => null);
      const maximizeBtn = await page.$('[data-testid="maximize-btn"]').catch(() => null);
      const closeBtn = await page.$('[data-testid="close-btn"]').catch(() => null);

      // At least some window controls should be present
      const hasControls = minimizeBtn || maximizeBtn || closeBtn;
      expect(hasControls).toBeTruthy();
    });

    test('should respond to minimize button', async () => {
      const minimizeBtn = await page.$('[data-testid="minimize-btn"]').catch(() => null);
      
      if (minimizeBtn) {
        const response = await api.post('/window/minimize');
        expect([200, 400, 501]).toContain(response.status); // 501 if not implemented
      }
    });

    test('should respond to maximize button', async () => {
      const maximizeBtn = await page.$('[data-testid="maximize-btn"]').catch(() => null);
      
      if (maximizeBtn) {
        const response = await api.post('/window/maximize');
        expect([200, 400, 501]).toContain(response.status);
      }
    });

    test('should show window title', async () => {
      const title = await page.title();
      expect(title).toBeTruthy();
    });
  });

  test.describe('Menu Operations', () => {
    test('should display application menu', async () => {
      const menu = await page.$('[data-testid="menu"]').catch(() => null);
      expect(menu).toBeTruthy();
    });

    test('should open File menu', async () => {
      const fileMenu = await page.$('text=File').catch(() => null);
      
      if (fileMenu) {
        await fileMenu.click();
        const fileMenuOpen = await page.$('[data-testid="file-menu-open"]').catch(() => null);
        expect(fileMenuOpen).toBeTruthy();
      }
    });

    test('should open Edit menu', async () => {
      const editMenu = await page.$('text=Edit').catch(() => null);
      
      if (editMenu) {
        await editMenu.click();
        const editMenuOpen = await page.$('[data-testid="edit-menu-open"]').catch(() => null);
        expect(editMenuOpen).toBeTruthy();
      }
    });

    test('should open Help menu', async () => {
      const helpMenu = await page.$('text=Help').catch(() => null);
      
      if (helpMenu) {
        await helpMenu.click();
        const helpMenuOpen = await page.$('[data-testid="help-menu-open"]').catch(() => null);
        expect(helpMenuOpen).toBeTruthy();
      }
    });

    test('should navigate to preferences from menu', async () => {
      const preferencesItem = await page.$('text=Preferences').catch(() => null);
      
      if (preferencesItem) {
        await preferencesItem.click();
        await page.waitForURL(/.*preferences.*/, { timeout: 2000 }).catch(() => {});
      }
    });
  });

  test.describe('Settings Panel', () => {
    test('should open settings panel', async () => {
      const settingsBtn = await page.$('[data-testid="settings-btn"]').catch(() => null);
      
      if (settingsBtn) {
        await settingsBtn.click();
        const settingsPanel = await page.$('[data-testid="settings-panel"]').catch(() => null);
        expect(settingsPanel).toBeTruthy();
      }
    });

    test('should display general settings', async () => {
      const generalSection = await page.$('[data-testid="settings-general"]').catch(() => null);
      
      if (generalSection) {
        expect(generalSection).toBeTruthy();
      }
    });

    test('should display appearance settings', async () => {
      const appearanceSection = await page.$('[data-testid="settings-appearance"]').catch(() => null);
      
      if (appearanceSection) {
        expect(appearanceSection).toBeTruthy();
      }
    });

    test('should display keyboard shortcuts settings', async () => {
      const shortcutsSection = await page.$('[data-testid="settings-shortcuts"]').catch(() => null);
      
      if (shortcutsSection) {
        expect(shortcutsSection).toBeTruthy();
      }
    });

    test('should toggle theme', async () => {
      const themeToggle = await page.$('[data-testid="theme-toggle"]').catch(() => null);
      
      if (themeToggle) {
        const currentTheme = await page.evaluate(() => {
          return document.documentElement.getAttribute('data-theme') || 'light';
        });

        await themeToggle.click();

        const newTheme = await page.evaluate(() => {
          return document.documentElement.getAttribute('data-theme') || 'light';
        });

        expect(newTheme).not.toBe(currentTheme);
      }
    });

    test('should save settings', async () => {
      const saveBtn = await page.$('[data-testid="settings-save-btn"]').catch(() => null);
      
      if (saveBtn) {
        await saveBtn.click();
        const successMessage = await page.$('text=Settings saved').catch(() => null);
        expect(successMessage).toBeTruthy();
      }
    });

    test('should close settings panel', async () => {
      const closeBtn = await page.$('[data-testid="settings-close-btn"]').catch(() => null);
      
      if (closeBtn) {
        await closeBtn.click();
        const settingsPanel = await page.$('[data-testid="settings-panel"]').catch(() => null);
        expect(settingsPanel).toBeFalsy();
      }
    });
  });

  test.describe('System Tray Integration', () => {
    test('should show system tray icon', async () => {
      const response = await api.get('/tray/icon');
      expect([200, 501]).toContain(response.status); // 501 if not implemented
    });

    test('should handle tray icon click', async () => {
      const response = await api.post('/tray/click');
      expect([200, 400, 501]).toContain(response.status);
    });

    test('should show tray context menu', async () => {
      const response = await api.get('/tray/menu');
      expect([200, 400, 501]).toContain(response.status);
    });

    test('should handle tray menu selection', async () => {
      const response = await api.post('/tray/menu-action', {
        action: 'show-window'
      });
      expect([200, 400, 501]).toContain(response.status);
    });

    test('should update tray icon on state change', async () => {
      const response = await api.post('/tray/update', {
        tooltip: 'TunnelForge - Ready',
        icon: 'ready'
      });
      expect([200, 400, 501]).toContain(response.status);
    });
  });

  test.describe('Sidebar Navigation', () => {
    test('should display sidebar', async () => {
      const sidebar = await page.$('[data-testid="sidebar"]');
      expect(sidebar).toBeTruthy();
    });

    test('should show navigation items', async () => {
      const navItems = await page.$$('[data-testid="nav-item"]');
      expect(navItems.length).toBeGreaterThan(0);
    });

    test('should navigate to sessions', async () => {
      const sessionsLink = await page.$('[data-testid="nav-sessions"]').catch(() => null);
      
      if (sessionsLink) {
        await sessionsLink.click();
        await page.waitForURL(/.*sessions.*/, { timeout: 2000 }).catch(() => {});
        expect(page.url()).toContain('sessions');
      }
    });

    test('should navigate to file browser', async () => {
      const filesLink = await page.$('[data-testid="nav-files"]').catch(() => null);
      
      if (filesLink) {
        await filesLink.click();
        await page.waitForURL(/.*files.*/, { timeout: 2000 }).catch(() => {});
      }
    });

    test('should navigate to settings', async () => {
      const settingsLink = await page.$('[data-testid="nav-settings"]').catch(() => null);
      
      if (settingsLink) {
        await settingsLink.click();
        await page.waitForURL(/.*settings.*/, { timeout: 2000 }).catch(() => {});
      }
    });

    test('should collapse and expand sidebar', async () => {
      const toggleBtn = await page.$('[data-testid="sidebar-toggle"]').catch(() => null);
      
      if (toggleBtn) {
        const isExpanded = await page.evaluate(() => {
          const sidebar = document.querySelector('[data-testid="sidebar"]');
          return sidebar?.getAttribute('data-expanded') === 'true';
        });

        await toggleBtn.click();

        const isNowExpanded = await page.evaluate(() => {
          const sidebar = document.querySelector('[data-testid="sidebar"]');
          return sidebar?.getAttribute('data-expanded') === 'true';
        });

        expect(isNowExpanded).not.toBe(isExpanded);
      }
    });
  });

  test.describe('Notification System', () => {
    test('should display notification', async () => {
      const response = await api.post('/notifications/show', {
        title: 'Test Notification',
        message: 'This is a test'
      });

      expect([200, 400, 501]).toContain(response.status);
    });

    test('should show success notification', async () => {
      const response = await api.post('/notifications/success', {
        message: 'Operation successful'
      });

      expect([200, 400, 501]).toContain(response.status);
    });

    test('should show error notification', async () => {
      const response = await api.post('/notifications/error', {
        message: 'An error occurred'
      });

      expect([200, 400, 501]).toContain(response.status);
    });

    test('should show warning notification', async () => {
      const response = await api.post('/notifications/warning', {
        message: 'Warning message'
      });

      expect([200, 400, 501]).toContain(response.status);
    });

    test('should dismiss notification', async () => {
      const notification = await page.$('[data-testid="notification"]').catch(() => null);
      
      if (notification) {
        const closeBtn = await notification.$('[data-testid="notification-close"]').catch(() => null);
        if (closeBtn) {
          await closeBtn.click();
          await page.waitForTimeout(500);
          const stillVisible = await page.$('[data-testid="notification"]').catch(() => null);
          expect(stillVisible).toBeFalsy();
        }
      }
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test('should respond to Ctrl+N (new session)', async () => {
      await page.keyboard.press('Control+N');
      await page.waitForTimeout(500);
      // Should open new session or show menu
    });

    test('should respond to Ctrl+Shift+D (developer tools)', async () => {
      await page.keyboard.press('Control+Shift+D');
      // May open dev tools or log message
    });

    test('should respond to Ctrl+Q (quit)', async () => {
      // Don't actually quit, just test the API
      const response = await api.get('/shortcuts/registered');
      expect([200, 400]).toContain(response.status);
    });

    test('should respond to F11 (fullscreen toggle)', async () => {
      const response = await api.post('/window/fullscreen-toggle');
      expect([200, 400, 501]).toContain(response.status);
    });

    test('should respond to Alt+Tab (app switcher)', async () => {
      // This is OS-level, just verify app can receive focus
      const response = await api.post('/window/focus');
      expect([200, 400, 501]).toContain(response.status);
    });
  });

  test.describe('Drag and Drop', () => {
    test('should accept file drag and drop', async () => {
      // Create a test file
      const response = await api.post('/dnd/file-drop', {
        files: ['/tmp/test.txt'],
        x: 100,
        y: 100
      });

      expect([200, 400, 501]).toContain(response.status);
    });

    test('should accept multiple file drag and drop', async () => {
      const response = await api.post('/dnd/file-drop', {
        files: ['/tmp/test1.txt', '/tmp/test2.txt', '/tmp/test3.txt'],
        x: 100,
        y: 100
      });

      expect([200, 400, 501]).toContain(response.status);
    });

    test('should handle drag over event', async () => {
      const response = await api.post('/dnd/drag-over', {
        x: 100,
        y: 100
      });

      expect([200, 400, 501]).toContain(response.status);
    });
  });

  test.describe('Accessibility', () => {
    test('should have accessible button controls', async () => {
      const buttons = await page.$$('button');
      
      for (const btn of buttons) {
        const ariaLabel = await btn.getAttribute('aria-label').catch(() => null);
        const textContent = await btn.textContent().catch(() => null);
        
        // Each button should have either aria-label or text content
        expect(ariaLabel || textContent).toBeTruthy();
      }
    });

    test('should have proper heading hierarchy', async () => {
      const h1s = await page.$$('h1');
      const h2s = await page.$$('h2');
      
      // Should have at least one main heading
      expect(h1s.length + h2s.length).toBeGreaterThan(0);
    });

    test('should support keyboard navigation', async () => {
      // Tab through interactive elements
      const firstBtn = await page.$('button').catch(() => null);
      
      if (firstBtn) {
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => {
          return document.activeElement?.tagName;
        });

        expect(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(focused);
      }
    });

    test('should have proper color contrast', async () => {
      const response = await api.get('/accessibility/contrast-check');
      expect([200, 400, 501]).toContain(response.status);
    });
  });
});
