<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { TERMINAL_FONT_FAMILY, IME_VERTICAL_OFFSET_PX, CJK_LANGUAGE_CODES } from '$lib/utils/terminal-constants';
  import type { Session } from '$lib/types';

  // Props interface
  interface Props {
    sessionId: string;
    enabled?: boolean;
    fontSize?: number;
    fontFamily?: string;
  }

  // Props with defaults
  let {
    sessionId,
    enabled = true,
    fontSize = 14,
    fontFamily = TERMINAL_FONT_FAMILY,
  }: Props = $props();

  // State
  let isComposing = $state(false);
  let compositionText = $state('');
  let inputElement: HTMLInputElement | null = null;
  let containerElement: HTMLElement | null = null;
  let cursorPosition = $state({ x: 0, y: 0 });
  let isVisible = $state(false);

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    'text-input': { text: string };
    'composition-start': void;
    'composition-end': void;
  }>();

  // Derived state
  let isEnabled = $derived(enabled && sessionId);

  // Detect if CJK language is active
  function isCJKLanguageActive(): boolean {
    const languages = [navigator.language, ...(navigator.languages || [])];
    return languages.some(lang =>
      CJK_LANGUAGE_CODES.some(cjkLang =>
        lang.toLowerCase().startsWith(cjkLang.toLowerCase())
      )
    );
  }

  // Detect if device supports IME
  function hasIMEKeyboard(): boolean {
    if (!('CompositionEvent' in window)) return false;

    // Check for virtual keyboard API
    if ('virtualKeyboard' in navigator) {
      try {
        const nav = navigator as Navigator & { virtualKeyboard?: { overlaysContent?: boolean } };
        const vk = nav.virtualKeyboard;
        if (vk && vk.overlaysContent !== undefined) return true;
      } catch {}
    }

    // Check common IME platforms
    const userAgent = navigator.userAgent.toLowerCase();
    const isCommonIMEPlatform = userAgent.includes('windows') ||
                               userAgent.includes('mac') ||
                               userAgent.includes('linux');
    return isCommonIMEPlatform;
  }

  // Get cursor position callback (to be set by parent)
  let getCursorInfo: (() => { x: number; y: number } | null) | null = null;

  function setCursorInfoCallback(callback: () => { x: number; y: number } | null) {
    getCursorInfo = callback;
  }

  // Update input position based on cursor
  function updatePosition() {
    if (!inputElement || !getCursorInfo) return;

    const cursorInfo = getCursorInfo();
    if (!cursorInfo) {
      // Fallback positioning
      inputElement.style.left = '10px';
      inputElement.style.top = '10px';
      return;
    }

    // Position IME input at cursor location with upward adjustment
    const x = Math.max(10, cursorInfo.x);
    const y = Math.max(10, cursorInfo.y - IME_VERTICAL_OFFSET_PX);

    inputElement.style.left = `${x}px`;
    inputElement.style.top = `${y}px`;
  }

  // Show input element
  function showInput() {
    if (!inputElement) return;
    updatePosition();
    isVisible = true;
    inputElement.style.opacity = '1';
    inputElement.style.pointerEvents = 'auto';
  }

  // Hide input element
  function hideInput() {
    if (!inputElement) return;
    isVisible = false;
    inputElement.style.opacity = '0';
    inputElement.style.pointerEvents = 'none';
    inputElement.style.left = '-9999px';
    inputElement.style.top = '-9999px';
  }

  // Focus the input
  function focus() {
    if (!inputElement || !isEnabled) return;
    updatePosition();
    showInput();
    inputElement.focus();

    // Ensure focus worked
    requestAnimationFrame(() => {
      if (document.activeElement !== inputElement) {
        requestAnimationFrame(() => {
          if (document.activeElement !== inputElement) {
            inputElement?.focus();
          }
        });
      }
    });
  }

  // Check if input is focused
  function isFocused(): boolean {
    return document.activeElement === inputElement;
  }

  // Event handlers
  function handleCompositionStart(event: CompositionEvent) {
    isComposing = true;
    compositionText = '';
    document.body.setAttribute('data-ime-composing', 'true');
    showInput();
    updatePosition();
    dispatch('composition-start');
  }

  function handleCompositionUpdate(event: CompositionEvent) {
    compositionText = event.data || '';
    updatePosition();
  }

  function handleCompositionEnd(event: CompositionEvent) {
    isComposing = false;
    document.body.removeAttribute('data-ime-composing');

    const finalText = event.data || '';
    if (finalText) {
      dispatch('text-input', { text: finalText });
    }

    compositionText = '';
    if (inputElement) {
      inputElement.value = '';
    }

    // Hide input after composition if not focused
    setTimeout(() => {
      if (!isFocused()) {
        hideInput();
      }
      updatePosition();
    }, 100);

    dispatch('composition-end');
  }

  function handleInput(event: Event) {
    if (isComposing) return;

    const target = event.target as HTMLInputElement;
    const text = target.value;

    if (text) {
      dispatch('text-input', { text });
      target.value = '';
      // Hide input after sending text if not focused
      setTimeout(() => {
        if (!isFocused()) {
          hideInput();
        }
      }, 100);
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    // Allow Cmd+V / Ctrl+V
    if ((event.metaKey || event.ctrlKey) && event.key === 'v') {
      return;
    }

    // During IME composition, let browser handle all keys
    if (isComposing) {
      return;
    }

    // Handle special keys when not composing
    switch (event.key) {
      case 'Enter':
        if (inputElement && inputElement.value.trim()) {
          event.preventDefault();
          dispatch('text-input', { text: inputElement.value });
          inputElement.value = '';
        }
        break;
      case 'Escape':
        event.preventDefault();
        // Could dispatch special key event here if needed
        break;
    }
  }

  function handlePaste(event: ClipboardEvent) {
    const pastedText = event.clipboardData?.getData('text');
    if (pastedText) {
      dispatch('text-input', { text: pastedText });
      if (inputElement) {
        inputElement.value = '';
      }
      event.preventDefault();
    }
  }

  function handleFocus() {
    document.body.setAttribute('data-ime-input-focused', 'true');
    showInput();
  }

  function handleBlur() {
    setTimeout(() => {
      if (document.activeElement !== inputElement) {
        document.body.removeAttribute('data-ime-input-focused');
        if (!isComposing) {
          hideInput();
        }
      }
    }, 50);
  }

  // Document click handler for auto-focus
  function handleDocumentClick(event: Event) {
    if (!containerElement || !isEnabled) return;

    const target = event.target as HTMLElement;
    if (containerElement.contains(target) || target === containerElement) {
      focus();
    }
  }

  // Global paste handler
  function handleGlobalPaste(event: ClipboardEvent) {
    if (!isEnabled) return;

    const target = event.target as HTMLElement;

    // Skip if paste is already handled by the IME input
    if (target === inputElement) {
      return;
    }

    // Only handle paste if we're in the session area
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.contentEditable === 'true' ||
      target.closest?.('.monaco-editor') ||
      target.closest?.('[data-keybinding-context]')
    ) {
      return;
    }

    const pastedText = event.clipboardData?.getData('text');
    if (pastedText) {
      dispatch('text-input', { text: pastedText });
      event.preventDefault();
    }
  }

  // Setup event listeners
  $effect(() => {
    if (!isEnabled || !inputElement) return;

    // IME composition events
    inputElement.addEventListener('compositionstart', handleCompositionStart);
    inputElement.addEventListener('compositionupdate', handleCompositionUpdate);
    inputElement.addEventListener('compositionend', handleCompositionEnd);
    inputElement.addEventListener('input', handleInput);
    inputElement.addEventListener('keydown', handleKeydown);
    inputElement.addEventListener('paste', handlePaste);
    inputElement.addEventListener('focus', handleFocus);
    inputElement.addEventListener('blur', handleBlur);

    // Document event listeners
    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('paste', handleGlobalPaste);

    return () => {
      if (!inputElement) return;

      inputElement.removeEventListener('compositionstart', handleCompositionStart);
      inputElement.removeEventListener('compositionupdate', handleCompositionUpdate);
      inputElement.removeEventListener('compositionend', handleCompositionEnd);
      inputElement.removeEventListener('input', handleInput);
      inputElement.removeEventListener('keydown', handleKeydown);
      inputElement.removeEventListener('paste', handlePaste);
      inputElement.removeEventListener('focus', handleFocus);
      inputElement.removeEventListener('blur', handleBlur);

      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('paste', handleGlobalPaste);
    };
  });

  // Initialize input element
  $effect(() => {
    if (!containerElement || !isEnabled) return;

    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.style.position = 'absolute';
    input.style.top = '-9999px';
    input.style.left = '-9999px';
    input.style.width = '200px';
    input.style.height = '24px';
    input.style.fontSize = `${fontSize}px`;
    input.style.padding = '2px 4px';
    input.style.border = 'none';
    input.style.borderRadius = '0';
    input.style.backgroundColor = 'transparent';
    input.style.color = '#e2e8f0';
    input.style.zIndex = '1000';
    input.style.opacity = '0';
    input.style.visibility = 'visible';
    input.style.pointerEvents = 'none';
    input.style.fontFamily = fontFamily;
    input.style.outline = 'none';
    input.style.caretColor = 'transparent';
    input.autocapitalize = 'off';
    input.setAttribute('autocorrect', 'off');
    input.autocomplete = 'off';
    input.spellcheck = false;

    containerElement.appendChild(input);
    inputElement = input;

    return () => {
      if (inputElement && inputElement.parentNode) {
        inputElement.parentNode.removeChild(inputElement);
        inputElement = null;
      }
    };
  });

  // Update font size when prop changes
  $effect(() => {
    if (inputElement) {
      inputElement.style.fontSize = `${fontSize}px`;
    }
  });

  // Cleanup on unmount
  onDestroy(() => {
    document.body.removeAttribute('data-ime-input-focused');
    document.body.removeAttribute('data-ime-composing');
  });

  // Expose methods for parent components
  export function refreshPosition() {
    updatePosition();
  }

  export function updateFontSize(newFontSize: number) {
    fontSize = newFontSize;
  }

  export function getIsComposing(): boolean {
    return isComposing;
  }

  export function getIsFocused(): boolean {
    return isFocused();
  }
</script>

<!-- IME Input Container -->
<div
  bind:this={containerElement}
  class="ime-input-container"
  class:hidden={!isEnabled}
  aria-label="IME Input for CJK text composition"
  role="textbox"
  aria-multiline="false"
>
  <!-- Composition Preview Overlay (when composing) -->
  {#if isComposing && compositionText}
    <div
      class="absolute z-50 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200 font-mono text-sm shadow-lg"
      style="left: {cursorPosition.x + 10}px; top: {cursorPosition.y - 30}px;"
      aria-live="polite"
      aria-label="IME composition preview: {compositionText}"
    >
      {compositionText}
      <span class="animate-pulse">|</span>
    </div>
  {/if}
</div>

<style>
  .ime-input-container {
    position: relative;
    pointer-events: none;
  }

  .ime-input-container.hidden {
    display: none;
  }

  /* Ensure IME input is properly styled */
  .ime-input-container input {
    @apply bg-transparent text-slate-200;
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
  }

  /* Composition overlay styling */
  .ime-input-container .composition-overlay {
    @apply bg-slate-800 border border-slate-600 rounded px-2 py-1 text-slate-200 font-mono text-sm shadow-lg;
  }
</style>