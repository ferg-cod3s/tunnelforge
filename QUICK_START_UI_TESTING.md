# 🚀 Quick Start: Browser UI Testing

**Current Status**: ✅ All backend endpoints validated and working
**Next Step**: Test the web UI to ensure file browser works correctly

---

## 📋 What We're Testing

The file browser endpoints we implemented:
1. **`/api/fs/preview`** - View file content with syntax highlighting
2. **`/api/fs/diff`** - View Git diff structure  
3. **`/api/fs/diff-content`** - View Git changes in Monaco editor

---

## ⚡ Quick 5-Minute Test

### Step 1: Open Browser
```
URL: http://localhost:3001
```

### Step 2: Open Developer Console
- Press **F12** (or Ctrl+Shift+I / Cmd+Opt+I)
- Keep Console tab open to watch for errors

### Step 3: Access File Browser
Look for one of these:
- 📁 File browser icon in toolbar
- Floating action button (FAB) with folder icon
- "Files" menu item
- Click it to open the file browser modal

### Step 4: Basic Test - Click on README.md
1. Navigate to project root (if not already there)
2. Find and click on **README.md**
3. **Watch for**:
   - ✅ Preview panel appears on right
   - ✅ Markdown syntax highlighting
   - ✅ File metadata shows (9.5 KB, language: markdown)
   - ✅ No errors in console

### Step 5: Test Different File Types
Quick clicks on:
- **package.json** → Should show JSON highlighting
- **server/cmd/vibetunnel/main.go** → Should show Go highlighting  
- **web/src/bun-server.ts** → Should show TypeScript highlighting

### Step 6: Check Console
In the Console tab, look for:
```
Network tab → Filter by "fs"
```
- ✅ All requests should be **200 OK**
- ✅ Response times < 500ms
- ❌ **NO 404 errors** (this is what we're fixing!)

---

## 🎯 Success Criteria (5 checks)

| Check | Expected Result | Status |
|-------|----------------|--------|
| 1. File browser opens | Modal displays with file list | ⬜ |
| 2. Preview works | File content shows with highlighting | ⬜ |
| 3. Language detection | Correct language for .md, .go, .ts, .json | ⬜ |
| 4. No console errors | Zero errors in browser console | ⬜ |
| 5. No 404s in Network tab | All /api/fs/* requests return 200 | ⬜ |

**If all 5 pass** → ✅ Ready for production deployment!

---

## 🐛 What If Something Breaks?

### Problem: File Browser Won't Open
**Check**:
1. Is the UI element visible? (Look for file browser icon)
2. Any JavaScript errors in console?
3. Try refreshing the page (Ctrl+R / Cmd+R)

### Problem: Preview Shows "Loading..." Forever
**Check**:
1. Network tab - is the request being made?
2. Response status code (should be 200)
3. Server logs (check terminal where servers are running)

### Problem: 404 Errors Still Appearing
**Check**:
1. Is Bun server restarted? (Required to load new code)
2. Is Go server responding? Test: `curl http://localhost:4021/api/health`
3. Check the exact URL in Network tab

### Problem: No Syntax Highlighting
**Check**:
1. Response includes "language" field in JSON?
2. Monaco editor loaded? (Look for Monaco in Elements tab)
3. Try different file type to isolate issue

---

## 📊 Expected Network Activity

When you click on README.md, you should see in Network tab:

```
Request:
GET http://localhost:3001/api/fs/preview?path=/home/f3rg/src/github/tunnelforge/README.md

Response (200 OK):
{
  "type": "text",
  "content": "...",
  "language": "markdown",
  "size": 9710,
  "humanSize": "9.5 KB"
}
```

**Timing**: Should complete in < 200ms

---

## 🔍 Detailed Testing (Optional - 15 min)

If the quick test passes and you want to be thorough, follow:
**`BROWSER_UI_TEST_CHECKLIST.md`** (comprehensive 40-point checklist)

---

## ✅ After Testing

### If Tests Pass:
1. Mark in checklist: `BROWSER_UI_TEST_CHECKLIST.md`
2. Ready for deployment planning
3. Update Sentry issue TUNNELFORGE-WEBSERVER-4 as resolved

### If Tests Fail:
1. Document specific failures
2. Check server logs for errors
3. Share console errors for debugging

---

## 🚦 Current Server Status

```bash
# Check if servers are running:
curl -s http://localhost:4021/api/health | jq
curl -s http://localhost:3001/api/health | jq

# Both should return: {"status":"ok", ...}
```

If either fails, restart:
```bash
# Go server (in server/ directory):
./vibetunnel

# Bun proxy (in web/ directory):
bun run src/bun-server.ts
```

---

## 🎬 Ready to Test!

**Open**: http://localhost:3001  
**Open**: Browser DevTools (F12)  
**Click**: File browser icon  
**Test**: Click on README.md and watch for preview

**Time**: ~5 minutes for quick validation  
**Goal**: Confirm file browser endpoints work in real UI

---

**Questions?** Check `BROWSER_UI_TEST_CHECKLIST.md` for detailed test scenarios.
