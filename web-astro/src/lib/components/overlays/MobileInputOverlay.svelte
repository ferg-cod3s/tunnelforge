<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { inputStore } from '$lib/stores/input';
  import ModalWrapper from '$lib/components/ModalWrapper.svelte';

  // Props interface
  interface Props {
    sessionId: string;
    visible?: boolean;
    mobileInputText?: string;
    keyboardHeight?: number;
    fontSize?: number;
    onSend?: (text: string) => void;
    onSendWithEnter?: (text: string) => void;
    onCancel?: () => void;
    onTextChange?: (text: string) => void;
    handleBack?: () => void;
  }

  // Props with defaults
  let {
    sessionId,
    visible = false,
    mobileInputText = '',
    keyboardHeight = 0,
    fontSize = 14,
    onSend,
    onSendWithEnter,
    onCancel,
    onTextChange,
    handleBack
  }: Props = $props();

  // State
  let isComposing = $state(false);
  let compositionBuffer = $state('');
  let touchStartX = $state(0);
  let touchStartY = $state(0);

  // Refs
  let textareaElement: HTMLTextAreaElement;
  let modalContent: HTMLDivElement;

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    'send-input': { text: string };
    'send-special-key': { key: string; type: 'control' | 'text' };
  }>();

  // Touch handlers for back gesture
  function handleTouchStart(event: TouchEvent) {
    const touch = event.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }

  function handleTouchEnd(event: TouchEvent) {
    const touch = event.changedTouches[0];
    const touchEndX = touch.clientX;
    const touchEndY = touch.clientY;

    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    // Check for horizontal swipe from left edge (back gesture)
    const isSwipeRight = deltaX > 100;
    const isVerticallyStable = Math.abs(deltaY) < 100;
    const startedFromLeftEdge = touchStartX < 50;

    if (isSwipeRight && isVerticallyStable && startedFromLeftEdge && handleBack) {
      handleBack();
    }
  }

  // IME composition handlers
  function handleCompositionStart(_event: CompositionEvent) {
    isComposing = true;
    compositionBuffer = '';
  }

  function handleCompositionUpdate(event: CompositionEvent) {
    compositionBuffer = event.data || '';
  }

  function handleCompositionEnd(event: CompositionEvent) {
    isComposing = false;

    // Get the final composed text
    const finalText = event.data || '';

    // Update the mobile input text with the final composition
    const textarea = event.target as HTMLTextAreaElement;
    if (textarea && finalText) {
      mobileInputText = textarea.value;
      onTextChange?.(textarea.value);
    }

    // Clear composition buffer
    compositionBuffer = '';
  }

  // Text input handler
  function handleInput(event: Event) {
    // Skip processing if we're in the middle of IME composition
    if (isComposing) {
      return;
    }

    const textarea = event.target as HTMLTextAreaElement;
    mobileInputText = textarea.value;
    onTextChange?.(textarea.value);
  }

  // Focus management
  function focusTextarea() {
    if (!textareaElement) return;

    // Multiple attempts to ensure focus on mobile
    textareaElement.focus();

    // iOS hack to show keyboard
    textareaElement.setAttribute('readonly', 'readonly');
    textareaElement.focus();
    setTimeout(() => {
      textareaElement.removeAttribute('readonly');
      textareaElement.focus();
      // Ensure cursor is at end
      textareaElement.setSelectionRange(textareaElement.value.length, textareaElement.value.length);
    }, 100);
  }

  // Send handlers
  async function handleSendOnly() {
    // Get the current value from the textarea directly
    const textToSend = textareaElement?.value?.trim() || mobileInputText.trim();

    if (!textToSend) return;

    onSend?.(textToSend);
    dispatch('send-input', { text: textToSend });

    // Clear both the reactive property and textarea
    mobileInputText = '';
    if (textareaElement) {
      textareaElement.value = '';
    }
  }

  async function handleSendWithEnter() {
    // Get the current value from the textarea directly
    const textToSend = textareaElement?.value?.trim() || mobileInputText.trim();

    if (!textToSend) return;

    onSendWithEnter?.(textToSend);
    dispatch('send-input', { text: textToSend });

    // Clear both the reactive property and textarea
    mobileInputText = '';
    if (textareaElement) {
      textareaElement.value = '';
    }
  }

  // Keyboard handler
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleSendWithEnter();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onCancel?.();
    }
  }

  // Focus/blur handlers
  function handleFocus(_event: FocusEvent) {
    console.log('[MobileInputOverlay] Textarea focused');
  }

  function handleBlur(_event: FocusEvent) {
    console.log('[MobileInputOverlay] Textarea blurred');
  }

  // Container click to focus textarea
  function handleContainerClick(event: MouseEvent) {
    event.stopPropagation();
    focusTextarea();
  }

  // Lifecycle
  onMount(() => {
    // Focus the textarea when the overlay becomes visible
    if (visible) {
      setTimeout(() => {
        focusTextarea();
      }, 100);
    }
  });

  // Watch for visibility changes to focus
  $effect(() => {
    if (visible) {
      setTimeout(() => {
        focusTextarea();
      }, 100);
    }
  });
</script>

<ModalWrapper
  {visible}
  modalClass="z-40"
  contentClass="fixed inset-0 flex flex-col z-40"
  ariaLabel="Mobile input overlay"
  closeOnBackdrop={true}
  closeOnEscape={false}
  on:close={() => onCancel?.()}
>
  <div
    class="h-full flex flex-col"
    ontouchstart={handleTouchStart}
    ontouchend={handleTouchEnd}
  >
    <!-- Spacer to push content up above keyboard -->
    <div class="flex-1"></div>

    <div
      class="mobile-input-container font-mono mx-4 flex flex-col"
      style="background: rgb(var(--color-bg)); border: 1px solid rgb(var(--color-primary)); border-radius: 8px; margin-bottom: {keyboardHeight > 0 ? `${keyboardHeight}px` : 'env(keyboard-inset-height, 0px)'};"
      onclick={handleContainerClick}
    >
      <!-- Input Area -->
      <div class="p-4 flex flex-col">
        <textarea
          bind:this={textareaElement}
          class="w-full font-mono resize-none outline-none"
          placeholder="Type your command here..."
          value={mobileInputText}
          oninput={handleInput}
          onfocus={handleFocus}
          onblur={handleBlur}
          onkeydown={handleKeyDown}
          oncompositionstart={handleCompositionStart}
          oncompositionupdate={handleCompositionUpdate}
          oncompositionend={handleCompositionEnd}
          style="height: 120px; background: rgb(var(--color-bg)); color: rgb(var(--color-text)); border: none; padding: 12px; font-size: {fontSize}px;"
               autocomplete="off"
               autocapitalize="none"
          spellcheck={false}
          data-autocorrect="off"
          data-gramm="false"
          data-ms-editor="false"
          data-smartpunctuation="false"
          data-form-type="other"
          inputmode="text"
          enterkeyhint="done"
        ></textarea>
      </div>

      <!-- Controls -->
      <div class="p-4 flex gap-2" style="border-top: 1px solid rgb(var(--color-border));">
        <button
          class="font-mono px-3 py-2 text-xs transition-colors btn-ghost"
          onclick={() => onCancel?.()}
        >
          CANCEL
        </button>
        <button
          class="flex-1 font-mono px-3 py-2 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed btn-ghost"
          onclick={handleSendOnly}
          disabled={!mobileInputText.trim()}
        >
          SEND
        </button>
        <button
          class="flex-1 font-mono px-3 py-2 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed btn-secondary"
          onclick={handleSendWithEnter}
          disabled={!mobileInputText.trim()}
        >
          SEND + ⏎
        </button>
      </div>
    </div>
  </div>
</ModalWrapper>

<style>
  .mobile-input-container {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
  }
</style>