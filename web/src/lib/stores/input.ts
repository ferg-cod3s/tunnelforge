/**
 * Input Manager Store for Terminal Input Handling
 *
 * Handles keyboard input events, special key combinations, IME composition,
 * focus management, and paste handling for terminal sessions.
 */

import { writable, derived, get } from 'svelte/store';
import type { Session } from '$lib/types';

// Types
interface InputCallbacks {
  requestUpdate(): void;
  getKeyboardCaptureActive?(): boolean;
  getTerminalElement?(): Terminal | VibeTerminalBinary | null;
}

interface InputStoreState {
  session: Session | null;
  isFocused: boolean;
  useWebSocketInput: boolean;
  lastEscapeTime: number;
  isComposing: boolean;
  imeInput: DesktopIMEInput | null;
  globalCompositionListener: ((e: CompositionEvent) => void) | null;
}

interface InputStoreActions {
  setSession(session: Session | null): void;
  setCallbacks(callbacks: InputCallbacks): void;
  handleKeyDown(event: KeyboardEvent): Promise<void>;
  handlePaste(event: ClipboardEvent): Promise<void>;
  setFocus(): void;
  sendInputText(text: string): Promise<void>;
  sendControlSequence(controlChar: string): Promise<void>;
  sendInput(inputText: string): Promise<void>;
  isKeyboardShortcut(event: KeyboardEvent): boolean;
  cleanup(): void;

  // Private methods (for internal use)
  sendInputInternal(input: { text?: string; key?: string }, errorContext: string): Promise<void>;
  setupIMEInput(retryCount?: number): void;
  setupGlobalCompositionListener(): void;
  refreshIMEPosition(): void;
  enableIMEInput(): void;
  forceSetupIMEInput(): void;
}

type InputStore = InputStoreState & InputStoreActions & {
  subscribe: (fn: (value: InputStoreState) => void) => () => void;
  update: (fn: (value: InputStoreState) => InputStoreState) => void;
};

// Forward declarations for types
interface Terminal {
  getCursorInfo?(): any;
  fontSize?: number;
}

interface VibeTerminalBinary {
  getCursorInfo?(): any;
  fontSize?: number;
}

interface DesktopIMEInput {
  isFocused(): boolean;
  isComposingText(): boolean;
  refreshPosition(): void;
  cleanup(): void;
}

// Constants
const DOUBLE_ESCAPE_THRESHOLD = 500; // ms
const IME_SETUP_RETRY_DELAY_MS = 100;
const MAX_RETRIES = 10;

// Utility functions (adapted from source)
function isBrowserShortcut(e: KeyboardEvent): boolean {
  // Browser shortcuts that should be preserved
  const isMac = navigator.userAgent.includes('Mac') ||
    (navigator.platform && navigator.platform.indexOf('Mac') >= 0);

  // DevTools shortcuts
  if (e.key === 'F12') return true;
  if (!isMac && e.ctrlKey && e.shiftKey && e.key === 'I') return true;
  if (isMac && e.metaKey && e.altKey && e.key === 'I') return true;

  // Window switching
  if ((e.altKey || e.metaKey) && e.key === 'Tab') return true;

  // Word navigation on macOS
  if (isMac && e.metaKey && e.altKey && ['ArrowLeft', 'ArrowRight'].includes(e.key)) return true;

  return false;
}

function isCopyPasteShortcut(e: KeyboardEvent): boolean {
  const isMac = navigator.userAgent.includes('Mac') ||
    (navigator.platform && navigator.platform.indexOf('Mac') >= 0);

  return (isMac && e.metaKey && e.key === 'v') ||
         (!isMac && e.ctrlKey && e.key === 'v') ||
         (isMac && e.metaKey && e.key === 'c') ||
         (!isMac && e.ctrlKey && e.key === 'c');
}

function consumeEvent(e: Event): void {
  e.preventDefault();
  e.stopPropagation();
}

function detectMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function isIMEAllowedKey(e: KeyboardEvent): boolean {
  // Keys allowed during IME composition
  return ['Escape', 'Enter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) ||
         (e.ctrlKey && e.key.length === 1);
}

// CJK language detection
const CJK_LANGUAGE_CODES = ['zh', 'ja', 'ko'];

function isCJKLanguageActive(): boolean {
  const languages = [navigator.language, ...(navigator.languages || [])];
  const hasCJKLanguage = languages.some(lang =>
    CJK_LANGUAGE_CODES.some(cjkLang => lang.toLowerCase().startsWith(cjkLang.toLowerCase()))
  );
  return hasCJKLanguage;
}

function hasIMEKeyboard(): boolean {
  if (!('CompositionEvent' in window)) return false;

  if ('virtualKeyboard' in navigator) {
    try {
      const nav = navigator as Navigator & { virtualKeyboard?: { overlaysContent?: boolean } };
      const vk = nav.virtualKeyboard;
      if (vk && vk.overlaysContent !== undefined) return true;
    } catch {}
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const isCommonIMEPlatform = userAgent.includes('windows') || userAgent.includes('mac') || userAgent.includes('linux');
  return isCommonIMEPlatform;
}

// Create the store
function createInputStore(): InputStore {
  const store = writable<InputStoreState>({
    session: null,
    isFocused: false,
    useWebSocketInput: true,
    lastEscapeTime: 0,
    isComposing: false,
    imeInput: null,
    globalCompositionListener: null,
  });

  let callbacks: InputCallbacks | null = null;

  const inputStore: InputStore = {
    // State getters (these will be updated by the store)
    get session() { return get(store).session; },
    get isFocused() { return get(store).isFocused; },
    get useWebSocketInput() { return get(store).useWebSocketInput; },
    get lastEscapeTime() { return get(store).lastEscapeTime; },
    get isComposing() { return get(store).isComposing; },
    get imeInput() { return get(store).imeInput; },
    get globalCompositionListener() { return get(store).globalCompositionListener; },

    // Store methods
    subscribe: store.subscribe,
    update: store.update,

    setSession(session: Session | null) {
      store.update(state => {
        // Clean up IME input when session is null
        if (!session && state.imeInput) {
          state.imeInput.cleanup();
          state.imeInput = null;
        }

        state.session = session;

        // Setup IME input when session is available and CJK language is active
        if (session && !state.imeInput) {
          this.setupIMEInput();
        }

        // Set up global composition event listener
        if (session && !detectMobile()) {
          this.setupGlobalCompositionListener();
        }

        // Check URL parameter for WebSocket input feature flag
        const urlParams = new URLSearchParams(window.location.search);
        const socketInputParam = urlParams.get('socket_input');
        if (socketInputParam !== null) {
          state.useWebSocketInput = socketInputParam === 'true';
        }

        // Connect to WebSocket when session is set (if feature enabled)
        // if (session && state.useWebSocketInput) {
        //   websocketInputClient.connect(session).catch((error) => {
        //     console.debug('WebSocket connection failed, will use HTTP fallback:', error);
        //   });
        // }

        return state;
      });
    },

    setCallbacks(newCallbacks: InputCallbacks) {
      callbacks = newCallbacks;
    },

    async handleKeyDown(e: KeyboardEvent): Promise<void> {
      const state = get(store);
      if (!state.session) return;

      // Block keyboard events when IME input is focused, except for editing keys
      if (state.imeInput?.isFocused()) {
        if (!isIMEAllowedKey(e)) {
          return;
        }
      }

      // Block keyboard events during IME composition
      if (state.imeInput?.isComposingText()) {
        return;
      }

      const { key, ctrlKey, altKey, metaKey, shiftKey } = e;

      // Handle Escape key specially for exited sessions
      if (key === 'Escape' && state.session.status === 'exited') {
        return; // Let parent component handle back navigation
      }

      // Don't send input to exited sessions
      if (state.session.status === 'exited') {
        console.log('ignoring keyboard input - session has exited');
        return;
      }

      // Allow standard browser copy/paste shortcuts
      if (isCopyPasteShortcut(e)) {
        return;
      }

      // Handle Alt+ combinations
      if (altKey && !ctrlKey && !metaKey && !shiftKey) {
        if (key === 'ArrowLeft') {
          consumeEvent(e);
          await this.sendInput('\x1bb'); // ESC+b
          return;
        }
        if (key === 'ArrowRight') {
          consumeEvent(e);
          await this.sendInput('\x1bf'); // ESC+f
          return;
        }
        if (key === 'Backspace') {
          consumeEvent(e);
          await this.sendInput('\x17'); // Ctrl+W
          return;
        }
      }

      let inputText = '';

      // Handle special keys
      switch (key) {
        case 'Enter':
          if (ctrlKey) {
            inputText = 'ctrl_enter';
          } else if (shiftKey) {
            inputText = 'shift_enter';
          } else {
            inputText = 'enter';
          }
          break;
        case 'Escape': {
          const now = Date.now();
          const timeSinceLastEscape = now - state.lastEscapeTime;

          if (timeSinceLastEscape < DOUBLE_ESCAPE_THRESHOLD) {
            // Double escape detected - toggle keyboard capture
            console.log('🔄 Double Escape detected in input manager - toggling keyboard capture');

            // Dispatch event to parent to toggle capture
            if (callbacks) {
              const currentCapture = callbacks.getKeyboardCaptureActive?.() ?? true;
              const newCapture = !currentCapture;

              const event = new CustomEvent('capture-toggled', {
                detail: { active: newCapture },
                bubbles: true,
                composed: true,
              });

              document.dispatchEvent(event);
            }

            store.update(s => ({ ...s, lastEscapeTime: 0 }));
            return; // Don't send this escape to terminal
          }

          store.update(s => ({ ...s, lastEscapeTime: now }));
          inputText = 'escape';
          break;
        }
        case 'ArrowUp':
          inputText = 'arrow_up';
          break;
        case 'ArrowDown':
          inputText = 'arrow_down';
          break;
        case 'ArrowLeft':
          inputText = 'arrow_left';
          break;
        case 'ArrowRight':
          inputText = 'arrow_right';
          break;
        case 'Tab':
          inputText = shiftKey ? 'shift_tab' : 'tab';
          break;
        case 'Backspace':
          inputText = 'backspace';
          break;
        case 'Delete':
          inputText = 'delete';
          break;
        case ' ':
          inputText = ' ';
          break;
        default:
          // Handle regular printable characters
          if (key.length === 1) {
            inputText = key;
          } else {
            return; // Ignore other special keys
          }
          break;
      }

      // Handle Ctrl combinations
      if (ctrlKey && key.length === 1 && key !== 'Enter') {
        const charCode = key.toLowerCase().charCodeAt(0);
        if (charCode >= 97 && charCode <= 122) {
          inputText = String.fromCharCode(charCode - 96);
        }
      }

      await this.sendInput(inputText);
    },

    async handlePaste(e: ClipboardEvent): Promise<void> {
      const state = get(store);
      if (!state.session) return;

      const text = e.clipboardData?.getData('text/plain');
      if (text) {
        await this.sendInputText(text);
      }
    },

    setFocus() {
      store.update(state => ({ ...state, isFocused: true }));
    },

    async sendInputText(text: string): Promise<void> {
      await this.sendInputInternal({ text }, 'send input to session');
      this.refreshIMEPosition();
    },

    async sendControlSequence(controlChar: string): Promise<void> {
      await this.sendInputInternal({ text: controlChar }, 'send control sequence to session');
      this.refreshIMEPosition();
    },

    async sendInput(inputText: string): Promise<void> {
      const specialKeys = [
        'enter', 'escape', 'backspace', 'tab', 'shift_tab', 'arrow_up', 'arrow_down',
        'arrow_left', 'arrow_right', 'ctrl_enter', 'shift_enter', 'page_up', 'page_down',
        'home', 'end', 'delete', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9',
        'f10', 'f11', 'f12'
      ];

      const input = specialKeys.includes(inputText) ? { key: inputText } : { text: inputText };
      await this.sendInputInternal(input, 'send input to session');
      this.refreshIMEPosition();
    },

    isKeyboardShortcut(e: KeyboardEvent): boolean {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.contentEditable === 'true' ||
        target.closest?.('.monaco-editor') ||
        target.closest?.('[data-keybinding-context]') ||
        target.closest?.('.editor-container') ||
        target.closest?.('inline-edit')
      ) {
        if (isCopyPasteShortcut(e)) {
          return true;
        }
        return false;
      }

      if (isBrowserShortcut(e)) {
        return true;
      }

      const isMac = navigator.userAgent.includes('Mac') ||
        (navigator.platform && navigator.platform.indexOf('Mac') >= 0);
      if (
        e.key === 'F12' ||
        (!isMac && e.ctrlKey && e.shiftKey && e.key === 'I') ||
        (isMac && e.metaKey && e.altKey && e.key === 'I')
      ) {
        return true;
      }

      if ((e.altKey || e.metaKey) && e.key === 'Tab') {
        return true;
      }

      if (isMac && e.metaKey && e.altKey && ['ArrowLeft', 'ArrowRight'].includes(e.key)) {
        return true;
      }

      const captureActive = callbacks?.getKeyboardCaptureActive?.() ?? true;

      if (!captureActive) {
        if (isMac && e.metaKey && !e.shiftKey && !e.altKey) {
          if (['a', 'f', 'r', 'l', 'p', 's', 'd'].includes(e.key.toLowerCase())) {
            return true;
          }
        }

        if (!isMac && e.ctrlKey && !e.shiftKey && !e.altKey) {
          if (['a', 'f', 'r', 'l', 'p', 's', 'd'].includes(e.key.toLowerCase())) {
            return true;
          }
        }
      }

      return false;
    },

    cleanup() {
      store.update(state => {
        if (state.imeInput) {
          state.imeInput.cleanup();
          state.imeInput = null;
        }

        if (state.globalCompositionListener) {
          document.removeEventListener('compositionstart', state.globalCompositionListener);
          state.globalCompositionListener = null;
        }

        // Disconnect WebSocket if feature was enabled
        // if (state.useWebSocketInput) {
        //   websocketInputClient.disconnect();
        // }

        state.session = null;
        callbacks = null;

        return state;
      });
    },

    // Private methods
    async sendInputInternal(input: { text?: string; key?: string }, errorContext: string): Promise<void> {
      const state = get(store);
      if (!state.session) return;

      try {
        // Try WebSocket first if feature enabled
        // if (state.useWebSocketInput) {
        //   const sentViaWebSocket = websocketInputClient.sendInput(input);
        //   if (sentViaWebSocket) return;
        // }

        // Fallback to HTTP
        console.debug('WebSocket unavailable, falling back to HTTP');
        const response = await fetch(`/api/sessions/${state.session.id}/input`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // ...authClient.getAuthHeader(),
          },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          if (response.status === 400) {
            console.log('session no longer accepting input (likely exited)');
            if (state.session) {
              state.session.status = 'exited';
              callbacks?.requestUpdate();
            }
          } else {
            console.error(`failed to ${errorContext}`, { status: response.status });
          }
        }
      } catch (error) {
        console.error(`error ${errorContext}`, error);
      }
    },

    setupIMEInput(retryCount = 0) {
      if (detectMobile()) {
        console.log('Skipping IME input setup on mobile device');
        return;
      }

      const state = get(store);
      if (state.imeInput) {
        console.log('IME input already exists, skipping setup');
        return;
      }

      if (!isCJKLanguageActive()) {
        console.log('Skipping IME input setup - no CJK language detected');
        return;
      }

      console.log('Setting up IME input on desktop device for CJK language');

      const terminalElement = callbacks?.getTerminalElement?.();
      if (!terminalElement) {
        if (retryCount >= MAX_RETRIES) {
          console.error('Failed to setup IME after maximum retries');
          return;
        }
        console.log(`Terminal element not ready yet, deferring IME setup (retry ${retryCount + 1}/${MAX_RETRIES})`);
        setTimeout(() => this.setupIMEInput(retryCount + 1), IME_SETUP_RETRY_DELAY_MS);
        return;
      }

      // This would need to be implemented - placeholder for now
      // state.imeInput = new DesktopIMEInput({...});
    },

    refreshIMEPosition() {
      const state = get(store);
      if (state.imeInput?.isFocused()) {
        state.imeInput.refreshPosition();
        setTimeout(() => {
          state.imeInput?.refreshPosition();
        }, 50);
      }
    },

    setupGlobalCompositionListener() {
      const state = get(store);
      if (state.globalCompositionListener) return;

      const listener = (e: CompositionEvent) => {
        if (!state.imeInput && state.session && !detectMobile()) {
          console.log('Composition event detected, enabling IME input:', e.type, e.data);
          this.enableIMEInput();
        }
      };

      store.update(s => ({ ...s, globalCompositionListener: listener }));
      document.addEventListener('compositionstart', listener);
    },

    enableIMEInput() {
      if (detectMobile()) {
        console.log('Skipping IME input enable on mobile device');
        return;
      }

      const state = get(store);
      if (state.imeInput) {
        console.log('IME input already enabled');
        return;
      }

      if (!state.session) {
        console.log('Cannot enable IME input - no session available');
        return;
      }

      console.log('Dynamically enabling IME input for CJK composition');
      this.forceSetupIMEInput();
    },

    forceSetupIMEInput() {
      // Implementation would go here - placeholder for now
      // Similar to setupIMEInput but without language checks
    },
  };

  return inputStore;
}

// Export the store
export const inputStore = createInputStore();

// Export derived stores for convenience
export const isInputFocused = derived(inputStore, $store => $store.isFocused);