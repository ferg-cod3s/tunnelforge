<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { inputStore } from '$lib/stores/input';

  // Props interface
  interface Props {
    sessionId: string;
    visible?: boolean;
    ctrlSequence?: string[];
    onCtrlKey?: (letter: string) => void;
    onSendSequence?: () => void;
    onClearSequence?: () => void;
    onCancel?: () => void;
  }

  // Props with defaults
  let {
    sessionId,
    visible = false,
    ctrlSequence = [],
    onCtrlKey,
    onSendSequence,
    onClearSequence,
    onCancel
  }: Props = $props();

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    'send-control': { letter: string };
    'send-sequence': void;
    'clear-sequence': void;
    'cancel': void;
  }>();

  // Handle Ctrl key press
  function handleCtrlKey(letter: string) {
    onCtrlKey?.(letter);
    dispatch('send-control', { letter });
  }

  // Handle sending sequence
  function handleSendSequence() {
    onSendSequence?.();
    dispatch('send-sequence');
  }

  // Handle clearing sequence
  function handleClearSequence() {
    onClearSequence?.();
    dispatch('clear-sequence');
  }

  // Handle cancel
  function handleCancel() {
    onCancel?.();
    dispatch('cancel');
  }

  // Handle backdrop click
  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleCancel();
    }
  }

  // Handle escape key
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleCancel();
    }
  }

  // Alphabet letters for the grid
  const letters = [
    'A', 'B', 'C', 'D', 'E', 'F',
    'G', 'H', 'I', 'J', 'K', 'L',
    'M', 'N', 'O', 'P', 'Q', 'R',
    'S', 'T', 'U', 'V', 'W', 'X',
    'Y', 'Z'
  ];
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if visible}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
    onclick={handleBackdropClick}
    role="dialog"
    aria-modal="true"
    aria-label="Ctrl key shortcuts"
  >
    <!-- Modal content -->
    <div
      class="bg-surface border-2 border-primary rounded-lg p-4 shadow-xl relative max-w-sm w-full"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Header -->
      <div class="text-primary text-center mb-2 font-bold text-lg">
        Ctrl + Key
      </div>

      <!-- Help text -->
      <div class="text-xs text-text-muted text-center mb-3 opacity-70">
        Build sequences like ctrl+c ctrl+c
      </div>

      <!-- Current sequence display -->
      {#if ctrlSequence.length > 0}
        <div class="text-center mb-4 p-2 border border-border rounded bg-bg">
          <div class="text-xs text-text-muted mb-1">Current sequence:</div>
          <div class="text-sm text-primary font-bold font-mono">
            {ctrlSequence.map(letter => `Ctrl+${letter}`).join(' ')}
          </div>
        </div>
      {/if}

      <!-- Grid of A-Z buttons -->
      <div class="grid grid-cols-6 gap-1 mb-3">
        {#each letters as letter}
          <button
            class="font-mono text-xs transition-all cursor-pointer aspect-square flex items-center justify-center quick-start-btn py-2 bg-bg-tertiary border border-border rounded hover:bg-surface-hover hover:border-primary hover:text-primary"
            onclick={() => handleCtrlKey(letter)}
            aria-label="Ctrl+{letter}"
          >
            {letter}
          </button>
        {/each}
      </div>

      <!-- Common shortcuts info -->
      <div class="text-xs text-text-muted text-center mb-3">
        <div>Common: C=interrupt, X=exit, O=save, W=search</div>
      </div>

      <!-- Action buttons -->
      <div class="flex gap-2 justify-center">
        <button
          class="font-mono px-4 py-2 text-sm transition-all cursor-pointer btn-ghost"
          onclick={handleCancel}
        >
          CANCEL
        </button>
        {#if ctrlSequence.length > 0}
          <button
            class="font-mono px-3 py-2 text-sm transition-all cursor-pointer btn-ghost"
            onclick={handleClearSequence}
          >
            CLEAR
          </button>
          <button
            class="font-mono px-3 py-2 text-sm transition-all cursor-pointer btn-secondary"
            onclick={handleSendSequence}
          >
            SEND
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .quick-start-btn {
    min-height: 2rem;
  }

  .quick-start-btn:hover {
    transform: scale(1.05);
  }

  .quick-start-btn:active {
    transform: scale(0.95);
  }
</style>