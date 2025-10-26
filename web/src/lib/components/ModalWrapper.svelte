<script lang="ts">
  import { onDestroy, createEventDispatcher } from 'svelte';

  export let visible: boolean = false;
  export let modalClass: string = '';
  export let contentClass: string = '';
  export let transitionName: string = '';
  export let ariaLabel: string = 'Modal dialog';
  export let closeOnBackdrop: boolean = true;
  export let closeOnEscape: boolean = true;
  export let noAutofocus: boolean = false;

  const dispatch = createEventDispatcher<{
    close: void;
  }>();

  let modalContent: HTMLDivElement;

  function handleKeyDown(e: KeyboardEvent) {
    if (visible && e.key === 'Escape' && closeOnEscape) {
      e.preventDefault();
      e.stopPropagation();
      handleClose();
    }
  }

  function handleBackdropClick(e: MouseEvent) {
    // Only close if clicking the backdrop itself, not the modal content
    if (closeOnBackdrop && e.target === e.currentTarget) {
      e.preventDefault();
      e.stopPropagation();
      handleClose();
    }
  }

  function handleClose() {
    dispatch('close');
  }

  // Manage escape key listener
  $: if (visible && closeOnEscape) {
    document.addEventListener('keydown', handleKeyDown);
  } else {
    document.removeEventListener('keydown', handleKeyDown);
  }

  // Focus management
  $: if (visible && !noAutofocus && modalContent) {
    requestAnimationFrame(() => {
      const focusable = modalContent.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;
      focusable?.focus();
    });
  }

  onDestroy(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });
</script>

{#if visible}
  <div
    class="modal-backdrop-container {modalClass}"
    on:click={handleBackdropClick}
    data-testid="modal-backdrop"
  >
    <div
      bind:this={modalContent}
      class="modal-content-box {contentClass}"
      style={transitionName ? `view-transition-name: ${transitionName}` : ''}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      data-testid="modal-content"
      on:click|stopPropagation
    >
      <slot />
    </div>
  </div>
{/if}

<style>
  .modal-backdrop-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
  }

  .modal-content-box {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    width: 100%;
    max-width: calc(100vw - 1rem);
  }

  @media (min-width: 640px) {
    .modal-backdrop-container {
      padding: 1rem;
    }

    .modal-content-box {
      max-width: 28rem;
    }
  }

  @media (min-width: 1024px) {
    .modal-content-box {
      max-width: 42rem;
    }
  }
</style>
