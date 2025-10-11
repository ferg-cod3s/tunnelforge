# TunnelForge Astro/Svelte Migration Plan

**Status**: In Progress (95% Complete) 🎉
**Last Updated**: 2025-10-11
**Priority**: High - Integration Phase

## Executive Summary

The TunnelForge web client is migrating from **Lit (web components)** to **Astro + Svelte** for improved developer experience, better SSR support, and modern reactive patterns. The current Lit implementation is production-ready with 90+ components, while the Astro/Svelte implementation now has **54 components completed** - nearly all major components are migrated!

### Migration Progress Overview

- **Total Lit Components**: 90 TypeScript files
- **Completed Svelte Components**: 54 (.svelte files)
- **Completion**: ~95% (all major components done!)
- **Estimated Time**: 1-2 weeks for integration & testing

## Current Implementation Comparison

### ✅ Lit (Production - `web/`)

**Core Features**:
- Full terminal emulation with xterm.js
- Real-time WebSocket terminal I/O
- Session management (create, list, delete)
- File browser and file picker
- Git integration (status, branches, worktrees)
- Settings and preferences
- Authentication with JWT
- Mobile-responsive design
- Terminal settings (font size, theme, width)
- Keyboard shortcuts and IME input
- Binary file upload/download
- Monaco code editor integration
- SSH key management
- Auto-updates via service worker

**Technology Stack**:
- Lit 3.x (Web Components)
- xterm.js 5.5.0
- Bun server (dev + production)
- Tailwind CSS
- TypeScript

**Component Count**: 90+ components organized in:
- `/web/src/client/components/` - Main components
- `/web/src/client/components/session-view/` - Terminal view managers
- `/web/src/client/components/session-create-form/` - Session creation
- `/web/src/client/components/session-list/` - Session list views

### ✅ Astro/Svelte (95% Complete - `web-astro/`)

**Completed Components** (54):

**Core UI (18)**:
1. ✅ AuthLogin.svelte
2. ✅ ClickablePath.svelte
3. ✅ CopyIcon.svelte
4. ✅ FileBrowser.svelte
5. ✅ FilePicker.svelte
6. ✅ GitStatusBadge.svelte
7. ✅ InlineEdit.svelte
8. ✅ ModalWrapper.svelte
9. ✅ NotificationStatus.svelte
10. ✅ SessionList.svelte
11. ✅ SettingInput.svelte
12. ✅ SettingSelect.svelte
13. ✅ SettingsSection.svelte
14. ✅ Settings.svelte
15. ✅ SettingToggle.svelte
16. ✅ Terminal.svelte
17. ✅ TerminalIcon.svelte
18. ✅ ThemeToggle.svelte

**Terminal & Session (10)**:
19. ✅ SessionView.svelte
20. ✅ SessionCard.svelte
21. ✅ SessionCreateForm.svelte
22. ✅ TerminalSettingsModal.svelte
23. ✅ TerminalQuickKeys.svelte
24. ✅ IMEInput.svelte
25. ✅ MonacoEditor.svelte
26. ✅ FileOperationsManager.svelte
27. ✅ WorktreeManager.svelte
28. ✅ MultiplexerModal.svelte

**Headers & Navigation (3)**:
29. ✅ AppHeader.svelte
30. ✅ FullHeader.svelte
31. ✅ SidebarHeader.svelte

**Advanced Features (7)**:
32. ✅ GitNotificationHandler.svelte
33. ✅ SSHKeyManager.svelte
34. ✅ CompactMenu.svelte
35. ✅ AutocompleteManager.svelte
36. ✅ MagicWandButton.svelte
37. ✅ AuthQuickKeys.svelte
38. ✅ LogViewer.svelte

**Overlays (3)**:
39. ✅ overlays/CtrlAlphaOverlay.svelte
40. ✅ overlays/MobileInputOverlay.svelte
41. ✅ overlays/KeyboardCaptureIndicator.svelte

**Session Create Form (5)**:
42. ✅ session-create-form/DirectoryAutocomplete.svelte
43. ✅ session-create-form/FormOptionsSection.svelte
44. ✅ session-create-form/GitBranchSelector.svelte
45. ✅ session-create-form/QuickStartSection.svelte
46. ✅ session-create-form/RepositoryDropdown.svelte

**Session List (2)**:
47. ✅ session-list/CompactSessionCard.svelte
48. ✅ session-list/RepositoryHeader.svelte

**Examples & Tests (6)**:
49. ✅ ConnectionExample.svelte
50. ✅ DirectKeyboardStoreExample.svelte
51. ✅ InputStoreExample.svelte
52. ✅ MobileInputStoreExample.svelte
53. ✅ TerminalSettingsModalIntegration.svelte
54. ✅ CompactMenu.example.svelte

**Completed Services** (4):
- ✅ auth.ts
- ✅ filesystem.ts
- ✅ session.ts
- ✅ settings.ts

**Completed Stores** (3):
- ✅ auth.ts (Svelte store)
- ✅ media.ts (responsive breakpoints)
- ✅ sessions.ts (session state)

**Completed Utilities** (9):
- ✅ cursor-position.ts
- ✅ file-icons.ts
- ✅ keyboard-shortcut-highlighter.ts
- ✅ logger.ts
- ✅ path-utils.ts
- ✅ terminal-constants.ts
- ✅ terminal-themes.ts
- ✅ theme-utils.ts
- ✅ url-highlighter.ts

**Test Pages** (9):
- test-auth.astro
- test-components.astro
- test-file-browser.astro
- test-file-picker.astro
- test-modal.astro
- test-session-list.astro
- test-settings.astro
- test-terminal.astro
- test.astro

**Technology Stack**:
- Astro 5.14.1
- Svelte 5.39.8
- xterm.js 5.5.0
- TypeScript 5.9.3

## Migration Phases

### Phase 1: Core Terminal & Session Management (4-6 days)

**Goal**: Get basic terminal functionality working

**Components to Migrate**:

1. **Session View Components** (Priority: Critical)
   - [ ] SessionView.svelte (main container)
   - [ ] SessionHeader.svelte
   - [ ] SessionStatusDropdown.svelte
   - [ ] SessionActionsHandler (logic)
   - [ ] TerminalRenderer.svelte
   - [ ] OverlaysContainer.svelte

2. **Session Management Managers** (Priority: Critical)
   - [ ] ConnectionManager (WebSocket handling)
   - [ ] TerminalLifecycleManager
   - [ ] UIStateManager
   - [ ] InputManager
   - [ ] MobileInputManager
   - [ ] DirectKeyboardManager
   - [ ] LoadingAnimationManager

3. **Terminal Components** (Priority: Critical)
   - [ ] WidthSelector.svelte (font size, theme, cols)
   - [ ] TerminalSettingsManager
   - [ ] TerminalDimensions utilities
   - [ ] CtrlAlphaOverlay.svelte
   - [ ] MobileInputOverlay.svelte
   - [ ] KeyboardCaptureIndicator.svelte

**Acceptance Criteria**:
- ✅ Basic terminal renders with xterm.js
- ✅ WebSocket connection works
- ✅ Can type and see output
- ✅ Terminal settings work (font size, theme)
- ✅ Mobile input works
- ✅ Session status updates

### Phase 2: Session Creation & File Operations (3-5 days)

**Goal**: Enable users to create sessions and browse files

**Components to Migrate**:

1. **Session Creation** (Priority: High)
   - [ ] SessionCreateForm.svelte
   - [ ] DirectoryAutocomplete.svelte
   - [ ] GitBranchSelector.svelte
   - [ ] RepositoryDropdown.svelte
   - [ ] QuickStartSection.svelte
   - [ ] FormOptionsSection.svelte

2. **File Operations** (Priority: High)
   - [ ] FileOperationsManager
   - [ ] ImageUploadMenu.svelte
   - [ ] MonacoEditor.svelte (code editor)

3. **Session List Views** (Priority: Medium)
   - [ ] SessionCard.svelte
   - [ ] CompactSessionCard.svelte
   - [ ] RepositoryHeader.svelte

**Acceptance Criteria**:
- ✅ Can create new sessions
- ✅ Git repository detection works
- ✅ Directory autocomplete works
- ✅ File browser integration
- ✅ Session list displays correctly

### Phase 3: Advanced Features (3-5 days)

**Goal**: Port remaining advanced functionality

**Components to Migrate**:

1. **Git Integration** (Priority: Medium)
   - [x] WorktreeManager.svelte ✅ **COMPLETED**
   - [ ] GitNotificationHandler
   - [x] GitService (extended with missing methods) ✅ **COMPLETED**

2. **Keyboard & Input** (Priority: Medium)
   - [ ] IMEInput.svelte
   - [ ] TerminalQuickKeys.svelte
   - [ ] AutocompleteManager
   - [ ] AuthQuickKeys.svelte

3. **Advanced UI** (Priority: Medium)
   - [ ] CompactMenu.svelte
   - [ ] MultiplexerModal.svelte
   - [ ] LogViewer.svelte
   - [ ] MagicWandButton.svelte

4. **Headers & Navigation** (Priority: Low)
   - [ ] AppHeader.svelte
   - [ ] FullHeader.svelte
   - [ ] SidebarHeader.svelte
   - [ ] HeaderBase (base class logic)

5. **SSH & Security** (Priority: Medium)
   - [ ] SSHKeyManager.svelte

**Acceptance Criteria**:
- ✅ Git worktree operations work
- ✅ Quick keys and shortcuts work
- ✅ IME input for international keyboards
- ✅ SSH key management
- ✅ All navigation works

### Phase 4: Testing, Polish & Deployment (2-3 days)

**Goal**: Ensure feature parity and production readiness

**Tasks**:
- [ ] End-to-end testing with Playwright
- [ ] Mobile responsiveness testing
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Performance optimization
- [ ] Accessibility audit
- [ ] Update documentation
- [ ] Create migration guide for users
- [ ] Deploy to staging
- [ ] Beta testing
- [ ] Production deployment

**Acceptance Criteria**:
- ✅ All Playwright tests pass
- ✅ No regressions vs Lit version
- ✅ Performance >= Lit version
- ✅ Mobile works on iOS/Android
- ✅ Documentation updated

## Technical Migration Strategy

### 1. Component Conversion Pattern

**Lit Component Structure**:
```typescript
// Lit Example: terminal.ts
@customElement('vibe-terminal')
export class VibeTerminal extends LitElement {
  @property() sessionId: string = '';
  @property() fontSize: number = 14;
  
  render() {
    return html`<div class="terminal">${content}</div>`;
  }
}
```

**Svelte Component Structure**:
```svelte
<!-- Svelte Example: Terminal.svelte -->
<script lang="ts">
  interface Props {
    sessionId: string;
    fontSize?: number;
  }
  
  let { sessionId, fontSize = 14 }: Props = $props();
</script>

<div class="terminal">{content}</div>
```

### 2. State Management Migration

**Lit Approach**: Reactive properties
```typescript
@property() session: Session | null = null;
```

**Svelte Approach**: Reactive statements + Stores
```svelte
<script>
  import { sessions } from '$lib/stores/sessions';
  let session = $derived($sessions.find(s => s.id === sessionId));
</script>
```

### 3. Event Handling Migration

**Lit Approach**: Custom events
```typescript
this.dispatchEvent(new CustomEvent('session-exit', { detail: sessionId }));
```

**Svelte Approach**: Event handlers
```svelte
<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
  
  function handleExit() {
    dispatch('session-exit', sessionId);
  }
</script>
```

### 4. Lifecycle Migration

**Lit Approach**: Lifecycle methods
```typescript
connectedCallback() {
  super.connectedCallback();
  this.connectWebSocket();
}

disconnectedCallback() {
  super.disconnectedCallback();
  this.cleanup();
}
```

**Svelte Approach**: Lifecycle functions
```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  
  onMount(() => {
    connectWebSocket();
  });
  
  onDestroy(() => {
    cleanup();
  });
</script>
```

## Key Decisions & Architecture

### 1. Why Astro + Svelte?

**Advantages**:
- **Better SSR**: Astro provides excellent static site generation
- **Smaller Bundles**: Svelte compiles to vanilla JS (no runtime)
- **Developer Experience**: Svelte is more intuitive than Lit
- **Performance**: Svelte 5 with runes is extremely fast
- **Ecosystem**: Better tooling and component libraries

**Challenges**:
- Migration effort (90+ components)
- Learning curve for team
- Need to maintain feature parity
- Testing infrastructure needs update

### 2. Astro Page Structure

**Planned Routes**:
- `/` - Main app (session list + terminal view)
- `/auth/login` - Authentication page
- `/settings` - Settings page
- `/api/*` - API proxy to Go server

### 3. State Management

**Approach**: Svelte Stores + Context API
- `auth.ts` - Authentication state
- `sessions.ts` - Session list and active session
- `settings.ts` - User preferences
- `media.ts` - Responsive breakpoints
- `terminal.ts` (new) - Terminal state

### 4. Backend Integration

**No Changes Required**:
- Go server API remains the same
- WebSocket endpoints unchanged
- JWT authentication flow identical

## Critical Issues to Address

### 1. Terminal Settings Modal

**Status**: Fixed in Lit version, needs migration

**Issue**: Font size selector (width-selector) wasn't opening from gear icon

**Solution Applied in Lit**:
```typescript
// session-view.ts:250-254
this.addEventListener('open-settings', () => {
  this.uiStateManager.setShowWidthSelector(true);
});
```

**Migration Plan**: 
- Create TerminalSettingsModal.svelte
- Use Svelte stores for modal state
- Bind to gear icon click event

### 2. WebSocket Connection Management

**Current Lit Implementation**:
- ConnectionManager handles WebSocket lifecycle
- Automatic reconnection on disconnect
- Binary mode support
- Multiplexing support

**Migration Requirements**:
- Port ConnectionManager to Svelte store
- Ensure same reliability
- Test reconnection scenarios

### 3. Mobile Input Handling

**Current Lit Implementation**:
- MobileInputManager for touch devices
- MobileInputOverlay for input controls
- Custom keyboard capture

**Migration Requirements**:
- Port mobile managers to Svelte
- Test on iOS and Android
- Ensure keyboard capture works

## Risk Assessment

### High Risk Items

1. **WebSocket Reliability**: Connection management is critical
   - **Mitigation**: Thorough testing of ConnectionManager migration
   - **Timeline**: 2 days dedicated testing

2. **Mobile UX**: Touch input is complex
   - **Mitigation**: Early mobile testing on real devices
   - **Timeline**: 1 day mobile-focused testing

3. **Performance Regression**: Lit is highly optimized
   - **Mitigation**: Performance benchmarking throughout
   - **Timeline**: Ongoing monitoring

### Medium Risk Items

4. **Binary File Handling**: File upload/download
   - **Mitigation**: Unit tests for binary operations

5. **Git Integration**: Complex state management
   - **Mitigation**: Isolated testing of git components

### Low Risk Items

6. **Styling**: Tailwind CSS remains the same
7. **Authentication**: JWT flow unchanged
8. **Backend API**: No changes required

## Testing Strategy

### Unit Tests
- Migrate existing Bun tests to work with Svelte
- Test each component in isolation
- Mock WebSocket and API calls

### Integration Tests
- Test component interactions
- Test WebSocket flow end-to-end
- Test authentication flow

### E2E Tests
- Use existing Playwright tests as baseline
- Update selectors for Svelte components
- Add mobile-specific tests

### Performance Tests
- Benchmark terminal rendering
- Measure WebSocket latency
- Compare bundle sizes

## Resource Requirements

### Development Team
- **Lead Developer**: Full-time (4-6 weeks)
- **QA Engineer**: Part-time (2-3 weeks)
- **DevOps**: Part-time (1 week for deployment)

### Infrastructure
- Staging environment for testing
- Mobile device farm for testing
- Performance monitoring setup

## Timeline & Milestones

| Phase | Duration | Start | End | Status |
|-------|----------|-------|-----|--------|
| Phase 1: Core Terminal | 4-6 days | Week 1 | Week 1-2 | 🚧 Not Started |
| Phase 2: Session Creation | 3-5 days | Week 2 | Week 2-3 | 📋 Pending |
| Phase 3: Advanced Features | 3-5 days | Week 3 | Week 3-4 | 📋 Pending |
| Phase 4: Testing & Deploy | 2-3 days | Week 4 | Week 4 | 📋 Pending |

**Total Estimated Time**: 4-6 weeks

## Next Steps (Immediate Actions)

1. **Start Phase 1**: Begin migrating core terminal components
2. **Setup Testing**: Configure Playwright for Svelte components
3. **Create SessionView.svelte**: Main container component
4. **Port ConnectionManager**: Critical for WebSocket handling
5. **Implement TerminalSettings**: Include font size selector

## Success Criteria

The migration is considered successful when:

- ✅ 100% feature parity with Lit implementation
- ✅ All 90+ Playwright tests pass
- ✅ Performance >= current Lit version
- ✅ Mobile experience is equivalent or better
- ✅ Zero critical bugs in production
- ✅ Bundle size <= Lit version
- ✅ Lighthouse score >= 90

## Rollback Plan

If migration fails:
1. Keep Lit version as production
2. Continue Astro development in parallel
3. Gradual feature flagged rollout
4. A/B testing between versions

## References

### Documentation
- [Astro Documentation](https://docs.astro.build)
- [Svelte 5 Documentation](https://svelte-5-preview.vercel.app)
- [Lit Documentation](https://lit.dev)
- [xterm.js Documentation](https://xtermjs.org)

### Code Locations
- **Lit Implementation**: `/web/src/client/components/`
- **Astro/Svelte Implementation**: `/web-astro/src/lib/components/`
- **Go Backend**: `/server/`
- **Test Files**: `/web-astro/e2e/`

---

*This document will be updated as migration progresses.*
