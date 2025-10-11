<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Worktree } from '$lib/types';
  import { createLogger } from '$lib/utils/logger';

  const logger = createLogger('repository-header');

  // Event dispatcher for repository actions
  const dispatch = createEventDispatcher<{
    'follow-mode-change': { repoPath: string; followBranch: string | undefined };
    'worktree-create': { worktreePath: string };
  }>();

  // Props
  interface Props {
    repoPath: string;
    followMode?: string | undefined;
    worktrees?: Worktree[];
    loadingFollowMode?: boolean;
    loadingWorktrees?: boolean;
  }

  let {
    repoPath,
    followMode,
    worktrees = [],
    loadingFollowMode = false,
    loadingWorktrees = false
  }: Props = $props();

  // State
  let showFollowDropdown = $state(false);
  let showWorktreeDropdown = $state(false);

  // Handle follow mode change
  function handleFollowModeChange(followBranch: string | undefined) {
    dispatch('follow-mode-change', { repoPath, followBranch });
    showFollowDropdown = false;
  }

  // Handle worktree creation
  function handleWorktreeCreate(worktreePath: string) {
    dispatch('worktree-create', { worktreePath });
    showWorktreeDropdown = false;
  }

  // Toggle dropdowns
  function toggleFollowDropdown() {
    showFollowDropdown = !showFollowDropdown;
    showWorktreeDropdown = false;
  }

  function toggleWorktreeDropdown() {
    showWorktreeDropdown = !showWorktreeDropdown;
    showFollowDropdown = false;
  }

  // Get repository name from path
  function getRepoName(repoPath: string): string {
    return repoPath.split('/').pop() || repoPath;
  }

  // Close dropdowns when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.dropdown-container')) {
      showFollowDropdown = false;
      showWorktreeDropdown = false;
    }
  }

  // Add click outside listener
  $effect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });
</script>

<div class="repo-header">
  <h4 class="repo-name">{getRepoName(repoPath)}</h4>
  <div class="repo-controls">
    <!-- Follow Mode Selector -->
    {#if worktrees.length > 0}
      <div class="dropdown-container">
        <button
          class="control-button"
          onclick={toggleFollowDropdown}
          title="Follow mode"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <span class="font-mono text-xs">{followMode?.replace(/^refs\/heads\//, '') || 'Standalone'}</span>
          {#if loadingFollowMode}
            <span class="animate-spin">⟳</span>
          {:else}
            <svg class="w-3 h-3 transition-transform {showFollowDropdown ? 'rotate-180' : ''}"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          {/if}
        </button>

        {#if showFollowDropdown}
          <div class="dropdown follow-dropdown">
            <button
              class="dropdown-item {!followMode ? 'selected' : ''}"
              onclick={() => handleFollowModeChange(undefined)}
            >
              <span class="font-mono {!followMode ? 'font-semibold' : ''}">Standalone</span>
              {!followMode ? '<span class="selected-indicator">✓</span>' : ''}
            </button>

            {#each worktrees as worktree}
              <button
                class="dropdown-item {followMode === worktree.branch ? 'selected' : ''}"
                onclick={() => handleFollowModeChange(worktree.branch)}
              >
                <div class="flex flex-col gap-1">
                  <span class="font-mono {followMode === worktree.branch ? 'font-semibold' : ''}">
                    Follow: {worktree.branch.replace(/^refs\/heads\//, '')}
                  </span>
                  <span class="text-[10px] text-text-muted">{worktree.path}</span>
                </div>
                {#if followMode === worktree.branch}
                  <span class="selected-indicator">✓</span>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- Worktree Selector -->
    <div class="dropdown-container">
      <button
        class="control-button"
        onclick={toggleWorktreeDropdown}
        title="Worktrees"
      >
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <span class="font-mono">{worktrees.length || 0}</span>
        {#if loadingWorktrees}
          <span class="animate-spin">⟳</span>
        {:else}
          <svg class="w-3 h-3 transition-transform {showWorktreeDropdown ? 'rotate-180' : ''}"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        {/if}
      </button>

      {#if showWorktreeDropdown}
        <div class="dropdown worktree-dropdown">
          {#if worktrees.length === 0 && !loadingWorktrees}
            <div class="px-3 py-2 text-xs text-text-muted">No worktrees found</div>
          {:else}
            {#each worktrees as worktree}
              <div class="worktree-item">
                <div class="worktree-info">
                  <svg class="w-3 h-3 text-text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.632 4.684C18.114 15.938 18 15.482 18 15c0-.482.114-.938.316-1.342m0 2.684a3 3 0 110-2.684M15 9a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <div class="font-mono text-sm truncate">
                    {worktree.branch.replace(/^refs\/heads\//, '')}
                  </div>
                  {#if worktree.detached}
                    <span class="detached-badge">
                      detached
                    </span>
                  {/if}
                </div>
                <button
                  class="create-button"
                  onclick={() => handleWorktreeCreate(worktree.path)}
                  title="Create new session in this worktree"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
              <div class="worktree-path">
                {worktree.path}
              </div>
            {/each}
          {/if}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .repo-header {
    @apply flex items-center gap-2 mb-3;
  }

  .repo-name {
    @apply font-medium text-text-primary flex-1;
    font-size: 0.875rem;
  }

  .repo-controls {
    @apply flex items-center gap-1;
  }

  .dropdown-container {
    @apply relative;
  }

  .control-button {
    @apply flex items-center gap-1 px-2 py-1 text-xs bg-bg-secondary hover:bg-bg-tertiary rounded-md border border-border transition-colors;
  }

  .dropdown {
    @apply absolute right-0 mt-1 bg-bg-elevated border border-border rounded-md shadow-lg z-50;
  }

  .follow-dropdown {
    @apply w-64 max-h-96 overflow-y-auto;
  }

  .worktree-dropdown {
    @apply w-96 max-h-96 overflow-y-auto;
  }

  .dropdown-item {
    @apply w-full text-left px-3 py-2 text-xs hover:bg-bg-elevated transition-colors flex items-center justify-between;
  }

  .dropdown-item.selected {
    @apply bg-accent-primary/10;
  }

  .selected-indicator {
    @apply text-accent-primary;
  }

  .worktree-item {
    @apply border-b border-border last:border-b-0;
  }

  .worktree-info {
    @apply px-3 py-2 flex items-center justify-between gap-2;
  }

  .detached-badge {
    @apply text-[10px] px-1.5 py-0.5 bg-status-warning/20 text-status-warning rounded flex-shrink-0;
  }

  .create-button {
    @apply p-1 hover:bg-bg-elevated rounded transition-colors flex-shrink-0;
  }

  .worktree-path {
    @apply text-[10px] text-text-muted truncate pl-5 pb-1;
  }
</style>