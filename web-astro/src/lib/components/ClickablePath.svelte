<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import CopyIcon from './CopyIcon.svelte';

  export let path: string = '';
  export let className: string = '';
  export let iconSize: number = 12;

  const dispatch = createEventDispatcher<{
    'path-copied': { path: string };
    'path-copy-failed': { path: string; error: string };
  }>();

  // Format path for display (replace home directory with ~)
  function formatPathForDisplay(fullPath: string): string {
    const homeDir = import.meta.env.PUBLIC_HOME || '~';
    if (fullPath.startsWith(homeDir)) {
      return fullPath.replace(homeDir, '~');
    }
    return fullPath;
  }

  async function copyToClipboard(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      return false;
    }
  }

  async function handleClick(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();

    if (!path) return;

    try {
      const success = await copyToClipboard(path);
      if (success) {
        console.log('Path copied to clipboard', { path });
        dispatch('path-copied', { path });
      } else {
        throw new Error('Copy command failed');
      }
    } catch (error) {
      console.error('Failed to copy path to clipboard', { error, path });
      dispatch('path-copy-failed', {
        path,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  $: displayPath = formatPathForDisplay(path);
</script>

{#if path}
  <div
    class="clickable-path {className}"
    title="Click to copy path"
    on:click={handleClick}
    on:keydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        handleClick(e as unknown as MouseEvent);
      }
    }}
    role="button"
    tabindex="0"
  >
    <span class="path-text">{displayPath}</span>
    <div class="icon-container">
      <CopyIcon size={iconSize} />
    </div>
  </div>
{/if}

<style>
  .clickable-path {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
    color: var(--color-text);
    transition: color var(--transition-base);
  }

  .clickable-path:hover {
    color: var(--color-accent-green);
  }

  .path-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .icon-container {
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }
</style>
