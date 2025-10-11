<script lang="ts">
  import { createLogger } from '$lib/utils/logger';
  import { sendAIPrompt } from '$lib/utils/ai-sessions';
  import type { AuthClient } from '$lib/types';

  const logger = createLogger('magic-wand-button');

  interface Props {
    sessionId: string;
    authClient: AuthClient;
    size?: 'small' | 'medium';
    showText?: boolean;
    disabled?: boolean;
  }

  let {
    sessionId,
    authClient,
    size = 'small',
    showText = false,
    disabled = false
  }: Props = $props();

  let sending = $state(false);

  const sizeClasses = $derived.by(() => ({
    small: 'w-4 h-4',
    medium: 'w-5 h-5',
  }));

  const buttonClasses = $derived.by(() =>
    size === 'small' ? 'p-1.5' : 'p-1'
  );

  async function handleClick(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();

    if (sending || disabled) return;

    sending = true;

    try {
      await sendAIPrompt(sessionId, authClient);

      // Dispatch success event
      const successEvent = new CustomEvent('prompt-sent', {
        detail: { sessionId },
        bubbles: true,
        composed: true,
      });
      event.target?.dispatchEvent(successEvent);
    } catch (error) {
      logger.error('Failed to send AI prompt', error);

      // Dispatch error event
      const errorEvent = new CustomEvent('prompt-error', {
        detail: {
          sessionId,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        bubbles: true,
        composed: true,
      });
      event.target?.dispatchEvent(errorEvent);
    } finally {
      sending = false;
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick(event as any);
    }
  }
</script>

<button
  class="magic-wand-button {buttonClasses} rounded-md transition-all hover:bg-elevated hover:shadow-sm hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
  onclick={handleClick}
  onkeydown={handleKeyDown}
  disabled={sending || disabled}
  title="Send prompt to update terminal title"
  aria-label="Send AI prompt to update terminal title"
  tabindex="0"
>
  {#if sending}
    <!-- Loading spinner -->
    <svg
      class="{sizeClasses[size]} animate-spin"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  {:else}
    <!-- Magic wand icon -->
    <svg
      class="{sizeClasses[size]}"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
      />
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="1.5"
        d="M12 8l-2 2m4-2l-2 2m4 0l-2 2"
        opacity="0.6"
      />
    </svg>
  {/if}

  {#if showText}
    <span class="ml-2">Update Title</span>
  {/if}
</button>

<style>
  .magic-wand-button {
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    transition: all var(--transition-base);
    flex-shrink: 0;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .magic-wand-button:hover:not(:disabled) {
    color: var(--color-primary);
    background: var(--color-bg-secondary);
    border-color: var(--color-primary);
    box-shadow: var(--shadow-sm);
  }

  .magic-wand-button:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-primary);
  }

  .magic-wand-button:active:not(:disabled) {
    transform: scale(0.95);
  }

  .magic-wand-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Animation for the scale effect */
  @keyframes scale-in {
    from {
      transform: scale(0.8);
    }
    to {
      transform: scale(1);
    }
  }

  .magic-wand-button:not(:disabled) {
    animation: scale-in 0.2s ease-out;
  }
</style>