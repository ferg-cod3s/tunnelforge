# TunnelForge Migration Plan: SwiftUI → Tauri v2 & Lit → Svelte

## Overview

This document tracks the migration of TunnelForge from:
- **Mac App**: SwiftUI (Swift) → Tauri v2 (Rust)
- **Web Client**: Lit Components → Astro/Svelte
- **Goal**: Unified cross-platform application with modern web stack

## Migration Started: 2025-10-25

---

## Phase 1: Tauri v2 Unified App

### Mac Services to Port (41 total)

#### Critical Services (Port First):
- [ ] ServerManager.swift (49KB) → server_manager.rs
- [ ] SessionService.swift → session_service.rs
- [ ] SessionMonitor.swift → session_monitor.rs
- [ ] UnixSocketConnection.swift (34KB) → unix_socket.rs
- [ ] GitRepositoryMonitor.swift (24KB) → git_repository_monitor.rs

#### Notification & Integration:
- [ ] NotificationService.swift (41KB) → notification_service.rs
- [ ] CloudflareService.swift (20KB) → cloudflare_service.rs
- [ ] TailscaleService.swift → tailscale_service.rs
- [ ] TailscaleServeStatusService.swift → tailscale_serve_status.rs
- [ ] NgrokService.swift (15KB) → ngrok_service.rs

#### System & Configuration:
- [ ] SystemPermissionManager.swift (12KB) → system_permission_manager.rs
- [ ] ConfigManager.swift (18KB) → config_manager.rs
- [ ] PowerManagementService.swift → power_management.rs
- [ ] NetworkMonitor.swift → network_monitor.rs
- [ ] StartupManager.swift → startup_manager.rs

#### Window & Terminal Management:
- [ ] WindowTracker.swift (19KB) → window_tracker.rs
- [ ] TerminalManager.swift → terminal_manager.rs
- [ ] TerminalControlHandler.swift → terminal_control_handler.rs
- [ ] WindowTracking/* (6 files) → window_tracking/*

#### Developer & Autocomplete:
- [ ] AutocompleteService.swift (20KB) → autocomplete_service.rs
- [ ] DevServerManager.swift (8KB) → dev_server_manager.rs
- [ ] AppleScriptExecutor.swift (11KB) → script_executor.rs (cross-platform)

#### Repository & Git:
- [ ] RepositoryDiscoveryService.swift (9KB) → repository_discovery.rs
- [ ] WorktreeService.swift → worktree_service.rs

#### Updates & Control:
- [ ] SparkleUpdaterManager.swift (8KB) → updater_manager.rs (use Tauri updater)
- [ ] SparkleUserDriverDelegate.swift → updater_delegate.rs
- [ ] SystemControlHandler.swift → system_control_handler.rs
- [ ] ControlProtocol.swift → control_protocol.rs
- [ ] ControlPayloads.swift → control_payloads.rs
- [ ] RemoteServicesStatusManager.swift → remote_services_status.rs

#### Utilities & Support:
- [ ] EventSource.swift → event_source.rs
- [ ] DashboardKeychain.swift → dashboard_keychain.rs (platform-specific)
- [ ] SharedUnixSocketManager.swift → shared_unix_socket.rs
- [ ] ContinuationWrapper.swift → async utilities (Rust async/await)
- [ ] ControlProtocol+Sendable.swift → marker traits

### Architecture Changes:
- **Before**: SwiftUI app managing Node.js server
- **After**: Tauri v2 app managing Go server + Bun web
- **Target**: `desktop/` directory becomes the unified app
- **Remove**: `linux/` (Tauri v1.5), `mac/` (SwiftUI), `windows/` (separate Tauri)

---

## Phase 2: Svelte Component Migration

### Lit Components to Convert (38 total)

#### Core Terminal Components:
- [ ] terminal.ts → Terminal.svelte
- [ ] vibe-terminal-buffer.ts → TerminalBuffer.svelte
- [ ] vibe-terminal-binary.ts → TerminalBinary.svelte
- [ ] terminal-quick-keys.ts → TerminalQuickKeys.svelte

#### Session Management:
- [ ] session-view.ts → SessionView.svelte
- [ ] session-list.ts → SessionList.svelte
- [ ] session-create-form.ts → SessionCreateForm.svelte
- [ ] session-view-drag-drop.ts → SessionViewDragDrop.svelte

#### UI Components:
- [ ] app-header.ts → AppHeader.svelte
- [ ] header-base.ts → HeaderBase.svelte
- [ ] sidebar-header.ts → SidebarHeader.svelte
- [ ] keyboard-capture-indicator.ts → KeyboardCaptureIndicator.svelte

#### Modals & Editors:
- [ ] multiplexer-modal.ts → MultiplexerModal.svelte
- [ ] quick-start-editor.ts → QuickStartEditor.svelte
- [ ] file-picker.ts → FilePicker.svelte
- [ ] inline-edit.ts → InlineEdit.svelte

#### Utilities & Helpers:
- [ ] clickable-path.ts → ClickablePath.svelte
- [ ] git-notification-handler.ts → GitNotificationHandler.svelte
- [ ] (+ 20 more components)

### Architecture Changes:
- **Before**: Lit Web Components (vanilla TS)
- **After**: Svelte 5 components with Astro integration
- **Build**: Astro for SSG + Svelte for interactive components
- **Target**: New `web-svelte/` directory or refactor `web/src/`

---

## Phase 3: Documentation Updates

### Files to Update:
- [ ] docs/ARCHITECTURE.md - Complete rewrite
- [ ] README.md - Update tech stack section
- [ ] CLAUDE.md - Update development commands
- [ ] docs/spec.md - API specifications
- [ ] docs/build-system.md - Tauri build process
- [ ] docs/CONTRIBUTING.md - New dev setup

### New Documentation Needed:
- [ ] docs/tauri-migration-guide.md
- [ ] docs/svelte-component-guide.md
- [ ] docs/cross-platform-builds.md

---

## Timeline Estimates

### Phase 1: Tauri v2 (6-8 weeks)
- Week 1-2: Core services (ServerManager, SessionService, etc.)
- Week 3-4: Integration services (Cloudflare, Tailscale, Ngrok)
- Week 5-6: Window/Terminal management, Git services
- Week 7-8: Testing, bug fixes, polish

### Phase 2: Svelte (4-6 weeks)
- Week 1-2: Core terminal components
- Week 3-4: Session management & UI
- Week 5-6: Testing, refinement, Astro integration

### Phase 3: Documentation (1-2 weeks)
- Continuous throughout, finalize at end

**Total Estimated Time**: 11-16 weeks

---

## Success Criteria

### Tauri v2 App:
- ✅ All 41 Mac services ported and functional
- ✅ Cross-platform builds (macOS, Linux, Windows)
- ✅ Feature parity with Swift Mac app
- ✅ Go server integration working
- ✅ Tray icon and native menus
- ✅ Auto-updater configured

### Svelte Components:
- ✅ All 38 components converted
- ✅ Feature parity with Lit components
- ✅ Improved performance and bundle size
- ✅ Astro integration for documentation
- ✅ TypeScript type safety maintained

### Documentation:
- ✅ Accurate architecture docs
- ✅ Updated development guides
- ✅ Migration guides for contributors
- ✅ API documentation updated

---

## Migration Status: STARTED

**Current Phase**: Phase 1 - Tauri v2 Services
**Progress**: 0/41 services ported, 0/38 components converted
**Next Actions**: Port ServerManager.swift, create Svelte architecture
