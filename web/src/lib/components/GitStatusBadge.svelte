<script lang="ts">
  import type { Session } from '../types/index';

  export let session: Session | null = null;
  export let detailed: boolean = false;

  // Reactive computed values
  $: hasGitRepo = !!session?.gitRepoPath;
  $: branchDisplay = session?.gitBranch || 'git';
  $: isWorktree = session?.gitIsWorktree || false;

  $: addedCount = session?.gitAddedCount ?? 0;
  $: modifiedCount = session?.gitModifiedCount ?? 0;
  $: deletedCount = session?.gitDeletedCount ?? 0;
  $: totalChanges = addedCount + modifiedCount + deletedCount;

  $: aheadCount = session?.gitAheadCount ?? 0;
  $: behindCount = session?.gitBehindCount ?? 0;

  $: hasLocalChanges = totalChanges > 0;
  $: hasRemoteChanges = aheadCount > 0 || behindCount > 0;

  // Debug logging
  $: if (session?.gitRepoPath) {
    console.debug('[GitStatusBadge] Session updated', {
      gitRepoPath: session.gitRepoPath,
      branch: session.gitBranch,
      id: session.id,
    });
  }
</script>

{#if hasGitRepo}
  <div class="git-status">
    <!-- Branch info -->
    <span class="branch-info">
      [{branchDisplay}{isWorktree ? ' •' : ''}]
    </span>

    <!-- Local changes -->
    {#if hasLocalChanges || detailed}
      {#if detailed}
        <span class="changes-detailed">
          {#if addedCount > 0}
            <span class="change-added" title="New files">
              +{addedCount}
            </span>
          {/if}
          {#if modifiedCount > 0}
            <span class="change-modified" title="Modified files">
              ~{modifiedCount}
            </span>
          {/if}
          {#if deletedCount > 0}
            <span class="change-deleted" title="Deleted files">
              -{deletedCount}
            </span>
          {/if}
        </span>
      {:else if hasLocalChanges}
        <span
          class="change-summary"
          title="{addedCount} new, {modifiedCount} modified, {deletedCount} deleted"
        >
          ●{totalChanges}
        </span>
      {/if}
    {/if}

    <!-- Remote changes -->
    {#if hasRemoteChanges}
      <span class="remote-changes">
        {#if aheadCount > 0}
          <span class="commits-ahead" title="Commits ahead">
            ↑{aheadCount}
          </span>
        {/if}
        {#if behindCount > 0}
          <span class="commits-behind" title="Commits behind">
            ↓{behindCount}
          </span>
        {/if}
      </span>
    {/if}
  </div>
{/if}

<style>
  .git-status {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: var(--font-size-xs);
  }

  .branch-info {
    color: var(--color-text-muted);
  }

  .changes-detailed {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
  }

  .change-added {
    color: var(--color-status-success);
  }

  .change-modified {
    color: var(--color-status-warning);
  }

  .change-deleted {
    color: var(--color-status-error);
  }

  .change-summary {
    color: var(--color-status-warning);
  }

  .remote-changes {
    display: flex;
    align-items: center;
    gap: 0.125rem;
  }

  .commits-ahead {
    color: var(--color-status-success);
  }

  .commits-behind {
    color: var(--color-status-error);
  }
</style>
