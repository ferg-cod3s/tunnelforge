<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { authToken } from '$lib/stores/auth';
  import { GitServiceImpl } from '$lib/services/git';
  import { formatPathForDisplay } from '$lib/utils/path-utils';
  import { createLogger } from '$lib/utils/logger';
  import type { Worktree, WorktreeListResponse } from '$lib/types';

  const logger = createLogger('worktree-manager');

  // Props interface
  interface Props {
    repositoryPath: string;
  }

  let { repositoryPath }: Props = $props();

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    'worktree-created': { branch: string; path: string };
    'worktree-deleted': { branch: string };
    'worktree-selected': { branch: string; path: string };
    error: string;
  }>();

  // Auth client for API calls
  const authClient = {
    getAuthHeader: () => ({
      'Authorization': `Bearer ${$authToken}`,
      'Content-Type': 'application/json'
    })
  };

  // Git service instance
  const gitService = new GitServiceImpl(authClient);

  // Reactive state using Svelte 5 runes
  let worktrees = $state<Worktree[]>([]);
  let baseBranch = $state('main');
  let followBranch = $state<string | undefined>(undefined);
  let loading = $state(false);
  let error = $state('');
  let showDeleteConfirm = $state(false);
  let deleteTargetBranch = $state('');
  let deleteHasChanges = $state(false);
  let showCreateWorktree = $state(false);
  let newBranchName = $state('');
  let newWorktreePath = $state('');
  let useCustomPath = $state(false);
  let isCreatingWorktree = $state(false);

  // Validation function (returns error message or null)
  function validateBranchName(name: string): string | null {
    if (!name.trim()) return null; // No error for empty name

    // Check if branch already exists
    const existingBranches = worktrees.map((wt) => wt.branch.replace(/^refs\/heads\//, ''));
    if (existingBranches.includes(name.trim())) {
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

    return null; // Valid
  }

  // Reactive state for validation
  let branchValidationError: string | null = null;
  let isBranchNameValid = false;
  let canCreateWorktree = false;

  // Update validation when branch name changes
  $effect(() => {
    branchValidationError = validateBranchName(newBranchName);
    isBranchNameValid = !branchValidationError;
  });

  // Update canCreateWorktree when dependencies change
  $effect(() => {
    canCreateWorktree = newBranchName.trim().length > 0 &&
                       isBranchNameValid &&
                       (!useCustomPath || newWorktreePath.trim().length > 0) &&
                       !isCreatingWorktree;
  });

  // Load worktrees on mount and when repositoryPath changes
  $effect(() => {
    if (repositoryPath && $authToken) {
      loadWorktrees();
    }
  });

  async function loadWorktrees() {
    if (!repositoryPath || !$authToken) return;

    loading = true;
    error = '';

    try {
      const response: WorktreeListResponse = await gitService.listWorktrees(repositoryPath);
      worktrees = response.worktrees;
      baseBranch = response.baseBranch;
      followBranch = response.followBranch;
    } catch (err) {
      logger.error('Failed to load worktrees:', err);
      error = err instanceof Error ? err.message : 'Failed to load worktrees';
    } finally {
      loading = false;
    }
  }

  async function handleSwitchBranch(branch: string) {
    // Direct branch switching without worktrees is no longer supported
    logger.log(`Branch switching to ${branch} requested, but direct branch switching is not supported. Use worktrees instead.`);
    dispatch('error', `Direct branch switching is no longer supported. Create a worktree for branch '${branch}' instead.`);
  }

  function handleDeleteWorktree(branch: string, hasChanges: boolean) {
    showDeleteConfirm = true;
    deleteTargetBranch = branch;
    deleteHasChanges = hasChanges;
  }

  async function confirmDelete() {
    if (!repositoryPath || !deleteTargetBranch || !$authToken) return;

    try {
      await gitService.deleteWorktree(repositoryPath, deleteTargetBranch, deleteHasChanges);
      showDeleteConfirm = false;
      deleteTargetBranch = '';
      deleteHasChanges = false;
      await loadWorktrees();
      dispatch('worktree-deleted', { branch: deleteTargetBranch });
    } catch (err) {
      logger.error('Failed to delete worktree:', err);
      dispatch('error', `Failed to delete worktree: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  function cancelDelete() {
    showDeleteConfirm = false;
    deleteTargetBranch = '';
    deleteHasChanges = false;
  }

  async function handleToggleFollow(branch: string, enable: boolean) {
    if (!$authToken) return;

    try {
      await gitService.setFollowMode(repositoryPath, branch, enable);
      await loadWorktrees();
    } catch (err) {
      logger.error('Failed to toggle follow mode:', err);
      dispatch('error', `Failed to toggle follow mode: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  function formatPath(path: string): string {
    return formatPathForDisplay(path);
  }

  async function handleCreateWorktree() {
    const branchName = newBranchName.trim();
    if (!branchName || !repositoryPath || !$authToken) return;

    isCreatingWorktree = true;
    try {
      // Use custom path if provided, otherwise generate default
      const worktreePath = useCustomPath && newWorktreePath.trim()
        ? newWorktreePath.trim()
        : generateWorktreePath(branchName);

      await gitService.createWorktree(repositoryPath, branchName, worktreePath, baseBranch);

      // Reset form
      showCreateWorktree = false;
      newBranchName = '';
      newWorktreePath = '';
      useCustomPath = false;

      // Reload worktrees
      await loadWorktrees();

      dispatch('worktree-created', { branch: branchName, path: worktreePath });
    } catch (err) {
      logger.error('Failed to create worktree:', err);

      let errorMessage = 'Failed to create worktree';
      if (err instanceof Error) {
        if (err.message.includes('already exists')) {
          errorMessage = `Worktree path already exists. Try a different branch name or path.`;
        } else if (err.message.includes('already checked out')) {
          errorMessage = `Branch '${branchName}' is already checked out in another worktree`;
        } else {
          errorMessage = err.message;
        }
      }

      dispatch('error', errorMessage);
    } finally {
      isCreatingWorktree = false;
    }
  }

  function generateWorktreePath(branchName: string): string {
    const branchSlug = branchName.trim().replace(/[^a-zA-Z0-9-_]/g, '-');
    return `${repositoryPath}-${branchSlug}`;
  }

  function handleCancelCreateWorktree() {
    showCreateWorktree = false;
    newBranchName = '';
    newWorktreePath = '';
    useCustomPath = false;
  }


</script>

<div class="p-4 h-full overflow-y-auto bg-bg">
  <div class="max-w-4xl mx-auto">
    <div class="mb-6">
      <h1 class="text-xl font-bold text-text">Git Worktrees</h1>
    </div>

    {#if error}
      <div class="bg-status-error text-white px-4 py-2 rounded mb-4">
        {error}
      </div>
    {/if}

    {#if loading}
      <div class="flex justify-center items-center py-8">
        <div class="text-secondary">Loading worktrees...</div>
      </div>
    {:else}
      <div class="space-y-4">
        <div class="text-sm text-text-muted mb-4">
          Repository: <span class="font-mono text-text break-all">{formatPath(repositoryPath)}</span>
        </div>

        {#if worktrees.length === 0 || (worktrees.length === 1 && worktrees[0].isMainWorktree)}
          <div class="text-center py-12 space-y-4">
            <div class="text-text-muted text-lg">
              No additional worktrees found
            </div>
            <div class="text-text-dim text-sm max-w-md mx-auto">
              This repository only has the main worktree. You can create additional worktrees using the git worktree command in your terminal.
            </div>
            <div class="mt-6">
              <code class="text-xs bg-surface px-2 py-1 rounded font-mono text-text-muted">
                git worktree add ../feature-branch feature-branch
              </code>
            </div>
          </div>
        {:else}
          <div class="grid gap-4">
            {#each worktrees as worktree}
              <div class="bg-surface rounded-lg p-4 border border-border hover:border-border-focus transition-colors">
                <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 class="font-semibold text-lg text-text">
                        {worktree.branch || 'detached'}
                      </h3>
                      {#if worktree.isMainWorktree}
                        <span class="px-2 py-1 text-xs bg-primary text-bg-elevated rounded">Main</span>
                      {/if}
                      {#if worktree.isCurrentWorktree}
                        <span class="px-2 py-1 text-xs bg-status-success text-bg-elevated rounded">Current</span>
                      {/if}
                    </div>

                    <div class="text-sm text-text-muted space-y-1">
                      <div class="font-mono text-text-dim break-all">{formatPath(worktree.path)}</div>
                      {#if worktree.HEAD}
                        <div class="text-text-muted">HEAD: <span class="font-mono">{worktree.HEAD.slice(0, 7)}</span></div>
                      {/if}
                      {#if worktree.commitsAhead !== undefined}
                        <div class="flex items-center gap-4 flex-wrap">
                          {#if worktree.commitsAhead > 0}
                            <span class="text-status-success">↑ {worktree.commitsAhead} ahead</span>
                          {/if}
                          {#if worktree.hasUncommittedChanges}
                            <span class="text-status-warning">● Uncommitted changes</span>
                          {/if}
                        </div>
                      {/if}
                    </div>
                  </div>

                  <div class="flex gap-2 flex-wrap sm:flex-nowrap sm:ml-4">
                    {#if !worktree.isMainWorktree && !worktree.isCurrentWorktree}
                      <button
                        onclick={() => handleToggleFollow(worktree.branch, followBranch !== worktree.branch)}
                        class="px-3 py-1 text-sm font-medium {followBranch === worktree.branch
                          ? 'text-bg-elevated bg-status-success hover:bg-status-success/90'
                          : 'text-text bg-surface hover:bg-surface-hover border border-border'} rounded transition-colors"
                        title={followBranch === worktree.branch ? 'Disable follow mode' : 'Enable follow mode'}
                      >
                        {followBranch === worktree.branch ? 'Following' : 'Follow'}
                      </button>
                    {/if}
                    {#if !worktree.isCurrentWorktree}
                      <button
                        onclick={() => handleSwitchBranch(worktree.branch)}
                        class="px-3 py-1 text-sm font-medium text-bg-elevated bg-primary rounded hover:bg-primary-hover transition-colors"
                      >
                        Switch
                      </button>
                    {/if}
                    {#if !worktree.isMainWorktree}
                      <button
                        onclick={() => handleDeleteWorktree(worktree.branch, worktree.hasUncommittedChanges || false)}
                        class="px-3 py-1 text-sm font-medium text-bg-elevated bg-status-error rounded hover:bg-status-error/90 transition-colors"
                      >
                        Delete
                      </button>
                    {/if}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Create New Worktree Button -->
      <div class="mt-6 flex justify-center">
        <button
          onclick={() => { showCreateWorktree = true; }}
          class="px-4 py-2 text-sm font-medium text-bg-elevated bg-primary rounded hover:bg-primary-hover transition-colors flex items-center gap-2"
          disabled={loading}
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          Create New Worktree
        </button>
      </div>
    {/if}

    <!-- Create Worktree Modal -->
    {#if showCreateWorktree}
      <div class="fixed inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div class="bg-surface rounded-lg p-6 max-w-md w-full border border-border shadow-elevated">
          <h3 class="text-lg font-semibold mb-4 text-text">Create New Worktree</h3>

          <div class="space-y-4">
            <!-- Branch Name Input -->
            <div>
              <label class="block text-sm font-medium text-text-muted mb-1">
                Branch Name
              </label>
              <input
                type="text"
                bind:value={newBranchName}
                placeholder="feature/new-feature"
                class="w-full px-3 py-2 bg-bg border border-border rounded focus:border-primary focus:outline-none text-text"
                disabled={isCreatingWorktree}
                onkeydown={(e) => {
                  if (e.key === 'Enter' && canCreateWorktree) {
                    handleCreateWorktree();
                  } else if (e.key === 'Escape') {
                    handleCancelCreateWorktree();
                  }
                }}
              />
               {#if newBranchName.trim()}
                 <div class="text-xs mt-1 {isBranchNameValid ? 'text-text-dim' : 'text-status-error'}">
                   {isBranchNameValid ? 'Valid branch name' : 'Invalid branch name'}
                 </div>
               {/if}
            </div>

            <!-- Base Branch Selection -->
            <div>
              <label class="block text-sm font-medium text-text-muted mb-1">
                Base Branch
              </label>
              <div class="text-sm text-text bg-bg px-3 py-2 border border-border rounded">
                {baseBranch}
              </div>
            </div>

            <!-- Path Customization -->
            <div>
              <label class="flex items-center gap-2 text-sm text-text-muted cursor-pointer">
                <input
                  type="checkbox"
                  bind:checked={useCustomPath}
                  disabled={isCreatingWorktree}
                  class="rounded"
                  onchange={() => {
                    if (!useCustomPath) {
                      newWorktreePath = '';
                    }
                  }}
                />
                <span>Customize worktree path</span>
              </label>
            </div>

            {#if useCustomPath}
              <div>
                <label class="block text-sm font-medium text-text-muted mb-1">
                  Custom Path
                </label>
                <input
                  type="text"
                  bind:value={newWorktreePath}
                  placeholder="/path/to/worktree"
                  class="w-full px-3 py-2 bg-bg border border-border rounded focus:border-primary focus:outline-none text-text"
                  disabled={isCreatingWorktree}
                />
                <div class="text-xs text-text-dim mt-1">
                  {#if newWorktreePath.trim()}
                    Will create at: {newWorktreePath.trim()}
                  {:else}
                    Enter absolute path for the worktree
                  {/if}
                </div>
              </div>
            {:else}
              <div class="text-xs text-text-dim">
                Default path: {generateWorktreePath(newBranchName.trim() || 'branch')}
              </div>
            {/if}
          </div>

          <!-- Modal Actions -->
          <div class="flex justify-end gap-2 mt-6">
            <button
              onclick={handleCancelCreateWorktree}
              class="px-4 py-2 text-sm font-medium text-text bg-surface rounded hover:bg-surface-hover transition-colors border border-border"
              disabled={isCreatingWorktree}
            >
              Cancel
            </button>
            <button
              onclick={handleCreateWorktree}
              class="px-4 py-2 text-sm font-medium text-bg-elevated bg-primary rounded hover:bg-primary-hover transition-colors disabled:opacity-50"
              disabled={!canCreateWorktree}
            >
              {isCreatingWorktree ? 'Creating...' : 'Create Worktree'}
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- Delete Confirmation Modal -->
    {#if showDeleteConfirm}
      <div class="fixed inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div class="bg-surface rounded-lg p-6 max-w-md w-full border border-border shadow-elevated">
          <h3 class="text-lg font-semibold mb-4 text-text">Confirm Delete</h3>
          <p class="text-text-muted mb-4">
            Are you sure you want to delete the worktree for branch
            <span class="font-mono font-semibold text-text">{deleteTargetBranch}</span>?
          </p>
          {#if deleteHasChanges}
            <p class="text-status-warning mb-4">
              ⚠️ This worktree has uncommitted changes that will be lost.
            </p>
          {/if}
          <div class="flex justify-end gap-2">
            <button
              onclick={cancelDelete}
              class="px-4 py-2 text-sm font-medium text-text bg-surface rounded hover:bg-surface-hover transition-colors border border-border"
            >
              Cancel
            </button>
            <button
              onclick={confirmDelete}
              class="px-4 py-2 text-sm font-medium text-bg-elevated bg-status-error rounded hover:bg-status-error/90 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>