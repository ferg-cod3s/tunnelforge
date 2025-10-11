<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import type { Session } from '$lib/types';
  import { mediaQuery } from '$lib/stores/media';
  import Terminal from './Terminal.svelte';
  import FileBrowser from './FileBrowser.svelte';
  import FilePicker from './FilePicker.svelte';
  import WorktreeManager from './WorktreeManager.svelte';
  import { type TerminalThemeId } from '$lib/utils/terminal-themes';
  import { createLogger } from '$lib/utils/logger';

  const logger = createLogger('session-view');

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    'navigate-to-list': void;
    error: { detail: string };
    warning: { detail: string };
    'session-exit': { detail: { sessionId: string; exitCode?: number } };
  }>();

  // Props
  interface Props {
    session?: Session | null;
    showBackButton?: boolean;
    showSidebarToggle?: boolean;
    sidebarCollapsed?: boolean;
    disableFocusManagement?: boolean;
    keyboardCaptureActive?: boolean;
  }

  let {
    session = null,
    showBackButton = true,
    showSidebarToggle = false,
    sidebarCollapsed = false,
  }: Props = $props();

  // Reactive state using Svelte 5 runes
  let connected = $state(true);
  let isLoading = $state(false);
  let viewMode = $state<'terminal' | 'worktree'>('terminal');
  let showFileBrowser = $state(false);
  let showImagePicker = $state(false);
  let showMobileInput = $state(false);
  let showQuickKeys = $state(false);
  let showCtrlAlpha = $state(false);
  let showWidthSelector = $state(false);
  let mobileInputText = $state('');
  let ctrlSequence = $state('');
  let keyboardHeight = $state(0);
  let terminalMaxCols = $state(80);
  let terminalFontSize = $state(14);
  let terminalTheme = $state<TerminalThemeId>('auto');
  let customWidth = $state('');
  let useDirectKeyboard = $state(true);


  // Derived state
  let isMobile = $derived($mediaQuery.isMobile);

  // Terminal instance reference
  let terminalComponent = $state<Terminal | null>(null);
  let terminalElement: HTMLElement | null = null;

  // WebSocket connection for session updates
  let sessionWs: WebSocket | null = null;

  // Event handlers
  function handleBack() {
    dispatch('navigate-to-list');
  }

  function handleSidebarToggle() {
    // Dispatch event to toggle sidebar
    window.dispatchEvent(new CustomEvent('toggle-sidebar'));
  }



  function handleOpenSettings() {
    // Dispatch event to open settings modal
    window.dispatchEvent(new CustomEvent('open-settings'));
  }

  function handleSessionExit(event: CustomEvent<{ sessionId: string; exitCode?: number }>) {
    if (session && event.detail.sessionId === session.id) {
      // Update session status to exited
      session = { ...session, status: 'exited' as const, exitCode: event.detail.exitCode };
      dispatch('session-exit', { detail: event.detail });
    }
  }

  // Mobile input handlers
  function handleMobileInputToggle() {
    showMobileInput = !showMobileInput;
  }

  function handleSpecialKey(key: string) {
    if (terminalComponent) {
      // Send special key to terminal
      terminalComponent.getTerminalAPI()?.write(key);
    }
  }

  function handleCtrlKey(letter: string) {
    ctrlSequence += letter;
  }

  function handleSendCtrlSequence() {
    if (terminalComponent && ctrlSequence) {
      for (const letter of ctrlSequence) {
        const controlCode = String.fromCharCode(letter.charCodeAt(0) - 64);
        terminalComponent.getTerminalAPI()?.write(controlCode);
      }
    }
    ctrlSequence = '';
    showCtrlAlpha = false;
  }

  function handleClearCtrlSequence() {
    ctrlSequence = '';
  }

  function handleCtrlAlphaCancel() {
    showCtrlAlpha = false;
    ctrlSequence = '';
  }

  function toggleDirectKeyboard() {
    useDirectKeyboard = !useDirectKeyboard;
  }



  // File operations


  function handleOpenImagePicker() {
    showImagePicker = true;
  }

  function handleCloseFileBrowser() {
    showFileBrowser = false;
  }

  function handleCloseFilePicker() {
    showImagePicker = false;
  }

  function handleFileSelected(event: CustomEvent) {
    // Handle file selection
    logger.log('File selected:', event.detail);
  }

  // Terminal settings


  // Orientation handling
  function checkOrientation() {
    // Orientation checking for future use
  }

  function handleOrientationChange() {
    checkOrientation();
  }

  // Worktree event handlers
  function handleWorktreeCreated(event: CustomEvent<{ branch: string; path: string }>) {
    logger.log('Worktree created:', event.detail);
    dispatch('warning', { detail: `Created worktree for branch '${event.detail.branch}'` });
  }

  function handleWorktreeDeleted(event: CustomEvent<{ branch: string }>) {
    logger.log('Worktree deleted:', event.detail);
    dispatch('warning', { detail: `Deleted worktree for branch '${event.detail.branch}'` });
  }

  function handleWorktreeSelected(event: CustomEvent<{ branch: string; path: string }>) {
    logger.log('Worktree selected:', event.detail);
    // TODO: Switch to the selected worktree (may require session restart or terminal command)
    dispatch('warning', { detail: `Selected worktree '${event.detail.branch}' - manual switching required` });
  }

  function handleError(event: CustomEvent<string>) {
    logger.error('Worktree error:', event.detail);
    dispatch('error', { detail: event.detail });
  }

  // WebSocket connection for session updates
  function connectSessionWebSocket() {
    if (!session?.id) return;

    try {
      const wsUrl = `ws://localhost:4021/ws/sessions/${session.id}`;
      sessionWs = new WebSocket(wsUrl);

      sessionWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'session-update' && data.session) {
            session = data.session;
          } else if (data.type === 'session-exit') {
            handleSessionExit(new CustomEvent('session-exit', {
              detail: { sessionId: data.sessionId, exitCode: data.exitCode }
            }));
          }
        } catch (error) {
          logger.error('Failed to parse session WebSocket message:', error);
        }
      };

      sessionWs.onclose = () => {
        logger.log('Session WebSocket disconnected');
        sessionWs = null;
      };

      sessionWs.onerror = (error) => {
        logger.error('Session WebSocket error:', error);
      };
    } catch (error) {
      logger.error('Failed to connect session WebSocket:', error);
    }
  }

  // Load preferences from localStorage
  function loadPreferences() {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem('tunnelforge_app_preferences');
      if (stored) {
        const preferences = JSON.parse(stored);
        useDirectKeyboard = preferences.useDirectKeyboard ?? true;
        terminalMaxCols = preferences.terminalMaxCols ?? 80;
        terminalFontSize = preferences.terminalFontSize ?? 14;
        terminalTheme = preferences.terminalTheme ?? 'auto';
      }
    } catch (error) {
      logger.warn('Failed to load preferences:', error);
    }
  }

  // Save preferences to localStorage
  function savePreferences() {
    if (typeof window === 'undefined') return;

    try {
      const preferences = {
        useDirectKeyboard,
        terminalMaxCols,
        terminalFontSize,
        terminalTheme,
      };
      localStorage.setItem('tunnelforge_app_preferences', JSON.stringify(preferences));
    } catch (error) {
      logger.warn('Failed to save preferences:', error);
    }
  }

  // Lifecycle
  onMount(() => {
    loadPreferences();
    checkOrientation();

    // Listen for orientation changes
    window.addEventListener('orientationchange', handleOrientationChange);
    window.addEventListener('resize', handleOrientationChange);

    // Connect to session WebSocket if session exists
    if (session) {
      connectSessionWebSocket();
    }
  });

  onDestroy(() => {
    // Clean up WebSocket
    if (sessionWs) {
      sessionWs.close();
      sessionWs = null;
    }

    // Remove event listeners
    window.removeEventListener('orientationchange', handleOrientationChange);
    window.removeEventListener('resize', handleOrientationChange);

    // Save preferences
    savePreferences();
  });

  // Reactive effects
  $effect(() => {
    // Reconnect WebSocket when session changes
    if (session?.id && connected) {
      if (sessionWs) {
        sessionWs.close();
      }
      connectSessionWebSocket();
    }
  });

  $effect(() => {
    // Save preferences when they change
    savePreferences();
  });

  // Loading text for animation
  let loadingText = $derived(() => {
    if (!session) return 'Waiting for session...';
    if (session.status === 'starting') return 'Starting session...';
    if (session.status === 'running') return 'Connecting...';
    return 'Loading...';
  });
</script>

<div class="session-view-container">
  {#if !session}
    <!-- Loading state when no session -->
    <div class="loading-container">
      <div class="loading-text">{loadingText}</div>
    </div>
  {:else}
    <!-- Main session view -->
    <div class="session-view-grid" class:keyboard-visible={keyboardHeight > 0 || showQuickKeys}>
      <!-- Session Header -->
      <div class="session-header-area">
        <div class="session-header">
          <div class="header-left">
            {#if showBackButton}
              <button class="back-button" onclick={handleBack} aria-label="Back to sessions">
                ← Back
              </button>
            {/if}
            {#if showSidebarToggle}
              <button
                class="sidebar-toggle"
                onclick={handleSidebarToggle}
                aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
              >
                ☰
              </button>
            {/if}
          </div>

          <div class="header-center">
            <div class="session-info">
              <span class="session-name">{session.name}</span>
              <span class="session-status status-{session.status}">
                {session.status}
              </span>
            </div>
          </div>

          <div class="header-right">
            {#if session.gitRepoPath}
              <button class="worktree-toggle" onclick={() => viewMode = viewMode === 'terminal' ? 'worktree' : 'terminal'}>
                {viewMode === 'terminal' ? 'Worktree' : 'Terminal'}
              </button>
            {/if}
            <button class="settings-button" onclick={handleOpenSettings} aria-label="Settings">
              ⚙️
            </button>
          </div>
        </div>
      </div>

      <!-- Terminal/Worktree Area -->
      <div class="terminal-area" class:exited={session.status === 'exited'}>
        {#if isLoading}
          <!-- Loading overlay -->
          <div class="loading-overlay">
            <div class="loading-spinner"></div>
            <div class="loading-text">{loadingText}</div>
          </div>
        {/if}

        {#if viewMode === 'worktree' && session.gitRepoPath}
          <!-- Worktree Manager -->
          <WorktreeManager
            repositoryPath={session.gitRepoPath}
            on:worktree-created={handleWorktreeCreated}
            on:worktree-deleted={handleWorktreeDeleted}
            on:worktree-selected={handleWorktreeSelected}
            on:error={handleError}
          />
        {:else}
          <!-- Terminal view -->
          <div class="terminal-container">
            <Terminal
              bind:this={terminalComponent}
              sessionId={session.id}
              sessionStatus={session.status}
              cols={terminalMaxCols}
              rows={24}
              fontSize={terminalFontSize}
              theme={terminalTheme}
            />
          </div>
        {/if}
      </div>

      <!-- Quick Keys Area (Mobile) -->
      {#if isMobile && !showMobileInput && !useDirectKeyboard}
        <div class="quickkeys-area">
          <!-- Arrow keys -->
          <div class="key-row">
            <button class="key-button" onclick={() => handleSpecialKey('↑')}>↑</button>
            <button class="key-button" onclick={() => handleSpecialKey('↓')}>↓</button>
            <button class="key-button" onclick={() => handleSpecialKey('←')}>←</button>
            <button class="key-button" onclick={() => handleSpecialKey('→')}>→</button>
          </div>

          <!-- Special keys -->
          <div class="key-row">
            <button class="key-button" onclick={() => handleSpecialKey('\x1b')} title="Escape">ESC</button>
            <button class="key-button" onclick={() => handleSpecialKey('\t')} title="Tab">⇥</button>
            <button class="key-button" onclick={handleMobileInputToggle}>ABC</button>
            <button class="key-button" onclick={handleOpenImagePicker} title="Upload file">📷</button>
            <button class="key-button" onclick={toggleDirectKeyboard} title="Direct keyboard">⌨️</button>
            <button class="key-button" onclick={() => showCtrlAlpha = true}>CTRL</button>
            <button class="key-button" onclick={() => handleSpecialKey('\r')} title="Enter">⏎</button>
          </div>
        </div>
      {/if}

      <!-- Overlay Container -->
      <div class="overlay-container">
        <!-- Mobile Input Overlay -->
        {#if showMobileInput}
          <div class="mobile-input-overlay">
            <div class="mobile-input-header">
              <button class="close-button" onclick={handleMobileInputToggle}>✕</button>
            </div>
            <textarea
              bind:value={mobileInputText}
              placeholder="Type command..."
              class="mobile-input-textarea"
              onkeydown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (mobileInputText.trim()) {
                    handleSpecialKey(mobileInputText + '\r');
                    mobileInputText = '';
                  }
                }
              }}
            ></textarea>
            <div class="mobile-input-actions">
              <button class="send-button" onclick={() => {
                if (mobileInputText.trim()) {
                  handleSpecialKey(mobileInputText + '\r');
                  mobileInputText = '';
                }
              }}>
                Send
              </button>
            </div>
          </div>
        {/if}

        <!-- Ctrl+Alpha Overlay -->
        {#if showCtrlAlpha}
          <div class="ctrl-alpha-overlay">
            <div class="ctrl-alpha-header">
              <h3>Ctrl+Key Sequence</h3>
              <button class="close-button" onclick={handleCtrlAlphaCancel}>✕</button>
            </div>
            <div class="ctrl-sequence-display">
              {#each ctrlSequence.split('') as letter}
                <span class="ctrl-key">Ctrl+{letter.toUpperCase()}</span>
              {/each}
            </div>
            <div class="ctrl-alpha-grid">
              {#each 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') as letter}
                <button
                  class="ctrl-alpha-button"
                  onclick={() => handleCtrlKey(letter)}
                  disabled={ctrlSequence.length >= 5}
                >
                  {letter}
                </button>
              {/each}
            </div>
            <div class="ctrl-alpha-actions">
              <button class="clear-button" onclick={handleClearCtrlSequence}>Clear</button>
              <button
                class="send-button"
                onclick={handleSendCtrlSequence}
                disabled={ctrlSequence.length === 0}
              >
                Send ({ctrlSequence.length})
              </button>
            </div>
          </div>
        {/if}

        <!-- File Browser Overlay -->
        {#if showFileBrowser}
          <div class="file-browser-overlay">
            <FileBrowser
              visible={true}
              mode="select"
              session={session}
              oninsertpath={(detail) => handleFileSelected(new CustomEvent('file-selected', { detail }))}
              onbrowsercancel={handleCloseFileBrowser}
            />
          </div>
        {/if}

        <!-- Image Picker Overlay -->
        {#if showImagePicker}
          <div class="image-picker-overlay">
            <FilePicker
              visible={true}
              onfileselected={(detail) => handleFileSelected(new CustomEvent('file-selected', { detail }))}
              onfilecancel={handleCloseFilePicker}
            />
          </div>
        {/if}

        <!-- Width Selector Overlay -->
        {#if showWidthSelector}
          <div class="width-selector-overlay">
            <div class="width-selector">
              <div class="width-selector-header">
                <h3>Terminal Width</h3>
                <button class="close-button" onclick={() => showWidthSelector = false}>✕</button>
              </div>
              <div class="width-options">
                <button class="width-option" onclick={() => { terminalMaxCols = 80; showWidthSelector = false; }}>80 cols</button>
                <button class="width-option" onclick={() => { terminalMaxCols = 120; showWidthSelector = false; }}>120 cols</button>
                <button class="width-option" onclick={() => { terminalMaxCols = 160; showWidthSelector = false; }}>160 cols</button>
                <button class="width-option" onclick={() => { terminalMaxCols = 200; showWidthSelector = false; }}>200 cols</button>
              </div>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .session-view-container {
    height: 100vh;
    width: 100vw;
    background-color: var(--color-bg);
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
    overflow: hidden;
  }

  .loading-container {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    flex-direction: column;
    gap: 1rem;
  }

  .loading-text {
    color: var(--color-primary);
    font-size: 1.25rem;
    font-weight: 500;
  }

  /* Grid layout */
  .session-view-grid {
    display: grid;
    grid-template-areas:
      "header"
      "terminal"
      "quickkeys";
    grid-template-rows: auto 1fr auto;
    grid-template-columns: 1fr;
    height: 100vh;
    width: 100%;
    position: relative;
    background-color: var(--color-bg);
    overflow: hidden;
  }

  .session-view-grid.keyboard-visible {
    height: calc(100vh - var(--keyboard-height, 0px) - var(--quickkeys-height, 0px));
  }

  .session-header-area {
    grid-area: header;
    background-color: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border);
    padding: 0.5rem 1rem;
  }

  .session-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 100%;
  }

  .header-left, .header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .header-center {
    flex: 1;
    text-align: center;
  }

  .back-button, .sidebar-toggle, .settings-button, .worktree-toggle {
    background: none;
    border: none;
    color: var(--color-text);
    padding: 0.5rem;
    border-radius: 0.25rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .back-button:hover, .sidebar-toggle:hover, .settings-button:hover, .worktree-toggle:hover {
    background-color: var(--color-bg-hover);
  }

  .session-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .session-name {
    font-weight: 600;
    color: var(--color-text);
  }

  .session-status {
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
  }

  .status-running {
    background-color: var(--color-success);
    color: white;
  }

  .status-exited {
    background-color: var(--color-error);
    color: white;
  }

  .status-starting {
    background-color: var(--color-warning);
    color: var(--color-text);
  }

  .terminal-area {
    grid-area: terminal;
    position: relative;
    overflow: hidden;
    min-height: 0;
    background-color: var(--color-bg);
  }

  .terminal-area.exited {
    opacity: 0.9;
  }

  .terminal-container {
    height: 100%;
    width: 100%;
  }

  .loading-overlay {
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.8);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  .loading-spinner {
    width: 2rem;
    height: 2rem;
    border: 2px solid var(--color-border);
    border-top: 2px solid var(--color-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .worktree-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--color-text-muted);
    font-size: 1.125rem;
  }

  .quickkeys-area {
    grid-area: quickkeys;
    background-color: var(--color-bg-secondary);
    padding: 1rem;
    border-top: 1px solid var(--color-border);
  }

  .key-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .key-row:last-child {
    margin-bottom: 0;
  }

  .key-button {
    flex: 1;
    padding: 0.5rem;
    background-color: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 0.25rem;
    color: var(--color-text);
    font-family: inherit;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .key-button:hover {
    background-color: var(--color-bg-hover);
  }

  .overlay-container {
    grid-area: 1 / 1 / -1 / -1;
    pointer-events: none;
    z-index: 20;
    position: relative;
  }

  .overlay-container > * {
    pointer-events: auto;
  }

  /* Mobile Input Overlay */
  .mobile-input-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: var(--color-bg);
    border-top: 1px solid var(--color-border);
    padding: 1rem;
    z-index: 30;
  }

  .mobile-input-header {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 0.5rem;
  }

  .close-button {
    background: none;
    border: none;
    color: var(--color-text);
    font-size: 1.25rem;
    cursor: pointer;
    padding: 0.25rem;
  }

  .mobile-input-textarea {
    width: 100%;
    min-height: 80px;
    padding: 0.5rem;
    border: 1px solid var(--color-border);
    border-radius: 0.25rem;
    background-color: var(--color-bg);
    color: var(--color-text);
    font-family: inherit;
    resize: vertical;
  }

  .mobile-input-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 0.5rem;
  }

  .send-button {
    padding: 0.5rem 1rem;
    background-color: var(--color-primary);
    color: white;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
    font-weight: 500;
  }

  .send-button:hover {
    background-color: var(--color-primary-hover);
  }

  /* Ctrl+Alpha Overlay */
  .ctrl-alpha-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    padding: 1.5rem;
    max-width: 90vw;
    max-height: 90vh;
    overflow-y: auto;
    z-index: 40;
  }

  .ctrl-alpha-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .ctrl-alpha-header h3 {
    margin: 0;
    color: var(--color-text);
  }

  .ctrl-sequence-display {
    margin-bottom: 1rem;
    min-height: 2rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .ctrl-key {
    background-color: var(--color-primary);
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .ctrl-alpha-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .ctrl-alpha-button {
    padding: 0.75rem;
    background-color: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 0.25rem;
    color: var(--color-text);
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .ctrl-alpha-button:hover:not(:disabled) {
    background-color: var(--color-bg-hover);
  }

  .ctrl-alpha-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .ctrl-alpha-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .clear-button {
    padding: 0.5rem 1rem;
    background-color: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 0.25rem;
    color: var(--color-text);
    cursor: pointer;
  }

  .clear-button:hover {
    background-color: var(--color-bg-hover);
  }

  /* File Browser/Image Picker Overlays */
  .file-browser-overlay, .image-picker-overlay {
    position: absolute;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 35;
  }

  /* Width Selector Overlay */
  .width-selector-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 35;
  }

  .width-selector {
    background-color: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    padding: 1.5rem;
    max-width: 300px;
    width: 90vw;
  }

  .width-selector-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .width-selector-header h3 {
    margin: 0;
    color: var(--color-text);
  }

  .width-options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .width-option {
    padding: 0.75rem;
    background-color: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: 0.25rem;
    color: var(--color-text);
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .width-option:hover {
    background-color: var(--color-bg-hover);
  }

  /* Mobile responsive adjustments */
  @media (max-width: 768px) {
    .session-header {
      padding: 0.25rem 0.5rem;
    }

    .session-name {
      font-size: 0.875rem;
    }

    .session-status {
      font-size: 0.625rem;
    }

    .quickkeys-area {
      padding: 0.5rem;
    }

    .key-button {
      padding: 0.375rem;
      font-size: 0.75rem;
    }
  }

  /* Touch optimizations */
  button {
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
</style>