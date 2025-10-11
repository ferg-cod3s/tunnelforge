import * as Sentry from '@sentry/browser';

// Initialize Sentry for the web frontend
export function initSentry() {
  // Check if we're in a browser environment (client-side)
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

  if (isBrowser) {
    // Browser environment - use import.meta.env (Vite)
    Sentry.init({
      dsn:
        (import.meta as any).env?.VITE_SENTRY_DSN ||
        'https://7afe672f8dcad80804647bc69a386687@sentry.fergify.work/10',
      environment: (import.meta as any).env?.VITE_SENTRY_ENVIRONMENT || 'development',
      release: (import.meta as any).env?.VITE_SENTRY_RELEASE || 'dev',
      // Setting this option to true will send default PII data to Sentry
      sendDefaultPii: true,
      // Tracing - Capture 100% of the transactions
      tracesSampleRate: 1.0,
      // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
      tracePropagationTargets: ['localhost', /^https:\/\/.*\.fergify\.work\/api/],
      // Session Replay - 10% sample rate in production, 100% for errors
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      // Integrations
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration(),
        Sentry.feedbackIntegration({
          colorScheme: 'auto',
          showBranding: true,
        }),
      ],
      // Add breadcrumbs for better error context
      beforeBreadcrumb(breadcrumb) {
        // Filter out noisy breadcrumbs
        if (breadcrumb.category === 'console' && breadcrumb.level === 'log') {
          return null;
        }
        return breadcrumb;
      },
      // Performance monitoring
      enabled:
        (import.meta as any).env?.PROD || (import.meta as any).env?.VITE_ENABLE_SENTRY === 'true',
      // Before sending events, filter out development errors
      beforeSend(event, hint) {
        // Filter out network errors in development
        if ((import.meta as any).env?.DEV && event.exception) {
          const error = hint.originalException;
          if (error && typeof error === 'object' && 'message' in error) {
            const message = (error as Error).message;
            if (message.includes('Network Error') || message.includes('Failed to fetch')) {
              return null;
            }
          }
        }
        return event;
      },
    });
  } else {
    // Node.js/server environment - use process.env
    Sentry.init({
      dsn: process.env.SENTRY_DSN || '',
      environment: process.env.SENTRY_ENVIRONMENT || 'development',
      release: process.env.SENTRY_RELEASE || 'dev',
      // Set TracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
      // We recommend adjusting this value in production,
      tracesSampleRate: 1.0,
      // Set ProfilesSampleRate to profile 100% of sampled transactions.
      // We recommend adjusting this value in production,
      profilesSampleRate: 1.0,
      // Performance monitoring
      enabled: process.env.NODE_ENV === 'production',
      // Before sending events, filter out development errors
      beforeSend(event, hint) {
        // Filter out network errors in development
        if (process.env.NODE_ENV !== 'production' && event.exception) {
          const error = hint.originalException;
          if (error && typeof error === 'object' && 'message' in error) {
            const message = (error as Error).message;
            if (message.includes('Network Error') || message.includes('Failed to fetch')) {
              return null;
            }
          }
        }
        return event;
      },
    });
  }
}

// Export Sentry for use in other modules
export { Sentry };
