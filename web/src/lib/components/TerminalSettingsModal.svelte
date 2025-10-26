<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { onMount } from 'svelte';
  import ModalWrapper from './ModalWrapper.svelte';
  import { TERMINAL_THEMES, type TerminalThemeId } from '$lib/utils/terminal-themes';
  import { getTerminalPreferences, saveTerminalPreferences, type TerminalPreferences } from '$lib/services/settings';

  let { visible = false } = $props();

  const dispatch = createEventDispatcher<{
    close: void;
    'settings-changed': TerminalPreferences;
  }>();

  // Terminal settings state using Svelte 5 runes
  let fontSize = $state(14);
  let maxColumns = $state<number | 'unlimited'>(120);
  let theme = $state<TerminalThemeId>('auto');
  let lineHeight = $state(1.2);

  // Column options
  const columnOptions = [80, 100, 120, 140, 160, 200, 'unlimited'] as const;

  // Load preferences on mount
  onMount(() => {
    const prefs = getTerminalPreferences();
    fontSize = prefs.fontSize;
    maxColumns = prefs.maxColumns;
    theme = prefs.theme as TerminalThemeId;
    lineHeight = prefs.lineHeight;
  });

  // Save preferences and dispatch event
  function saveSettings() {
    const newPrefs: TerminalPreferences = {
      fontSize,
      maxColumns,
      theme,
      lineHeight,
    };

    saveTerminalPreferences(newPrefs);
    dispatch('settings-changed', newPrefs);
  }

  // Reset to defaults
  function resetToDefaults() {
    fontSize = 14;
    maxColumns = 120;
    theme = 'auto';
    lineHeight = 1.2;
    saveSettings();
  }

  // Handle close
  function handleClose() {
    dispatch('close');
  }

  // Reactive effect to auto-save when settings change
  $effect(() => {
    if (visible) {
      // Auto-save when any setting changes
      saveSettings();
    }
  });
</script>

<ModalWrapper
  {visible}
  modalClass="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
  contentClass="bg-surface border border-border rounded-lg shadow-elevated max-w-md w-full mx-4"
  ariaLabel="Terminal Settings"
  on:close={handleClose}
>
  <div class="p-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-lg font-semibold text-text-bright">Terminal Settings</h2>
      <button
        class="text-text-muted hover:text-primary transition-colors p-1"
        onclick={handleClose}
        aria-label="Close terminal settings"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Settings -->
    <div class="space-y-6">
      <!-- Font Size -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-text-bright">
          Font Size: {fontSize}px
        </label>
        <input
          type="range"
          min="8"
          max="32"
          step="1"
          bind:value={fontSize}
          class="w-full h-2 bg-bg-secondary rounded-lg appearance-none cursor-pointer slider"
        />
        <div class="flex justify-between text-xs text-text-muted">
          <span>8px</span>
          <span>32px</span>
        </div>
      </div>

      <!-- Line Height -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-text-bright">
          Line Height: {lineHeight.toFixed(1)}
        </label>
        <input
          type="range"
          min="1.0"
          max="2.0"
          step="0.1"
          bind:value={lineHeight}
          class="w-full h-2 bg-bg-secondary rounded-lg appearance-none cursor-pointer slider"
        />
        <div class="flex justify-between text-xs text-text-muted">
          <span>1.0</span>
          <span>2.0</span>
        </div>
      </div>

      <!-- Max Columns -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-text-bright">Max Columns</label>
        <div class="grid grid-cols-3 gap-2">
          {#each columnOptions as option}
            <button
              class="px-3 py-2 text-sm font-medium rounded-md border transition-all duration-200
                {maxColumns === option
                  ? 'bg-primary text-text-bright border-primary'
                  : 'bg-bg-secondary border-border text-text hover:border-primary hover:text-primary'}"
              onclick={() => maxColumns = option}
            >
              {option === 'unlimited' ? 'Unlimited' : option}
            </button>
          {/each}
        </div>
      </div>

      <!-- Theme -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-text-bright">Theme</label>
        <select
          bind:value={theme}
          class="w-full bg-bg-secondary border border-border rounded-md px-3 py-2 text-sm text-text focus:border-primary focus:shadow-glow-sm cursor-pointer appearance-none"
          style="background-image: url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 20 20%22 fill=%22%23666%22%3e%3cpath fill-rule=%22evenodd%22 d=%22M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z%22 clip-rule=%22evenodd%22/%3e%3c/svg%3e'); background-position: right 0.75rem center; background-repeat: no-repeat; background-size: 1.25em 1.25em;"
        >
          {#each TERMINAL_THEMES as themeOption}
            <option value={themeOption.id}>{themeOption.name}</option>
          {/each}
        </select>
      </div>
    </div>

    <!-- Footer -->
    <div class="flex justify-between items-center mt-6 pt-4 border-t border-border">
      <button
        class="px-4 py-2 text-sm font-medium text-text-muted hover:text-text transition-colors"
        onclick={resetToDefaults}
      >
        Reset to Defaults
      </button>
      <button
        class="px-4 py-2 text-sm font-medium bg-primary text-text-bright rounded-md hover:bg-primary-hover active:scale-95 transition-all duration-200"
        onclick={handleClose}
      >
        Close
      </button>
    </div>
  </div>
</ModalWrapper>

<style>
  /* Custom slider styling */
  .slider::-webkit-slider-thumb {
    appearance: none;
    height: 20px;
    width: 20px;
    border-radius: 50%;
    background: rgb(var(--color-primary));
    cursor: pointer;
    border: 2px solid rgb(var(--color-bg-elevated));
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .slider::-webkit-slider-thumb:hover {
    transform: scale(1.1);
  }

  .slider::-moz-range-thumb {
    height: 20px;
    width: 20px;
    border-radius: 50%;
    background: rgb(var(--color-primary));
    cursor: pointer;
    border: 2px solid rgb(var(--color-bg-elevated));
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .slider::-moz-range-thumb:hover {
    transform: scale(1.1);
  }

  /* Mobile responsive adjustments */
  @media (max-width: 640px) {
    .grid-cols-3 {
      grid-template-columns: repeat(2, 1fr);
    }

    .grid-cols-3 button:last-child {
      grid-column: span 2;
    }
  }
</style>