/**
 * Mobile Input Manager Store for Terminal Input Handling
 *
 * Manages mobile-specific input handling for terminal sessions,
 * including keyboard overlays and direct input modes.
 */

import { writable, derived, get } from 'svelte/store';
import type { Session } from '$lib/types';

// Types
interface MobileInputCallbacks {
  toggleMobileInputDisplay(): void;
  shouldUseDirectKeyboard(): boolean;
  focusHiddenInput(): void;
  refreshTerminalAfterMobileInput(): void;
  getMobileInputText(): string;
  clearMobileInputText(): void;
  closeMobileInput(): void;
  requestUpdate(): void;
  querySelector(selector: string): Element | null;
  shouldRefocusHiddenInput(): boolean;
  refocusHiddenInput(): void;
  startFocusRetention(): void;
  delayedRefocusHiddenInput(): void;
}

interface MobileInputStoreState {
  showOverlay: boolean;
  inputText: string;
  isCreating: boolean;
}

interface MobileInputStoreActions {
  toggleOverlay(): void;
  handleMobileInputToggle(): void;
  handleMobileInputSend(text: string): Promise<void>;
  handleMobileInputSendOnly(text: string): Promise<void>;
  handleMobileInputCancel(): void;
  setInputText(text: string): void;
  clearInputText(): void;
  cleanup(): void;
}

type MobileInputStore = MobileInputStoreState & MobileInputStoreActions & {
  subscribe: (fn: (value: MobileInputStoreState) => void) => () => void;
  update: (fn: (value: MobileInputStoreState) => MobileInputStoreState) => void;
  setCallbacks: (callbacks: MobileInputCallbacks) => void;
  setInputManager: (manager: any) => void;
};

// Create the store
function createMobileInputStore(): MobileInputStore {
  const store = writable<MobileInputStoreState>({
    showOverlay: false,
    inputText: '',
    isCreating: false,
  });

  let callbacks: MobileInputCallbacks | null = null;
  let inputManager: any = null; // Would be InputManager type

  const mobileInputStore: MobileInputStore = {
    // State getters (these will be updated by the store)
    get showOverlay() { return get(store).showOverlay; },
    get inputText() { return get(store).inputText; },
    get isCreating() { return get(store).isCreating; },

    // Store methods
    subscribe: store.subscribe,
    update: store.update,

    setCallbacks(newCallbacks: MobileInputCallbacks) {
      callbacks = newCallbacks;
    },

    setInputManager(manager: any) {
      inputManager = manager;
    },

    toggleOverlay() {
      store.update(state => ({ ...state, showOverlay: !state.showOverlay }));
    },

    handleMobileInputToggle() {
      if (!callbacks) return;

      // If direct keyboard is enabled, focus a hidden input instead of showing overlay
      if (callbacks.shouldUseDirectKeyboard()) {
        callbacks.focusHiddenInput();
        return;
      }

      callbacks.toggleMobileInputDisplay();
    },

    async handleMobileInputSend(text: string): Promise<void> {
      if (!callbacks || !inputManager) return;

      const textToSend = text?.trim();
      if (!textToSend) return;

      try {
        store.update(state => ({ ...state, isCreating: true }));

        // Add enter key at the end to execute the command
        await inputManager.sendInputText(textToSend);
        // Use sendInput (not sendInputText) for special keys like 'enter'
        await inputManager.sendInput('enter');

        // Clear the reactive property
        callbacks.clearMobileInputText();

        // Trigger re-render to update button state
        callbacks.requestUpdate();

        // Hide the input overlay after sending
        callbacks.closeMobileInput();

        // Refocus the hidden input to restore keyboard functionality
        if (callbacks.shouldRefocusHiddenInput()) {
          callbacks.refocusHiddenInput();
        }

        // Refresh terminal scroll position after closing mobile input
        callbacks.refreshTerminalAfterMobileInput();

        store.update(state => ({ ...state, isCreating: false }));
      } catch (error) {
        console.error('error sending mobile input', error);
        store.update(state => ({ ...state, isCreating: false }));
        // Don't hide the overlay if there was an error
      }
    },

    async handleMobileInputSendOnly(text: string): Promise<void> {
      if (!callbacks || !inputManager) return;

      // Use the passed text parameter instead of reading from textarea
      const textToSend = text?.trim();
      if (!textToSend) return;

      try {
        store.update(state => ({ ...state, isCreating: true }));

        // Send text without enter key
        await inputManager.sendInputText(textToSend);

        // Clear the reactive property
        callbacks.clearMobileInputText();

        // Trigger re-render to update button state
        callbacks.requestUpdate();

        // Hide the input overlay after sending
        callbacks.closeMobileInput();

        // Refocus the hidden input to restore keyboard functionality
        if (callbacks.shouldRefocusHiddenInput()) {
          callbacks.refocusHiddenInput();
        }

        // Refresh terminal scroll position after closing mobile input
        callbacks.refreshTerminalAfterMobileInput();

        store.update(state => ({ ...state, isCreating: false }));
      } catch (error) {
        console.error('error sending mobile input', error);
        store.update(state => ({ ...state, isCreating: false }));
        // Don't hide the overlay if there was an error
      }
    },

    handleMobileInputCancel() {
      if (!callbacks) return;

      callbacks.closeMobileInput();
      // Clear the text
      callbacks.clearMobileInputText();
      // Restart focus retention
      if (callbacks.shouldRefocusHiddenInput()) {
        callbacks.startFocusRetention();
        callbacks.delayedRefocusHiddenInput();
      }
    },

    setInputText(text: string) {
      store.update(state => ({ ...state, inputText: text }));
    },

    clearInputText() {
      store.update(state => ({ ...state, inputText: '' }));
    },

    cleanup() {
      // Clear references to prevent memory leaks
      inputManager = null;
      callbacks = null;
      store.set({ showOverlay: false, inputText: '', isCreating: false });
    },
  };

  return mobileInputStore;
}

// Export the store
export const mobileInputStore = createMobileInputStore();

// Export derived stores for convenience
export const showMobileOverlay = derived(mobileInputStore, $store => $store.showOverlay);
export const mobileInputText = derived(mobileInputStore, $store => $store.inputText);
export const isMobileInputCreating = derived(mobileInputStore, $store => $store.isCreating);