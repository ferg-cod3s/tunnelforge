<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createLogger } from '$lib/utils/logger';
  import type { Session, Worktree, WorktreeListResponse, AuthClient } from '$lib/types';
  import { SessionServiceImpl } from '$lib/services/session';
  import { sessions, selectedSessionId } from '$lib/stores/sessions';

  const logger = createLogger('session-list');

  // Svelte 5 props
  interface Props {
    loading?: boolean;
    hideExited?: boolean;
    authClient?: AuthClient;
    compactMode?: boolean;
    onnavigateToSession?: (detail: { sessionId: string }) => void;
    onrefresh?: () => void;
    onerror?: (detail: string) => void;
    onsessionCreated?: (detail: { sessionId: string; message?: string }) => void;
    oncreateModalClose?: () => void;
    onhideExitedChange?: (detail: boolean) => void;
    onkillAllSessions?: () => void;
  }

  let {
    loading = false,
    hideExited = true,
    authClient,
    compactMode = false,
    onnavigateToSession,
    onrefresh,
    onerror,
    onsessionCreated,
    oncreateModalClose,
    onhideExitedChange,
    onkillAllSessions
  }: Props = $props();

  // Svelte 5 state
  let cleaningExited = $state(false);
  let repoFollowMode = $state(new Map<string, string | undefined>());
  let loadingFollowMode = $state(new Set<string>());
  let showFollowDropdown = $state(new Map<string, boolean>());
  let repoWorktrees = $state(new Map<string, Worktree[]>());
  let loadingWorktrees = $state(new Set<string>());
  let showWorktreeDropdown = $state(new Map<string, boolean>());

  // Reactive state from stores
  let sessionsList = $state<Session[]>([]);
  let selectedSessionIdValue = $state<string | null>(null);

  // Subscribe to stores
  let unsubscribeSessions: (() => void) | undefined;
  let unsubscribeSelected: (() => void) | undefined;

  // Service instance
  let sessionServiceInstance: SessionServiceImpl | undefined;

  onMount(() => {
    // Initialize service
    if (authClient) {
      sessionServiceInstance = new SessionServiceImpl(authClient);
    }

    // Subscribe to stores
    unsubscribeSessions = sessions.subscribe(value => {
      sessionsList = value;
      // Load follow mode for all repositories when sessions change
      loadFollowModeForAllRepos();
    });

    unsubscribeSelected = selectedSessionId.subscribe(value => {
      selectedSessionIdValue = value;
    });

    // Make component focusable
    // Add keyboard listener
    document.addEventListener('keydown', handleKeyDown);
    // Add click outside listener for dropdowns
    document.addEventListener('click', handleClickOutside);
  });

  onDestroy(() => {
    if (unsubscribeSessions) unsubscribeSessions();
    if (unsubscribeSelected) unsubscribeSelected();
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('click', handleClickOutside);
  });

  function getVisibleSessions(): Session[] {
    const running = sessionsList.filter((s) => s.status === 'running');
    const exited = sessionsList.filter((s) => s.status === 'exited');
    return hideExited ? running : running.concat(exited);
  }

  function getGridColumns(): number {
    // Get the grid container element
    const gridContainer = document.querySelector('.session-flex-responsive');
    if (!gridContainer || compactMode) return 1; // Compact mode is single column

    // Get the computed style to check the actual grid columns
    const computedStyle = window.getComputedStyle(gridContainer);
    const templateColumns = computedStyle.getPropertyValue('grid-template-columns');

    // Count the number of columns by splitting the template value
    const columns = templateColumns.split(' ').filter((col) => col && col !== '0px').length;

    // Fallback: calculate based on container width and minimum item width
    if (columns === 0 || columns === 1) {
      const containerWidth = gridContainer.clientWidth;
      const minItemWidth = 280; // From CSS: minmax(280px, 1fr)
      const gap = 20; // 1.25rem = 20px
      return Math.max(1, Math.floor((containerWidth + gap) / (minItemWidth + gap)));
    }

    return columns;
  }

  function handleKeyDown(e: KeyboardEvent) {
    const { key } = e;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(key)) {
      return;
    }

    // Check if we're inside an input element
    const target = e.target as HTMLElement;
    if (
      target !== document.activeElement &&
      (target.closest('input, textarea, select') || target.isContentEditable)
    ) {
      return;
    }

    const sessions = getVisibleSessions();
    if (sessions.length === 0) return;

    e.preventDefault();
    e.stopPropagation();

    let index = selectedSessionIdValue
      ? sessions.findIndex((s) => s.id === selectedSessionIdValue)
      : 0;
    if (index < 0) index = 0;

    if (key === 'Enter') {
      handleSessionSelect(sessions[index]);
      return;
    }

    const columns = getGridColumns();

    if (key === 'ArrowLeft') {
      // Move left, wrap to previous row
      index = (index - 1 + sessions.length) % sessions.length;
    } else if (key === 'ArrowRight') {
      // Move right, wrap to next row
      index = (index + 1) % sessions.length;
    } else if (key === 'ArrowUp') {
      // Move up one row
      index = index - columns;
      if (index < 0) {
        // Wrap to the bottom, trying to maintain column position
        const currentColumn = index + columns; // Original index
        const lastRowStart = Math.floor((sessions.length - 1) / columns) * columns;
        index = Math.min(lastRowStart + currentColumn, sessions.length - 1);
      }
    } else if (key === 'ArrowDown') {
      // Move down one row
      const oldIndex = index;
      index = index + columns;
      if (index >= sessions.length) {
        // Wrap to the top, maintaining column position
        const currentColumn = oldIndex % columns;
        index = currentColumn;
      }
    }

    selectedSessionId.set(sessions[index].id);

    // Ensure the selected element is visible by scrolling it into view
    setTimeout(() => {
      const selectedCard = document.querySelector(`[data-session-id="${sessions[index].id}"].selected`) ||
        document.querySelector(`div[class*="bg-bg-elevated"][class*="border-accent-primary"]`);
      if (selectedCard) {
        selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 0);
  }

  function handleSessionSelect(session: Session) {
    onnavigateToSession?.({ sessionId: session.id });
  }

  async function handleSessionKilled(sessionId: string) {
    logger.debug(`session ${sessionId} killed, updating session list`);

    // Update local state
    sessions.update(current => current.filter(session => session.id !== sessionId));

    // Clear selection if deleted session was selected
    selectedSessionId.update(id => id === sessionId ? null : id);

    // Trigger refresh
    onrefresh?.();
  }

  function handleSessionKillError(sessionId: string, error: string) {
    logger.error(`failed to kill session ${sessionId}:`, error);
    onerror?.(`Failed to kill session: ${error}`);
  }

  function handleSessionRenamed(sessionId: string, newName: string) {
    sessions.update(current =>
      current.map(s => s.id === sessionId ? { ...s, name: newName } : s)
    );
  }

  function handleSessionRenameError(sessionId: string, error: string) {
    logger.error(`failed to rename session ${sessionId}:`, error);
    onerror?.(`Failed to rename session: ${error}`);
  }

  async function handleCleanupExited() {
    if (cleaningExited || !authClient) return;

    cleaningExited = true;

    try {
      const success = await sessionServiceInstance?.cleanupExitedSessions();
      if (success) {
        // Apply black hole animation to all exited sessions
        const exitedSessions = sessionsList.filter((s) => s.status === 'exited');

        if (exitedSessions.length > 0) {
          const sessionCards = document.querySelectorAll('[data-session-id]');
          const exitedCards: HTMLElement[] = [];

          sessionCards.forEach((card) => {
            const sessionId = card.getAttribute('data-session-id');
            if (sessionId && exitedSessions.some(s => s.id === sessionId)) {
              exitedCards.push(card as HTMLElement);
            }
          });

          // Apply animation to all exited cards
          exitedCards.forEach((card) => {
            card.classList.add('black-hole-collapsing');
          });

          // Wait for animation to complete
          if (exitedCards.length > 0) {
            await new Promise((resolve) => setTimeout(resolve, 300));
          }

          // Remove all exited sessions at once
          sessions.update(current => current.filter(session => session.status !== 'exited'));
        }

        onrefresh?.();
      } else {
        onerror?.('Failed to cleanup exited sessions');
      }
    } catch (error) {
      logger.error('error cleaning up exited sessions:', error);
      onerror?.('Failed to cleanup exited sessions');
    } finally {
      cleaningExited = false;
    }
  }

  function groupSessionsByRepo(sessions: Session[]): Map<string | null, Session[]> {
    const groups = new Map<string | null, Session[]>();

    sessions.forEach((session) => {
      // Use gitMainRepoPath to group worktrees with their main repository
      const groupKey = session.gitMainRepoPath || session.gitRepoPath || null;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      const group = groups.get(groupKey);
      if (group) {
        group.push(session);
      }
    });

    // Sort groups: non-git sessions first, then git sessions
    const sortedGroups = new Map<string | null, Session[]>();

    // Add non-git sessions first
    if (groups.has(null)) {
      const nullGroup = groups.get(null);
      if (nullGroup) {
        sortedGroups.set(null, nullGroup);
      }
    }

    // Add git sessions sorted by repo name
    const gitRepos = Array.from(groups.keys()).filter((key): key is string => key !== null);
    gitRepos.sort((a, b) => {
      const nameA = getRepoName(a);
      const nameB = getRepoName(b);
      return nameA.localeCompare(nameB);
    });

    gitRepos.forEach((repo) => {
      const repoGroup = groups.get(repo);
      if (repoGroup) {
        sortedGroups.set(repo, repoGroup);
      }
    });

    return sortedGroups;
  }

  function getRepoName(repoPath: string): string {
    return repoPath.split('/').pop() || repoPath;
  }

  async function loadFollowModeForAllRepos() {
    const repoGroups = groupSessionsByRepo(sessionsList);
    for (const [repoPath] of repoGroups) {
      if (repoPath && !repoWorktrees.has(repoPath)) {
        // loadWorktreesForRepo now also loads follow mode
        loadWorktreesForRepo(repoPath);
      }
    }
  }

  async function handleFollowModeChange(repoPath: string, followBranch: string | undefined) {
    repoFollowMode.set(repoPath, followBranch);
    // Close all dropdowns for this repo (they might have different section keys)
    const newFollowDropdown = new Map(showFollowDropdown);
    for (const [key] of newFollowDropdown) {
      if (key.startsWith(`${repoPath}:`)) {
        newFollowDropdown.delete(key);
      }
    }
    showFollowDropdown = new Map(newFollowDropdown);

    try {
      const success = await sessionServiceInstance?.updateFollowMode(repoPath, followBranch);
      if (success) {
        // Show success toast
        const event = new CustomEvent('show-toast', {
          detail: {
            message: followBranch
              ? `Following worktree branch: ${followBranch.replace(/^refs\/heads\//, '')}`
              : 'Follow mode disabled',
            type: 'success',
          },
          bubbles: true,
          composed: true,
        });
        document.dispatchEvent(event);
      } else {
        throw new Error('Failed to update follow mode');
      }
    } catch (error) {
      logger.error('Error updating follow mode:', error);
      const event = new CustomEvent('show-toast', {
        detail: { message: 'Failed to update follow mode', type: 'error' },
        bubbles: true,
        composed: true,
      });
      document.dispatchEvent(event);
    }
  }

  function toggleFollowDropdown(dropdownKey: string) {
    const isOpen = showFollowDropdown.get(dropdownKey) || false;

    // Create new maps preserving existing state
    const newFollowDropdown = new Map(showFollowDropdown);
    const newWorktreeDropdown = new Map(showWorktreeDropdown);

    if (isOpen) {
      // Close this dropdown
      newFollowDropdown.delete(dropdownKey);
    } else {
      // Close all other dropdowns and open this one
      newFollowDropdown.clear();
      newFollowDropdown.set(dropdownKey, true);

      // Extract repo path from dropdown key for loading
      const repoPath = dropdownKey.split(':')[0];
      // Load worktrees and follow mode if not already loaded
      loadWorktreesForRepo(repoPath);
    }

    // Close all worktree dropdowns to avoid conflicts
    newWorktreeDropdown.clear();

    // Update state atomically
    showFollowDropdown = new Map(newFollowDropdown);
    showWorktreeDropdown = new Map(newWorktreeDropdown);
  }

  function toggleWorktreeDropdown(dropdownKey: string) {
    const isOpen = showWorktreeDropdown.get(dropdownKey) || false;

    // Create new maps to avoid intermediate states during update
    const newFollowDropdown = new Map<string, boolean>();
    const newWorktreeDropdown = new Map<string, boolean>();

    // Only set the clicked dropdown if it wasn't already open
    if (!isOpen) {
      newWorktreeDropdown.set(dropdownKey, true);
      // Extract repo path from dropdown key for loading
      const repoPath = dropdownKey.split(':')[0];
      // Load worktrees if not already loaded
      loadWorktreesForRepo(repoPath);
    }

    // Update state atomically
    showFollowDropdown = new Map(newFollowDropdown);
    showWorktreeDropdown = new Map(newWorktreeDropdown);
  }

  function createSessionInWorktree(worktreePath: string) {
    // Close all dropdowns atomically
    showWorktreeDropdown = new Map<string, boolean>();

    // Dispatch event to open create session dialog with pre-filled path
    const event = new CustomEvent('open-create-dialog', {
      detail: { workingDir: worktreePath },
      bubbles: true,
      composed: true,
    });
    document.dispatchEvent(event);
  }

  async function loadWorktreesForRepo(repoPath: string) {
    if (loadingWorktrees.has(repoPath) || repoWorktrees.has(repoPath)) {
      return;
    }

    loadingWorktrees.add(repoPath);

    try {
      const data = await sessionServiceInstance?.loadWorktrees(repoPath);
      repoWorktrees.set(repoPath, data?.worktrees || []);
      // Also set follow mode from the worktrees API response
      repoFollowMode.set(repoPath, data?.followBranch);
    } catch (error) {
      logger.error('Error loading worktrees:', error);
    } finally {
      loadingWorktrees.delete(repoPath);
    }
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;

    // Check if click is outside any selector
    const isInsideSelector =
      target.closest('[id^="branch-selector-"]') ||
      target.closest('.branch-dropdown') ||
      target.closest('[id^="follow-selector-"]') ||
      target.closest('.follow-dropdown') ||
      target.closest('[id^="worktree-selector-"]') ||
      target.closest('.worktree-dropdown');

    if (!isInsideSelector) {
      if (showFollowDropdown.size > 0 || showWorktreeDropdown.size > 0) {
        // Create new empty maps to close all dropdowns atomically
        showFollowDropdown = new Map<string, boolean>();
        showWorktreeDropdown = new Map<string, boolean>();
      }
    }
  }

  // Computed values using $derived
  let visibleSessions = $derived(getVisibleSessions());
  let activeSessions = $derived(sessionsList.filter(
    (session) => session.status === 'running' && session.activityStatus?.isActive !== false
  ));
  let idleSessions = $derived(sessionsList.filter(
    (session) => session.status === 'running' && session.activityStatus?.isActive === false
  ));
  let exitedSessions = $derived(sessionsList.filter((session) => session.status === 'exited'));
  let hasActiveSessions = $derived(activeSessions.length > 0);
  let hasIdleSessions = $derived(idleSessions.length > 0);
  let hasExitedSessions = $derived(exitedSessions.length > 0);
  let showExitedSection = $derived(!hideExited && (hasIdleSessions || hasExitedSessions));
  let groupedSessions = $derived(groupSessionsByRepo(visibleSessions));
</script>

<div class="font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 focus:ring-offset-bg-primary rounded-lg" data-testid="session-list-container" tabindex="0">
  <div class="p-4 pt-5">
    {#if !hasActiveSessions && !hasIdleSessions && (!hasExitedSessions || hideExited)}
      <div class="text-text-muted text-center py-8">
        {#if loading}
          Loading sessions...
        {:else if hideExited && sessionsList.length > 0}
          <div class="space-y-4 max-w-2xl mx-auto text-left">
            <div class="text-lg font-semibold text-text">
              No running sessions
            </div>
            <div class="text-sm text-text-muted">
              There are exited sessions. Show them by toggling "Hide exited" above.
            </div>
          </div>
        {:else}
          <div class="space-y-6 max-w-2xl mx-auto text-left">
            <div class="text-lg font-semibold text-text">
              No terminal sessions yet!
            </div>

            <div class="space-y-3">
              <div class="text-sm text-text-muted">
                Get started by using the
                <code class="bg-bg-secondary px-2 py-1 rounded">tf</code> command
                in your terminal:
              </div>

              <div class="bg-bg-secondary p-4 rounded-lg font-mono text-xs space-y-2">
                <div class="text-status-success">tf pnpm run dev</div>
                <div class="text-text-muted pl-4"># Monitor your dev server</div>

                <div class="text-status-success">tf claude --dangerously...</div>
                <div class="text-text-muted pl-4"># Keep an eye on AI agents</div>

                <div class="text-status-success">tf --shell</div>
                <div class="text-text-muted pl-4"># Open an interactive shell</div>

                <div class="text-status-success">tf python train.py</div>
                <div class="text-text-muted pl-4"># Watch long-running scripts</div>
              </div>
            </div>

            <div class="space-y-3 border-t border-border pt-4">
              <div class="text-sm font-semibold text-text">
                Haven't installed the CLI yet?
              </div>
              <div class="text-sm text-text-muted space-y-1">
                <div>→ Click the TunnelForge menu bar icon</div>
                <div>→ Go to Settings → Advanced → Install CLI Tools</div>
              </div>
            </div>

            <div class="text-xs text-text-muted mt-4">
              Once installed, any command prefixed with
              <code class="bg-bg-secondary px-1 rounded">tf</code> will appear
              here, accessible from any browser at localhost:4020.
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <!-- Active Sessions -->
      {#if hasActiveSessions}
        <div class="mb-6 mt-2">
          <h3 class="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">
            Active <span class="text-text-dim">({activeSessions.length})</span>
          </h3>
          {#each Array.from(groupedSessions) as [repoPath, repoSessions]}
            <div class="{repoPath ? 'mb-6 mt-6' : 'mb-4'}">
              {#if repoPath}
                <div class="flex items-center gap-2 mb-3">
                  <h4 class="text-sm font-medium text-text">{getRepoName(repoPath)}</h4>
                  <div class="flex items-center gap-1">
                    <!-- Follow Mode Selector -->
                    {#if repoWorktrees.get(repoPath)?.length}
                      <div class="relative">
                        <button
                          class="flex items-center gap-1 px-2 py-1 text-xs bg-bg-secondary hover:bg-bg-tertiary rounded-md border border-border transition-colors"
                          onclick={() => toggleFollowDropdown(`${repoPath}:active`)}
                          id="follow-selector-{repoPath.replace(/[^a-zA-Z0-9]/g, '-')}-active"
                        >
                          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          <span class="font-mono text-xs">{repoFollowMode.get(repoPath)?.replace(/^refs\/heads\//, '') || 'Standalone'}</span>
                          {#if loadingFollowMode.has(repoPath)}
                            <span class="animate-spin">⟳</span>
                          {:else}
                            <svg class="w-3 h-3 transition-transform {showFollowDropdown.get(`${repoPath}:active`) ? 'rotate-180' : ''}"
                              fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          {/if}
                        </button>

                        {#if showFollowDropdown.get(`${repoPath}:active`)}
                          <div class="follow-dropdown absolute right-0 mt-1 w-64 bg-bg-elevated border border-border rounded-md shadow-lg max-h-96 overflow-y-auto z-50">
                            <div class="py-1">
                              <button
                                class="w-full text-left px-3 py-2 text-xs hover:bg-bg-elevated transition-colors flex items-center justify-between"
                                onclick={() => handleFollowModeChange(repoPath, undefined)}
                              >
                                <span class="font-mono {!repoFollowMode.get(repoPath) ? 'text-accent-primary font-semibold' : ''}">Standalone</span>
                                {!repoFollowMode.get(repoPath) ? '<span class="text-accent-primary">✓</span>' : ''}
                              </button>

                              {#each repoWorktrees.get(repoPath) || [] as worktree}
                                <button
                                  class="w-full text-left px-3 py-2 text-xs hover:bg-bg-elevated transition-colors flex items-center justify-between"
                                  onclick={() => handleFollowModeChange(repoPath, worktree.branch)}
                                >
                                  <div class="flex flex-col gap-1">
                                    <span class="font-mono {repoFollowMode.get(repoPath) === worktree.branch ? 'text-accent-primary font-semibold' : ''}">
                                      Follow: {worktree.branch.replace(/^refs\/heads\//, '')}
                                    </span>
                                    <span class="text-[10px] text-text-muted">{worktree.path}</span>
                                  </div>
                                  {#if repoFollowMode.get(repoPath) === worktree.branch}
                                    <span class="text-accent-primary">✓</span>
                                  {/if}
                                </button>
                              {/each}
                            </div>
                          </div>
                        {/if}
                      </div>
                    {/if}

                    <!-- Worktree Selector -->
                    <div class="relative">
                      <button
                        class="flex items-center gap-1 px-2 py-1 text-xs bg-bg-secondary hover:bg-bg-tertiary rounded-md border border-border transition-colors"
                        onclick={() => toggleWorktreeDropdown(`${repoPath}:active`)}
                        id="worktree-selector-{repoPath.replace(/[^a-zA-Z0-9]/g, '-')}-active"
                        title="Worktrees"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <span class="font-mono">{(repoWorktrees.get(repoPath) || []).length || 0}</span>
                        {#if loadingWorktrees.has(repoPath)}
                          <span class="animate-spin">⟳</span>
                        {:else}
                          <svg class="w-3 h-3 transition-transform {showWorktreeDropdown.get(`${repoPath}:active`) ? 'rotate-180' : ''}"
                            fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        {/if}
                      </button>

                      {#if showWorktreeDropdown.get(`${repoPath}:active`)}
                        <div class="worktree-dropdown absolute right-0 mt-1 w-96 bg-bg-elevated border border-border rounded-md shadow-lg max-h-96 overflow-y-auto z-50">
                          {#if (repoWorktrees.get(repoPath) || []).length === 0 && !loadingWorktrees.has(repoPath)}
                            <div class="px-3 py-2 text-xs text-text-muted">No worktrees found</div>
                          {:else}
                            <div class="py-1">
                              {#each repoWorktrees.get(repoPath) || [] as worktree}
                                <div class="border-b border-border last:border-b-0">
                                  <div class="px-3 py-2">
                                    <div class="flex items-center justify-between gap-2">
                                      <div class="flex items-center gap-2 min-w-0 flex-1">
                                        <svg class="w-3 h-3 text-text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.632 4.684C18.114 15.938 18 15.482 18 15c0-.482.114-.938.316-1.342m0 2.684a3 3 0 110-2.684M15 9a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <div class="font-mono text-sm truncate">
                                          {worktree.branch.replace(/^refs\/heads\//, '')}
                                        </div>
                                        {#if worktree.detached}
                                          <span class="text-[10px] px-1.5 py-0.5 bg-status-warning/20 text-status-warning rounded flex-shrink-0">
                                            detached
                                          </span>
                                        {/if}
                                      </div>
                                      <button
                                        class="p-1 hover:bg-bg-elevated rounded transition-colors flex-shrink-0"
                                        onclick={() => createSessionInWorktree(worktree.path)}
                                        title="Create new session in this worktree"
                                      >
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                                        </svg>
                                      </button>
                                    </div>
                                    <div class="text-[10px] text-text-muted truncate pl-5">{worktree.path}</div>
                                  </div>
                                </div>
                              {/each}
                            </div>
                          {/if}
                        </div>
                      {/if}
                    </div>
                  </div>
                </div>
              {/if}
              <div class="{compactMode ? '' : 'session-flex-responsive'} relative">
                {#each repoSessions as session, index}
                  {@const currentIndex = index + 1}
                  {#if compactMode}
                    <!-- Compact session card placeholder - would need CompactSessionCard component -->
                    <div class="session-card-compact" data-session-id={session.id}>
                      Compact: {session.name} ({session.status})
                    </div>
                  {:else}
                    <!-- Full session card placeholder - would need SessionCard component -->
                    <div
                      class="session-card {selectedSessionIdValue === session.id ? 'selected' : ''}"
                      data-session-id={session.id}
                      onclick={() => handleSessionSelect(session)}
                    >
                      {session.name} ({session.status})
                    </div>
                  {/if}
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Idle Sessions -->
      {#if hasIdleSessions}
        <div class="mb-6 {!hasActiveSessions ? 'mt-2' : ''}">
          <h3 class="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">
            Idle <span class="text-text-dim">({idleSessions.length})</span>
          </h3>
          <!-- Similar structure to active sessions but for idle -->
          <div class="text-sm text-text-muted">Idle sessions display would go here</div>
        </div>
      {/if}

      <!-- Exited Sessions -->
      {#if showExitedSection && hasExitedSessions}
        <div class="{!hasActiveSessions && !hasIdleSessions ? 'mt-2' : ''}">
          <h3 class="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">
            Exited <span class="text-text-dim">({exitedSessions.length})</span>
          </h3>
          <!-- Similar structure to active sessions but for exited -->
          <div class="text-sm text-text-muted">Exited sessions display would go here</div>
        </div>
      {/if}
    {/if}
  </div>

  <!-- Bottom Controls -->
  <div class="sticky bottom-0 border-t border-border bg-bg-secondary shadow-lg z-40">
    <div class="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <!-- Status group (left side) -->
      <div class="flex flex-wrap items-center gap-3 sm:gap-4">
        <!-- Session counts -->
        <div class="flex items-center gap-2 sm:gap-3 font-mono text-xs">
          {#if activeSessions.length > 0}
            <span class="text-status-success whitespace-nowrap">{activeSessions.length} Active</span>
          {/if}
          {#if idleSessions.length > 0}
            <span class="text-text-muted whitespace-nowrap">{idleSessions.length} Idle</span>
          {/if}
          {#if exitedSessions.length > 0}
            <span class="text-text-dim whitespace-nowrap">{exitedSessions.length} Exited</span>
          {/if}
        </div>

        <!-- Show exited toggle (only if there are exited sessions) -->
        {#if exitedSessions.length > 0}
          <label class="flex items-center gap-2 cursor-pointer group whitespace-nowrap">
            <input
              type="checkbox"
              class="session-toggle-checkbox"
              checked={!hideExited}
              onchange={(e) => onhideExitedChange?.(!(e.target as HTMLInputElement).checked)}
              id="show-exited-toggle"
              data-testid="show-exited-toggle"
            />
            <span class="text-xs text-text-muted group-hover:text-text font-mono select-none">
              Show
            </span>
          </label>
        {/if}
      </div>

      <!-- Actions group (right side) -->
      <div class="flex items-center gap-2 ml-auto">
        <!-- Clean button (only visible when showing exited sessions) -->
        {#if !hideExited && exitedSessions.length > 0}
          <button
            class="font-mono text-xs px-3 py-1.5 rounded-md border transition-all duration-200 border-status-warning bg-status-warning/10 text-status-warning hover:bg-status-warning/20 hover:shadow-glow-warning-sm active:scale-95 disabled:opacity-50"
            id="clean-exited-button"
            onclick={handleCleanupExited}
            disabled={cleaningExited}
            data-testid="clean-exited-button"
          >
            {#if cleaningExited}
              <span class="flex items-center gap-1">
                <span class="animate-spin">⟳</span>
                Cleaning...
              </span>
            {:else}
              Clean
            {/if}
          </button>
        {/if}

        <!-- Kill All button (always visible if there are running sessions) -->
        {#if sessionsList.filter(s => s.status === 'running').length > 0}
          <button
            class="font-mono text-xs px-3 py-1.5 rounded-md border transition-all duration-200 border-status-error bg-status-error/10 text-status-error hover:bg-status-error/20 hover:shadow-glow-error-sm active:scale-95"
            id="kill-all-button"
            onclick={onkillAllSessions}
            data-testid="kill-all-button"
          >
            Kill All
          </button>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .session-flex-responsive {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.25rem;
  }

  .session-card {
    @apply bg-bg-elevated border border-border rounded-lg p-4 cursor-pointer transition-all duration-200;
  }

  .session-card:hover {
    @apply border-accent-primary/50 shadow-lg;
  }

  .session-card.selected {
    @apply border-accent-primary bg-bg-elevated shadow-lg ring-2 ring-accent-primary/20;
  }

  .black-hole-collapsing {
    animation: black-hole-collapse 0.3s ease-in-out forwards;
  }

  @keyframes black-hole-collapse {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(0.8);
      opacity: 0.5;
    }
    100% {
      transform: scale(0);
      opacity: 0;
    }
  }

  .follow-dropdown,
  .worktree-dropdown {
    z-index: 50;
  }
</style>