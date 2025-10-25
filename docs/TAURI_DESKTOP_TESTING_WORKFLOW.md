# Tauri Desktop Testing Workflow Documentation

**Created**: 2025-01-27  
**Purpose**: Automated testing of Tauri v2 desktop applications with JavaScript-Rust integration verification  
**Location**: `.github/workflows/tauri-desktop-test.yml`

---

## Overview

This GitHub Actions workflow provides comprehensive automated testing for the TunnelForge Tauri desktop application. It validates both the Rust backend and JavaScript frontend integration, ensuring the complete desktop application works correctly across different build configurations.

## Workflow Structure

### Triggers
- **Push**: Runs on pushes to `main` and `development` branches
- **Pull Request**: Runs on PRs targeting `main` and `development` branches
- **Manual**: Can be triggered manually via `workflow_dispatch`

### Jobs

#### 1. `test-desktop` (Main Integration Test)
**Purpose**: Full integration testing with JavaScript-Rust communication verification  
**Environment**: Ubuntu Latest with Xvfb (virtual display)  
**Timeout**: 30 minutes

**Key Steps**:
1. **Environment Setup**
   - Install system dependencies (WebKitGTK, GTK, etc.)
   - Setup Node.js v20 and Bun runtime
   - Configure dependency caching for faster builds

2. **Build Process**
   - Install web and desktop dependencies
   - Build web frontend with Bun
   - Build Tauri application in release mode

3. **Testing with Xvfb**
   - Start virtual X11 display server
   - Launch Tauri application with timeout protection
   - Wait for diagnostic file creation
   - Gracefully terminate application

4. **Verification**
   - Check for all expected diagnostic files
   - Validate JavaScript execution via `tauri-immediate-test.json`
   - Upload artifacts for debugging

#### 2. `test-debug-build` (Debug Build Validation)
**Purpose**: Test debug build configuration  
**Environment**: Ubuntu Latest  
**Timeout**: 20 minutes

**Key Steps**:
- Build application in debug mode
- Test with virtual display
- Verify debug-specific functionality
- Upload debug artifacts

#### 3. `rust-unit-tests` (Backend Validation)
**Purpose**: Validate Rust backend independently  
**Environment**: Ubuntu Latest  
**Timeout**: 15 minutes

**Key Steps**:
- Run all 52 Rust unit tests
- Check code formatting with `rustfmt`
- Run static analysis with `clippy`
- Cache Rust dependencies for performance

#### 4. `test-summary` (Results Aggregation)
**Purpose**: Provide comprehensive test results summary  
**Environment**: Ubuntu Latest

**Key Steps**:
- Aggregate results from all test jobs
- Generate GitHub Step Summary
- Provide clear pass/fail status

---

## Diagnostic Files

The workflow validates JavaScript-Rust integration by checking for these diagnostic files:

### Expected Files
1. **`/tmp/tauri-rust-init.json`**
   - Created during Rust initialization
   - Confirms backend is starting correctly

2. **`/tmp/tauri-rust-injected.json`**
   - Created by JavaScript injection from Rust
   - Confirms `__TAURI_INVOKE__` is available

3. **`/tmp/tauri-post-load.json`**
   - Created by page load event listener
   - Confirms WebView is loading pages correctly

4. **`/tmp/tauri-immediate-test.json`**
   - **Most Important**: Created by HTML test page
   - Contains full JavaScript test results
   - Verifies command execution from JavaScript

### Success Criteria
- All 4 diagnostic files must be created
- `tauri-immediate-test.json` must contain success indicators
- JSON files must be valid format
- Rust unit tests must pass (52/52)

---

## Environment Configuration

### System Dependencies
```bash
libwebkit2gtk-4.1-dev    # WebView rendering
build-essential          # C/C++ build tools
curl wget               # Network tools
libssl-dev              # SSL/TLS support
libgtk-3-dev            # GTK3 UI toolkit
libayatana-appindicator3-dev  # System tray
librsvg2-dev            # SVG support
xvfb                    # Virtual X11 display
```

### Runtime Environment
- **Display**: `:99` (virtual X11)
- **Resolution**: 1024x768x24
- **Timeout**: 30 seconds for app execution
- **Rust Log Level**: Debug
- **Node Environment**: Production

---

## Caching Strategy

### Rust Dependencies
- **Paths**: `~/.cargo/registry`, `~/.cargo/git`, `desktop/src-tauri/target`
- **Key**: `${runner.os}-cargo-${{ hashFiles('desktop/src-tauri/Cargo.lock') }}`
- **Restore**: `${runner.os}-cargo-`

### Bun Dependencies
- **Paths**: `~/.bun/install/cache`, `desktop/node_modules/.cache`, `web/node_modules/.cache`
- **Key**: `${runner.os}-bun-${{ hashFiles('desktop/bun.lock', 'web/bun.lock') }}`
- **Restore**: `${runner.os}-bun-`

---

## Error Handling and Debugging

### Common Issues and Solutions

#### 1. Xvfb Failures
**Symptoms**: `Xvfb failed to start` errors  
**Solutions**:
- Check Xvfb logs in artifacts
- Verify display server configuration
- Ensure sufficient system resources

#### 2. Binary Not Found
**Symptoms**: `Tunnelforge binary not found`  
**Solutions**:
- Check build logs for compilation errors
- Verify Tauri configuration
- Examine target directory structure

#### 3. Missing Diagnostic Files
**Symptoms**: JavaScript diagnostic files not created  
**Solutions**:
- Check app output logs for WebView errors
- Verify HTML test file exists
- Examine JavaScript injection code

#### 4. Timeout Issues
**Symptoms**: App termination before diagnostic creation  
**Solutions**:
- Increase timeout values
- Check for infinite loops in startup code
- Verify system resource constraints

### Debugging Artifacts

The workflow uploads comprehensive artifacts for debugging:

#### `tauri-diagnostic-files-${{ github.run_number }}`
- All diagnostic JSON files
- Application output logs
- Xvfb server logs

#### `tauri-debug-artifacts-${{ github.run_number }}`
- Debug build diagnostic files
- Debug-specific logs
- Debug build artifacts

---

## Performance Optimizations

### Build Time Reduction
- **Dependency Caching**: Reduces build time by 60-80%
- **Parallel Jobs**: Multiple test configurations run simultaneously
- **Incremental Builds**: Rust incremental compilation enabled

### Resource Management
- **Timeout Protection**: Prevents runaway processes
- **Graceful Shutdown**: Proper process termination
- **Memory Cleanup**: Artifact cleanup after completion

---

## Integration with CI/CD Pipeline

### Upstream Dependencies
- **Web Frontend**: Must build successfully
- **Go Server**: Should be running for integration tests
- **Dependencies**: All system and runtime dependencies installed

### Downstream Consumers
- **Release Pipeline**: Uses artifacts for deployment
- **Testing Pipeline**: Consumes test results
- **Monitoring**: Integrates with Sentry for error tracking

### Environment Variables
- `TAURI_PRIVATE_KEY`: Code signing key
- `TAURI_KEY_PASSWORD`: Key password
- `GITHUB_TOKEN`: Package installation authentication

---

## Security Considerations

### Secret Management
- **Code Signing Keys**: Stored in GitHub Secrets
- **No Hardcoded Credentials**: All secrets via environment variables
- **Artifact Retention**: Limited to 7 days for security

### Isolation
- **Sandboxed Execution**: Each job runs in isolated environment
- **Temporary Files**: All diagnostic files in `/tmp`
- **Process Isolation**: Virtual display prevents GUI interference

---

## Maintenance and Updates

### Regular Maintenance Tasks
1. **Update Dependencies**: Keep Bun, Node, and Rust versions current
2. **Review Caching**: Adjust cache keys when dependencies change
3. **Monitor Performance**: Track build times and success rates
4. **Update Security**: Apply security patches to dependencies

### Version Updates
- **Actions**: Keep GitHub Actions up to date
- **Rust Toolchain**: Update to latest stable version
- **System Packages**: Update Ubuntu packages regularly

---

## Troubleshooting Guide

### Quick Diagnosis Commands

#### Check Workflow Status
```bash
gh run list --workflow=tauri-desktop-test.yml
gh run view <run-id>
```

#### Download Artifacts
```bash
gh run download <run-id> --name=tauri-diagnostic-files-<run-number>
```

#### Local Testing
```bash
./scripts/validate-tauri-workflow.sh
cd desktop && bun tauri build
```

### Common Log Locations
- **Xvfb Logs**: `/tmp/xvfb.log`
- **App Output**: `/tmp/app-output.log`
- **Build Logs**: GitHub Actions job logs
- **Test Results**: Diagnostic JSON files

---

## Future Enhancements

### Planned Improvements
1. **Cross-Platform Testing**: Add Windows and macOS test jobs
2. **Performance Testing**: Include startup time benchmarks
3. **Visual Regression**: Add UI screenshot comparison
4. **Load Testing**: Stress test with multiple sessions

### Potential Integrations
- **Sentry Integration**: Automatic error reporting
- **Slack Notifications**: Build status notifications
- **Code Coverage**: Rust test coverage reporting
- **Dependency Scanning**: Security vulnerability scanning

---

## Usage Examples

### Manual Trigger
```bash
gh workflow run tauri-desktop-test.yml
```

### View Results
```bash
gh run view --job=<job-id>
```

### Debug Failed Run
1. Download diagnostic artifacts
2. Examine `/tmp/tauri-immediate-test.json`
3. Check application output logs
4. Review Xvfb server logs

---

## Conclusion

This workflow provides comprehensive automated testing for the TunnelForge Tauri desktop application, ensuring reliable JavaScript-Rust integration and validating both debug and release builds. The combination of unit tests, integration tests, and diagnostic file verification provides confidence in the application's functionality across different environments.

The workflow is designed to be maintainable, performant, and provide clear feedback when issues occur, making it an essential part of the TunnelForge CI/CD pipeline.

---

**Related Documentation**:
- [Tauri v2 JavaScript Integration Status](../TAURI_V2_JS_VERIFICATION_STATUS.md)
- [Cross-Platform Development Guide](../CROSS_PLATFORM_ROADMAP.md)
- [Desktop Testing Guide](../desktop/TESTING.md)