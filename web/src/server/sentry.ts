/**
 * Sentry Configuration for Bun Backend Server
 *
 * Uses @sentry/bun for optimal Bun runtime integration
 * Separate from frontend Sentry for better error tracking and distributed tracing
 */

import * as Sentry from '@sentry/bun';

/**
 * Initialize Sentry for the Bun backend server
 */
export function initServerSentry() {
  const dsn = process.env.SENTRY_SERVER_DSN || '';

  // Skip initialization if no DSN provided
  if (!dsn) {
    console.log('[Sentry] Backend DSN not configured, skipping initialization');
    return;
  }

  Sentry.init({
    // Use separate DSN for backend project
    dsn: dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || 'dev',

    // Send structured logs to Sentry
    enableLogs: true,

    // Enable distributed tracing
    tracesSampleRate: 1.0, // Capture 100% of the transactions

    // Bun-specific integrations
    integrations: [
      // Bun's built-in HTTP server instrumentation
      Sentry.bunServerIntegration(),

      // Automatically capture console errors
      Sentry.captureConsoleIntegration({
        levels: ['error', 'warn'],
      }),
    ],

    // Filter out noisy errors
    beforeSend(event, hint) {
      // Skip development errors unless explicitly enabled
      if (process.env.NODE_ENV !== 'production' && !process.env.SENTRY_DEBUG) {
        return null;
      }

      const error = hint.originalException;

      // Filter out common non-critical errors
      if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as Error).message;

        // Skip connection errors in development
        if (process.env.NODE_ENV !== 'production') {
          if (message.includes('ECONNREFUSED') || message.includes('ENOTFOUND')) {
            return null;
          }
        }
      }

      return event;
    },

    // Add custom context
    beforeBreadcrumb(breadcrumb) {
      // Filter out verbose HTTP breadcrumbs
      if (breadcrumb.category === 'http' && breadcrumb.data?.method === 'GET') {
        // Only keep failed requests
        if (breadcrumb.data?.status_code && breadcrumb.data.status_code < 400) {
          return null;
        }
      }

      return breadcrumb;
    },
  });

  console.log('[Sentry] Backend initialized successfully');
}

/**
 * Bun.serve() integration
 *
 * For Bun's native server, Sentry.bunServerIntegration() automatically instruments
 * fetch handlers. No additional middleware is needed.
 *
 * To capture errors manually in your Bun server:
 * - Use Sentry.captureException(error) for errors
 * - Use Sentry.captureMessage(message) for messages
 * - Console errors/warnings are automatically captured if captureConsoleIntegration is enabled
 */

// Export Sentry for use in other modules
export { Sentry };
