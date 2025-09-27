# TunnelForge Desktop Testing Guide

## Overview

This document provides comprehensive testing procedures for the TunnelForge Desktop application, including UI functionality, tab switching, and integration tests.

## Test Suite

### Quick Test

Run the comprehensive test suite:

```bash
node tests/ui_tests.cjs
```

This will verify:
- ✅ All required files exist
- ✅ HTML structure is correct
- ✅ JavaScript functionality is implemented
- ✅ CSS styles are present
- ✅ Tauri configuration is valid
- ✅ Rust integration is correct

### Manual UI Testing

To test the UI functionality manually:

1. **Start the application:**
   ```bash
   cd src-tauri
   cargo tauri dev
   ```

2. **Test tab navigation:**
   - Click each tab in the sidebar (General, Notifications, Power, Integrations, Server)
   - Verify that the content area updates correctly
   - Check that the active tab is highlighted

3. **Test form interactions:**
   - Toggle checkboxes in the General settings
   - Change dropdown values
   - Verify settings can be saved

4. **Test server management:**
   - Check that server status is displayed
   - Test start/stop/restart buttons
   - Verify external links open correctly

## Browser Testing

For debugging JavaScript issues outside of Tauri:

```bash
# Open the standalone test page
xdg-open file://$(pwd)/test.html
```

This test page isolates the tab switching logic to help debug any issues.

## Troubleshooting

### JavaScript "Unexpected token <" Error

This typically means the webview is receiving HTML instead of JavaScript. To fix:

1. Verify all assets exist:
   ```bash
   ls -la dist/
   ```

2. Check Tauri configuration:
   ```bash
   cat src-tauri/tauri.conf.json | grep frontendDist
   ```

3. Rebuild the application:
   ```bash
   cd src-tauri
   cargo tauri dev
   ```

### Tab Switching Not Working

1. Open webview developer tools (if available)
2. Check console for JavaScript errors
3. Verify DOM elements exist:
   - Navigation links with `data-tab` attributes
   - Settings panels with matching IDs
   - JavaScript event listeners are attached

### Settings Not Persisting

This is expected behavior currently - settings persistence will be implemented when Tauri commands are wired up to the Rust backend.

## Development Testing

### Add New Tests

To add new tests to the suite, edit `tests/ui_tests.cjs`:

```javascript
addTest('category', 'test description', () => {
    // Test logic here
    return true; // or false
});
```

Test categories:
- `files` - File existence tests
- `structure` - HTML/CSS structure tests  
- `functionality` - JavaScript functionality tests
- `integration` - Tauri integration tests

### Test Coverage

Current test coverage includes:
- ✅ File existence and validity
- ✅ HTML structure and required elements
- ✅ JavaScript syntax and key functions
- ✅ CSS structure and classes
- ✅ Tauri configuration
- ✅ Rust-JavaScript integration

## Expected Results

With properly functioning setup:
- All 18 automated tests should pass
- Tab navigation should work smoothly
- Settings forms should be interactive
- Server status should display (mock data currently)
- External links should open in system browser

## Next Steps

Once basic UI is confirmed working:
1. Wire up Tauri commands for settings persistence
2. Implement actual notification functionality
3. Add server management integration
4. Implement proper error handling
5. Add user feedback and loading states