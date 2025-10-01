import * as Sentry from '@sentry/browser';

// Initialize Sentry for the web frontend
export function initSentry() {
  // Check if we're in a browser environment (client-side)
  const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

  if (isBrowser) {
    // Browser environment - use import.meta.env (Vite)
    Sentry.init({
      dsn: (import.meta as any).env?.VITE_SENTRY_DSN || '',
      environment: (import.meta as any).env?.VITE_SENTRY_ENVIRONMENT || 'development',
      release: (import.meta as any).env?.VITE_SENTRY_RELEASE || 'dev',
      // Set TracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
      // We recommend adjusting this value in production,
      tracesSampleRate: 1.0,
      // Set ProfilesSampleRate to profile 100% of sampled transactions.
      // We recommend adjusting this value in production,
      profilesSampleRate: 1.0,
      // Capture console logs and errors
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.feedbackIntegration({
          // Additional Feedback configuration
          colorScheme: "auto",
          showBranding: true,
        }),
      ],
      // Performance monitoring
      enabled: (import.meta as any).env?.PROD,
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