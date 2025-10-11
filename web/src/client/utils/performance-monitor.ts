/**
 * Performance Monitoring Utility
 *
 * Tracks Core Web Vitals and custom performance metrics
 * Integrates with Sentry for error tracking
 */

import { Sentry } from '../../sentry.js';

interface PerformanceMetrics {
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
  tti?: number; // Time to Interactive
}

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {};

  constructor() {
    if (typeof window === 'undefined') return;

    // Measure Core Web Vitals
    this.measureCoreWebVitals();

    // Report metrics to Sentry
    this.reportMetrics();
  }

  private measureCoreWebVitals() {
    // First Contentful Paint (FCP)
    const fcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const fcp = entries.find((entry) => entry.name === 'first-contentful-paint');
      if (fcp) {
        this.metrics.fcp = fcp.startTime;
        this.logMetric('FCP', fcp.startTime);
      }
    });

    try {
      fcpObserver.observe({ entryTypes: ['paint'] });
    } catch (_e) {
      // Browser doesn't support paint timing
      console.warn('Paint timing not supported');
    }

    // Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        this.metrics.lcp = lastEntry.startTime;
        this.logMetric('LCP', lastEntry.startTime);
      }
    });

    try {
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (_e) {
      console.warn('LCP not supported');
    }

    // First Input Delay (FID)
    const fidObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const firstInput = entries[0] as PerformanceEventTiming;
      if (firstInput) {
        this.metrics.fid = firstInput.processingStart - firstInput.startTime;
        this.logMetric('FID', this.metrics.fid);
      }
    });

    try {
      fidObserver.observe({ entryTypes: ['first-input'] });
    } catch (_e) {
      console.warn('FID not supported');
    }

    // Cumulative Layout Shift (CLS)
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }
      this.metrics.cls = clsValue;
    });

    try {
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (_e) {
      console.warn('CLS not supported');
    }

    // Time to First Byte (TTFB)
    const navigationEntry = performance.getEntriesByType(
      'navigation'
    )[0] as PerformanceNavigationTiming;
    if (navigationEntry) {
      this.metrics.ttfb = navigationEntry.responseStart - navigationEntry.requestStart;
      this.logMetric('TTFB', this.metrics.ttfb);
    }
  }

  private logMetric(name: string, value: number) {
    console.log(`[Performance] ${name}: ${value.toFixed(2)}ms`);

    // Add custom measurement to Sentry
    Sentry.setMeasurement(name, value, 'millisecond');
  }

  private reportMetrics() {
    // Wait for page to be fully loaded before reporting
    if (document.readyState === 'complete') {
      this.sendMetrics();
    } else {
      window.addEventListener('load', () => {
        setTimeout(() => this.sendMetrics(), 0);
      });
    }
  }

  private sendMetrics() {
    // Log all metrics
    console.log('[Performance] Core Web Vitals:', this.metrics);

    // Send to Sentry as context
    Sentry.setContext('performance', {
      metrics: this.metrics,
      timestamp: new Date().toISOString(),
    });

    // Create a custom span for performance
    Sentry.startSpan(
      {
        name: 'Page Load Performance',
        op: 'pageload',
      },
      (span) => {
        // Add measurements as data
        Object.entries(this.metrics).forEach(([key, value]) => {
          if (value !== undefined) {
            span?.setData(key.toUpperCase(), value);
          }
        });
      }
    );
  }

  // Public method to get current metrics
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // Track custom timing
  trackCustomTiming(name: string, startTime: number) {
    const duration = performance.now() - startTime;
    console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
    Sentry.setMeasurement(name, duration, 'millisecond');
    return duration;
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();
