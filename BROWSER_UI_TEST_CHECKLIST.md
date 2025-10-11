# Browser UI Testing Checklist for File Browser Endpoints

**Date**: 2025-01-27
**Session**: Resuming from endpoint implementation
**URL**: http://localhost:3001

## Pre-Test Setup ✅
- [x] Go server running on port 4021
- [x] Bun proxy running on port 3001
- [x] Backend endpoints validated via curl
- [ ] Browser opened to http://localhost:3001

---

## Test Plan Overview

### Phase 1: Basic File Browser Access (5 min)
### Phase 2: File Preview Testing (10 min)
### Phase 3: Git Diff Testing (10 min)
### Phase 4: Error Handling (5 min)

---

## Phase 1: Basic File Browser Access

### 1.1 Open Application
- [ ] Navigate to http://localhost:3001
- [ ] Application loads without console errors
- [ ] Check browser console (F12) for any errors

### 1.2 Access File Browser
- [ ] Look for file browser button/icon (usually floating action button or menu item)
- [ ] Click to open file browser modal
- [ ] File browser modal displays correctly
- [ ] Initial directory listing loads

**Expected**: 
- Modal overlay appears
- File/directory list visible
- Loading states work correctly

---

## Phase 2: File Preview Testing

### 2.1 Text File Previews

#### Test: Markdown File
- [ ] Navigate to project root
- [ ] Click on `README.md`
- [ ] Preview panel opens on right side
- [ ] Syntax highlighting shows correctly
- [ ] File metadata displays (size, language)

**Expected Response**:
```json
{
  "type": "text",
  "content": "...",
  "language": "markdown",
  "size": 9710,
  "humanSize": "9.5 KB"
}
```

#### Test: Go Source File
- [ ] Navigate to `server/cmd/vibetunnel/`
- [ ] Click on `main.go`
- [ ] Preview shows Go syntax highlighting
- [ ] Language detected as "go"

#### Test: TypeScript File
- [ ] Navigate to `web/src/bun-server.ts`
- [ ] Click on the file
- [ ] Preview shows TypeScript syntax highlighting
- [ ] Language detected as "typescript"

#### Test: JSON File
- [ ] Navigate to project root
- [ ] Click on `package.json`
- [ ] Preview shows JSON syntax highlighting
- [ ] Proper indentation visible

#### Test: CSS/SCSS File
- [ ] Navigate to `web/src/` (look for CSS files)
- [ ] Click on a CSS/SCSS file
- [ ] Preview shows CSS syntax highlighting

### 2.2 Different File Sizes

#### Small File (< 1KB)
- [ ] Click on a small config file
- [ ] Loads instantly
- [ ] Full content visible

#### Medium File (1-100KB)
- [ ] Click on `CROSS_PLATFORM_ROADMAP.md`
- [ ] Loads within 1 second
- [ ] Content scrollable

#### Large File (> 100KB)
- [ ] Find a large file if available
- [ ] Check if truncation message appears
- [ ] Performance remains smooth

### 2.3 UI Elements

- [ ] Close button (X) works in preview panel
- [ ] Can switch between different files
- [ ] Previous selection clears when new file selected
- [ ] Scroll works in preview panel
- [ ] Line numbers visible (if implemented)

---

## Phase 3: Git Diff Testing

### 3.1 Modified Files

**Setup**: Modify a tracked file to create a diff

```bash
# In terminal
echo "# Test modification" >> README.md
```

#### Test: View Diff
- [ ] Refresh file browser
- [ ] Modified file shows git status badge (M)
- [ ] Click "Show Diff" or similar button
- [ ] Diff panel displays
- [ ] Red/green highlighting for deletions/additions

**Expected API Call**: `GET /api/fs/diff?path=/path/to/file`

### 3.2 Diff Content (Monaco Editor)

- [ ] Diff displays in Monaco editor format
- [ ] Original vs Modified side-by-side (if supported)
- [ ] Syntax highlighting in diff view
- [ ] Line numbers match changes

**Expected API Call**: `GET /api/fs/diff-content?path=/path/to/file`

### 3.3 Unmodified Files

- [ ] Click on unmodified file
- [ ] Diff button disabled/hidden
- [ ] Only preview shows (no diff option)

---

## Phase 4: Error Handling

### 4.1 File Not Found

**Manual Test**: Try to access non-existent file via URL manipulation

- [ ] 404 error handled gracefully
- [ ] User-friendly error message
- [ ] No application crash

### 4.2 Permission Denied

**Manual Test**: Try to access restricted file (if applicable)

- [ ] 403 error handled gracefully
- [ ] Appropriate error message
- [ ] Can return to file browser

### 4.3 Network Issues

**Manual Test**: Stop Go server, try to preview file

```bash
# Kill Go server temporarily
kill 3016508
```

- [ ] Timeout handled gracefully
- [ ] Error message displayed
- [ ] Can retry or cancel

**Restore**: Restart Go server after test

---

## Phase 5: Cross-Browser Testing (Optional)

### Chrome/Chromium
- [ ] All features work
- [ ] No console errors
- [ ] Performance is good

### Firefox
- [ ] All features work
- [ ] No console errors

### Safari (if on Mac)
- [ ] All features work
- [ ] No console errors

---

## Phase 6: Mobile Responsive Testing

### Small Screen (< 768px)
- [ ] File browser adapts to screen size
- [ ] Preview panel readable
- [ ] Touch interactions work
- [ ] No horizontal scroll issues

### Tablet (768-1024px)
- [ ] Layout adjusts appropriately
- [ ] All features accessible

---

## Console Monitoring

### During All Tests, Monitor:
```
F12 → Console Tab
```

**Watch For**:
- [ ] No 404 errors for `/api/fs/preview`
- [ ] No 404 errors for `/api/fs/diff`
- [ ] No 404 errors for `/api/fs/diff-content`
- [ ] No JavaScript errors
- [ ] No CORS errors
- [ ] Response times < 500ms

### Network Tab Inspection
```
F12 → Network Tab → Filter by "fs"
```

**Verify**:
- [ ] All requests return 200 OK
- [ ] Response payloads contain expected data
- [ ] No unnecessary repeated requests
- [ ] Proper caching headers (if implemented)

---

## Performance Checks

### Response Times
- [ ] File list: < 500ms
- [ ] Preview: < 200ms for small files
- [ ] Diff: < 300ms
- [ ] No UI freezing or lag

### Memory Usage
```
F12 → Performance → Memory
```
- [ ] No memory leaks during extended use
- [ ] Memory usage stable after multiple file views

---

## Sentry Integration Test

### Before Testing
1. Note current error count in Sentry for TUNNELFORGE-WEBSERVER-4

### After Testing
1. Check Sentry dashboard
2. Verify:
   - [ ] No new 404 errors for file browser endpoints
   - [ ] Any new errors are captured with proper context
   - [ ] Error rate decreasing

---

## Test Results Summary

### Passed Tests: ___/40
### Failed Tests: ___
### Blocked Tests: ___

### Issues Found:
1. 
2. 
3. 

### Performance Notes:


### Browser Compatibility:


### Recommendations:


---

## Sign-Off

**Tester**: _______________
**Date**: _______________
**Status**: [ ] APPROVED  [ ] NEEDS FIXES  [ ] BLOCKED

---

## Next Steps After Testing

### If All Tests Pass:
1. ✅ Mark endpoints as production-ready
2. 🚀 Prepare deployment to staging
3. 📊 Set up Sentry monitoring alerts
4. 📝 Update documentation

### If Tests Fail:
1. 🐛 Document bugs in GitHub issues
2. 🔧 Create fix branches
3. 🧪 Re-test after fixes
4. ✅ Re-validate before deployment

