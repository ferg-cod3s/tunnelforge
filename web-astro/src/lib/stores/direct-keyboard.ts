/**
 * Direct Keyboard Input Manager Store for Terminal Input Handling
 *
 * Manages hidden input element and direct keyboard input for mobile devices.
 * Handles focus management, input events, quick key interactions, and IME composition.
 *
 * ## IME Support for Japanese/CJK Input
 *
 * This store includes full support for Input Method Editor (IME) composition,
 * which is essential for Japanese, Chinese, and Korean text input on mobile devices.
 */

import { writable, derived, get } from 'svelte/store';
import type { Session } from '$lib/types';

// Types
interface DirectKeyboardCallbacks {
  getShowMobileInput(): boolean;
  getShowCtrlAlpha(): boolean;
  getDisableFocusManagement(): boolean;
  getVisualViewportHandler(): (() => void) | null;
  getKeyboardHeight(): number;
  setKeyboardHeight(height: number): void;
  updateShowQuickKeys(value: boolean): void;
  toggleMobileInput(): void;
  clearMobileInputText(): void;
  toggleCtrlAlpha(): void;
  clearCtrlSequence(): void;
}

interface DirectKeyboardStoreState {
  showQuickKeys: boolean;
  keyboardMode: boolean;
  isComposing: boolean;
  compositionBuffer: string;
  keyboardHeight: number;
}

interface DirectKeyboardStoreActions {
  focusHiddenInput(): void;
  dismissKeyboard(): void;
  handleQuickKeyPress(key: string, isModifier?: boolean, isSpecial?: boolean, isToggle?: boolean, pasteText?: string): Promise<void>;
  ensureHiddenInputVisible(): void;
  shouldRefocusHiddenInput(): boolean;
  refocusHiddenInput(): void;
  startFocusRetention(): void;
  delayedRefocusHiddenInput(): void;
  showVisibleInputForKeyboard(): void;
  cleanup(): void;
  getKeyboardMode(): boolean;
  isRecentlyEnteredKeyboardMode(): boolean;
}

type DirectKeyboardStore = DirectKeyboardStoreState & DirectKeyboardStoreActions & {
  subscribe: (fn: (value: DirectKeyboardStoreState) => void) => () => void;
  update: (fn: (value: DirectKeyboardStoreState) => DirectKeyboardStoreState) => void;
  setCallbacks: (callbacks: DirectKeyboardCallbacks) => void;
  setInputManager: (manager: any) => void;
  setSessionViewElement: (element: HTMLElement) => void;
};

// Create the store
function createDirectKeyboardStore(): DirectKeyboardStore {
  const store = writable<DirectKeyboardStoreState>({
    showQuickKeys: false,
    keyboardMode: false,
    isComposing: false,
    compositionBuffer: '',
    keyboardHeight: 0,
  });

  let callbacks: DirectKeyboardCallbacks | null = null;
  let inputManager: any = null; // Would be InputManager type
  let sessionViewElement: HTMLElement | null = null;
  let hiddenInput: HTMLInputElement | null = null;
  let focusRetentionInterval: number | null = null;
  let keyboardActivationTimeout: number | null = null;
  let captureClickHandler: ((e: Event) => void) | null = null;
  let globalPasteHandler: ((e: Event) => void) | null = null;
  let keyboardModeTimestamp = 0;

  // Setup global paste listener
  const setupGlobalPasteListener = () => {
    globalPasteHandler = (e: Event) => {
      const pasteEvent = e as ClipboardEvent;
      if (hiddenInput && document.activeElement === hiddenInput && get(store).showQuickKeys) {
        const clipboardData = pasteEvent.clipboardData?.getData('text/plain');
        if (clipboardData && inputManager) {
          console.log('Global paste event captured, text length:', clipboardData.length);
          inputManager.sendInputText(clipboardData);
          pasteEvent.preventDefault();
          pasteEvent.stopPropagation();
        }
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('paste', globalPasteHandler);
      console.log('Global paste listener setup for CMD+V support');
    }
  };

  // Create hidden input
  const createHiddenInput = () => {
    hiddenInput = document.createElement('input');
    hiddenInput.type = 'text';
    hiddenInput.style.position = 'absolute';
    hiddenInput.style.opacity = '0.01';
    hiddenInput.style.fontSize = '16px';
    hiddenInput.style.border = 'none';
    hiddenInput.style.outline = 'none';
    hiddenInput.style.background = 'transparent';
    hiddenInput.style.color = 'transparent';
    hiddenInput.style.caretColor = 'transparent';
    hiddenInput.style.cursor = 'default';
    hiddenInput.style.pointerEvents = 'none';
    hiddenInput.placeholder = '';
    hiddenInput.autocapitalize = 'none';
    hiddenInput.autocomplete = 'off';
    hiddenInput.setAttribute('autocorrect', 'off');
    hiddenInput.setAttribute('spellcheck', 'false');
    hiddenInput.setAttribute('data-autocorrect', 'off');
    hiddenInput.setAttribute('data-gramm', 'false');
    hiddenInput.setAttribute('data-ms-editor', 'false');
    hiddenInput.setAttribute('data-smartpunctuation', 'false');
    hiddenInput.setAttribute('data-form-type', 'other');
    hiddenInput.setAttribute('inputmode', 'text');
    hiddenInput.setAttribute('enterkeyhint', 'done');
    hiddenInput.setAttribute('aria-hidden', 'true');

    updateHiddenInputPosition();

    // IME composition events
    hiddenInput.addEventListener('compositionstart', () => {
      store.update(state => ({ ...state, isComposing: true, compositionBuffer: '' }));
    });

    hiddenInput.addEventListener('compositionupdate', (e) => {
      const compositionEvent = e as CompositionEvent;
      store.update(state => ({ ...state, compositionBuffer: compositionEvent.data || '' }));
    });

    hiddenInput.addEventListener('compositionend', (e) => {
      const compositionEvent = e as CompositionEvent;
      store.update(state => ({ ...state, isComposing: false }));

      const finalText = compositionEvent.data || hiddenInput?.value || '';
      if (finalText) {
        const showMobileInput = callbacks?.getShowMobileInput() ?? false;
        const showCtrlAlpha = callbacks?.getShowCtrlAlpha() ?? false;
        if (!showMobileInput && !showCtrlAlpha && inputManager) {
          inputManager.sendInputText(finalText);
        }
      }

      if (hiddenInput) {
        hiddenInput.value = '';
      }
      store.update(state => ({ ...state, compositionBuffer: '' }));
    });

    // Input events
    hiddenInput.addEventListener('input', (e) => {
      const input = e.target as HTMLInputElement;
      const state = get(store);

      if (state.isComposing) {
        return;
      }

      if (input.value) {
        const showMobileInput = callbacks?.getShowMobileInput() ?? false;
        const showCtrlAlpha = callbacks?.getShowCtrlAlpha() ?? false;
        if (!showMobileInput && !showCtrlAlpha && inputManager) {
          inputManager.sendInputText(input.value);
        }
        input.value = '';
      }
    });

    // Special keys
    hiddenInput.addEventListener('keydown', (e) => {
      const showMobileInput = callbacks?.getShowMobileInput() ?? false;
      const showCtrlAlpha = callbacks?.getShowCtrlAlpha() ?? false;
      if (showMobileInput || showCtrlAlpha) {
        return;
      }

      if (['Enter', 'Backspace', 'Tab', 'Escape'].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === 'Enter' && inputManager) {
        inputManager.sendInput('enter');
      } else if (e.key === 'Backspace' && inputManager) {
        inputManager.sendInput('backspace');
      } else if (e.key === 'Tab' && inputManager) {
        inputManager.sendInput(e.shiftKey ? 'shift_tab' : 'tab');
      } else if (e.key === 'Escape' && inputManager) {
        inputManager.sendInput('escape');
      }
    });

    // Focus/blur events
    hiddenInput.addEventListener('focus', () => {
      console.log(`Hidden input focused. Keyboard mode: ${get(store).keyboardMode}`);

      if (hiddenInput && get(store).keyboardMode) {
        hiddenInput.style.pointerEvents = 'auto';
      }

      const state = get(store);
      if (state.keyboardMode) {
        store.update(state => ({ ...state, showQuickKeys: true }));
        if (callbacks) {
          callbacks.updateShowQuickKeys(true);
          console.log('Showing quick keys due to keyboard mode');
        }

        if (hiddenInput) {
          hiddenInput.setSelectionRange(0, 0);
        }
      } else {
        const keyboardHeight = callbacks?.getKeyboardHeight() ?? 0;
        if (keyboardHeight > 50) {
          store.update(state => ({ ...state, showQuickKeys: true }));
          if (callbacks) {
            callbacks.updateShowQuickKeys(true);
          }
        }
      }

      const visualViewportHandler = callbacks?.getVisualViewportHandler();
      if (visualViewportHandler) {
        visualViewportHandler();
      }

      if (!focusRetentionInterval) {
        startFocusRetention();
      }
    });

    hiddenInput.addEventListener('blur', (e) => {
      console.log(`Hidden input blurred. Keyboard mode: ${get(store).keyboardMode}`);

      const state = get(store);
      if (state.keyboardMode) {
        console.log('In keyboard mode - maintaining focus');

        setTimeout(() => {
          if (get(store).keyboardMode && hiddenInput && document.activeElement !== hiddenInput) {
            console.log('Refocusing hidden input to maintain keyboard');
            hiddenInput.focus();
          }
        }, 50);
        return;
      }

      const disableFocusManagement = callbacks?.getDisableFocusManagement() ?? false;
      if (!disableFocusManagement && state.showQuickKeys && hiddenInput) {
        setTimeout(() => {
          const activeElement = document.activeElement;
          const isWithinComponent = sessionViewElement?.contains(activeElement) ?? false;

          if (!isWithinComponent && activeElement && activeElement !== document.body) {
            store.update(state => ({ ...state, showQuickKeys: false }));
            if (callbacks) {
              callbacks.updateShowQuickKeys(false);
            }
            console.log('Focus left component, hiding quick keys');

            if (focusRetentionInterval) {
              clearInterval(focusRetentionInterval);
              focusRetentionInterval = null;
            }
          }
        }, 100);
      }
    });

    document.body.appendChild(hiddenInput);
  };

  // Update hidden input position
  const updateHiddenInputPosition = () => {
    if (!hiddenInput) return;

    const state = get(store);
    if (state.keyboardMode) {
      hiddenInput.style.position = 'fixed';
      hiddenInput.style.bottom = '50px';
      hiddenInput.style.left = '50%';
      hiddenInput.style.transform = 'translateX(-50%)';
      hiddenInput.style.width = '1px';
      hiddenInput.style.height = '1px';
      hiddenInput.style.zIndex = '1000';
      hiddenInput.style.pointerEvents = 'auto';
    } else {
      hiddenInput.style.position = 'fixed';
      hiddenInput.style.left = '-9999px';
      hiddenInput.style.top = '-9999px';
      hiddenInput.style.width = '1px';
      hiddenInput.style.height = '1px';
      hiddenInput.style.zIndex = '-1';
      hiddenInput.style.pointerEvents = 'none';
    }
  };

  // Start focus retention
  const startFocusRetention = () => {
    focusRetentionInterval = setInterval(() => {
      const disableFocusManagement = callbacks?.getDisableFocusManagement() ?? false;
      const showMobileInput = callbacks?.getShowMobileInput() ?? false;
      const showCtrlAlpha = callbacks?.getShowCtrlAlpha() ?? false;
      const state = get(store);

      if (state.keyboardMode && hiddenInput && document.activeElement !== hiddenInput) {
        console.log('Keyboard mode: forcing focus on hidden input');
        hiddenInput.focus();
        return;
      }

      if (
        !disableFocusManagement &&
        state.showQuickKeys &&
        hiddenInput &&
        document.activeElement !== hiddenInput &&
        !showMobileInput &&
        !showCtrlAlpha
      ) {
        console.log('Refocusing hidden input to maintain keyboard');
        hiddenInput.focus();
      }
    }, 100) as unknown as number;
  };

  // Delayed refocus
  const delayedRefocusHiddenInput = () => {
    setTimeout(() => {
      const disableFocusManagement = callbacks?.getDisableFocusManagement() ?? false;
      if (!disableFocusManagement && hiddenInput) {
        hiddenInput.focus();
      }
    }, 100);
  };

  // Trigger native paste
  const triggerNativePasteWithHiddenInput = () => {
    if (!hiddenInput) {
      console.error('No hidden input available for paste fallback');
      return;
    }

    console.log('Making hidden input temporarily visible for paste');

    const originalStyles = {
      position: hiddenInput.style.position,
      opacity: hiddenInput.style.opacity,
      left: hiddenInput.style.left,
      top: hiddenInput.style.top,
      width: hiddenInput.style.width,
      height: hiddenInput.style.height,
      backgroundColor: hiddenInput.style.backgroundColor,
      border: hiddenInput.style.border,
      borderRadius: hiddenInput.style.borderRadius,
      padding: hiddenInput.style.padding,
      zIndex: hiddenInput.style.zIndex,
    };

    hiddenInput.style.position = 'fixed';
    hiddenInput.style.left = '50%';
    hiddenInput.style.top = '50%';
    hiddenInput.style.transform = 'translate(-50%, -50%)';
    hiddenInput.style.width = '200px';
    hiddenInput.style.height = '40px';
    hiddenInput.style.opacity = '1';
    hiddenInput.style.backgroundColor = 'white';
    hiddenInput.style.border = '2px solid #007AFF';
    hiddenInput.style.borderRadius = '8px';
    hiddenInput.style.padding = '8px';
    hiddenInput.style.zIndex = '10000';
    hiddenInput.placeholder = 'Long-press to paste';

    const restoreStyles = () => {
      if (!hiddenInput) return;

      Object.entries(originalStyles).forEach(([key, value]) => {
        if (value !== undefined) {
          if (hiddenInput?.style) {
            (hiddenInput.style as unknown as Record<string, string>)[key] = value;
          }
        }
      });
      if (hiddenInput) {
        hiddenInput.placeholder = '';
      }
      console.log('Restored hidden input to original state');
    };

    const handlePasteEvent = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const clipboardData = e.clipboardData?.getData('text/plain');
      console.log('Native paste event received, text length:', clipboardData?.length || 0);

      if (clipboardData && inputManager) {
        console.log('Sending native paste text to terminal');
        inputManager.sendInputText(clipboardData);
      } else {
        console.warn('No clipboard data received in paste event');
      }

      hiddenInput?.removeEventListener('paste', handlePasteEvent);
      restoreStyles();
      console.log('Removed paste event listener and restored styles');
    };

    hiddenInput.addEventListener('paste', handlePasteEvent);
    hiddenInput.focus();
    hiddenInput.select();

    console.log('Input is now visible and focused - long-press to see paste menu');

    setTimeout(() => {
      if (hiddenInput) {
        hiddenInput.removeEventListener('paste', handlePasteEvent);
        restoreStyles();
        console.log('Paste timeout - restored input to hidden state');
      }
    }, 10000);
  };

  const directKeyboardStore: DirectKeyboardStore = {
    // State getters
    get showQuickKeys() { return get(store).showQuickKeys; },
    get keyboardMode() { return get(store).keyboardMode; },
    get isComposing() { return get(store).isComposing; },
    get compositionBuffer() { return get(store).compositionBuffer; },
    get keyboardHeight() { return get(store).keyboardHeight; },

    // Store methods
    subscribe: store.subscribe,
    update: store.update,

    setCallbacks(newCallbacks: DirectKeyboardCallbacks) {
      callbacks = newCallbacks;
    },

    setInputManager(manager: any) {
      inputManager = manager;
    },

    setSessionViewElement(element: HTMLElement) {
      sessionViewElement = element;
    },

    ensureHiddenInputVisible(): void {
      if (!hiddenInput) {
        createHiddenInput();
      } else {
        if (!hiddenInput.parentNode) {
          document.body.appendChild(hiddenInput);
        }
      }

      const state = get(store);
      if (state.keyboardMode && !state.showQuickKeys) {
        store.update(state => ({ ...state, showQuickKeys: true }));
        if (callbacks) {
          callbacks.updateShowQuickKeys(true);
          console.log('Showing quick keys immediately in keyboard mode');
        }
      }

      if (hiddenInput && state.keyboardMode) {
        hiddenInput.style.display = 'block';
        hiddenInput.style.visibility = 'visible';

        hiddenInput.focus();

        hiddenInput.value = ' ';
        hiddenInput.setSelectionRange(0, 1);

        setTimeout(() => {
          if (hiddenInput) {
            hiddenInput.value = '';
          }
        }, 50);

        console.log('Focused hidden input with dummy value trick');
      }
    },

    focusHiddenInput() {
      console.log('Entering keyboard mode');

      store.update(state => ({ ...state, keyboardMode: true }));
      keyboardModeTimestamp = Date.now();

      if (!captureClickHandler) {
        captureClickHandler = (e: Event) => {
          const state = get(store);
          if (state.keyboardMode) {
            const target = e.target as HTMLElement;

            if (
              target.closest('.terminal-quick-keys-container') ||
              target.closest('session-header') ||
              target.closest('app-header') ||
              target.closest('.modal-backdrop') ||
              target.closest('.modal-content') ||
              target.closest('.sidebar') ||
              target.closest('unified-settings') ||
              target.closest('notification-status') ||
              target.closest('button') ||
              target.closest('a') ||
              target.closest('[role="button"]') ||
              target.closest('.settings-button') ||
              target.closest('.notification-button')
            ) {
              return;
            }

            if (target.closest('#terminal-container') || target.closest('vibe-terminal')) {
              if (hiddenInput) {
                hiddenInput.focus();
              }
            }
          }
        };
        document.addEventListener('click', captureClickHandler, true);
        document.addEventListener('pointerdown', captureClickHandler, true);
      }

      if (focusRetentionInterval) {
        clearInterval(focusRetentionInterval);
      }
      startFocusRetention();

      this.ensureHiddenInputVisible();
    },

    dismissKeyboard() {
      store.update(state => ({ ...state, keyboardMode: false, showQuickKeys: false }));
      keyboardModeTimestamp = 0;

      if (captureClickHandler) {
        document.removeEventListener('click', captureClickHandler, true);
        document.removeEventListener('pointerdown', captureClickHandler, true);
        captureClickHandler = null;
      }

      if (callbacks) {
        callbacks.updateShowQuickKeys(false);
        callbacks.setKeyboardHeight(0);
      }

      if (focusRetentionInterval) {
        clearInterval(focusRetentionInterval);
        focusRetentionInterval = null;
      }

      if (keyboardActivationTimeout) {
        clearTimeout(keyboardActivationTimeout);
        keyboardActivationTimeout = null;
      }

      if (hiddenInput) {
        hiddenInput.blur();
        updateHiddenInputPosition();
      }

      console.log('Keyboard dismissed');
    },

    async handleQuickKeyPress(key: string, isModifier?: boolean, isSpecial?: boolean, isToggle?: boolean, pasteText?: string): Promise<void> {
      if (!inputManager) {
        console.error('No input manager found');
        return;
      }

      if (isSpecial && key === 'Done') {
        console.log('Done button pressed - dismissing keyboard');
        this.dismissKeyboard();
        return;
      }

      if (isModifier && key === 'Control') {
        return;
      }

      if (key === 'CtrlFull') {
        console.log('[DirectKeyboardManager] CtrlFull pressed, toggling Ctrl+Alpha overlay');
        if (callbacks) {
          callbacks.toggleCtrlAlpha();
        }

        const showCtrlAlpha = callbacks?.getShowCtrlAlpha() ?? false;
        console.log('[DirectKeyboardManager] showCtrlAlpha after toggle:', showCtrlAlpha);
        if (showCtrlAlpha) {
        } else {
          if (callbacks) {
            callbacks.clearCtrlSequence();
          }

          const disableFocusManagement = callbacks?.getDisableFocusManagement() ?? false;
          if (!disableFocusManagement && hiddenInput && get(store).showQuickKeys) {
            startFocusRetention();
            delayedRefocusHiddenInput();
          }
        }
        return;
      }

      if (key === 'Paste') {
        console.log('Paste button pressed - attempting clipboard read');

        console.log('Clipboard context:', {
          hasClipboard: !!navigator.clipboard,
          hasReadText: !!navigator.clipboard?.readText,
          isSecureContext: window.isSecureContext,
          protocol: window.location.protocol,
          userAgent: navigator.userAgent.includes('Safari') ? 'Safari' : 'Other',
        });

        if (window.isSecureContext && navigator.clipboard && navigator.clipboard.readText) {
          try {
            console.log('Secure context detected - trying modern clipboard API...');
            const text = await navigator.clipboard.readText();
            console.log('Clipboard read successful, text length:', text?.length || 0);

            if (text && inputManager) {
              console.log('Sending clipboard text to terminal');
              inputManager.sendInputText(text);
              return;
            } else if (!text) {
              console.warn('Clipboard is empty or contains no text');
              return;
            }
          } catch (err) {
            const error = err as Error;
            console.warn('Clipboard API failed despite secure context:', {
              name: error?.name,
              message: error?.message,
            });
          }
        } else {
          console.log('Not in secure context - clipboard API unavailable, using textarea fallback');
        }

        triggerNativePasteWithHiddenInput();
      } else if (key === 'Ctrl+A') {
        inputManager.sendControlSequence('\x01');
      } else if (key === 'Ctrl+C') {
        inputManager.sendControlSequence('\x03');
      } else if (key === 'Ctrl+D') {
        inputManager.sendControlSequence('\x04');
      } else if (key === 'Ctrl+E') {
        inputManager.sendControlSequence('\x05');
      } else if (key === 'Ctrl+K') {
        inputManager.sendControlSequence('\x0b');
      } else if (key === 'Ctrl+L') {
        inputManager.sendControlSequence('\x0c');
      } else if (key === 'Ctrl+R') {
        inputManager.sendControlSequence('\x12');
      } else if (key === 'Ctrl+U') {
        inputManager.sendControlSequence('\x15');
      } else if (key === 'Ctrl+W') {
        inputManager.sendControlSequence('\x17');
      } else if (key === 'Ctrl+Z') {
        inputManager.sendControlSequence('\x1a');
      } else if (key === 'Option') {
        inputManager.sendControlSequence('\x1b');
      } else if (key === 'Command') {
        return;
      } else if (key === 'Delete') {
        inputManager.sendInput('delete');
      } else if (key === 'Done') {
        this.dismissKeyboard();
        return;
      } else if (key.startsWith('F')) {
        const fNum = Number.parseInt(key.substring(1), 10);
        if (fNum >= 1 && fNum <= 12) {
          inputManager.sendInput(`f${fNum}`);
        }
      } else {
        let keyToSend = key;
        if (key === 'Tab') {
          keyToSend = 'tab';
        } else if (key === 'Escape') {
          keyToSend = 'escape';
        } else if (key === 'ArrowUp') {
          keyToSend = 'arrow_up';
        } else if (key === 'ArrowDown') {
          keyToSend = 'arrow_down';
        } else if (key === 'ArrowLeft') {
          keyToSend = 'arrow_left';
        } else if (key === 'ArrowRight') {
          keyToSend = 'arrow_right';
        } else if (key === 'PageUp') {
          keyToSend = 'page_up';
        } else if (key === 'PageDown') {
          keyToSend = 'page_down';
        } else if (key === 'Home') {
          keyToSend = 'home';
        } else if (key === 'End') {
          keyToSend = 'end';
        }

        if (keyToSend.length === 1) {
          inputManager.sendInputText(keyToSend);
        } else {
          inputManager.sendInput(keyToSend.toLowerCase());
        }
      }

      requestAnimationFrame(() => {
        const disableFocusManagement = callbacks?.getDisableFocusManagement() ?? false;
        if (!disableFocusManagement && hiddenInput && get(store).showQuickKeys) {
          hiddenInput.focus();
        }
      });
    },

    shouldRefocusHiddenInput() {
      const disableFocusManagement = callbacks?.getDisableFocusManagement() ?? false;
      return !disableFocusManagement && !!hiddenInput && get(store).showQuickKeys;
    },

    refocusHiddenInput() {
      setTimeout(() => {
        const disableFocusManagement = callbacks?.getDisableFocusManagement() ?? false;
        if (!disableFocusManagement && hiddenInput) {
          hiddenInput.focus();
        }
      }, 100);
    },

    startFocusRetention() {
      startFocusRetention();
    },

    delayedRefocusHiddenInput() {
      delayedRefocusHiddenInput();
    },

    showVisibleInputForKeyboard() {
      if (document.getElementById('vibe-visible-keyboard-input')) return;

      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'vibe-visible-keyboard-input';
      input.placeholder = 'Type here...';
      input.style.position = 'fixed';
      input.style.bottom = '80px';
      input.style.left = '50%';
      input.style.transform = 'translateX(-50%)';
      input.style.zIndex = '9999';
      input.style.fontSize = '18px';
      input.style.padding = '0.5em';
      input.style.background = '#fff';
      input.style.color = '#000';
      input.style.border = '1px solid #ccc';
      input.style.borderRadius = '6px';

      document.body.appendChild(input);

      setTimeout(() => {
        input.focus();
        console.log('Input focused:', document.activeElement === input);
      }, 50);

      const cleanup = () => {
        if (input.value && inputManager) {
          inputManager.sendInputText(input.value);
        }
        input.remove();
      };

      input.addEventListener('blur', cleanup);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          cleanup();
        }
      });
    },

    cleanup() {
      if (focusRetentionInterval) {
        clearInterval(focusRetentionInterval);
        focusRetentionInterval = null;
      }
      if (keyboardActivationTimeout) {
        clearTimeout(keyboardActivationTimeout);
        keyboardActivationTimeout = null;
      }

      if (captureClickHandler) {
        document.removeEventListener('click', captureClickHandler, true);
        document.removeEventListener('pointerdown', captureClickHandler, true);
        captureClickHandler = null;
      }

      if (globalPasteHandler) {
        document.removeEventListener('paste', globalPasteHandler);
        globalPasteHandler = null;
      }

      if (hiddenInput) {
        hiddenInput.remove();
        hiddenInput = null;
      }
    },

    getKeyboardMode() {
      return get(store).keyboardMode;
    },

    isRecentlyEnteredKeyboardMode() {
      if (!get(store).keyboardMode) return false;
      const timeSinceEntry = Date.now() - keyboardModeTimestamp;
      return timeSinceEntry < 2000;
    },
  };

  // Initialize
  setupGlobalPasteListener();

  return directKeyboardStore;
}

// Export the store
export const directKeyboardStore = createDirectKeyboardStore();

// Export derived stores for convenience
export const showQuickKeys = derived(directKeyboardStore, $store => $store.showQuickKeys);
export const keyboardMode = derived(directKeyboardStore, $store => $store.keyboardMode);
export const isComposing = derived(directKeyboardStore, $store => $store.isComposing);
export const keyboardHeight = derived(directKeyboardStore, $store => $store.keyboardHeight);