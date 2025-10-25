<script lang="ts">
  /**
   * SessionList.svelte - Session grid display component
   *
   * Migrated from: web/src/client/components/session-list.ts (Lit)
   *
   * Displays a grid of session cards and manages session operations.
   * Groups sessions by repository and provides filtering, cleanup,
   * and keyboard navigation.
   *
   * Features:
   * - Session filtering (active, idle, exited)
   * - Repository grouping with Git integration
   * - Follow mode for worktrees
   * - Keyboard navigation support
   * - Cleanup operations for exited sessions
   */

  import { onMount, onDestroy } from 'svelte';
  import type { Session } from '../types/session.js';
  import SessionView from './SessionView.svelte';

  interface Props {
    sessions: Session[];
    loading?: boolean;
    hideExited?: boolean;
    selectedSessionId?: string | null;
    compactMode?: boolean;
    onSessionSelect?: (sessionId: string) => void;
    onSessionKilled?: (sessionId: string) => void;
    onRefresh?: () => void;
    onError?: (message: string) => void;
  }

  let {
    sessions = [],
    loading = false,
    hideExited = true,
    selectedSessionId = null,
    compactMode = false,
    onSessionSelect,
    onSessionKilled,
    onRefresh,
    onError
  }: Props = $props();

  let cleaningExited = $state(false);
  let containerElement: HTMLElement | null = $state(null);

  // Group sessions by status
  const activeSessions = $derived(
    sessions.filter((s) => s.status === 'running' && s.activityStatus?.isActive !== false)
  );

  const idleSessions = $derived(
    sessions.filter((s) => s.status === 'running' && s.activityStatus?.isActive === false)
  );

  const exitedSessions = $derived(
    sessions.filter((s) => s.status === 'exited')
  );

  const hasActiveSessions = $derived(activeSessions.length > 0);
  const hasIdleSessions = $derived(idleSessions.length > 0);
  const hasExitedSessions = $derived(exitedSessions.length > 0);
  const showExitedSection = $derived(!hideExited && (hasIdleSessions || hasExitedSessions));

  // Get visible sessions based on filter
  const visibleSessions = $derived(() => {
    const running = sessions.filter((s) => s.status === 'running');
    const exited = sessions.filter((s) => s.status === 'exited');
    return hideExited ? running : running.concat(exited);
  });

  // Keyboard navigation handler
  function handleKeyDown(e: KeyboardEvent) {
    const { key } = e;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter'].includes(key)) {
      return;
    }

    // Check if we're inside an input element
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select') || target.isContentEditable) {
      return;
    }

    const visible = visibleSessions();
    if (visible.length === 0) return;

    e.preventDefault();
    e.stopPropagation();

    let index = selectedSessionId
      ? visible.findIndex((s) => s.id === selectedSessionId)
      : 0;
    if (index < 0) index = 0;

    if (key === 'Enter') {
      handleSessionSelect(visible[index].id);
      return;
    }

    const columns = getGridColumns();

    if (key === 'ArrowLeft') {
      index = (index - 1 + visible.length) % visible.length;
    } else if (key === 'ArrowRight') {
      index = (index + 1) % visible.length;
    } else if (key === 'ArrowUp') {
      index = index - columns;
      if (index < 0) {
        const currentColumn = index + columns;
        const lastRowStart = Math.floor((visible.length - 1) / columns) * columns;
        index = Math.min(lastRowStart + currentColumn, visible.length - 1);
      }
    } else if (key === 'ArrowDown') {
      const oldIndex = index;
      index = index + columns;
      if (index >= visible.length) {
        const currentColumn = oldIndex % columns;
        index = currentColumn;
      }
    }

    selectedSessionId = visible[index].id;

    // Scroll selected element into view
    setTimeout(() => {
      const selectedCard = containerElement?.querySelector('[data-selected="true"]');
      if (selectedCard) {
        selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 0);
  }

  function getGridColumns(): number {
    if (!containerElement || compactMode) return 1;

    const gridContainer = containerElement.querySelector('.session-grid');
    if (!gridContainer) return 1;

    const computedStyle = window.getComputedStyle(gridContainer);
    const templateColumns = computedStyle.getPropertyValue('grid-template-columns');
    const columns = templateColumns.split(' ').filter((col) => col && col !== '0px').length;

    if (columns === 0 || columns === 1) {
      const containerWidth = gridContainer.clientWidth;
      const minItemWidth = 280;
      const gap = 20;
      return Math.max(1, Math.floor((containerWidth + gap) / (minItemWidth + gap)));
    }

    return columns;
  }

  function handleSessionSelect(sessionId: string) {
    onSessionSelect?.(sessionId);
  }

  function handleSessionKilledEvent(sessionId: string) {
    onSessionKilled?.(sessionId);
    onRefresh?.();
  }

  async function handleCleanupExited() {
    if (cleaningExited) return;

    cleaningExited = true;

    try {
      const response = await fetch('/api/cleanup-exited', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Apply animation to exited sessions
        const exitedCards = containerElement?.querySelectorAll('[data-session-status="exited"]');
        exitedCards?.forEach((card) => {
          (card as HTMLElement).classList.add('black-hole-collapsing');
        });

        // Wait for animation
        if (exitedCards && exitedCards.length > 0) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        onRefresh?.();
      } else {
        onError?.('Failed to cleanup exited sessions');
      }
    } catch (error) {
      console.error('Error cleaning up exited sessions:', error);
      onError?.('Failed to cleanup exited sessions');
    } finally {
      cleaningExited = false;
    }
  }

  function groupSessionsByRepo(sessions: Session[]): Map<string | null, Session[]> {
    const groups = new Map<string | null, Session[]>();

    sessions.forEach((session) => {
      const groupKey = session.gitMainRepoPath || session.gitRepoPath || null;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(session);
    });

    // Sort groups: non-git first, then git repos by name
    const sortedGroups = new Map<string | null, Session[]>();

    if (groups.has(null)) {
      sortedGroups.set(null, groups.get(null)!);
    }

    const gitRepos = Array.from(groups.keys()).filter((key): key is string => key !== null);
    gitRepos.sort((a, b) => {
      const nameA = getRepoName(a);
      const nameB = getRepoName(b);
      return nameA.localeCompare(nameB);
    });

    gitRepos.forEach((repo) => {
      sortedGroups.set(repo, groups.get(repo)!);
    });

    return sortedGroups;
  }

  function getRepoName(repoPath: string): string {
    const parts = repoPath.split('/');
    return parts[parts.length - 1] || repoPath;
  }

  onMount(() => {
    if (containerElement) {
      containerElement.tabIndex = 0;
      containerElement.addEventListener('keydown', handleKeyDown);
    }
  });

  onDestroy(() => {
    if (containerElement) {
      containerElement.removeEventListener('keydown', handleKeyDown);
    }
  });
</script>

<div
  bind:this={containerElement}
  class="session-list font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent-primary rounded-lg"
  data-testid="session-list-container"
>
  <div class="p-4 pt-5">
    {#if !hasActiveSessions && !hasIdleSessions && (!hasExitedSessions || hideExited)}
      <div class="text-text-muted text-center py-8">
        {#if loading}
          Loading sessions...
        {:else if hideExited && sessions.length > 0}
          <div class="space-y-4 max-w-2xl mx-auto text-left">
            <div class="text-lg font-semibold text-text">No running sessions</div>
            <div class="text-sm text-text-muted">
              There are exited sessions. Show them by toggling "Hide exited" above.
            </div>
          </div>
        {:else}
          <div class="space-y-6 max-w-2xl mx-auto text-left">
            <div class="text-lg font-semibold text-text">No terminal sessions yet!</div>

            <div class="space-y-3">
              <div class="text-sm text-text-muted">
                Get started by using the <code class="bg-bg-secondary px-2 py-1 rounded">vt</code> command
                in your terminal:
              </div>

              <div class="bg-bg-secondary p-4 rounded-lg font-mono text-xs space-y-2">
                <div class="text-status-success">vt pnpm run dev</div>
                <div class="text-text-muted pl-4"># Monitor your dev server</div>

                <div class="text-status-success">vt claude --dangerously...</div>
                <div class="text-text-muted pl-4"># Keep an eye on AI agents</div>

                <div class="text-status-success">vt --shell</div>
                <div class="text-text-muted pl-4"># Open an interactive shell</div>
              </div>
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

          {#each Array.from(groupSessionsByRepo(activeSessions)) as [repoPath, repoSessions]}
            <div class={repoPath ? 'mb-6 mt-6' : 'mb-4'}>
              {#if repoPath}
                <div class="mb-3 text-xs font-semibold text-text flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  {getRepoName(repoPath)}
                </div>
              {/if}

              <div class={compactMode ? '' : 'session-grid'}>
                {#each repoSessions as session (session.id)}
                  <SessionView
                    sessionId={session.id}
                    title={session.name}
                    workingDir={session.workingDir}
                    command={session.command?.join(' ')}
                    active={session.id === selectedSessionId}
                    onClose={handleSessionKilledEvent}
                    onSelect={handleSessionSelect}
                  />
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

          {#each Array.from(groupSessionsByRepo(idleSessions)) as [repoPath, repoSessions]}
            <div class={repoPath ? 'mb-6 mt-6' : 'mb-4'}>
              {#if repoPath}
                <div class="mb-3 text-xs font-semibold text-text flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  {getRepoName(repoPath)}
                </div>
              {/if}

              <div class={compactMode ? '' : 'session-grid'}>
                {#each repoSessions as session (session.id)}
                  <SessionView
                    sessionId={session.id}
                    title={session.name}
                    workingDir={session.workingDir}
                    command={session.command?.join(' ')}
                    active={session.id === selectedSessionId}
                    onClose={handleSessionKilledEvent}
                    onSelect={handleSessionSelect}
                  />
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}

      <!-- Exited Sessions -->
      {#if showExitedSection && hasExitedSessions}
        <div class={!hasActiveSessions && !hasIdleSessions ? 'mt-2' : ''}>
          <h3 class="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">
            Exited <span class="text-text-dim">({exitedSessions.length})</span>
          </h3>

          {#each Array.from(groupSessionsByRepo(exitedSessions)) as [repoPath, repoSessions]}
            <div class={repoPath ? 'mb-6 mt-6' : 'mb-4'}>
              {#if repoPath}
                <div class="mb-3 text-xs font-semibold text-text flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  {getRepoName(repoPath)}
                </div>
              {/if}

              <div class={compactMode ? '' : 'session-grid'}>
                {#each repoSessions as session (session.id)}
                  <SessionView
                    sessionId={session.id}
                    title={session.name}
                    workingDir={session.workingDir}
                    command={session.command?.join(' ')}
                    active={session.id === selectedSessionId}
                    onClose={handleSessionKilledEvent}
                    onSelect={handleSessionSelect}
                  />
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>

  <!-- Bottom Controls -->
  {#if sessions.length > 0}
    <div class="sticky bottom-0 border-t border-border bg-bg-secondary shadow-lg">
      <div class="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <!-- Status group -->
        <div class="flex flex-wrap items-center gap-3 sm:gap-4">
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

          {#if exitedSessions.length > 0}
            <label class="flex items-center gap-2 cursor-pointer group whitespace-nowrap">
              <input
                type="checkbox"
                class="session-toggle-checkbox"
                checked={!hideExited}
                onchange={(e) => {
                  hideExited = !(e.target as HTMLInputElement).checked;
                }}
                data-testid="show-exited-toggle"
              />
              <span class="text-xs text-text-muted group-hover:text-text font-mono select-none">
                Show
              </span>
            </label>
          {/if}
        </div>

        <!-- Actions group -->
        <div class="flex items-center gap-2 ml-auto">
          {#if !hideExited && exitedSessions.length > 0}
            <button
              class="font-mono text-xs px-3 py-1.5 rounded-md border transition-all duration-200 border-status-warning bg-status-warning/10 text-status-warning hover:bg-status-warning/20 active:scale-95 disabled:opacity-50"
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
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .session-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.25rem;
  }

  .black-hole-collapsing {
    animation: blackhole 0.3s ease-out forwards;
  }

  @keyframes blackhole {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    100% {
      transform: scale(0);
      opacity: 0;
    }
  }
</style>
