# TunnelForge Comprehensive Testing Strategy

**Goal**: Achieve near 100% testing coverage across the entire stack with end-to-end user flow validation.

## Testing Infrastructure Overview

### 1. Server (Go Backend) - Port 4021
**Test Framework**: Go testing (`go test`)
**Coverage**: 20+ test files

**Test Files**:
- Integration tests: `test/integration_test.go`, `test/frontend_integration_test.go`
- Security tests: `test/security_hardening_test.go`, `test/penetration_test.go`
- Component tests: `internal/*/` (filesystem, git, tmux, buffer, server, etc.)

**Run Commands**:
```bash
cd server
make test                # Run all tests
make test-coverage       # Run with coverage report
```

### 2. Web UI (Astro + Svelte 5) - Port 3000
**Test Framework**: Playwright E2E
**Coverage**: 5 test files + test pages

**Test Files**:
- `e2e/auth-login.spec.ts` - Authentication flows
- `e2e/file-picker.spec.ts` - File operations
- `e2e/session-management.spec.ts` - Session lifecycle
- `e2e/settings-terminal.spec.ts` - Settings and terminal
- `e2e/app-flow.spec.ts` - Complete app workflows

**Run Commands**:
```bash
cd web
bun run test:e2e         # Run all E2E tests
bun run test:e2e:ui      # Interactive UI mode
bun run test:e2e:debug   # Debug mode
```

### 3. Desktop App (Tauri v2)
**Test Framework**: Playwright + Tauri Testing
**Coverage**: 42 test files

**Test Categories**:
- E2E Web: `tests/e2e-web/` (21 files)
  - Auth, sessions, terminal, file ops, git, security, etc.
- E2E Desktop: `tests/e2e-desktop/` (13 files)
  - Tauri commands, system integration, webview, performance
- Platform-specific: Linux, Windows, macOS integration tests

**Run Commands**:
```bash
cd desktop
npm test                  # Run all tests
npm run test:e2e-web     # Web integration tests
npm run test:e2e-desktop # Desktop-specific tests
```

## Complete User Flow E2E Tests

### User Story 1: Fresh Installation to First Session

**Linux Setup Flow**:
1. Install TunnelForge via package manager
2. Launch desktop app
3. Configure server settings
4. Start local server
5. Access web UI
6. Create first terminal session
7. Execute commands in terminal

**Windows Setup Flow**:
1. Install TunnelForge via MSI installer
2. Launch desktop app
3. Configure firewall permissions
4. Start local server
5. Access web UI
6. Create first terminal session
7. Test Windows-specific features

**macOS Setup Flow**:
1. Install TunnelForge via DMG
2. Launch desktop app
3. Grant necessary permissions
4. Start local server
5. Access web UI
6. Create first terminal session
7. Test macOS-specific features

### User Story 2: Advanced Features

**File Operations**:
1. Create session in specific directory
2. Use file browser to navigate
3. Open file in Monaco editor
4. Edit and save file
5. Verify changes via terminal

**Git Integration**:
1. Create session in Git repository
2. View Git status badge
3. Create worktree
4. Switch branches via UI
5. Commit changes via terminal

**Settings Management**:
1. Open settings panel
2. Configure terminal preferences (theme, font)
3. Configure network access
4. Enable/disable features
5. Verify settings persist

## Test Execution Plan

### Phase 1: Server Tests (Go)
```bash
cd server
make clean
make deps
make test-coverage
```

**Expected Coverage**: 70%+ code coverage
**Critical Paths**:
- Session management
- WebSocket communication
- File operations
- Git integration
- Authentication

### Phase 2: Web UI Tests (Astro/Svelte)
```bash
cd web
# Ensure server is running
cd ../server && make dev-simple &
SERVER_PID=$!

cd ../web
bun install
bun run test:e2e

kill $SERVER_PID
```

**Expected Coverage**: 80%+ component coverage
**Critical Paths**:
- Auth login flow
- Session creation
- Terminal interaction
- File picker
- Settings UI

### Phase 3: Desktop App Tests (Tauri)
```bash
cd desktop
npm install
npm test
```

**Expected Coverage**: 85%+ integration coverage
**Critical Paths**:
- App lifecycle
- Tauri commands
- System integration
- Cross-platform compatibility
- WebView communication

### Phase 4: Complete User Flow Tests

**Manual Test Checklist** (until automated):
- [ ] Fresh install on Linux
- [ ] Fresh install on Windows
- [ ] Fresh install on macOS
- [ ] Server configuration
- [ ] First session creation
- [ ] Terminal command execution
- [ ] File browser usage
- [ ] Git integration
- [ ] Settings persistence
- [ ] Multi-session management
- [ ] Network access from remote device

## Coverage Goals

| Component | Target Coverage | Current Status |
|-----------|-----------------|----------------|
| Go Server | 70%+ | ✅ Tests exist |
| Web UI | 80%+ | ✅ E2E tests exist |
| Desktop App | 85%+ | ✅ 42 test files |
| User Flows | 100% | 🔄 In progress |

## Test Reporting

### Coverage Reports
- **Server**: `server/coverage.html`
- **Web UI**: `web/playwright-report/index.html`
- **Desktop**: `desktop/test-results/`

### CI/CD Integration
All tests should pass in CI before merge:
```bash
# Server tests
cd server && make test

# Web tests
cd web && bun run test:e2e

# Desktop tests
cd desktop && npm test
```

## Success Criteria

✅ **Server**: All unit and integration tests pass with 70%+ coverage
✅ **Web UI**: All E2E tests pass across Chromium, Firefox, WebKit
✅ **Desktop**: All platform-specific tests pass on Linux, Windows, macOS
✅ **User Flows**: Complete installation-to-usage flow validated on all platforms
✅ **Performance**: Tests complete in < 10 minutes total
✅ **CI/CD**: All tests automated and running in CI pipeline

## Next Steps

1. Run all existing tests and collect baseline coverage
2. Identify gaps in test coverage
3. Implement missing tests for critical paths
4. Automate complete user flow tests
5. Integrate all tests into CI/CD pipeline
6. Generate consolidated coverage report
7. Document testing infrastructure for contributors

## Commands Summary

```bash
# Run everything
./scripts/test-all.sh     # (To be created)

# Individual components
cd server && make test-coverage
cd web && bun run test:e2e
cd desktop && npm test

# Coverage reports
open server/coverage.html
open web/playwright-report/index.html
open desktop/test-results/index.html
```
