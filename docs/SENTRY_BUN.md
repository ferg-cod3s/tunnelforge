# Sentry for Bun Backend

**SDK**: `@sentry/bun` (Bun-optimized)
**Alternative**: `@sentry/node` (works but not optimized)

## Why @sentry/bun Instead of @sentry/node?

### @sentry/bun Benefits ✅

1. **Native Bun Integration**: Built specifically for Bun's runtime
2. **Better Performance**: Optimized for Bun's event loop
3. **Automatic Instrumentation**: Works with `Bun.serve()` out of the box
4. **Smaller Bundle**: Leverages Bun's built-in APIs
5. **Better Stack Traces**: Understands Bun's error formats

### Comparison

| Feature | @sentry/bun | @sentry/node |
|---------|-------------|--------------|
| Works with Bun | ✅ Native | ⚠️ Compatible |
| Performance | ✅ Optimized | ⚠️ Not optimized |
| Bundle Size | ✅ Smaller | ⚠️ Larger |
| `Bun.serve()` | ✅ Auto | ❌ Manual |
| Express | ✅ Supported | ✅ Supported |
| Profiling | ✅ Built-in | ⚠️ Requires extra package |

## Installation

```bash
cd web
bun add @sentry/bun
```

## Configuration

### For Bun.serve() (Native)

If you're using Bun's native HTTP server:

```typescript
// bun-server.ts
import { initServerSentry, Sentry } from './server/sentry.js';

// Initialize Sentry FIRST
initServerSentry();

// Bun.serve() is automatically instrumented
const server = Bun.serve({
  port: 3001,
  async fetch(req) {
    // Sentry automatically captures errors and creates traces
    return new Response('Hello');
  },
  error(error) {
    // Manually capture errors in error handler
    Sentry.captureException(error);
    return new Response('Error', { status: 500 });
  }
});
```

### For Express on Bun

If you're using Express with Bun:

```typescript
// server.ts
import express from 'express';
import { initServerSentry, setupExpressSentry, sentryErrorHandler } from './server/sentry.js';

// Initialize Sentry FIRST
initServerSentry();

const app = express();

// Setup Sentry middleware
setupExpressSentry(app);

// Your routes
app.get('/api/test', (req, res) => {
  res.json({ ok: true });
});

// Sentry error handler (AFTER routes)
app.use(sentryErrorHandler);

// Start with Bun
Bun.serve({
  port: 3001,
  fetch(req) {
    return app(req);
  }
});
```

## Environment Variables

```bash
# .env
SENTRY_SERVER_DSN=<your-backend-dsn>
NODE_ENV=development
SENTRY_RELEASE=1.0.0-beta.15
SENTRY_DEBUG=true  # Enable debug logging
```

## Distributed Tracing with Bun

### How It Works

```
Frontend → Bun Server → Go Server
    └──── sentry-trace header ────┘
```

1. **Frontend sends request** with `sentry-trace` header
2. **Bun server** automatically extracts trace context
3. **Transaction created** linked to frontend trace
4. **Spans captured** for database queries, API calls, etc.
5. **Trace visible** in Sentry showing full request path

### Automatic Instrumentation

`@sentry/bun` automatically instruments:
- ✅ HTTP requests (incoming)
- ✅ HTTP requests (outgoing with `fetch`)
- ✅ Promise rejections
- ✅ Uncaught exceptions
- ✅ Console errors (if enabled)

### Manual Instrumentation

For custom operations:

```typescript
import { Sentry } from './server/sentry.js';

async function processSession(sessionId: string) {
  // Create a span for this operation
  return await Sentry.startSpan(
    {
      op: 'process.session',
      name: 'Process Session',
      attributes: { sessionId }
    },
    async (span) => {
      // Your code here
      const result = await doWork();

      // Add data to span
      span.setAttribute('result_size', result.length);

      return result;
    }
  );
}
```

## Integration Examples

### Capture Error

```typescript
try {
  await riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: { operation: 'risky' },
    extra: { sessionId: '123' }
  });
  throw error;
}
```

### Add Breadcrumbs

```typescript
Sentry.addBreadcrumb({
  category: 'session',
  message: 'Creating new PTY session',
  level: 'info',
  data: { sessionId, command }
});
```

### Set User Context

```typescript
Sentry.setUser({
  id: userId,
  username: username,
  email: email
});
```

### Create Transaction

```typescript
const transaction = Sentry.startTransaction({
  op: 'http.server',
  name: 'POST /api/sessions'
});

try {
  // Your code
  transaction.setStatus('ok');
} catch (error) {
  transaction.setStatus('internal_error');
  Sentry.captureException(error);
} finally {
  transaction.finish();
}
```

## Performance Monitoring

### Web Vitals for Backend

```typescript
import { Sentry } from './server/sentry.js';

// Track custom metrics
Sentry.setMeasurement('pty_spawn_time', 45, 'millisecond');
Sentry.setMeasurement('session_count', 12, 'none');

// Track operation timing
const start = Date.now();
await createSession();
const duration = Date.now() - start;
Sentry.setMeasurement('session_creation', duration, 'millisecond');
```

## Common Issues

### Issue: Sentry Not Capturing Errors

**Solution**: Make sure `initServerSentry()` is called **before** any other imports:

```typescript
// ✅ CORRECT
import { initServerSentry } from './server/sentry.js';
initServerSentry();

import express from 'express';
import routes from './routes.js';

// ❌ WRONG
import express from 'express';
import routes from './routes.js';
import { initServerSentry } from './server/sentry.js';
initServerSentry();
```

### Issue: Traces Not Linking

**Solution**: Ensure frontend `tracePropagationTargets` matches your API domain:

```typescript
// Frontend config
tracePropagationTargets: ['localhost', /yourapi\.com/]
```

### Issue: Too Many Events

**Solution**: Lower sample rates in production:

```typescript
Sentry.init({
  tracesSampleRate: 0.1,  // 10% of transactions
  // ... other config
});
```

## Migration from @sentry/node

If you're currently using `@sentry/node`:

1. **Install @sentry/bun**:
   ```bash
   bun add @sentry/bun
   bun remove @sentry/node @sentry/profiling-node
   ```

2. **Update imports**:
   ```typescript
   // Before
   import * as Sentry from '@sentry/node';
   import { nodeProfilingIntegration } from '@sentry/profiling-node';

   // After
   import * as Sentry from '@sentry/bun';
   ```

3. **Update integrations**:
   ```typescript
   // Before
   integrations: [
     Sentry.httpIntegration(),
     nodeProfilingIntegration()
   ]

   // After
   integrations: [
     Sentry.bunServerIntegration()
   ]
   ```

4. **Test**: Verify errors and traces are still captured

## Testing Your Setup

### 1. Test Error Capture

```bash
# Start server with Sentry
bun run src/bun-server.ts

# Trigger test error
curl http://localhost:3001/api/test-error
```

**Expected**: Error appears in Sentry project

### 2. Test Distributed Tracing

1. Make API call from frontend
2. Go to Sentry → Performance → Transactions
3. Click on a transaction
4. **Expected**: See spans from both frontend and backend

### 3. Test Console Capture

```typescript
console.error('Test error from Bun server');
```

**Expected**: Error appears in Sentry (if `captureConsoleIntegration` is enabled)

## Resources

- [@sentry/bun Documentation](https://docs.sentry.io/platforms/javascript/guides/bun/)
- [Bun Sentry Integration](https://bun.sh/docs/ecosystem/sentry)
- [Distributed Tracing](https://docs.sentry.io/product/sentry-basics/tracing/distributed-tracing/)
