# TunnelForge Testing Guide

This document provides comprehensive information about the testing infrastructure for TunnelForge, including unit tests, integration tests, E2E tests, and CI/CD pipeline.

## 🧪 Test Overview

TunnelForge uses a multi-layered testing approach:

- **Unit Tests**: Test individual components and services
- **Integration Tests**: Test interactions between components
- **E2E Tests**: Test complete user workflows
- **Performance Tests**: Test application performance and load handling
- **Security Tests**: Test for vulnerabilities and security issues

## 🚀 Quick Start

### Run All Tests

```bash
# Run comprehensive test suite
./scripts/test-all.sh

# Or using npm script
cd web && npm run test:all
```

### Run Specific Test Types

```bash
# Rust backend tests
cd desktop/src-tauri && cargo test

# Frontend unit tests
cd web && bun test

# E2E tests
cd web && bunx playwright test

# Performance tests
cd web && bun run test:coverage
```

## 📁 Test Structure

### Rust Backend Tests

```
desktop/src-tauri/src/
├── cloudflare_service_tests.rs    # Cloudflare service unit tests
├── ngrok_service_tests.rs         # ngrok service unit tests
├── access_mode_service_tests.rs   # Access mode service unit tests
└── integration_tests.rs          # Cross-service integration tests
```

### Frontend Tests

```
web/
├── src/components/
│   ├── SettingsWindow.test.ts     # Settings window tests
│   └── integrations/
│       └── CloudflareIntegration.test.ts  # Service integration tests
└── e2e-tests/
    └── settings-window.spec.ts    # E2E test scenarios
```

## 🧪 Unit Tests

### Rust Backend Unit Tests

#### Running Tests

```bash
cd desktop/src-tauri
cargo test                    # Run all tests
cargo test --lib             # Run library tests only
cargo test --test integration_tests  # Run integration tests only
```

#### Test Coverage

- **Cloudflare Service**: Status checking, tunnel management, process handling
- **ngrok Service**: Authentication, tunnel operations, API integration
- **Access Mode Service**: Network binding, firewall detection, connectivity testing
- **Integration Tests**: Cross-service workflows, error handling, concurrent operations

### Frontend Unit Tests

#### Running Tests

```bash
cd web
bun test                      # Run all unit tests
bun test --watch             # Run tests in watch mode
bun test --coverage          # Run tests with coverage report
```

#### Test Coverage

- **SettingsWindow**: Tab navigation, save/close functionality, loading states
- **CloudflareIntegration**: Status display, tunnel controls, installation guidance
- **ngrokIntegration**: Authentication handling, tunnel management, error states
- **AccessModeControls**: Network detection, mode switching, connectivity testing

## 🔗 Integration Tests

### Tauri Command Integration Tests

The integration tests verify that Tauri commands work correctly across different services:

```bash
cd desktop/src-tauri
cargo test --test integration_tests
```

**Test Scenarios:**
- Cloudflare tunnel start/stop workflow
- ngrok tunnel with authentication
- Access mode switching and network connectivity
- Cross-service interaction patterns
- Error handling and recovery mechanisms

## 🎭 E2E Tests

### Playwright E2E Tests

```bash
cd web
bunx playwright test                    # Run all E2E tests
bunx playwright test --headed          # Run tests in headed mode
bunx playwright test --ui              # Run tests with UI
bunx playwright test --debug           # Run tests in debug mode
```

**Test Scenarios:**
- Settings window navigation and interaction
- Service integration workflows
- Responsive design across different screen sizes
- Error handling and user feedback
- Performance and accessibility testing

### Test Configuration

The E2E tests are configured in `playwright.config.ts`:

```typescript
// Playwright configuration
export default {
  testDir: './e2e-tests',
  outputDir: './test-results',
  // Browser configurations
  projects: [
    { name: 'chromium' },
    { name: 'firefox' },
    { name: 'webkit' }
  ]
}
```

## 🚀 CI/CD Pipeline

### GitHub Actions

The CI/CD pipeline runs on every push and pull request:

```yaml
# .github/workflows/ci.yml
- Rust backend tests (unit + integration)
- Frontend tests (unit + build)
- E2E tests with Playwright
- Cross-platform build tests
- Security audit
- Performance tests
- Documentation validation
```

### Running CI Locally

```bash
# Run the same tests as CI
./scripts/test-all.sh

# Or run specific CI jobs
docker run --rm -v $(pwd):/app -w /app ubuntu:20.04 ./scripts/test-all.sh
```

## 📊 Performance Testing

### Coverage Reports

```bash
# Generate coverage reports
cd web && bun run test:coverage

# View coverage report
open coverage/lcov-report/index.html
```

### Performance Benchmarks

```bash
# Build performance
cd web && time bun run build

# Runtime performance
cd web && bunx playwright test --config=playwright.config.performance.ts
```

## 🔒 Security Testing

### Automated Security Checks

```bash
# Rust security audit
cd desktop/src-tauri && cargo audit

# Frontend dependency audit
cd web && bun audit

# SAST (Static Application Security Testing)
cargo clippy -- -W security
```

### Manual Security Testing

- **Authentication**: Test auth token handling in ngrok integration
- **Network Security**: Test access mode controls and firewall integration
- **Input Validation**: Test all user inputs for injection attacks
- **Error Handling**: Verify no sensitive data leaks in error messages

## 🐛 Debugging Tests

### Debug Rust Tests

```bash
cd desktop/src-tauri
cargo test -- --nocapture    # Show stdout/stderr
cargo test test_name -- --nocapture  # Show output for specific test
RUST_BACKTRACE=1 cargo test  # Show backtraces on failure
```

### Debug Frontend Tests

```bash
cd web
bun test --inspect            # Debug with inspector
bun test --watch             # Watch mode for development
```

### Debug E2E Tests

```bash
cd web
bunx playwright test --debug  # Step through tests
bunx playwright test --headed # Visual debugging
bunx playwright test --ui     # Interactive test runner
```

## 📈 Test Metrics

### Code Coverage

- **Rust Backend**: Aim for >80% coverage
- **Frontend Components**: Aim for >85% coverage
- **Integration Tests**: Aim for >90% coverage

### Performance Benchmarks

- **Test Execution Time**: <5 minutes for full suite
- **E2E Test Stability**: >95% pass rate
- **Build Performance**: <30 seconds for production build

## 🤝 Contributing

### Writing Tests

1. **Unit Tests**: Add tests for new functions/services
2. **Integration Tests**: Test interactions between components
3. **E2E Tests**: Test complete user workflows
4. **Performance Tests**: Add benchmarks for critical paths

### Test Guidelines

- Use descriptive test names
- Test both success and failure scenarios
- Mock external dependencies
- Keep tests independent and idempotent
- Include assertions for expected behavior

## 📚 Additional Resources

- [Rust Testing Book](https://doc.rust-lang.org/book/ch11-00-testing.html)
- [Bun Test Documentation](https://bun.sh/docs/test)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Tauri Testing Guide](https://tauri.app/v1/guides/testing)

## 🆘 Troubleshooting

### Common Issues

1. **Test Dependencies**: Run `bun install` to install test dependencies
2. **Playwright Browsers**: Run `bunx playwright install` to install browsers
3. **Rust Toolchain**: Ensure Rust is installed and up to date
4. **Permissions**: Some tests may require elevated permissions

### Getting Help

- Check the CI logs for detailed error information
- Run tests locally to reproduce issues
- Use debug modes to step through failing tests
- Check the troubleshooting section in each test file

---

**Happy Testing! 🧪**
