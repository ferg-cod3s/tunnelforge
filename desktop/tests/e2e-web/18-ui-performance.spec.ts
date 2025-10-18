import { test, expect } from '@playwright/test';
import axios from 'axios';

const BASE_URL = 'http://localhost:4021';
const API_URL = `${BASE_URL}/api`;

const api = axios.create({
  baseURL: API_URL,
  validateStatus: () => true,
});

test.describe('UI and Performance Metrics', () => {
  let page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
  });

  test.describe('Page Load Performance', () => {
    test('should load login page within acceptable time', async () => {
      const startTime = Date.now();
      
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
      
      const loadTime = Date.now() - startTime;
      
      // Login page should load in under 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test('should load dashboard within acceptable time', async () => {
      // First login
      await page.goto(`${BASE_URL}/login`);
      await page.fill('input[name="username"]', 'testuser');
      await page.fill('input[name="password"]', 'testpass123');
      await page.click('button[type="submit"]');

      const startTime = Date.now();
      
      await page.waitForNavigation();
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      
      // Dashboard should load in under 5 seconds after login
      expect(loadTime).toBeLessThan(5000);
    });

    test('should load terminal session within acceptable time', async () => {
      await page.goto(`${BASE_URL}/dashboard`);
      
      const startTime = Date.now();
      
      await page.click('button:has-text("New Session")');
      await page.waitForLoadState('networkidle');
      
      const loadTime = Date.now() - startTime;
      
      // Terminal should open in under 2 seconds
      expect(loadTime).toBeLessThan(2000);
    });
  });

  test.describe('Core Web Vitals', () => {
    test('should measure Largest Contentful Paint (LCP)', async () => {
      const lcpPromise = page.evaluate(() => {
        return new Promise((resolve) => {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            resolve(lastEntry.renderTime || lastEntry.loadTime);
          });

          observer.observe({ entryTypes: ['largest-contentful-paint'] });

          // Timeout after 5 seconds
          setTimeout(() => resolve(null), 5000);
        });
      });

      await page.goto(`${BASE_URL}/dashboard`);
      const lcp = await lcpPromise;

      // LCP should be under 2.5 seconds
      if (lcp) {
        expect(lcp).toBeLessThan(2500);
      }
    });

    test('should measure First Input Delay (FID)', async () => {
      const fidPromise = page.evaluate(() => {
        return new Promise((resolve) => {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            resolve(entries[0].processingDuration);
          });

          observer.observe({ entryTypes: ['first-input'] });

          // Timeout after 5 seconds
          setTimeout(() => resolve(null), 5000);
        });
      });

      await page.goto(`${BASE_URL}/dashboard`);
      
      // Simulate user interaction
      await page.click('button:first-of-type');
      
      const fid = await fidPromise;

      // FID should be under 100ms
      if (fid) {
        expect(fid).toBeLessThan(100);
      }
    });

    test('should measure Cumulative Layout Shift (CLS)', async () => {
      const clsPromise = page.evaluate(() => {
        let clsValue = 0;
        
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
        });

        observer.observe({ entryTypes: ['layout-shift'] });

        // Return CLS value after 3 seconds
        return new Promise((resolve) => {
          setTimeout(() => resolve(clsValue), 3000);
        });
      });

      await page.goto(`${BASE_URL}/dashboard`);
      const cls = await clsPromise;

      // CLS should be under 0.1
      if (cls) {
        expect(cls).toBeLessThan(0.1);
      }
    });

    test('should measure Time to Interactive (TTI)', async () => {
      const startTime = Date.now();
      
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
      
      const tti = Date.now() - startTime;

      // TTI should be under 5 seconds
      expect(tti).toBeLessThan(5000);
    });

    test('should measure First Contentful Paint (FCP)', async () => {
      const fcpPromise = page.evaluate(() => {
        const perfData = performance.getEntriesByType('paint');
        const fcp = perfData.find(entry => entry.name === 'first-contentful-paint');
        return fcp ? fcp.startTime : null;
      });

      const startTime = Date.now();
      await page.goto(`${BASE_URL}/dashboard`);
      const fcp = await fcpPromise;

      // FCP should be under 1.8 seconds
      if (fcp) {
        expect(fcp).toBeLessThan(1800);
      }
    });
  });

  test.describe('Memory Usage', () => {
    test('should not have excessive memory growth', async () => {
      // Note: Memory metrics may not be available in all browsers
      const initialMemory = await page.evaluate(() => {
        if (performance.memory) {
          return performance.memory.usedJSHeapSize;
        }
        return null;
      });

      // Perform various UI operations
      for (let i = 0; i < 5; i++) {
        await page.goto(`${BASE_URL}/dashboard`);
        await page.waitForLoadState('networkidle');
      }

      const finalMemory = await page.evaluate(() => {
        if (performance.memory) {
          return performance.memory.usedJSHeapSize;
        }
        return null;
      });

      // If memory metrics available, growth should be reasonable
      if (initialMemory && finalMemory) {
        const growth = finalMemory - initialMemory;
        // Allow up to 20MB growth
        expect(growth).toBeLessThan(20 * 1024 * 1024);
      }
    });

    test('should cleanup memory on page navigation', async () => {
      await page.goto(`${BASE_URL}/dashboard`);
      
      const memBefore = await page.evaluate(() => {
        if (performance.memory) {
          return performance.memory.usedJSHeapSize;
        }
        return null;
      });

      // Navigate away
      await page.goto(`${BASE_URL}/login`);

      const memAfter = await page.evaluate(() => {
        if (performance.memory) {
          return performance.memory.usedJSHeapSize;
        }
        return null;
      });

      // Memory should not significantly increase
      if (memBefore && memAfter) {
        const increase = memAfter - memBefore;
        expect(increase).toBeLessThan(5 * 1024 * 1024);
      }
    });
  });

  test.describe('Terminal Responsiveness', () => {
    test('should respond to input quickly', async () => {
      await page.goto(`${BASE_URL}/dashboard`);
      
      // Open terminal
      await page.click('button:has-text("New Session")');
      await page.waitForLoadState('networkidle');

      const startTime = Date.now();
      
      // Type in terminal
      await page.fill('[data-testid="terminal-input"]', 'echo "test"');
      
      const inputTime = Date.now() - startTime;

      // Input should be responsive (under 200ms)
      expect(inputTime).toBeLessThan(200);
    });

    test('should render terminal output quickly', async () => {
      await page.goto(`${BASE_URL}/dashboard`);
      
      // Open terminal
      await page.click('button:has-text("New Session")');
      await page.waitForLoadState('networkidle');

      const startTime = Date.now();
      
      // Execute command
      await page.click('[data-testid="terminal-input"]');
      await page.keyboard.type('ls\n');
      
      // Wait for output
      await page.waitForSelector('[data-testid="terminal-output"]', { timeout: 2000 }).catch(() => {});
      
      const renderTime = Date.now() - startTime;

      // Output should render within 2 seconds
      expect(renderTime).toBeLessThan(2000);
    });
  });

  test.describe('API Response Times', () => {
    test('should respond to auth requests quickly', async () => {
      const startTime = Date.now();
      
      const response = await api.post('/auth/login', {
        username: 'testuser',
        password: 'testpass123'
      });

      const responseTime = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000); // Should respond in under 1 second
    });

    test('should respond to session creation requests quickly', async () => {
      const startTime = Date.now();
      
      const response = await api.post('/sessions', {
        command: '/bin/bash',
        cols: 80,
        rows: 24
      });

      const responseTime = Date.now() - startTime;

      expect([200, 401]).toContain(response.status);
      expect(responseTime).toBeLessThan(2000); // Should respond in under 2 seconds
    });

    test('should respond to file operations quickly', async () => {
      const startTime = Date.now();
      
      const response = await api.get('/files', {
        params: { path: '/tmp' }
      });

      const responseTime = Date.now() - startTime;

      expect([200, 400]).toContain(response.status);
      expect(responseTime).toBeLessThan(1000); // Should respond in under 1 second
    });

    test('should maintain response time under load', async () => {
      const responseTimes = [];

      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        
        await api.get('/');
        
        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);
      }

      const avgResponseTime = responseTimes.reduce((a, b) => a + b) / responseTimes.length;

      // Average response time should be under 500ms
      expect(avgResponseTime).toBeLessThan(500);
    });
  });

  test.describe('Dashboard Performance', () => {
    test('should render dashboard components efficiently', async () => {
      const startTime = Date.now();
      
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForLoadState('networkidle');

      // Wait for components to render
      await page.waitForSelector('[data-testid="dashboard-container"]', { timeout: 3000 }).catch(() => {});

      const renderTime = Date.now() - startTime;

      // Full dashboard render should be under 3 seconds
      expect(renderTime).toBeLessThan(3000);
    });

    test('should handle sidebar navigation smoothly', async () => {
      await page.goto(`${BASE_URL}/dashboard`);

      const startTime = Date.now();

      // Click sidebar items
      const sidebarItems = await page.$$('[data-testid="sidebar-item"]');
      
      for (let i = 0; i < Math.min(3, sidebarItems.length); i++) {
        await sidebarItems[i].click();
        await page.waitForLoadState('networkidle');
      }

      const navigationTime = Date.now() - startTime;

      // Navigation should be smooth (under 2 seconds per item avg)
      expect(navigationTime).toBeLessThan(6000);
    });

    test('should update dashboard data efficiently', async () => {
      await page.goto(`${BASE_URL}/dashboard`);

      const startTime = Date.now();

      // Trigger data refresh
      await page.click('button[title="Refresh"]').catch(() => {});
      await page.waitForLoadState('networkidle');

      const refreshTime = Date.now() - startTime;

      // Refresh should complete within 2 seconds
      expect(refreshTime).toBeLessThan(2000);
    });
  });

  test.describe('Performance Optimization Validation', () => {
    test('should use efficient resource loading', async () => {
      const resourceTiming = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource');
        return {
          totalResources: resources.length,
          largeResources: resources.filter(r => r.transferSize > 1000000).length,
          avgSize: resources.reduce((sum, r) => sum + r.transferSize, 0) / resources.length
        };
      });

      // Should not have excessive large resources
      expect(resourceTiming.largeResources).toBeLessThan(5);
      
      // Average resource size should be reasonable
      expect(resourceTiming.avgSize).toBeLessThan(100000); // 100KB average
    });

    test('should minimize HTTP requests', async () => {
      const requests = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource');
        return resources.length;
      });

      // Should not make excessive HTTP requests
      expect(requests).toBeLessThan(50);
    });

    test('should properly cache resources', async () => {
      // Load page twice and check for cache usage
      await page.goto(`${BASE_URL}/dashboard`);
      const firstLoadTime = await page.evaluate(() => {
        const navigationTiming = performance.getEntriesByType('navigation')[0];
        return navigationTiming.loadEventEnd - navigationTiming.fetchStart;
      });

      // Clear cache and reload
      await page.reload({ waitUntil: 'networkidle' });
      const secondLoadTime = await page.evaluate(() => {
        const navigationTiming = performance.getEntriesByType('navigation')[0];
        return navigationTiming.loadEventEnd - navigationTiming.fetchStart;
      });

      // Second load should be faster due to caching (or similar)
      expect(secondLoadTime).toBeLessThanOrEqual(firstLoadTime + 500); // Allow slight variance
    });
  });
});
