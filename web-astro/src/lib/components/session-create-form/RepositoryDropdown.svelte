<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Repository } from '$lib/types';

  let { visible = false, repositories = [] } = $props();

  const dispatch = createEventDispatcher<{
    'repository-selected': { path: string };
  }>();

  function handleRepositoryClick(repoPath: string) {
    dispatch('repository-selected', { path: repoPath });
  }
</script>

{#if visible && repositories.length > 0}
  <div class="mt-2 bg-bg-elevated border border-border/50 rounded-lg overflow-hidden">
    <div class="max-h-48 overflow-y-auto">
      {#each repositories as repo}
        <button
          on:click={() => handleRepositoryClick(repo.path)}
          class="w-full text-left px-3 py-2 hover:bg-surface-hover transition-colors duration-200 border-b border-border/30 last:border-b-0"
          type="button"
        >
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <div class="text-text text-xs sm:text-sm font-medium">{repo.folderName}</div>
              </div>
              <div class="text-text-muted text-[9px] sm:text-[10px] mt-0.5">{repo.relativePath}</div>
            </div>
            <div class="text-text-muted text-[9px] sm:text-[10px]">
              {new Date(repo.lastModified).toLocaleDateString()}
            </div>
          </div>
        </button>
      {/each}
    </div>
  </div>
{/if}