<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { TitleMode } from '$lib/types';
  import type { GitRepoInfo } from '$lib/types';

  let {
    macAppConnected = false,
    spawnWindow = false,
    titleMode = TitleMode.DYNAMIC,
    gitRepoInfo = null,
    followMode = false,
    followBranch = null,
    showFollowMode = false,
    selectedWorktree = undefined,
    disabled = false,
    isCreating = false
  } = $props();

  let expanded = $state(false);

  const dispatch = createEventDispatcher<{
    'spawn-window-changed': { enabled: boolean };
    'title-mode-changed': { mode: TitleMode };
    'follow-mode-changed': { enabled: boolean };
  }>();

  function handleToggle() {
    expanded = !expanded;
  }

  function handleSpawnWindowToggle() {
    dispatch('spawn-window-changed', { enabled: !spawnWindow });
  }

  function handleTitleModeChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    dispatch('title-mode-changed', { mode: select.value as TitleMode });
  }

  function handleFollowModeToggle() {
    dispatch('follow-mode-changed', { enabled: !showFollowMode });
  }

  function getTitleModeDescription(mode: TitleMode): string {
    switch (mode) {
      case TitleMode.NONE:
        return 'No title updates';
      case TitleMode.FILTER:
        return 'Show command filters';
      case TitleMode.STATIC:
        return 'Static title';
      case TitleMode.DYNAMIC:
        return 'Dynamic title with command';
      default:
        return 'Unknown mode';
    }
  }
</script>

<div class="mb-2 sm:mb-4 lg:mb-6">
  <button
    id="session-options-button"
    on:click={handleToggle}
    class="flex items-center gap-1.5 sm:gap-2 text-text-muted hover:text-primary transition-colors duration-200"
    type="button"
    aria-expanded={expanded}
  >
    <svg
      width="8"
      height="8"
      class="sm:w-2 sm:h-2 lg:w-2.5 lg:h-2.5 transition-transform duration-200 flex-shrink-0"
      viewBox="0 0 16 16"
      fill="currentColor"
      style="transform: {expanded ? 'rotate(90deg)' : 'rotate(0deg)'}"
    >
      <path
        d="M5.22 1.22a.75.75 0 011.06 0l6.25 6.25a.75.75 0 010 1.06l-6.25 6.25a.75.75 0 01-1.06-1.06L10.94 8 5.22 2.28a.75.75 0 010-1.06z"
      />
    </svg>
    <span class="form-label mb-0 text-text-muted uppercase text-[9px] sm:text-[10px] lg:text-xs tracking-wider">Options</span>
  </button>

  {#if expanded}
    <div class="mt-2 sm:mt-3">
      <!-- Spawn Window Toggle - Only show when Mac app is connected -->
      {#if macAppConnected}
        <div class="flex items-center justify-between bg-bg-elevated border border-border/50 rounded-lg p-2 sm:p-3 lg:p-4 mb-2 sm:mb-3">
          <div class="flex-1 pr-2 sm:pr-3 lg:pr-4">
            <span class="text-primary text-[10px] sm:text-xs lg:text-sm font-medium">Spawn window</span>
            <p class="text-[9px] sm:text-[10px] lg:text-xs text-text-muted mt-0.5 hidden sm:block">Opens native terminal window</p>
          </div>
          <button
            role="switch"
            aria-checked={spawnWindow}
            on:click={handleSpawnWindowToggle}
            class="relative inline-flex h-4 w-8 sm:h-5 sm:w-10 lg:h-6 lg:w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-bg-secondary {spawnWindow ? 'bg-primary' : 'bg-border/50'}"
            disabled={disabled || isCreating}
            data-testid="spawn-window-toggle"
          >
            <span
              class="inline-block h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5 transform rounded-full bg-bg-elevated transition-transform {spawnWindow ? 'translate-x-4 sm:translate-x-5' : 'translate-x-0.5'}"
            ></span>
          </button>
        </div>
      {/if}

      <!-- Terminal Title Mode -->
      <div class="flex items-center justify-between bg-bg-elevated border border-border/50 rounded-lg p-2 sm:p-3 lg:p-4 mb-2 sm:mb-3">
        <div class="flex-1 pr-2 sm:pr-3 lg:pr-4">
          <span class="text-primary text-[10px] sm:text-xs lg:text-sm font-medium">Terminal Title Mode</span>
          <p class="text-[9px] sm:text-[10px] lg:text-xs text-text-muted mt-0.5 hidden sm:block">
            {getTitleModeDescription(titleMode)}
          </p>
        </div>
        <div class="relative">
          <select
            value={titleMode}
            on:change={handleTitleModeChange}
            class="bg-bg-tertiary border border-border/50 rounded-lg px-1.5 py-1 pr-6 sm:px-2 sm:py-1.5 sm:pr-7 lg:px-3 lg:py-2 lg:pr-8 text-text text-[10px] sm:text-xs lg:text-sm transition-all duration-200 hover:border-primary/50 focus:border-primary focus:outline-none appearance-none cursor-pointer"
            style="min-width: 80px"
            disabled={disabled || isCreating}
          >
            <option value={TitleMode.NONE} class="bg-bg-tertiary text-text">None</option>
            <option value={TitleMode.FILTER} class="bg-bg-tertiary text-text">Filter</option>
            <option value={TitleMode.STATIC} class="bg-bg-tertiary text-text">Static</option>
            <option value={TitleMode.DYNAMIC} class="bg-bg-tertiary text-text">Dynamic</option>
          </select>
          <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 sm:px-1.5 lg:px-2 text-text-muted">
            <svg class="h-2.5 w-2.5 sm:h-3 sm:w-3 lg:h-4 lg:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      <!-- Follow Mode Toggle - Show only when a worktree is selected -->
      {#if gitRepoInfo?.isGitRepo && selectedWorktree && selectedWorktree !== 'none'}
        <div class="flex items-center justify-between bg-bg-elevated border border-border/50 rounded-lg p-2 sm:p-3 lg:p-4">
          <div class="flex-1 pr-2 sm:pr-3 lg:pr-4">
            <span class="text-primary text-[10px] sm:text-xs lg:text-sm font-medium">Follow Mode</span>
            <p class="text-[9px] sm:text-[10px] lg:text-xs text-text-muted mt-0.5 hidden sm:block">
              {#if followMode}
                Currently following: {followBranch || 'unknown'}
              {:else}
                Keep main repository in sync with this worktree
              {/if}
            </p>
          </div>
          <button
            role="switch"
            aria-checked={showFollowMode}
            on:click={handleFollowModeToggle}
            class="relative inline-flex h-4 w-8 sm:h-5 sm:w-10 lg:h-6 lg:w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-bg-secondary {showFollowMode ? 'bg-primary' : 'bg-border/50'}"
            disabled={disabled || isCreating || followMode}
            data-testid="follow-mode-toggle"
          >
            <span
              class="inline-block h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5 transform rounded-full bg-bg-elevated transition-transform {showFollowMode ? 'translate-x-4 sm:translate-x-5' : 'translate-x-0.5'}"
            ></span>
          </button>
        </div>
      {/if}
    </div>
  {/if}
</div>