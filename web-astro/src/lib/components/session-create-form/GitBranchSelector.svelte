<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { GitRepoInfo, WorktreeInfo } from '$lib/types';

  let {
    gitRepoInfo = null,
    disabled = false,
    isCreating = false,
    currentBranch = '',
    selectedBaseBranch = '',
    selectedWorktree = undefined,
    availableBranches = [],
    availableWorktrees = [],
    isLoadingBranches = false,
    isLoadingWorktrees = false,
    followMode = false,
    followBranch = null,
    showFollowMode = false,
    branchSwitchWarning = undefined
  } = $props();

  const dispatch = createEventDispatcher<{
    'branch-changed': { branch: string };
    'worktree-changed': { worktree: string | undefined };
    'create-worktree': { branchName: string; baseBranch: string; customPath?: string };
    'error': string;
  }>();

  let showCreateWorktree: boolean = false;
  let newBranchName: string = '';
  let isCreatingWorktree: boolean = false;
  let customPath: string = '';
  let useCustomPath: boolean = false;

  function handleBaseBranchChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    selectedBaseBranch = select.value;
    dispatch('branch-changed', { branch: select.value });
  }

  function handleWorktreeChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    selectedWorktree = select.value === 'none' ? undefined : select.value;
    dispatch('worktree-changed', { worktree: selectedWorktree });
  }

  async function handleCreateWorktree() {
    const branchName = newBranchName.trim();

    if (!branchName) {
      return;
    }

    // Validate branch name
    const validationError = validateBranchName(branchName);
    if (validationError) {
      dispatch('error', validationError);
      return;
    }

    isCreatingWorktree = true;
    dispatch('create-worktree', {
      branchName: branchName,
      baseBranch: selectedBaseBranch || 'main',
      customPath: useCustomPath ? customPath.trim() : undefined,
    });
  }

  function validateBranchName(name: string): string | null {
    // Check if branch already exists
    if (availableBranches.includes(name)) {
      return `Branch '${name}' already exists`;
    }

    // Git branch name validation rules
    if (name.startsWith('-') || name.endsWith('-')) {
      return 'Branch name cannot start or end with a hyphen';
    }

    if (name.includes('..') || name.includes('~') || name.includes('^') || name.includes(':')) {
      return 'Branch name contains invalid characters (.. ~ ^ :)';
    }

    if (name.endsWith('.lock')) {
      return 'Branch name cannot end with .lock';
    }

    if (name.includes('//') || name.includes('\\')) {
      return 'Branch name cannot contain consecutive slashes';
    }

    // Reserved names
    const reserved = ['HEAD', 'FETCH_HEAD', 'ORIG_HEAD', 'MERGE_HEAD'];
    if (reserved.includes(name.toUpperCase())) {
      return `'${name}' is a reserved Git name`;
    }

    return null;
  }

  function handleNewBranchInput(e: Event) {
    newBranchName = (e.target as HTMLInputElement).value;
  }

  function handleCancelCreateWorktree() {
    showCreateWorktree = false;
    newBranchName = '';
    customPath = '';
    useCustomPath = false;
  }

  function logEvent(type: string, detail: any) {
    // This is a placeholder - in real implementation, use proper event dispatching
    console.log('Dispatching event:', type, detail);
  }
</script>

{#if gitRepoInfo?.isGitRepo}
  <div class="mb-2 sm:mb-3 mt-2 sm:mt-3">
    <div class="space-y-2">
      <!-- Base Branch Selection -->
      <div>
        <label class="form-label text-text-muted text-[10px] sm:text-xs lg:text-sm flex items-center gap-2">
          {#if availableWorktrees.some((wt) => wt.isCurrentWorktree && !wt.isMainWorktree)}
            Base Branch for Current Worktree:
          {:else if selectedWorktree}
            Base Branch for Worktree:
          {:else}
            Switch to Branch:
          {/if}
          {#if gitRepoInfo?.hasChanges && !selectedWorktree}
            <span class="text-yellow-500 text-[9px] sm:text-[10px] flex items-center gap-1">
              <span>●</span>
              <span>Uncommitted changes</span>
            </span>
          {/if}
        </label>
        <div class="relative">
          <select
            bind:value={selectedBaseBranch}
            on:change={handleBaseBranchChange}
            class="input-field py-1.5 sm:py-2 lg:py-3 text-xs sm:text-sm appearance-none pr-8 {gitRepoInfo?.hasChanges && !selectedWorktree ? 'opacity-50 cursor-not-allowed' : ''}"
            disabled={disabled || isCreating || isLoadingBranches || (gitRepoInfo?.hasChanges && !selectedWorktree)}
            data-testid="git-base-branch-select"
          >
            {#each availableBranches as branch}
              <option value={branch} selected={branch === (selectedBaseBranch || currentBranch)}>
                {branch}{branch === currentBranch ? ' (current)' : ''}
              </option>
            {/each}
          </select>
          <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-text-muted">
            <svg class="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {#if !isLoadingBranches}
          <p class="text-[9px] sm:text-[10px] text-text-muted mt-1">
            {#if gitRepoInfo?.hasChanges && !selectedWorktree}
              <span class="text-yellow-500">Branch switching is disabled due to uncommitted changes. Commit or stash changes first.</span>
            {:else if selectedWorktree}
              Session will use worktree: {selectedWorktree}
            {:else if selectedBaseBranch && selectedBaseBranch !== currentBranch}
              Session will start on {selectedBaseBranch}
            {/if}
            {#if followMode && followBranch && ((gitRepoInfo?.hasChanges && !selectedWorktree) || selectedWorktree || (selectedBaseBranch && selectedBaseBranch !== currentBranch))}
              {#if (gitRepoInfo?.hasChanges && !selectedWorktree) || selectedWorktree || (selectedBaseBranch && selectedBaseBranch !== currentBranch)}
                <br>
              {/if}
              <span class="text-primary">Follow mode active: following {followBranch}</span>
            {:else if followMode && followBranch}
              <span class="text-primary">Follow mode active: following {followBranch}</span>
            {/if}
          </p>
        {/if}
      </div>

      <!-- Worktree Selection -->
      <div>
        <label class="form-label text-text-muted text-[10px] sm:text-xs lg:text-sm">
          Worktree:
        </label>
        {#if !showCreateWorktree}
          <div class="relative">
            <select
              bind:value={selectedWorktree}
              on:change={handleWorktreeChange}
              class="input-field py-1.5 sm:py-2 lg:py-3 text-xs sm:text-sm appearance-none pr-8"
              disabled={disabled || isCreating || isLoadingWorktrees}
              data-testid="git-worktree-select"
            >
              <option value={undefined}>
                {#if availableWorktrees.some((wt) => wt.isCurrentWorktree && !wt.isMainWorktree)}
                  Use main repository
                {:else}
                  Use selected worktree
                {/if}
              </option>
              {#each availableWorktrees as worktree}
                {@const folderName = worktree.path.split('/').pop() || worktree.path}
                {@const showBranch = folderName.toLowerCase() !== worktree.branch.toLowerCase() && !folderName.toLowerCase().endsWith(`-${worktree.branch.toLowerCase()}`)}
                <option value={worktree.branch} selected={worktree.branch === selectedWorktree}>
                  {folderName}{showBranch ? ` [${worktree.branch}]` : ''}{worktree.isMainWorktree ? ' (main)' : ''}{worktree.isCurrentWorktree ? ' (current)' : ''}{followMode && followBranch === worktree.branch ? ' ⚡️ following' : ''}
                </option>
              {/each}
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-text-muted">
              <svg class="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <div class="flex items-center gap-2 mt-2">
            <button
              type="button"
              on:click={() => { showCreateWorktree = true; newBranchName = ''; }}
              class="text-[10px] sm:text-xs text-primary hover:text-primary-dark transition-colors flex items-center gap-1"
              disabled={disabled || isCreating}
            >
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              Create new worktree
            </button>
          </div>
        {:else}
          <!-- Create Worktree Mode -->
          <div class="space-y-2">
            <input
              type="text"
              bind:value={newBranchName}
              on:input={handleNewBranchInput}
              placeholder="New branch name"
              class="input-field py-1.5 sm:py-2 lg:py-3 text-xs sm:text-sm"
              disabled={disabled || isCreating || isCreatingWorktree}
              on:keydown={(e) => {
                if (e.key === 'Escape') {
                  handleCancelCreateWorktree();
                }
              }}
            />

            <!-- Path customization toggle -->
            <label class="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
              <input
                type="checkbox"
                bind:checked={useCustomPath}
                on:change={() => {
                  if (!useCustomPath) {
                    customPath = '';
                  }
                }}
                disabled={disabled || isCreating || isCreatingWorktree}
                class="rounded"
              />
              <span>Customize worktree path</span>
            </label>

            <!-- Custom path input -->
            {#if useCustomPath}
              <div class="space-y-1">
                <input
                  type="text"
                  bind:value={customPath}
                  placeholder="/path/to/worktree"
                  class="input-field py-1.5 sm:py-2 lg:py-3 text-xs sm:text-sm"
                  disabled={disabled || isCreating || isCreatingWorktree}
                />
                <div class="text-[10px] text-text-dim">
                  {#if customPath.trim()}
                    Will create at: {customPath.trim()}
                  {:else}
                    Enter absolute path for the worktree
                  {/if}
                </div>
              </div>
            {:else}
              <div class="text-[10px] text-text-dim">
                Will use default path: {gitRepoInfo?.repoPath || ''}-{newBranchName.trim().replace(/[^a-zA-Z0-9-_]/g, '-') || 'branch'}
              </div>
            {/if}

            <div class="flex items-center gap-2">
              <button
                type="button"
                on:click={handleCancelCreateWorktree}
                class="text-[10px] sm:text-xs text-text-muted hover:text-text transition-colors"
                disabled={disabled || isCreating || isCreatingWorktree}
              >
                Cancel
              </button>
              <button
                type="button"
                on:click={handleCreateWorktree}
                class="text-[10px] sm:text-xs px-2 py-1 bg-primary text-bg-elevated rounded hover:bg-primary-dark transition-colors disabled:opacity-50"
                disabled={!newBranchName.trim() || (useCustomPath && !customPath.trim()) || disabled || isCreating || isCreatingWorktree}
              >
                {isCreatingWorktree ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}