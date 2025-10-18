# TunnelForge Test Execution Guide

Quick reference for running the comprehensive test suite (700+ tests across 21 suites).

---

## Prerequisites

```bash
# 1. Install dependencies
npm install
cd web && npm install && cd ..
cd desktop && npm install && cd ..

# 2. Start the server
npm run server:start  # Should run on port 4021

# 3. Start the web frontend
npm run dev:web       # Should run on port 5173

# 4. Install Playwright browsers (first time only)
npx playwright install
```

---

## Running Tests

### Run All Tests
```bash
# Execute complete test suite (all 21 suites, ~700 tests)
npm run test:e2e

# Expected: ~30-45 minutes execution time
# Expected: >95% pass rate on stable system
```

### Run Specific Test Suite
```bash
# Run single test file
npm run test:e2e -- 01-auth-flow.spec.ts
npm run test:e2e -- 20-integration-complete.spec.ts

# Run by pattern
npm run test:e2e -- "02-*.spec.ts"
npm run test:e2e -- "*-security-*.spec.ts"
```

### Run Test Categories

```bash
# Foundation tests (141 tests, ~10 min)
npm run test:e2e -- "0[1-5]-*.spec.ts"

# Platform tests (140 tests, ~15 min)
npm run test:e2e -- "0[6-8]-*.spec.ts"

# Performance tests (85 tests, ~20 min)
npm run test:e2e -- "0[9-10]-*.spec.ts"

# Security tests (140 tests, ~20 min)
npm run test:e2e -- "1[1-4]-*.spec.ts"

# Feature tests (265 tests, ~20 min)
npm run test:e2e -- "1[5-9]-*.spec.ts"

# Integration & Regression (160 tests, ~15 min)
npm run test:e2e -- "2[0-1]-*.spec.ts"
```

### Advanced Options

```bash
# Run in debug mode (opens browser)
npm run test:e2e:debug -- 20-integration-complete.spec.ts

# Run with coverage report
npm run test:e2e:coverage

# Run in headed mode (see browser)
npx playwright test --headed

# Run specific test by name
npx playwright test -g "E2E: Complete Terminal Session Workflow"

# Run with verbose output
npx playwright test --reporter=verbose

# Run with trace (for debugging)
npx playwright test --trace on

# Generate HTML report
npx playwright show-report
```

---

## Test Suite Reference

### Phase 4.3c - Foundation (141 tests, ~10 min)
| Suite | Tests | Command | Focus |
|-------|-------|---------|-------|
| 01-auth-flow | 15 | `npm run test:e2e -- 01-auth-flow.spec.ts` | Login flows |
| 02-dashboard-loading | 12 | `npm run test:e2e -- 02-dashboard-loading.spec.ts` | Dashboard UI |
| 03-terminal-session | 18 | `npm run test:e2e -- 03-terminal-session.spec.ts` | Terminal basics |
| 04-api-endpoints | 45 | `npm run test:e2e -- 04-api-endpoints.spec.ts` | REST API |
| 05-websocket | 51 | `npm run test:e2e -- 05-websocket-connections.spec.ts` | WebSocket |

### Phase 4.4a - Platform (140 tests, ~15 min)
| Suite | Tests | Command | Platform |
|-------|-------|---------|----------|
| 06-windows | 45 | `npm run test:e2e -- 06-windows-integration.spec.ts` | Windows |
| 07-linux | 50 | `npm run test:e2e -- 07-linux-integration.spec.ts` | Linux |
| 08-macos | 45 | `npm run test:e2e -- 08-macos-integration.spec.ts` | macOS |

### Phase 4.4b - Performance (85 tests, ~20 min)
| Suite | Tests | Command | Focus |
|-------|-------|---------|-------|
| 09-load-testing | 42 | `npm run test:e2e -- 09-load-testing.spec.ts` | Load performance |
| 10-stress-testing | 43 | `npm run test:e2e -- 10-stress-testing.spec.ts` | Stress limits |

### Phase 4.4c - Security (140 tests, ~20 min)
| Suite | Tests | Command | Focus |
|-------|-------|---------|-------|
| 11-security-auth | 35 | `npm run test:e2e -- 11-security-auth.spec.ts` | Auth security |
| 12-security-injection | 38 | `npm run test:e2e -- 12-security-injection.spec.ts` | Injection attacks |
| 13-security-api | 40 | `npm run test:e2e -- 13-security-api.spec.ts` | API security |
| 14-security-file | 27 | `npm run test:e2e -- 14-security-file-operations.spec.ts` | File security |

### Phase 4.4d - Features (265 tests, ~20 min)
| Suite | Tests | Command | Focus |
|-------|-------|---------|-------|
| 15-file-ops | 40 | `npm run test:e2e -- 15-feature-file-operations.spec.ts` | File I/O |
| 16-git | 80 | `npm run test:e2e -- 16-feature-git-integration.spec.ts` | Git operations |
| 17-sessions | 65 | `npm run test:e2e -- 17-feature-session-management.spec.ts` | Sessions |
| 18-ui-perf | 50 | `npm run test:e2e -- 18-ui-performance.spec.ts` | UI performance |
| 19-desktop-ui | 70 | `npm run test:e2e -- 19-desktop-ui-components.spec.ts` | UI components |

### Phase 4.4e - Integration (160 tests, ~15 min)
| Suite | Tests | Command | Focus |
|-------|-------|---------|-------|
| 20-integration | 75 | `npm run test:e2e -- 20-integration-complete.spec.ts` | E2E workflows |
| 21-regression | 85 | `npm run test:e2e -- 21-regression-suite.spec.ts` | Regression/compat |

---

## Performance Benchmarks

### Expected Execution Times
```
Individual Test:          50-200ms
Small Suite (15-20 tests): 2-5 minutes
Medium Suite (40-60 tests): 10-15 minutes
Large Suite (70-85 tests): 15-20 minutes
Complete Suite (700 tests): 30-45 minutes
```

### Resource Usage
```
Memory:   Stable, <2GB peak
CPU:      Moderate, 30-50% average
Disk:     ~500MB for test artifacts
Network:  Minimal, local only
```

### Performance Benchmarks
```
Auth Flow:              <500ms
Dashboard Load:         <1000ms
Terminal Creation:      <200ms
Git Operations:         <2000ms
File Operations:        <1000ms
API Responses (p95):    <200ms
WebSocket Latency:      <50ms
```

---

## Troubleshooting

### Tests Failing

1. **Server not running**
   ```bash
   # Check server status
   curl http://localhost:4021/health
   
   # Start server
   npm run server:start
   ```

2. **Web frontend not running**
   ```bash
   # Check frontend
   curl http://localhost:5173
   
   # Start frontend
   npm run dev:web
   ```

3. **Browser installation issue**
   ```bash
   # Reinstall Playwright browsers
   npx playwright install
   ```

4. **Port already in use**
   ```bash
   # Kill process on port 4021
   lsof -ti:4021 | xargs kill -9
   
   # Kill process on port 5173
   lsof -ti:5173 | xargs kill -9
   ```

### Debugging Failed Tests

```bash
# Run with debug browser
npm run test:e2e:debug -- 20-integration-complete.spec.ts

# Run with trace enabled
npx playwright test --trace on --headed

# View HTML report
npx playwright show-report

# Run specific test with verbose output
npx playwright test -g "test name" --reporter=verbose
```

### Flaky Tests

```bash
# Retry failing tests
npx playwright test --retries 2

# Run with extended timeout
npx playwright test --timeout=60000

# Run in debug mode for inspection
npx playwright test --debug
```

---

## CI/CD Integration

### GitHub Actions Example
```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Start server
        run: npm run server:start &
        
      - name: Start web frontend
        run: npm run dev:web &
      
      - name: Install Playwright
        run: npx playwright install
      
      - name: Run tests
        run: npm run test:e2e
      
      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v2
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Test Coverage Analysis

### Generate Coverage Report
```bash
# Install coverage dependencies
npm install --save-dev @playwright/test @coverage/html

# Run with coverage
npm run test:e2e:coverage

# View report
open coverage/index.html
```

### Expected Coverage Targets
```
Line Coverage:      85-90%
Branch Coverage:    80-85%
Function Coverage:  90-95%
Statement Coverage: 85-90%
```

---

## Best Practices

### Before Running Tests
- ✅ Ensure server is running
- ✅ Ensure web frontend is running
- ✅ Check no other tests are running
- ✅ Verify database is reset to clean state

### During Test Execution
- ✅ Monitor system resources
- ✅ Keep terminals clean and visible
- ✅ Note any warnings or errors
- ✅ Don't interact with browser windows

### After Test Completion
- ✅ Review test results and failures
- ✅ Check coverage report
- ✅ Save logs for analysis
- ✅ Clean up test artifacts if needed

---

## Quick Command Reference

```bash
# Installation
npm install

# Running
npm run test:e2e                              # All tests
npm run test:e2e -- 01-auth-flow.spec.ts    # Specific suite
npm run test:e2e:debug                        # Debug mode
npm run test:e2e:coverage                     # With coverage

# Debugging
npx playwright test --headed                  # See browser
npx playwright test --debug                   # Debug mode
npx playwright show-report                    # View report
npx playwright test -g "test name"            # Specific test

# Server management
npm run server:start                          # Start backend
npm run dev:web                               # Start frontend
npm run server:stop                           # Stop backend
```

---

## Resources

- **Playwright Documentation**: https://playwright.dev/
- **Test Configuration**: `playwright.config.ts`
- **Test Report**: `playwright-report/index.html`
- **Coverage Report**: `coverage/index.html`
- **Debug Info**: `.playwright/` directory

---

## Support

For issues or questions:

1. Check the test output and error messages
2. Review `PHASE_4_4_COMPLETION_SUMMARY.md` for test details
3. Check individual test file comments for specific test purposes
4. Enable debug mode for detailed execution flow

---

*Last Updated: 2025-01-27*
*Phase 4.4 Complete - 700+ Tests, Production-Ready*

