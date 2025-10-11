# Performance Monitoring & Error Tracking Setup

**Status**: ✅ Configured and Ready
**Date**: 2025-10-04
**Tools**: Lighthouse, Sentry, Core Web Vitals

## Overview

TunnelForge now has comprehensive performance monitoring and error tracking configured to establish baselines before the Lit → Astro/Svelte migration and track improvements during the migration.

## Components Configured

### 1. XTerm.js WebSocket Fix ✅

**Issue Found**: The `/api/config` endpoint was missing the `websocketUrl` field, causing terminal connections to fail.

**Fix Applied**: `web/src/server/routes/config.ts:53-78`
- Added `websocketUrl` to the AppConfig interface
- WebSocket URL is now dynamically generated based on request protocol and host
- Returns `ws://localhost:4020` for local development
- Supports `wss://` for HTTPS connections

**Testing**:
```bash
curl http://localhost:4020/api/config | jq .websocketUrl
# Should return: "ws://localhost:4020"
```

### 2. Lighthouse Baseline Measurements ✅

**Script**: `web/scripts/lighthouse-baseline.js`

**Purpose**: Measures current performance to establish migration baseline

**Metrics Captured**:
- **Performance Score** (target: 90/100)
- **Accessibility Score**
- **Best Practices Score**
- **SEO Score**
- **Core Web Vitals**:
  - First Contentful Paint (FCP)
  - Largest Contentful Paint (LCP)
  - Total Blocking Time (TBT)
  - Cumulative Layout Shift (CLS)
  - Speed Index
  - Time to Interactive (TTI)
- **Bundle Sizes**:
  - Total page weight
  - JavaScript size

**Usage**:
```bash
cd web
node scripts/lighthouse-baseline.js
```

**Output**:
- Console summary of all metrics
- JSON report saved to `web/lighthouse-reports/baseline-YYYY-MM-DD.json`

**Comparison**:
```json
{
  "current": {
    "bundleSize": "420KB",
    "performanceScore": "TBD",
    "fcp": "TBD ms",
    "lcp": "TBD ms",
    "tti": "TBD ms"
  },
  "target": {
    "bundleSize": "67KB (84% reduction)",
    "performanceScore": "90/100",
    "fcp": "<1500ms",
    "lcp": "<2500ms",
    "tti": "<3000ms"
  }
}
```

### 3. Sentry Error Tracking ✅

**Configuration**: `web/src/sentry.ts`

**DSN**: `https://7afe672f8dcad80804647bc69a386687@sentry.fergify.work/10`

**Features Enabled**:
- **Session Replay**: 10% of normal sessions, 100% of error sessions
- **Performance Tracing**: 100% transaction sampling
- **User Feedback**: Built-in feedback widget
- **Breadcrumbs**: Filtered console logs for error context
- **Privacy**: PII collection enabled, but replay masks sensitive data

**Configuration Details**:
```typescript
{
  dsn: 'https://7afe672f8dcad80804647bc69a386687@sentry.fergify.work/10',
  sendDefaultPii: true,
  tracesSampleRate: 1.0,
  tracePropagationTargets: ['localhost', /^https:\/\/.*\.fergify\.work\/api/],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [
    browserTracingIntegration(),
    replayIntegration(),
    feedbackIntegration()
  ]
}
```

**Error Filtering**:
- Development network errors are filtered out
- Only production errors or opt-in development errors are sent
- Console log breadcrumbs are filtered to reduce noise

**Environment Variables** (optional):
```bash
# .env or environment config
VITE_SENTRY_DSN=https://7afe672f8dcad80804647bc69a386687@sentry.fergify.work/10
VITE_SENTRY_ENVIRONMENT=development|staging|production
VITE_SENTRY_RELEASE=1.0.0-beta.15
VITE_ENABLE_SENTRY=true  # Force enable in development
```

### 4. Real User Monitoring (RUM) ✅

**Implementation**: `web/src/client/utils/performance-monitor.ts`

**Core Web Vitals Tracked**:
1. **First Contentful Paint (FCP)** - When first content is rendered
2. **Largest Contentful Paint (LCP)** - When main content is visible
3. **First Input Delay (FID)** - Time until page is interactive
4. **Cumulative Layout Shift (CLS)** - Visual stability
5. **Time to First Byte (TTFB)** - Server response time

**Integration with Sentry**:
- Metrics automatically sent as Sentry measurements
- Performance context attached to all error reports
- Custom transactions for page load tracking

**Usage**:
```typescript
import { performanceMonitor } from './utils/performance-monitor';

// Get current metrics
const metrics = performanceMonitor.getMetrics();
console.log('Current performance:', metrics);

// Track custom timing
const startTime = performance.now();
// ... do something ...
performanceMonitor.trackCustomTiming('custom-operation', startTime);
```

**Console Output**:
```
[Performance] FCP: 245.30ms
[Performance] LCP: 1234.56ms
[Performance] TTFB: 123.45ms
[Performance] FID: 12.34ms
[Performance] Core Web Vitals: { fcp: 245.3, lcp: 1234.56, ... }
```

## Migration Tracking Plan

### Phase 0: Baseline (Current State)
✅ **Action**: Run Lighthouse baseline
```bash
cd web
node scripts/lighthouse-baseline.js
```

✅ **Expected Output**: Current performance scores and metrics saved to JSON

### Phase 1-2: Foundation & Simple Components (Weeks 1-4)
📊 **Metrics to Track**:
- Bundle size reduction (initial)
- Build time comparison
- Development server startup time

**Sentry Alerts**:
- Monitor for new errors introduced
- Track session replays of migration issues
- Performance degradation alerts

### Phase 3-4: Medium & Complex Components (Weeks 5-8)
📊 **Metrics to Track**:
- FCP improvement
- LCP improvement
- TTI improvement
- JavaScript execution time

**Critical Metrics**:
- WebSocket connection stability
- Terminal rendering performance
- Session management speed

### Phase 5: Optimization (Weeks 9-10)
📊 **Target Validation**:
- ✅ Performance Score ≥ 90
- ✅ Bundle Size ≤ 100KB initial
- ✅ FCP < 1.5s
- ✅ LCP < 2.5s
- ✅ TTI < 3s
- ✅ CLS < 0.1

## Monitoring Dashboards

### Sentry Dashboard
**URL**: `https://sentry.fergify.work/organizations/tunnelforge/issues/`

**Key Metrics**:
- Error rate trends
- Performance transaction timing
- Session replay analysis
- User feedback submissions

**Recommended Alerts**:
1. **Error Rate Spike**: >10 errors/hour
2. **Performance Degradation**: LCP >3s for 5+ users
3. **Session Replay**: Review 100% of error sessions

### Lighthouse Reports
**Location**: `web/lighthouse-reports/`

**Naming Convention**: `baseline-YYYY-MM-DD.json`, `phase-N-YYYY-MM-DD.json`

**Comparison Script** (to be created):
```bash
node scripts/compare-lighthouse.js baseline-2025-10-04.json phase-5-2025-10-15.json
```

## Performance Budget

### Current State (Baseline)
- **Total Bundle**: ~420KB
- **JavaScript**: ~240KB
- **CSS**: ~30KB
- **Performance Score**: TBD

### Target State (Post-Migration)
- **Total Bundle**: <100KB (-76%)
- **JavaScript**: <60KB (-75%)
- **CSS**: <20KB (-33%)
- **Performance Score**: ≥90

### Budget Rules
- **Fail Build If**:
  - Bundle size >110KB
  - Performance score <85
  - Any critical accessibility issues
  - More than 5 high-severity Sentry errors/hour

## Testing Strategy

### Before Each Migration Phase
1. Run Lighthouse baseline
2. Review Sentry error rates
3. Capture Core Web Vitals snapshot

### During Migration
1. Monitor Sentry for new errors
2. Review session replays for UX issues
3. Compare performance metrics weekly

### After Each Phase
1. Run full Lighthouse audit
2. Compare metrics with baseline
3. Document improvements/regressions
4. Adjust migration plan if needed

## Debugging Performance Issues

### Slow Page Load
1. Check Lighthouse report for bottlenecks
2. Review Sentry performance traces
3. Analyze Core Web Vitals:
   - High TTFB → Server issue
   - High FCP → Rendering blocker
   - High LCP → Large resource loading
   - High TTI → JavaScript execution

### High Bundle Size
1. Run bundle analyzer:
   ```bash
   npm run build -- --analyze
   ```
2. Identify largest modules
3. Check for duplicate dependencies
4. Review code splitting strategy

### Runtime Errors
1. Check Sentry for error details
2. Review session replay for reproduction
3. Check breadcrumbs for error context
4. Review user feedback if available

## Best Practices

### Performance Monitoring
1. **Run Lighthouse weekly** during migration
2. **Review Sentry daily** for new error patterns
3. **Track Core Web Vitals** in every environment
4. **Document performance decisions** in migration plan

### Error Tracking
1. **Triage Sentry issues daily**
2. **Review session replays** for critical errors
3. **Enable user feedback** for beta testing
4. **Set up alerting** for error rate spikes

### Migration Validation
1. **Compare metrics at each phase**
2. **Validate no functionality regression**
3. **Check error rates remain stable**
4. **Ensure performance improves incrementally**

## Quick Reference Commands

```bash
# Run Lighthouse baseline
cd web && node scripts/lighthouse-baseline.js

# Check Sentry configuration
grep -A 20 "Sentry.init" web/src/sentry.ts

# View performance monitoring
grep -A 30 "class PerformanceMonitor" web/src/client/utils/performance-monitor.ts

# Test WebSocket config
curl http://localhost:4020/api/config | jq .websocketUrl

# Check bundle size
ls -lh web/dist/bundle/*.js

# Run code quality checks
cd web && bun run check
```

## Next Steps

1. **✅ Completed**: XTerm.js fix, Sentry configuration, Lighthouse setup
2. **📋 Next**: Run initial Lighthouse baseline to establish current metrics
3. **📋 Then**: Begin Phase 1 of migration (Foundation setup)
4. **📋 Ongoing**: Monitor Sentry for errors and performance issues

## Support

**Issues**: Create GitHub issue with:
- Sentry error ID (if applicable)
- Lighthouse report (if performance-related)
- Session replay URL (if available)
- Browser/environment details

**Performance Questions**: Reference this document and include:
- Current vs target metrics
- Migration phase context
- Specific performance concerns
