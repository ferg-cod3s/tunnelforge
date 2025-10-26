# E2E Tests for web-astro

This directory contains end-to-end tests for the web-astro project using Playwright.

## Test Structure

### Test Files

- `auth-login.spec.ts` - Tests for the AuthLogin component
- `file-picker.spec.ts` - Tests for the FilePicker component
- `global-setup.ts` - Global test setup (runs once before all tests)
- `global-teardown.ts` - Global test cleanup (runs once after all tests)

### Test Pages

The tests interact with test pages that showcase the components:

- `/test-auth` - Test page for AuthLogin component
- `/test-file-picker` - Test page for FilePicker component

## Running Tests

### Prerequisites

Make sure you have the development server running:

```bash
bun run dev
```

This will start the Astro development server on `http://localhost:3001`.

### Run All E2E Tests

```bash
bun run test:e2e
```

### Run Tests with UI Mode

```bash
bun run test:e2e:ui
```

This opens Playwright's interactive UI for running and debugging tests.

### Debug Tests

```bash
bun run test:e2e:debug
```

This runs tests in debug mode with browser windows visible.

### Run Specific Test File

```bash
npx playwright test auth-login.spec.ts
npx playwright test file-picker.spec.ts
```

### Run Tests in Specific Browser

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

## Test Configuration

The tests are configured in `playwright.config.ts` with:

- **Base URL**: `http://localhost:3001`
- **Browsers**: Chromium, Firefox, WebKit (Safari)
- **Screenshots**: Taken on failure
- **Videos**: Recorded on first retry
- **Timeouts**: 30 seconds for individual tests, 10 seconds locally for actions
- **Parallel Execution**: Enabled for better performance
- **Auto-start Dev Server**: Starts the Astro dev server before tests

## Test Coverage

### AuthLogin Component Tests

- ✅ Component rendering and basic UI elements
- ✅ User information display (avatar, welcome message)
- ✅ Password input field behavior
- ✅ Form validation and button states
- ✅ Loading states during authentication
- ✅ Error message display and dismissal
- ✅ SSH key authentication options
- ✅ Settings and SSH key manager buttons
- ✅ Mobile responsiveness
- ✅ Keyboard navigation
- ✅ Accessibility standards

### FilePicker Component Tests

- ✅ Test page rendering and controls
- ✅ File picker dialog display and interaction
- ✅ Dialog dismissal (cancel button, escape key, backdrop click)
- ✅ Direct file selection functionality
- ✅ Image picker and camera functionality
- ✅ Event logging infrastructure
- ✅ Upload progress UI elements
- ✅ Accessibility (ARIA attributes, focus management)
- ✅ Mobile responsiveness
- ✅ Multiple rapid interactions handling

## Writing New Tests

### Test Structure Pattern

```typescript
import { test, expect } from '@playwright/test';

test.describe('Component Name', () => {
  test.setTimeout(30000); // Set appropriate timeout

  test.beforeEach(async ({ page }) => {
    // Navigate to test page
    await page.goto('/test-component');
    await page.waitForLoadState('networkidle');
  });

  test('should do something', async ({ page }) => {
    // Test implementation
    await expect(page.locator('.selector')).toBeVisible();
  });
});
```

### Best Practices

1. **Use descriptive test names** that explain what is being tested
2. **Wait for elements** using `await page.waitForLoadState('networkidle')` or appropriate waits
3. **Use data-testid attributes** for reliable element selection
4. **Test both success and error scenarios**
5. **Include accessibility checks** where appropriate
6. **Test mobile responsiveness** with `page.setViewportSize()`
7. **Handle async operations** with appropriate timeouts

### Debugging Tests

- Use `await page.pause()` to pause test execution
- Use `console.log()` in page context with `page.evaluate()`
- Check screenshots and videos in `test-results/` directory
- Use `--debug` flag for step-by-step execution

## CI/CD Integration

The tests are configured to work in CI environments with:

- Automatic retries on failure (2 retries in CI)
- JUnit XML output for test reporting
- GitHub Actions integration
- Parallel test execution disabled to prevent conflicts

## Troubleshooting

### Common Issues

1. **Tests timing out**: Increase timeout values or add appropriate waits
2. **Elements not found**: Check if test pages are loading correctly
3. **Flaky tests**: Add more specific waits or retry logic
4. **Browser-specific issues**: Test in different browsers or adjust selectors

### Debug Commands

```bash
# Show test results
npx playwright show-report

# Run tests with headed browser
npx playwright test --headed

# Run specific test with extra logging
DEBUG=pw:api npx playwright test specific-test.spec.ts
```

## Contributing

When adding new tests:

1. Follow the existing naming conventions
2. Add appropriate test descriptions
3. Include both positive and negative test cases
4. Update this README if adding new test categories
5. Ensure tests work across all supported browsers