<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { QuickStartItem } from '$lib/types';

  let { commands = [], selectedCommand = '', disabled = false, isCreating = false } = $props();

  const dispatch = createEventDispatcher<{
    'quick-start-selected': { command: string };
  }>();

  function handleQuickStartClick(command: string) {
    dispatch('quick-start-selected', { command });
  }
</script>

<div class="mb-3 sm:mb-4">
  <div class="flex items-center justify-between mb-1 sm:mb-2 mt-3 sm:mt-4">
    <label class="form-label text-text-muted uppercase text-[9px] sm:text-[10px] lg:text-xs tracking-wider">
      Quick Start
    </label>
  </div>

  <div class="grid grid-cols-2 gap-2 sm:gap-2.5 lg:gap-3 mt-1.5 sm:mt-2">
    {#each commands as { label, command }}
      <button
        on:click={() => handleQuickStartClick(command)}
        class={
          selectedCommand === command
            ? 'px-2 py-1.5 sm:px-3 sm:py-2 lg:px-4 lg:py-3 rounded-lg border text-left transition-all bg-primary/10 border-primary/50 text-primary hover:bg-primary/20 font-medium text-[10px] sm:text-xs lg:text-sm'
            : 'px-2 py-1.5 sm:px-3 sm:py-2 lg:px-4 lg:py-3 rounded-lg border text-left transition-all bg-bg-elevated border-border/50 text-text hover:bg-hover hover:border-primary/50 hover:text-primary text-[10px] sm:text-xs lg:text-sm'
        }
        disabled={disabled || isCreating}
        type="button"
      >
        {label}
      </button>
    {/each}
  </div>
</div>