# Testing Phase 4.3c - API & WebSocket Testing Plan

**Date**: 2025-01-27  
**Status**: ✅ INITIATED  
**Duration**: 1-2 sessions (2-3 hours)  
**Objective**: Extend E2E test coverage to include API endpoints and WebSocket connections

## Overview

Phase 4.3c focuses on expanding the E2E test suite beyond UI testing to cover backend API endpoints and real-time WebSocket functionality. This bridges the gap between UI testing (35% coverage) and full system integration testing.

### Current Status
- ✅ Phase 4.3b Complete: 75/75 UI tests passing (100% pass rate)
- 🚧 Phase 4.3c In Progress: Adding API and WebSocket tests
- 📋 Target: Increase coverage from 35% to 60-65%

## Test Suites to Create

### 1. API Endpoint Tests (15-20 tests)
**File**: `desktop/tests/e2e-web/04-api-endpoints.spec.ts`

**Purpose**: Validate backend REST API endpoints directly

**Test Cases**:
```
1. Authentication Endpoints
   - POST /api/auth/login - Valid credentials
   - POST /api/auth/login - Invalid credentials
   - POST /api/auth/logout - Valid session
   - GET /api/auth/me - Current user info
   - POST /api/auth/register - New user registration

2. Session Management (CRUD)
   - GET /api/sessions - List all sessions
   - POST /api/sessions - Create new session
   - GET /api/sessions/:id - Get session details
   - PUT /api/sessions/:id - Update session
   - DELETE /api/sessions/:id - Delete session

3. Error Handling
   - 401 Unauthorized responses
   - 403 Forbidden responses
   - 404 Not Found responses
   - 500 Server errors
   - Request validation errors

4. Data Integrity
   - Response schema validation
   - Timestamp accuracy
   - Data consistency across endpoints
```

### 2. WebSocket Tests (12-18 tests)
**File**: `desktop/tests/e2e-web/05-websocket-connections.spec.ts`

**Purpose**: Validate real-time WebSocket functionality

**Test Cases**:
```
1. Connection Lifecycle
   - Connect to WebSocket server
   - Receive initial connection message
   - Maintain connection for extended period
   - Graceful disconnection
   - Automatic reconnection

2. Real-time Message Delivery
   - Send command via WebSocket
   - Receive response
   - Multiple rapid messages
   - Large payload handling
   - Message ordering

3. Error Handling
   - Network timeout handling
   - Malformed message handling
   - Server error propagation
   - Connection recovery

4. Terminal Session Integration
   - Create session via WebSocket
   - Send terminal input
   - Receive terminal output
   - Handle session termination
   - Multi-session independence
```

### 3. Integration Tests (Optional - Phase 4.3d)
**File**: `desktop/tests/e2e-web/06-full-integration.spec.ts`

**Purpose**: Test complete workflows combining UI, API, and WebSocket

**Test Cases**:
```
1. End-to-End User Journey
   - Login via API
   - Create session via WebSocket
   - Interact with terminal via WebSocket
   - Update session via API
   - Logout via API

2. Real-time Collaboration
   - Multiple concurrent sessions
   - Cross-session communication
   - Session state synchronization
```

## Implementation Details

### API Testing Approach

1. **Direct HTTP Requests**
   ```typescript
   const response = await request.post('/api/auth/login', {
     data: { username: 'test', password: 'password' }
   });
   expect(response.status()).toBe(200);
   expect(response.json()).toHaveProperty('token');
   ```

2. **Authentication Token Management**
   - Extract JWT from login response
   - Use token in subsequent requests
   - Test token expiration handling
   - Test refresh token flow

3. **Error Case Testing**
   - Invalid payload validation
   - Authentication failures
   - Permission checks
   - Server error handling

### WebSocket Testing Approach

1. **Connection Establishment**
   ```typescript
   const ws = await page.context().newCDPSession(page);
   // Listen for WebSocket events
   ```

2. **Message Exchange**
   - Send JSON-formatted commands
   - Listen for responses
   - Validate message format and content
   - Measure response latency

3. **Connection Stability**
   - Long-running connection test (5+ minutes)
   - Connection recovery from network disruption
   - Graceful shutdown handling

## Test Infrastructure Requirements

### 1. API Test Setup
```typescript
- Base URL configuration: http://localhost:4021
- Test user creation before test suite
- Token storage and management
- Response schema validation (Zod/Joi)
```

### 2. WebSocket Test Setup
```typescript
- WebSocket URL configuration: ws://localhost:4021/ws
- Connection state tracking
- Message queue for async validation
- Timeout handling (5-10 second default)
```

### 3. Test Data Management
```typescript
- Fixture data for test users
- Sample session configurations
- Expected response schemas
- Mock data for edge cases
```

## Success Criteria

| Metric | Target | Status |
|--------|--------|--------|
| API Tests Passing | 100% (15-20 tests) | 🚧 In Progress |
| WebSocket Tests Passing | 100% (12-18 tests) | 🚧 In Progress |
| Coverage Increase | 35% → 60% | 🚧 In Progress |
| Documentation Complete | 100% | 🚧 In Progress |
| Execution Time | <2 min | 🚧 In Progress |

## File Structure

```
desktop/tests/e2e-web/
├── 01-auth-flow.spec.ts              (✅ Existing)
├── 02-dashboard-loading.spec.ts      (✅ Existing)
├── 03-terminal-session.spec.ts       (✅ Existing)
├── 04-api-endpoints.spec.ts          (🚧 NEW - This phase)
├── 05-websocket-connections.spec.ts  (🚧 NEW - This phase)
└── 06-full-integration.spec.ts       (📋 Next phase)
```

## Dependencies & Prerequisites

### Backend Requirements
- Go server running on port 4021
- Authentication endpoints available
- Session management endpoints working
- WebSocket server configured

### Frontend Requirements
- Web frontend accessible on port 3000 (or configured URL)
- API proxy properly configured
- WebSocket client library available

### Test Environment Setup
```bash
# Install dependencies
cd desktop && npm install

# Start servers (if not already running)
npm run test:servers

# Run new test suites
npm run test:e2e -- 04-api-endpoints.spec.ts
npm run test:e2e -- 05-websocket-connections.spec.ts
```

## Execution Plan

### Phase 4.3c Session 1 (This Session)
1. ✅ Plan creation (this document)
2. Create API endpoint test suite (04-api-endpoints.spec.ts)
3. Implement authentication tests
4. Implement session management tests
5. Add error handling tests

### Phase 4.3c Session 2 (Next Session)
1. Create WebSocket test suite (05-websocket-connections.spec.ts)
2. Implement connection lifecycle tests
3. Implement message delivery tests
4. Add integration tests
5. Final validation and documentation

## Risk Mitigation

### Potential Issues

1. **Server Port Conflicts**
   - Mitigation: Use dynamic port allocation
   - Fallback: Stop existing server instances

2. **Flaky WebSocket Tests**
   - Mitigation: Implement retry logic with exponential backoff
   - Fallback: Use longer timeouts in CI environment

3. **Test Data State Management**
   - Mitigation: Clean up test data after each test
   - Fallback: Use fresh test database per run

4. **Cross-Platform WebSocket Differences**
   - Mitigation: Test all three browsers (Chromium, Firefox, WebKit)
   - Fallback: Mark WebKit as "known issue" if needed

## Success Indicators

✅ **Phase 4.3c Complete When**:
- All 15-20 API endpoint tests passing
- All 12-18 WebSocket tests passing
- Total test coverage increased to 60-65%
- Execution time < 2 minutes for new tests
- Comprehensive documentation created
- No regressions in existing Phase 4.3b tests

## Next Steps After Phase 4.3c

1. **Phase 4.3d**: Mobile browser testing (Pixel 5, iPhone 12)
2. **Phase 4.3e**: Accessibility testing (ARIA, keyboard navigation)
3. **Phase 4.3f**: Performance testing (Core Web Vitals)
4. **Phase 4.4**: CI/CD GitHub Actions integration

## References

- Phase 4.3b Results: `docs/TESTING_PHASE_4_3b_E2E_RESULTS.md`
- Playwright API: https://playwright.dev/docs/api/class-apirequestcontext
- WebSocket Testing: https://playwright.dev/docs/network#websockets

---

**Created**: 2025-01-27  
**Next Review**: After Phase 4.3c completion
