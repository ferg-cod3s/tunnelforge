# Sentry Multi-Project Setup Guide

**Status**: Configuration Ready
**Architecture**: Distributed Tracing Across Frontend, Node.js Backend, and Go Server

## Overview

TunnelForge uses **three separate Sentry projects** linked together with distributed tracing:

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│  Frontend (Web) │────▶│  Node.js Server  │────▶│   Go Server    │
│  @sentry/browser│     │   @sentry/node   │     │   sentry-go    │
└─────────────────┘     └──────────────────┘     └────────────────┘
         │                       │                       │
         └───────────── Linked by Trace ID ──────────────┘
```

## Why Separate Projects?

1. **Different SDKs**: Each layer requires different Sentry SDK
2. **Isolated Metrics**: Clear performance metrics per layer
3. **Better Filtering**: Easy to find frontend vs backend vs server errors
4. **Team Access**: Different teams can have different permissions
5. **Alert Routing**: Configure alerts specific to each layer

## Sentry Project Structure

### Project 1: `tunnelforge-web` (Frontend)
- **Platform**: JavaScript/Browser
- **DSN**: `https://7afe672f8dcad80804647bc69a386687@sentry.fergify.work/10`
- **SDK**: `@sentry/browser`
- **Location**: `web/src/sentry.ts`
- **Tracks**: UI errors, browser performance, user interactions

### Project 2: `tunnelforge-server` (Bun) ✅
- **Platform**: Node.js (select this in Sentry, Bun uses same project type)
- **DSN**: `https://9f43c806cd915c331753ca7e627ae479@sentry.fergify.work/11`
- **SDK**: `@sentry/bun` (Bun-optimized, better than `@sentry/node`)
- **Location**: `web/src/server/sentry.ts`
- **Tracks**: API errors, server performance, request tracing
- **See**: `docs/SENTRY_BUN.md` for Bun-specific setup
- **Status**: ✅ Configured and integrated

### Project 3: `tunnelforge-go` (Go Server) ✅
- **Platform**: Go
- **DSN**: `https://00bf7c0e2b55613e91a5bc455298896f@sentry.fergify.work/12`
- **SDK**: `sentry-go`
- **Location**: `server/internal/sentry/sentry.go`
- **Tracks**: PTY errors, WebSocket issues, Go server performance
- **Status**: ✅ Configured and ready for integration

## Setup Instructions

### Step 1: Create Sentry Projects

1. **Log in to Sentry**: https://sentry.fergify.work
2. **Create Projects**:
   - Click "Projects" → "Create Project"
   - **Project 1**: Select "JavaScript" → Name: `tunnelforge-web`
   - **Project 2**: Select "Node.js" → Name: `tunnelforge-server`
   - **Project 3** (optional): Select "Go" → Name: `tunnelforge-go`

3. **Copy DSNs**:
   - Frontend DSN: Already set ✅
   - Backend DSN: Copy from `tunnelforge-server` project settings
   - Go DSN: Copy from `tunnelforge-go` project settings (if created)

### Step 2: Configure Environment Variables ✅

The `.env.development` file has been configured with:

```bash
# Frontend Sentry (Browser) ✅
VITE_SENTRY_DSN=https://7afe672f8dcad80804647bc69a386687@sentry.fergify.work/10
VITE_SENTRY_ENVIRONMENT=development
VITE_SENTRY_RELEASE=1.0.0-dev
VITE_ENABLE_SENTRY=true  # Enable in development

# Backend Sentry (Bun) ✅
SENTRY_SERVER_DSN=https://9f43c806cd915c331753ca7e627ae479@sentry.fergify.work/11
NODE_ENV=development
SENTRY_RELEASE=1.0.0-dev
SENTRY_DEBUG=true

# Go Backend Sentry ✅
SENTRY_GO_DSN=https://00bf7c0e2b55613e91a5bc455298896f@sentry.fergify.work/12
```

### Step 3: Integrate Sentry in Bun Server ✅

The Bun server has been configured with Sentry initialization:

```typescript
// web/src/bun-server.ts
// Initialize Sentry for backend error tracking
import { initServerSentry } from './server/sentry.js';
initServerSentry();

const server = Bun.serve({
  // Server configuration...
});
```

The `initServerSentry()` function automatically:
- Checks for `SENTRY_SERVER_DSN` environment variable
- Configures distributed tracing with `tracesSampleRate: 1.0`
- Enables structured logs with `enableLogs: true`
- Sets up Bun-specific instrumentation
- Captures console errors and warnings
- Filters out noisy development errors

### Step 4: Test Distributed Tracing

Create a test endpoint to verify tracing:

```typescript
// web/src/server/routes/test.ts
import { Router } from 'express';
import { Sentry } from '../sentry.js';

const router = Router();

router.get('/test-sentry', (req, res) => {
  // Start a transaction
  const transaction = Sentry.startTransaction({
    op: 'test',
    name: 'Test Sentry Integration',
  });

  // Add breadcrumb
  Sentry.addBreadcrumb({
    category: 'test',
    message: 'Testing Sentry',
    level: 'info',
  });

  // Capture message
  Sentry.captureMessage('Test message from Node.js backend');

  transaction.finish();

  res.json({ success: true, message: 'Check Sentry for test event' });
});

router.get('/test-error', (req, res, next) => {
  // This will be caught by Sentry error handler
  next(new Error('Test error from Node.js backend'));
});

export default router;
```

## Distributed Tracing Flow

### How It Works

1. **User Action in Browser**:
   ```typescript
   // Frontend makes API call with Sentry trace headers
   fetch('/api/sessions', {
     headers: {
       'sentry-trace': '<trace-id>',
       'baggage': '<trace-context>'
     }
   });
   ```

2. **Node.js Server Receives Request**:
   ```typescript
   // Sentry automatically extracts trace headers
   // Creates span linked to frontend transaction
   app.post('/api/sessions', async (req, res) => {
     const transaction = Sentry.getCurrentHub().getScope()?.getTransaction();
     // This transaction is linked to frontend
   });
   ```

3. **Go Server Called** (if instrumented):
   ```go
   // Go server extracts trace headers
   // Creates span linked to Node.js transaction
   span := sentry.StartSpan(ctx, "create.session")
   defer span.Finish()
   ```

### Viewing Traces in Sentry

1. Go to **Performance** tab in Sentry
2. Click on any transaction
3. See **Trace View** showing full request path:
   ```
   Frontend → Node.js API → Go Server → Database
      └── All linked by same trace ID
   ```

## Project-Specific Configuration

### Frontend (`tunnelforge-web`)

**Focus**: User experience, browser errors, page performance

**Alerts**:
- Error rate >10/hour
- LCP >3s for 5+ users
- JS errors in production

**Features**:
- ✅ Session replay
- ✅ Performance monitoring
- ✅ User feedback widget
- ✅ Breadcrumbs

### Backend (`tunnelforge-server`)

**Focus**: API errors, server performance, request tracing

**Alerts**:
- 500 errors
- API response time >1s
- High memory usage

**Features**:
- ✅ Request/response tracking
- ✅ Distributed tracing
- ✅ CPU/memory profiling
- ✅ Console error capture

### Go Server (`tunnelforge-go`) - Optional

**Focus**: PTY errors, WebSocket issues, system-level errors

**Alerts**:
- PTY spawn failures
- WebSocket disconnects
- Panic recovery

**Features**:
- Panic recovery
- Goroutine tracking
- Context propagation
- Performance profiling

## Trace Propagation Configuration

### Frontend (Already Configured ✅)

```typescript
// web/src/sentry.ts
tracePropagationTargets: [
  'localhost',
  /^https:\/\/.*\.fergify\.work\/api/
],
```

This tells the frontend to attach trace headers to API calls matching these patterns.

### Backend (Automatic)

The `@sentry/node` integration automatically:
1. Extracts trace headers from incoming requests
2. Continues the transaction started by frontend
3. Adds backend spans to the trace
4. Propagates traces to downstream services (Go server)

### Go Server (If Implemented)

```go
// server/internal/sentry/sentry.go
import "github.com/getsentry/sentry-go"

// Extract trace from HTTP headers
transaction := sentry.StartTransaction(
    ctx,
    "create.session",
    sentry.ContinueFromHeaders(r.Header),
)
defer transaction.Finish()
```

## Testing Your Setup

### 1. Frontend Error Test

```javascript
// In browser console
throw new Error('Frontend test error');
```

**Expected**: Error appears in `tunnelforge-web` project

### 2. Backend Error Test

```bash
curl http://localhost:4020/api/test-error
```

**Expected**: Error appears in `tunnelforge-server` project

### 3. Distributed Trace Test

1. Open browser with DevTools
2. Make an API call (e.g., create session)
3. Go to Sentry Performance tab
4. Find the transaction
5. Click "View Trace"
6. **Expected**: See spans from both frontend and backend

## Environment-Specific Configuration

### Development

```bash
# Enable Sentry in development
VITE_ENABLE_SENTRY=true
SENTRY_DEBUG=true

# Use development environment
VITE_SENTRY_ENVIRONMENT=development
```

### Staging

```bash
VITE_SENTRY_ENVIRONMENT=staging
NODE_ENV=staging
```

### Production

```bash
VITE_SENTRY_ENVIRONMENT=production
NODE_ENV=production

# Lower sample rates in production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_REPLAYS_SAMPLE_RATE=0.05
```

## Common Issues & Solutions

### Issue: Frontend Events Not Linked to Backend

**Cause**: `tracePropagationTargets` not matching API URLs

**Solution**:
```typescript
// Update frontend config to match your API domain
tracePropagationTargets: [
  'localhost',
  window.location.host,  // Current host
  /^https:\/\/.*\.fergify\.work/  // All Fergify domains
],
```

### Issue: Backend Not Capturing Errors

**Cause**: Sentry middleware not in correct order

**Solution**:
```typescript
// CORRECT order:
app.use(sentryRequestHandler());  // 1. Request handler
app.use(sentryTracingHandler());  // 2. Tracing handler
app.use('/api', routes);          // 3. Your routes
app.use(sentryErrorHandler());    // 4. Error handler (BEFORE custom handlers)
app.use(customErrorHandler);      // 5. Custom error handlers
```

### Issue: Duplicate Events

**Cause**: Both frontend and backend capturing same error

**Solution**:
- **Frontend**: Capture UI/rendering errors
- **Backend**: Capture API/server errors
- Use `beforeSend` to filter appropriately

## Monitoring Dashboard

### Recommended Sentry Setup

1. **Create Teams**:
   - `frontend` team → `tunnelforge-web` project
   - `backend` team → `tunnelforge-server` + `tunnelforge-go` projects

2. **Configure Alerts**:
   - Email alerts for critical errors
   - Slack integration for error spikes
   - PagerDuty for production incidents

3. **Set Issue Owners**:
   - Auto-assign based on error location
   - Route frontend errors to UI team
   - Route backend errors to API team

## Performance Budgets

### Frontend (`tunnelforge-web`)
- LCP < 2.5s (p75)
- FCP < 1.8s (p75)
- Error rate < 0.1%

### Backend (`tunnelforge-server`)
- API response < 200ms (p95)
- Error rate < 0.5%
- Memory usage < 512MB

### Go Server (`tunnelforge-go`)
- PTY spawn < 100ms
- WebSocket latency < 50ms
- Error rate < 0.1%

## Next Steps

1. ✅ **Frontend Sentry**: Already configured (`tunnelforge-web`)
2. ✅ **Create Backend Project**: Created `tunnelforge-server` project (Bun)
3. ✅ **Add Backend DSN**: Updated `.env.development` with backend DSN
4. ✅ **Integrate in Server**: Sentry initialized in `bun-server.ts`
5. ✅ **Create Go Project**: Created `tunnelforge-go` project
6. ✅ **Add Go DSN**: Updated `.env.development` with Go backend DSN
7. ✅ **Integrate Go Sentry**: `sentry.Initialize()` called in `server/cmd/server/main.go:22`
8. **Test Tracing**: Restart servers and verify errors are captured in all three projects

### Testing Your Setup

1. **Restart all servers** to load the new Sentry configuration:
   ```bash
   # Bun server
   cd web && bun run dev
   # You should see: [Sentry] Backend initialized successfully

   # Go server
   cd server && go run cmd/server/main.go
   # You should see: [Sentry] Go backend initialized successfully
   ```

2. **Verify Frontend Errors** are captured:
   ```javascript
   // In browser console
   throw new Error('Frontend test error');
   ```
   → Check `tunnelforge-web` project in Sentry

3. **Test Bun Backend Error Capture**:
   - Make API calls that might error
   - Check console.error() messages
   → Check `tunnelforge-server` project in Sentry

4. **Test Go Backend Error Capture**:
   - Trigger PTY or WebSocket errors
   - Use `sentry.CaptureError()` in error handlers
   → Check `tunnelforge-go` project in Sentry

5. **Verify Distributed Tracing**:
   - Make a request that goes: Frontend → Bun → Go
   - Click on an error in Sentry
   - View the trace to see all three services linked together

6. **Monitor Structured Logs**:
   - Console errors and warnings are automatically sent to Sentry
   - Check the "Logs" tab in Sentry issues for detailed context

## Resources

- [Sentry Node.js Integration](https://docs.sentry.io/platforms/node/)
- [Sentry Distributed Tracing](https://docs.sentry.io/product/sentry-basics/tracing/distributed-tracing/)
- [Sentry Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Sentry Go SDK](https://docs.sentry.io/platforms/go/)
