# TunnelForge Comprehensive E2E Test Suite

## Overview

This directory contains comprehensive end-to-end (E2E) tests for TunnelForge, covering the complete user journey from server setup through web UI usage.

## Test Files

### 1. **complete-user-flow.spec.ts** - Comprehensive User Flow Test
The most important test file that validates the entire user journey:

#### Test Coverage:
- ✅ **Step 1: Server Setup and Connectivity**
  - Server health check
  - Auth configuration loading
  - Guest authentication

- ✅ **Step 2: Web UI Initial Load**
  - Application loading
  - Auto-authentication
  - Session list display

- ✅ **Step 3: Settings Configuration**
  - Settings modal open/close
  - Tab navigation (General, Notifications, Domains, Tunnels)
  - Cloudflare tunnel settings display
  - Quick tunnel vs custom domain toggle

- ✅ **Step 4: Session Creation**
  - Create session button visibility
  - Session creation via API
  - Session listing

- ✅ **Step 5: Terminal Interaction**
  - Session details retrieval
  - WebSocket connection establishment

- ✅ **Step 6: Session Persistence**
  - Session metadata persistence
  - Session restoration after restart simulation

- ✅ **Step 7: Complete User Workflow**
  - Full end-to-end journey validation
  - Setup → Settings → Session → Terminal

- ✅ **Step 8: Error Handling**
  - Network error handling
  - Unauthorized access handling
  - Missing session handling

## Running Tests

### Prerequisites
\`\`\`bash
# Install dependencies (use Bun - recommended)
bun install

# OR with npm (fallback)
npm install

# Install Playwright browsers (use bunx - recommended)
bunx playwright install chromium

# OR with npx (fallback)
npx playwright install chromium
\`\`\`

### Run All E2E Tests
\`\`\`bash
# With Bun (recommended)
bun run test:e2e

# OR with npm
npm run test:e2e
\`\`\`

### Run Comprehensive User Flow Test
\`\`\`bash
# With bunx (recommended)
bunx playwright test complete-user-flow.spec.ts

# With debugging
bunx playwright test complete-user-flow.spec.ts --debug

# With UI mode (interactive)
bunx playwright test complete-user-flow.spec.ts --ui

# OR with npx (fallback)
npx playwright test complete-user-flow.spec.ts
\`\`\`

## API Endpoints Tested

- GET  /health
- GET  /api/auth/config
- POST /api/auth/password
- GET  /api/sessions
- POST /api/sessions
- GET  /api/sessions/:id
- DELETE /api/sessions/:id
