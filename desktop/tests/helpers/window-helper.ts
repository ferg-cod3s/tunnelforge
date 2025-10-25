/**
 * WindowHelper - Desktop Window Operations and Testing
 * 
 * Provides comprehensive functionality for managing Tauri desktop windows,
 * including creation, manipulation, state management, and UI testing.
 */

import { Page, BrowserContext, TestInfo } from '@playwright/test';
import { promisify } from 'util';
import { 
  WindowInfo, 
  WindowOptions, 
  WindowEvent,
  TestError,
  HelperConfig
} from './types';
import { createTestError, sleep } from './utils';

const sleep = promisify(setTimeout);

export class WindowHelper {
  private page: Page;
  private context: BrowserContext;
  private testInfo: TestInfo;
  private config: HelperConfig;
  private windowHistory: WindowInfo[] = [];
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(
    page: Page,
    context: BrowserContext,
    testInfo: TestInfo,
    debugPort: number = 9222,
    config: Partial<HelperConfig> = {}
  ) {
    this.page = page;
    this.context = context;
    this.testInfo = testInfo;
    this.config = {
      debugPort,
      timeout: 15000,
      retries: 2,
      screenshotOnFailure: true,
      videoRecording: false,
      traceRecording: false,
      logLevel: 'info',
      tempDir: 'test-results/temp',
      ...config
    };
  }

  /**
   * Get current window information
   */
  async getCurrentWindowInfo(): Promise<WindowInfo> {
    console.log('🪟 Getting current window information...');
    
    try {
      const windowInfo = await this.page.evaluate(() => {
        const currentWindow = window.__TAURI__?.window?.getCurrentWindow?.();
        
        if (!currentWindow) {
          throw new Error('Current window not available');
        }
        
        return {
          id: currentWindow.label || 'main',
          title: currentWindow.title?.() || 'Unknown',
          width: currentWindow.innerWidth?.() || 0,
          height: currentWindow.innerHeight?.() || 0,
          x: currentWindow.outerPosition?.()?.x || 0,
          y: currentWindow.outerPosition?.()?.y || 0,
          isVisible: currentWindow.isVisible?.() || false,
          isMaximized: currentWindow.isMaximized?.() || false,
          isMinimized: currentWindow.isMinimized?.() || false,
          isFullscreen: currentWindow.isFullscreen?.() || false,
        };
      });
      
      this.windowHistory.push(windowInfo);
      console.log('📋 Window info:', windowInfo);
      
      return windowInfo;
      
    } catch (error) {
      console.error('❌ Failed to get window info:', error);
      throw createTestError('Failed to get window info', 'GET_WINDOW_INFO', { error });
    }
  }

  /**
   * Get all available windows
   */
  async getAllWindows(): Promise<WindowInfo[]> {
    console.log('🪟 Getting all windows...');
    
    try {
      const windows = await this.page.evaluate(() => {
        const getAllWindows = window.__TAURI__?.window?.getAll;
        
        if (!getAllWindows) {
          return [];
        }
        
        const allWindows = getAllWindows();
        
        return Promise.all(allWindows.map(async (window: any) => ({
          id: window.label || 'unknown',
          title: await window.title?.() || 'Unknown',
          width: await window.innerWidth?.() || 0,
          height: await window.innerHeight?.() || 0,
          x: (await window.outerPosition?.())?.x || 0,
          y: (await window.outerPosition?.())?.y || 0,
          isVisible: await window.isVisible?.() || false,
          isMaximized: await window.isMaximized?.() || false,
          isMinimized: await window.isMinimized?.() || false,
          isFullscreen: await window.isFullscreen?.() || false,
        })));
      });
      
      console.log(`📋 Found ${windows.length} windows`);
      return windows;
      
    } catch (error) {
      console.error('❌ Failed to get all windows:', error);
      return [];
    }
  }

  /**
   * Create a new window
   */
  async createWindow(options: WindowOptions): Promise<WindowInfo> {
    console.log('🪟 Creating new window...', options);
    
    try {
      const windowInfo = await this.page.evaluate((opts) => {
        return new Promise((resolve, reject) => {
          const { WebviewWindow } = window.__TAURI__?.window || {};
          
          if (!WebviewWindow) {
            reject(new Error('WebviewWindow not available'));
            return;
          }
          
          const newWindow = new WebviewWindow(opts.title || 'new-window', {
            width: opts.width || 800,
            height: opts.height || 600,
            x: opts.x,
            y: opts.y,
            resizable: opts.resizable !== false,
            decorations: opts.decorations !== false,
            transparent: opts.transparent || false,
            alwaysOnTop: opts.alwaysOnTop || false,
          });
          
          newWindow.once('tauri://created', () => {
            resolve({
              id: newWindow.label,
              title: opts.title || 'new-window',
              width: opts.width || 800,
              height: opts.height || 600,
              x: opts.x || 0,
              y: opts.y || 0,
              isVisible: true,
              isMaximized: false,
              isMinimized: false,
              isFullscreen: false,
            });
          });
          
          newWindow.once('tauri://error', (error: any) => {
            reject(error);
          });
        });
      }, options);
      
      this.windowHistory.push(windowInfo);
      console.log('✅ Window created successfully:', windowInfo);
      
      return windowInfo;
      
    } catch (error) {
      console.error('❌ Failed to create window:', error);
      throw createTestError('Failed to create window', 'CREATE_WINDOW', { error, options });
    }
  }

  /**
   * Close a window by ID
   */
  async closeWindow(windowId: string): Promise<void> {
    console.log(`🪟 Closing window: ${windowId}`);
    
    try {
      await this.page.evaluate((id) => {
        const windows = window.__TAURI__?.window?.getAll?.() || [];
        const targetWindow = windows.find((w: any) => w.label === id);
        
        if (!targetWindow) {
          throw new Error(`Window not found: ${id}`);
        }
        
        return targetWindow.close();
      }, windowId);
      
      console.log(`✅ Window closed: ${windowId}`);
      
    } catch (error) {
      console.error(`❌ Failed to close window ${windowId}:`, error);
      throw createTestError('Failed to close window', 'CLOSE_WINDOW', { error, windowId });
    }
  }

  /**
   * Minimize a window
   */
  async minimizeWindow(windowId?: string): Promise<void> {
    const targetId = windowId || 'main';
    console.log(`📉 Minimizing window: ${targetId}`);
    
    try {
      await this.page.evaluate((id) => {
        const windows = window.__TAURI__?.window?.getAll?.() || [];
        const targetWindow = windows.find((w: any) => w.label === id) || 
                           window.__TAURI__?.window?.getCurrentWindow?.();
        
        if (!targetWindow) {
          throw new Error(`Window not found: ${id}`);
        }
        
        return targetWindow.minimize();
      }, targetId);
      
      console.log(`✅ Window minimized: ${targetId}`);
      
    } catch (error) {
      console.error(`❌ Failed to minimize window ${targetId}:`, error);
      throw createTestError('Failed to minimize window', 'MINIMIZE_WINDOW', { error, windowId: targetId });
    }
  }

  /**
   * Unminimize a window
   */
  async unminimizeWindow(windowId?: string): Promise<void> {
    const targetId = windowId || 'main';
    console.log(`📈 Unminimizing window: ${targetId}`);
    
    try {
      await this.page.evaluate((id) => {
        const windows = window.__TAURI__?.window?.getAll?.() || [];
        const targetWindow = windows.find((w: any) => w.label === id) || 
                           window.__TAURI__?.window?.getCurrentWindow?.();
        
        if (!targetWindow) {
          throw new Error(`Window not found: ${id}`);
        }
        
        return targetWindow.unminimize();
      }, targetId);
      
      console.log(`✅ Window unminimized: ${targetId}`);
      
    } catch (error) {
      console.error(`❌ Failed to unminimize window ${targetId}:`, error);
      throw createTestError('Failed to unminimize window', 'UNMINIMIZE_WINDOW', { error, windowId: targetId });
    }
  }

  /**
   * Maximize a window
   */
  async maximizeWindow(windowId?: string): Promise<void> {
    const targetId = windowId || 'main';
    console.log(`📊 Maximizing window: ${targetId}`);
    
    try {
      await this.page.evaluate((id) => {
        const windows = window.__TAURI__?.window?.getAll?.() || [];
        const targetWindow = windows.find((w: any) => w.label === id) || 
                           window.__TAURI__?.window?.getCurrentWindow?.();
        
        if (!targetWindow) {
          throw new Error(`Window not found: ${id}`);
        }
        
        return targetWindow.maximize();
      }, targetId);
      
      console.log(`✅ Window maximized: ${targetId}`);
      
    } catch (error) {
      console.error(`❌ Failed to maximize window ${targetId}:`, error);
      throw createTestError('Failed to maximize window', 'MAXIMIZE_WINDOW', { error, windowId: targetId });
    }
  }

  /**
   * Unmaximize a window
   */
  async unmaximizeWindow(windowId?: string): Promise<void> {
    const targetId = windowId || 'main';
    console.log(`📉 Unmaximizing window: ${targetId}`);
    
    try {
      await this.page.evaluate((id) => {
        const windows = window.__TAURI__?.window?.getAll?.() || [];
        const targetWindow = windows.find((w: any) => w.label === id) || 
                           window.__TAURI__?.window?.getCurrentWindow?.();
        
        if (!targetWindow) {
          throw new Error(`Window not found: ${id}`);
        }
        
        return targetWindow.unmaximize();
      }, targetId);
      
      console.log(`✅ Window unmaximized: ${targetId}`);
      
    } catch (error) {
      console.error(`❌ Failed to unmaximize window ${targetId}:`, error);
      throw createTestError('Failed to unmaximize window', 'UNMAXIMIZE_WINDOW', { error, windowId: targetId });
    }
  }

  /**
   * Toggle maximize state
   */
  async toggleMaximize(windowId?: string): Promise<void> {
    const targetId = windowId || 'main';
    console.log(`🔄 Toggling maximize state: ${targetId}`);
    
    try {
      await this.page.evaluate((id) => {
        const windows = window.__TAURI__?.window?.getAll?.() || [];
        const targetWindow = windows.find((w: any) => w.label === id) || 
                           window.__TAURI__?.window?.getCurrentWindow?.();
        
        if (!targetWindow) {
          throw new Error(`Window not found: ${id}`);
        }
        
        return targetWindow.toggleMaximize();
      }, targetId);
      
      console.log(`✅ Maximize state toggled: ${targetId}`);
      
    } catch (error) {
      console.error(`❌ Failed to toggle maximize state ${targetId}:`, error);
      throw createTestError('Failed to toggle maximize state', 'TOGGLE_MAXIMIZE', { error, windowId: targetId });
    }
  }

  /**
   * Set window position
   */
  async setWindowPosition(x: number, y: number, windowId?: string): Promise<void> {
    const targetId = windowId || 'main';
    console.log(`📍 Setting window position: ${targetId} -> (${x}, ${y})`);
    
    try {
      await this.page.evaluate(({ id, posX, posY }) => {
        const windows = window.__TAURI__?.window?.getAll?.() || [];
        const targetWindow = windows.find((w: any) => w.label === id) || 
                           window.__TAURI__?.window?.getCurrentWindow?.();
        
        if (!targetWindow) {
          throw new Error(`Window not found: ${id}`);
        }
        
        return targetWindow.setPosition({ x: posX, y: posY });
      }, { id: targetId, posX: x, posY: y });
      
      console.log(`✅ Window position set: ${targetId} -> (${x}, ${y})`);
      
    } catch (error) {
      console.error(`❌ Failed to set window position ${targetId}:`, error);
      throw createTestError('Failed to set window position', 'SET_WINDOW_POSITION', { error, windowId: targetId, x, y });
    }
  }

  /**
   * Set window size
   */
  async setWindowSize(width: number, height: number, windowId?: string): Promise<void> {
    const targetId = windowId || 'main';
    console.log(`📏 Setting window size: ${targetId} -> ${width}x${height}`);
    
    try {
      await this.page.evaluate(({ id, w, h }) => {
        const windows = window.__TAURI__?.window?.getAll?.() || [];
        const targetWindow = windows.find((w: any) => w.label === id) || 
                           window.__TAURI__?.window?.getCurrentWindow?.();
        
        if (!targetWindow) {
          throw new Error(`Window not found: ${id}`);
        }
        
        return targetWindow.setSize({ width: w, height: h });
      }, { id: targetId, w: width, h: height });
      
      console.log(`✅ Window size set: ${targetId} -> ${width}x${height}`);
      
    } catch (error) {
      console.error(`❌ Failed to set window size ${targetId}:`, error);
      throw createTestError('Failed to set window size', 'SET_WINDOW_SIZE', { error, windowId: targetId, width, height });
    }
  }

  /**
   * Show a window
   */
  async showWindow(windowId?: string): Promise<void> {
    const targetId = windowId || 'main';
    console.log(`👁️ Showing window: ${targetId}`);
    
    try {
      await this.page.evaluate((id) => {
        const windows = window.__TAURI__?.window?.getAll?.() || [];
        const targetWindow = windows.find((w: any) => w.label === id) || 
                           window.__TAURI__?.window?.getCurrentWindow?.();
        
        if (!targetWindow) {
          throw new Error(`Window not found: ${id}`);
        }
        
        return targetWindow.show();
      }, targetId);
      
      console.log(`✅ Window shown: ${targetId}`);
      
    } catch (error) {
      console.error(`❌ Failed to show window ${targetId}:`, error);
      throw createTestError('Failed to show window', 'SHOW_WINDOW', { error, windowId: targetId });
    }
  }

  /**
   * Hide a window
   */
  async hideWindow(windowId?: string): Promise<void> {
    const targetId = windowId || 'main';
    console.log(`🙈 Hiding window: ${targetId}`);
    
    try {
      await this.page.evaluate((id) => {
        const windows = window.__TAURI__?.window?.getAll?.() || [];
        const targetWindow = windows.find((w: any) => w.label === id) || 
                           window.__TAURI__?.window?.getCurrentWindow?.();
        
        if (!targetWindow) {
          throw new Error(`Window not found: ${id}`);
        }
        
        return targetWindow.hide();
      }, targetId);
      
      console.log(`✅ Window hidden: ${targetId}`);
      
    } catch (error) {
      console.error(`❌ Failed to hide window ${targetId}:`, error);
      throw createTestError('Failed to hide window', 'HIDE_WINDOW', { error, windowId: targetId });
    }
  }

  /**
   * Set window always on top
   */
  async setAlwaysOnTop(alwaysOnTop: boolean, windowId?: string): Promise<void> {
    const targetId = windowId || 'main';
    console.log(`🔝 Setting always on top: ${targetId} -> ${alwaysOnTop}`);
    
    try {
      await this.page.evaluate(({ id, onTop }) => {
        const windows = window.__TAURI__?.window?.getAll?.() || [];
        const targetWindow = windows.find((w: any) => w.label === id) || 
                           window.__TAURI__?.window?.getCurrentWindow?.();
        
        if (!targetWindow) {
          throw new Error(`Window not found: ${id}`);
        }
        
        return targetWindow.setAlwaysOnTop(onTop);
      }, { id: targetId, onTop: alwaysOnTop });
      
      console.log(`✅ Always on top set: ${targetId} -> ${alwaysOnTop}`);
      
    } catch (error) {
      console.error(`❌ Failed to set always on top ${targetId}:`, error);
      throw createTestError('Failed to set always on top', 'SET_ALWAYS_ON_TOP', { error, windowId: targetId, alwaysOnTop });
    }
  }

  /**
   * Set window title
   */
  async setWindowTitle(title: string, windowId?: string): Promise<void> {
    const targetId = windowId || 'main';
    console.log(`📝 Setting window title: ${targetId} -> "${title}"`);
    
    try {
      await this.page.evaluate(({ id, newTitle }) => {
        const windows = window.__TAURI__?.window?.getAll?.() || [];
        const targetWindow = windows.find((w: any) => w.label === id) || 
                           window.__TAURI__?.window?.getCurrentWindow?.();
        
        if (!targetWindow) {
          throw new Error(`Window not found: ${id}`);
        }
        
        return targetWindow.setTitle(newTitle);
      }, { id: targetId, newTitle: title });
      
      console.log(`✅ Window title set: ${targetId} -> "${title}"`);
      
    } catch (error) {
      console.error(`❌ Failed to set window title ${targetId}:`, error);
      throw createTestError('Failed to set window title', 'SET_WINDOW_TITLE', { error, windowId: targetId, title });
    }
  }

  /**
   * Center window on screen
   */
  async centerWindow(windowId?: string): Promise<void> {
    const targetId = windowId || 'main';
    console.log(`🎯 Centering window: ${targetId}`);
    
    try {
      await this.page.evaluate((id) => {
        const windows = window.__TAURI__?.window?.getAll?.() || [];
        const targetWindow = windows.find((w: any) => w.label === id) || 
                           window.__TAURI__?.window?.getCurrentWindow?.();
        
        if (!targetWindow) {
          throw new Error(`Window not found: ${id}`);
        }
        
        return targetWindow.center();
      }, targetId);
      
      console.log(`✅ Window centered: ${targetId}`);
      
    } catch (error) {
      console.error(`❌ Failed to center window ${targetId}:`, error);
      throw createTestError('Failed to center window', 'CENTER_WINDOW', { error, windowId: targetId });
    }
  }

  /**
   * Test window responsiveness
   */
  async testWindowResponsiveness(): Promise<boolean> {
    console.log('🧪 Testing window responsiveness...');
    
    try {
      const startTime = Date.now();
      
      // Try to get window title
      const title = await this.page.evaluate(() => {
        return window.__TAURI__?.window?.getCurrentWindow()?.title?.();
      });
      
      const responseTime = Date.now() - startTime;
      
      const isResponsive = responseTime < 5000 && !!title;
      
      console.log(`📊 Window responsiveness test: ${isResponsive ? 'PASS' : 'FAIL'} (${responseTime}ms)`);
      
      return isResponsive;
      
    } catch (error) {
      console.error('❌ Window responsiveness test failed:', error);
      return false;
    }
  }

  /**
   * Wait for window to be ready
   */
  async waitForWindowReady(windowId?: string, timeout: number = 10000): Promise<void> {
    const targetId = windowId || 'main';
    console.log(`⏳ Waiting for window to be ready: ${targetId}`);
    
    try {
      await this.page.waitForFunction((id) => {
        const windows = window.__TAURI__?.window?.getAll?.() || [];
        const targetWindow = windows.find((w: any) => w.label === id) || 
                           window.__TAURI__?.window?.getCurrentWindow?.();
        
        return targetWindow && targetWindow.isVisible?.();
      }, { timeout }, targetId);
      
      console.log(`✅ Window is ready: ${targetId}`);
      
    } catch (error) {
      console.error(`❌ Window readiness timeout: ${targetId}`, error);
      throw createTestError('Window readiness timeout', 'WINDOW_READY_TIMEOUT', { error, windowId: targetId });
    }
  }

  /**
   * Get window history
   */
  getWindowHistory(): WindowInfo[] {
    return [...this.windowHistory];
  }

  /**
   * Clear window history
   */
  clearWindowHistory(): void {
    this.windowHistory = [];
    console.log('🗑️ Window history cleared');
  }

  /**
   * Setup window event listeners
   */
  async setupWindowEventListeners(): Promise<void> {
    console.log('👂 Setting up window event listeners...');
    
    try {
      await this.page.evaluate(() => {
        const currentWindow = window.__TAURI__?.window?.getCurrentWindow?.();
        
        if (!currentWindow) {
          return;
        }
        
        // Listen for window events
        currentWindow.listen('tauri://resize', () => {
          console.log('🪟 Window resized');
        });
        
        currentWindow.listen('tauri://move', () => {
          console.log('🪟 Window moved');
        });
        
        currentWindow.listen('tauri://focus', () => {
          console.log('🪟 Window focused');
        });
        
        currentWindow.listen('tauri://blur', () => {
          console.log('🪟 Window blurred');
        });
        
        currentWindow.listen('tauri://close-requested', () => {
          console.log('🪟 Window close requested');
        });
      });
      
      console.log('✅ Window event listeners setup complete');
      
    } catch (error) {
      console.error('❌ Failed to setup window event listeners:', error);
    }
  }

  /**
   * Take a screenshot of a specific window
   */
  async takeWindowScreenshot(windowId?: string, name?: string): Promise<string> {
    const targetId = windowId || 'main';
    const screenshotName = name || `window-${targetId}-${Date.now()}`;
    const screenshotPath = `test-results/window-screenshots/${screenshotName}.png`;
    
    try {
      await this.page.screenshot({ 
        path: screenshotPath,
        fullPage: true 
      });
      
      console.log(`📸 Window screenshot saved: ${screenshotPath}`);
      
      // Attach to test info
      this.testInfo.attachments.push({
        name: screenshotName,
        path: screenshotPath,
        contentType: 'image/png'
      });
      
      return screenshotPath;
      
    } catch (error) {
      console.error('❌ Failed to take window screenshot:', error);
      throw createTestError('Failed to take window screenshot', 'TAKE_WINDOW_SCREENSHOT', { error, windowId: targetId });
    }
  }
}