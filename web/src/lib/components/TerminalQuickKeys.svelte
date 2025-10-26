<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { inputStore } from '$lib/stores/input';
  import { getAppPreferences, saveAppPreferences, type AppPreferences } from '$lib/services/settings';

  // Props interface
  interface Props {
    sessionId: string;
    visible?: boolean;
    position?: 'top' | 'bottom';
    customKeys?: QuickKey[];
  }

  interface QuickKey {
    id: string;
    label: string;
    command: string;
    type: 'control' | 'text' | 'sequence';
  }

  // Props with defaults
  let {
    sessionId,
    visible = false,
    position = 'bottom',
    customKeys = []
  }: Props = $props();

  // State
  let showFunctionKeys = $state(false);
  let showCtrlKeys = $state(false);
  let isLandscape = $state(false);
  let activeModifiers = $state(new Set<string>());
  let customQuickKeys = $state<QuickKey[]>([]);
  let isEditingCustomKeys = $state(false);
  let newCustomKeyLabel = $state('');
  let newCustomKeyCommand = $state('');
  let newCustomKeyType = $state<'control' | 'text' | 'sequence'>('text');

  // Key repeat functionality
  let keyRepeatInterval: number | null = null;
  let keyRepeatTimeout: number | null = null;
  let orientationHandler: (() => void) | null = null;

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    'key-pressed': { key: string; type?: 'control' | 'text' | 'sequence' };
    'custom-keys-changed': { customKeys: QuickKey[] };
    'visibility-changed': { visible: boolean };
  }>();

  // Derived state
  let allCustomKeys = $derived([...customKeys, ...customQuickKeys]);

  // Predefined quick keys (based on original Lit component)
  const TERMINAL_QUICK_KEYS = [
    // First row
    { key: 'Escape', label: 'Esc', row: 1 },
    { key: 'Control', label: 'Ctrl', modifier: true, row: 1 },
    { key: 'CtrlExpand', label: '⌃', toggle: true, row: 1 },
    { key: 'F', label: 'F', toggle: true, row: 1 },
    { key: 'Tab', label: 'Tab', row: 1 },
    { key: 'shift_tab', label: '⇤', row: 1 },
    { key: 'ArrowUp', label: '↑', arrow: true, row: 1 },
    { key: 'ArrowDown', label: '↓', arrow: true, row: 1 },
    { key: 'ArrowLeft', label: '←', arrow: true, row: 1 },
    { key: 'ArrowRight', label: '→', arrow: true, row: 1 },
    { key: 'PageUp', label: 'PgUp', row: 1 },
    { key: 'PageDown', label: 'PgDn', row: 1 },
    // Second row
    { key: 'Home', label: 'Home', row: 2 },
    { key: 'Paste', label: 'Paste', row: 2 },
    { key: 'End', label: 'End', row: 2 },
    { key: 'Delete', label: 'Del', row: 2 },
    { key: '`', label: '~', row: 2 },
    { key: '|', label: '|', row: 2 },
    { key: '/', label: '/', row: 2 },
    { key: '\\', label: '\\', row: 2 },
    { key: '-', label: '-', row: 2 },
    // Third row - additional special characters
    { key: 'Option', label: '⌥', modifier: true, row: 3 },
    { key: 'Command', label: '⌘', modifier: true, row: 3 },
    { key: 'Ctrl+C', label: '^C', combo: true, row: 3 },
    { key: 'Ctrl+Z', label: '^Z', combo: true, row: 3 },
    { key: "'", label: "'", row: 3 },
    { key: '"', label: '"', row: 3 },
    { key: '{', label: '{', row: 3 },
    { key: '}', label: '}', row: 3 },
    { key: '[', label: '[', row: 3 },
    { key: ']', label: ']', row: 3 },
    { key: '(', label: '(', row: 3 },
    { key: ')', label: ')', row: 3 },
  ];

  // Common Ctrl key combinations
  const CTRL_SHORTCUTS = [
    { key: 'Ctrl+D', label: '^D', combo: true, description: 'EOF/logout' },
    { key: 'Ctrl+L', label: '^L', combo: true, description: 'Clear screen' },
    { key: 'Ctrl+R', label: '^R', combo: true, description: 'Reverse search' },
    { key: 'Ctrl+W', label: '^W', combo: true, description: 'Delete word' },
    { key: 'Ctrl+U', label: '^U', combo: true, description: 'Clear line' },
    { key: 'Ctrl+A', label: '^A', combo: true, description: 'Start of line' },
    { key: 'Ctrl+E', label: '^E', combo: true, description: 'End of line' },
    { key: 'Ctrl+K', label: '^K', combo: true, description: 'Kill to EOL' },
    { key: 'CtrlFull', label: 'Ctrl…', special: true, description: 'Full Ctrl UI' },
  ];

  // Function keys F1-F12
  const FUNCTION_KEYS = Array.from({ length: 12 }, (_, i) => ({
    key: `F${i + 1}`,
    label: `F${i + 1}`,
    func: true,
  }));

  // Done button - always visible
  const DONE_BUTTON = { key: 'Done', label: 'Done', special: true };

  // Load custom keys from settings
  function loadCustomKeys() {
    try {
      const prefs = getAppPreferences();
      const stored = localStorage.getItem('tunnelforge_custom_quick_keys');
      if (stored) {
        customQuickKeys = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load custom quick keys:', error);
      customQuickKeys = [];
    }
  }

  // Save custom keys to settings
  function saveCustomKeys() {
    try {
      localStorage.setItem('tunnelforge_custom_quick_keys', JSON.stringify(customQuickKeys));
      dispatch('custom-keys-changed', { customKeys: allCustomKeys });
    } catch (error) {
      console.error('Failed to save custom quick keys:', error);
    }
  }

  // Add new custom key
  function addCustomKey() {
    if (!newCustomKeyLabel.trim() || !newCustomKeyCommand.trim()) return;

    const newKey: QuickKey = {
      id: `custom_${Date.now()}`,
      label: newCustomKeyLabel.trim(),
      command: newCustomKeyCommand.trim(),
      type: newCustomKeyType,
    };

    customQuickKeys = [...customQuickKeys, newKey];
    saveCustomKeys();

    // Reset form
    newCustomKeyLabel = '';
    newCustomKeyCommand = '';
    newCustomKeyType = 'text';
  }

  // Remove custom key
  function removeCustomKey(id: string) {
    customQuickKeys = customQuickKeys.filter(key => key.id !== id);
    saveCustomKeys();
  }

  // Check orientation
  function checkOrientation() {
    isLandscape = window.innerWidth > window.innerHeight && window.innerWidth > 600;
  }

  // Get button size class
  function getButtonSizeClass(_label: string): string {
    return isLandscape ? 'px-0.5 py-1' : 'px-1 py-1.5';
  }

  // Get button font class
  function getButtonFontClass(label: string): string {
    if (label.length >= 4) {
      return 'text-xs'; // 12px
    } else if (label.length === 3) {
      return 'text-sm'; // 14px
    } else {
      return 'text-base'; // 16px
    }
  }

  // Handle key press
  function handleKeyPress(
    key: string,
    isModifier = false,
    isSpecial = false,
    isToggle = false,
    event?: Event
  ) {
    // Prevent default to avoid any focus loss
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (isToggle && key === 'F') {
      // Toggle function keys display
      showFunctionKeys = !showFunctionKeys;
      showCtrlKeys = false; // Hide Ctrl keys if showing
      return;
    }

    if (isToggle && key === 'CtrlExpand') {
      // Toggle Ctrl shortcuts display
      showCtrlKeys = !showCtrlKeys;
      showFunctionKeys = false; // Hide function keys if showing
      return;
    }

    // If we're showing function keys and a function key is pressed, hide them
    if (showFunctionKeys && key.startsWith('F') && key !== 'F') {
      showFunctionKeys = false;
    }

    // If we're showing Ctrl keys and a Ctrl shortcut is pressed (not CtrlFull), hide them
    if (showCtrlKeys && key.startsWith('Ctrl+')) {
      showCtrlKeys = false;
    }

    // Handle modifier keys for chord system
    if (isModifier && key === 'Option') {
      // If Option is already active, clear it
      if (activeModifiers.has('Option')) {
        activeModifiers.delete('Option');
      } else {
        // Add Option to active modifiers
        activeModifiers.add('Option');
      }
      return; // Don't send Option key immediately
    }

    // Check for Option+Arrow chord combinations
    if (activeModifiers.has('Option') && key.startsWith('Arrow')) {
      // Clear only the Option modifier after use
      activeModifiers.delete('Option');

      // Send the Option+Arrow combination
      sendKeyToTerminal('Option', 'control');
      sendKeyToTerminal(key, 'control');
      return;
    }

    // If any non-arrow key is pressed while Option is active, clear Option
    if (activeModifiers.has('Option') && !key.startsWith('Arrow')) {
      activeModifiers.clear();
    }

    // Send key to terminal
    sendKeyToTerminal(key, isSpecial ? 'control' : 'text');
  }

  // Send key to terminal via input store
  async function sendKeyToTerminal(key: string, type: 'control' | 'text' | 'sequence' = 'text') {
    try {
      if (type === 'control') {
        // Handle control sequences
        switch (key) {
          case 'Ctrl+C':
            await inputStore.sendControlSequence('\x03');
            break;
          case 'Ctrl+D':
            await inputStore.sendControlSequence('\x04');
            break;
          case 'Ctrl+Z':
            await inputStore.sendControlSequence('\x1a');
            break;
          case 'Ctrl+L':
            await inputStore.sendControlSequence('\x0c');
            break;
          case 'Ctrl+R':
            await inputStore.sendControlSequence('\x12');
            break;
          case 'Ctrl+W':
            await inputStore.sendControlSequence('\x17');
            break;
          case 'Ctrl+U':
            await inputStore.sendControlSequence('\x15');
            break;
          case 'Ctrl+A':
            await inputStore.sendControlSequence('\x01');
            break;
          case 'Ctrl+E':
            await inputStore.sendControlSequence('\x05');
            break;
          case 'Ctrl+K':
            await inputStore.sendControlSequence('\x0b');
            break;
          default:
            await inputStore.sendInput(key);
        }
      } else if (type === 'sequence') {
        // Handle escape sequences
        await inputStore.sendInputText(key);
      } else {
        // Handle regular text input
        await inputStore.sendInputText(key);
      }

      dispatch('key-pressed', { key, type });
    } catch (error) {
      console.error('Failed to send key to terminal:', error);
    }
  }

  // Handle paste
  function handlePasteImmediate(_e: Event) {
    console.log('[QuickKeys] Paste button touched - delegating to paste handler');
    // For now, just dispatch the paste event - parent component should handle it
    dispatch('key-pressed', { key: 'Paste', type: 'control' });
  }

  // Start key repeat for arrow keys
  function startKeyRepeat(key: string, isModifier: boolean, isSpecial: boolean) {
    // Only enable key repeat for arrow keys
    if (!key.startsWith('Arrow')) return;

    // Clear any existing repeat
    stopKeyRepeat();

    // Send first key immediately
    sendKeyToTerminal(key, isSpecial ? 'control' : 'text');

    // Start repeat after 500ms initial delay
    keyRepeatTimeout = window.setTimeout(() => {
      // Repeat every 50ms
      keyRepeatInterval = window.setInterval(() => {
        sendKeyToTerminal(key, isSpecial ? 'control' : 'text');
      }, 50);
    }, 500);
  }

  // Stop key repeat
  function stopKeyRepeat() {
    if (keyRepeatTimeout) {
      clearTimeout(keyRepeatTimeout);
      keyRepeatTimeout = null;
    }
    if (keyRepeatInterval) {
      clearInterval(keyRepeatInterval);
      keyRepeatInterval = null;
    }
  }

  // Toggle visibility
  function toggleVisibility() {
    visible = !visible;
    dispatch('visibility-changed', { visible });
  }

  // Keyboard shortcuts
  function handleGlobalKeyDown(event: KeyboardEvent) {
    // Ctrl+Shift+K to toggle quick keys
    if (event.ctrlKey && event.shiftKey && event.key === 'K') {
      event.preventDefault();
      toggleVisibility();
    }
  }

  // Lifecycle
  onMount(() => {
    // Check orientation on mount
    checkOrientation();

    // Set up orientation change listener
    orientationHandler = () => {
      checkOrientation();
    };

    window.addEventListener('resize', orientationHandler);
    window.addEventListener('orientationchange', orientationHandler);

    // Load custom keys
    loadCustomKeys();

    // Set up global keyboard shortcuts
    document.addEventListener('keydown', handleGlobalKeyDown);
  });

  onDestroy(() => {
    stopKeyRepeat();

    // Clean up orientation listener
    if (orientationHandler) {
      window.removeEventListener('resize', orientationHandler);
      window.removeEventListener('orientationchange', orientationHandler);
    }

    // Clean up global keyboard listener
    document.removeEventListener('keydown', handleGlobalKeyDown);
  });

  // Watch for custom keys changes
  $effect(() => {
    if (customKeys.length > 0) {
      // Merge with existing custom keys
      const existingIds = new Set(customQuickKeys.map(k => k.id));
      const newKeys = customKeys.filter(k => !existingIds.has(k.id));
      if (newKeys.length > 0) {
        customQuickKeys = [...customQuickKeys, ...newKeys];
        saveCustomKeys();
      }
    }
  });
</script>

<!-- Terminal Quick Keys Container -->
{#if visible}
  <div
    class="terminal-quick-keys-container fixed left-0 right-0 z-50 bg-slate-900/98 backdrop-blur-xl border-t border-slate-700/50"
    class:top-0={position === 'top'}
    class:bottom-0={position === 'bottom'}
    style="width: 100vw; max-width: 100vw;"
    role="toolbar"
    aria-label="Terminal Quick Keys"
  >
    <!-- Toggle Button -->
    <button
      type="button"
      class="absolute top-1 right-2 z-10 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded px-2 py-1 text-xs transition-colors"
      onclick={toggleVisibility}
      aria-label="Toggle quick keys visibility"
    >
      ✕
    </button>

    <!-- Custom Keys Management -->
    <div class="px-2 py-1 border-b border-slate-700/50">
      <button
        type="button"
        class="text-xs text-slate-400 hover:text-slate-200 transition-colors"
        onclick={() => isEditingCustomKeys = !isEditingCustomKeys}
        aria-label="Manage custom keys"
      >
        {isEditingCustomKeys ? '✕' : '+'} Custom Keys
      </button>

      {#if isEditingCustomKeys}
        <div class="mt-2 space-y-2">
          <!-- Add new custom key form -->
          <div class="flex gap-2">
            <input
              type="text"
              bind:value={newCustomKeyLabel}
              placeholder="Label"
              class="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-500"
            />
            <input
              type="text"
              bind:value={newCustomKeyCommand}
              placeholder="Command"
              class="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-500"
            />
            <select
              bind:value={newCustomKeyType}
              class="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200"
            >
              <option value="text">Text</option>
              <option value="control">Control</option>
              <option value="sequence">Sequence</option>
            </select>
            <button
              type="button"
              onclick={addCustomKey}
              disabled={!newCustomKeyLabel.trim() || !newCustomKeyCommand.trim()}
              class="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 text-white rounded px-2 py-1 text-xs transition-colors"
            >
              Add
            </button>
          </div>

          <!-- Existing custom keys -->
          {#if customQuickKeys.length > 0}
            <div class="space-y-1">
              {#each customQuickKeys as key (key.id)}
                <div class="flex items-center gap-2 bg-slate-800 rounded px-2 py-1">
                  <span class="text-xs text-slate-300 flex-1">{key.label}</span>
                  <span class="text-xs text-slate-500">{key.command}</span>
                  <button
                    type="button"
                    onclick={() => removeCustomKey(key.id)}
                    class="text-red-400 hover:text-red-300 text-xs"
                    aria-label="Remove custom key"
                  >
                    ✕
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Quick Keys Bar -->
    <div class="quick-keys-bar p-1">
      <!-- Row 1 -->
      <div class="flex gap-0.5 mb-0.5 overflow-x-auto">
        {#each TERMINAL_QUICK_KEYS.filter((k) => k.row === 1) as { key, label, modifier, arrow, toggle } (key)}
          <button
            type="button"
            tabindex="-1"
            class="quick-key-btn {getButtonFontClass(label)} min-w-0 {getButtonSizeClass(label)} bg-slate-700 text-slate-200 font-mono rounded border border-slate-600 hover:bg-slate-600 hover:border-slate-500 transition-all whitespace-nowrap select-none touch-manipulation {modifier ? 'modifier-key' : ''} {arrow ? 'arrow-key' : ''} {toggle ? 'toggle-key' : ''} {toggle && ((key === 'CtrlExpand' && showCtrlKeys) || (key === 'F' && showFunctionKeys)) ? 'active' : ''} {modifier && key === 'Option' && activeModifiers.has('Option') ? 'active' : ''}"
            class:active={modifier && key === 'Option' && activeModifiers.has('Option')}
            onmousedown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            ontouchstart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Start key repeat for arrow keys
              if (arrow) {
                startKeyRepeat(key, modifier || false, false);
              }
            }}
            ontouchend={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // Stop key repeat
              if (arrow) {
                stopKeyRepeat();
              } else {
                handleKeyPress(key, modifier, false, toggle, e);
              }
            }}
            ontouchcancel={(_e) => {
              // Also stop on touch cancel
              if (arrow) {
                stopKeyRepeat();
              }
            }}
            onclick={(e) => {
              if (e.detail !== 0 && !arrow) {
                handleKeyPress(key, modifier, false, toggle, e);
              }
            }}
            aria-label={label}
          >
            {label}
          </button>
        {/each}
      </div>

      <!-- Row 2 or Function Keys or Ctrl Shortcuts (with Done button always visible) -->
      {#if showCtrlKeys}
        <!-- Ctrl shortcuts row with Done button -->
        <div class="flex gap-0.5 mb-0.5 overflow-x-auto">
          {#each CTRL_SHORTCUTS as { key, label, combo, special } (key)}
            <button
              type="button"
              tabindex="-1"
              class="ctrl-shortcut-btn {getButtonFontClass(label)} min-w-0 {getButtonSizeClass(label)} bg-slate-700 text-slate-200 font-mono rounded border border-slate-600 hover:bg-slate-600 hover:border-slate-500 transition-all whitespace-nowrap select-none touch-manipulation {combo ? 'combo-key' : ''} {special ? 'special-key' : ''}"
              onmousedown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              ontouchstart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              ontouchend={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleKeyPress(key, false, special, false, e);
              }}
              onclick={(e) => {
                if (e.detail !== 0) {
                  handleKeyPress(key, false, special, false, e);
                }
              }}
              aria-label={label}
            >
              {label}
            </button>
          {/each}
          <!-- Done button -->
          <button
            type="button"
            tabindex="-1"
            class="quick-key-btn {getButtonFontClass(DONE_BUTTON.label)} min-w-0 {getButtonSizeClass(DONE_BUTTON.label)} bg-blue-600 text-white font-mono rounded border border-blue-500 hover:bg-blue-500 transition-all whitespace-nowrap select-none touch-manipulation special-key"
            onmousedown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            ontouchstart={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            ontouchend={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleKeyPress(DONE_BUTTON.key, false, DONE_BUTTON.special, false, e);
            }}
            onclick={(e) => {
              if (e.detail !== 0) {
                handleKeyPress(DONE_BUTTON.key, false, DONE_BUTTON.special, false, e);
              }
            }}
            aria-label={DONE_BUTTON.label}
          >
            {DONE_BUTTON.label}
          </button>
        </div>
      {:else if showFunctionKeys}
        <!-- Function keys row with Done button -->
        <div class="flex gap-0.5 mb-0.5 overflow-x-auto">
          {#each FUNCTION_KEYS as { key, label } (key)}
            <button
              type="button"
              tabindex="-1"
              class="func-key-btn {getButtonFontClass(label)} min-w-0 {getButtonSizeClass(label)} bg-slate-700 text-slate-200 font-mono rounded border border-slate-600 hover:bg-slate-600 hover:border-slate-500 transition-all whitespace-nowrap select-none touch-manipulation"
              onmousedown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              ontouchstart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              ontouchend={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleKeyPress(key, false, false, false, e);
              }}
              onclick={(e) => {
                if (e.detail !== 0) {
                  handleKeyPress(key, false, false, false, e);
                }
              }}
              aria-label={label}
            >
              {label}
            </button>
          {/each}
          <!-- Done button -->
          <button
            type="button"
            tabindex="-1"
            class="quick-key-btn {getButtonFontClass(DONE_BUTTON.label)} min-w-0 {getButtonSizeClass(DONE_BUTTON.label)} bg-blue-600 text-white font-mono rounded border border-blue-500 hover:bg-blue-500 transition-all whitespace-nowrap select-none touch-manipulation special-key"
            onmousedown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            ontouchstart={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            ontouchend={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleKeyPress(DONE_BUTTON.key, false, DONE_BUTTON.special, false, e);
            }}
            onclick={(e) => {
              if (e.detail !== 0) {
                handleKeyPress(DONE_BUTTON.key, false, DONE_BUTTON.special, false, e);
              }
            }}
            aria-label={DONE_BUTTON.label}
          >
            {DONE_BUTTON.label}
          </button>
        </div>
      {:else}
        <!-- Regular row 2 -->
        <div class="flex gap-0.5 mb-0.5 overflow-x-auto">
          {#each TERMINAL_QUICK_KEYS.filter((k) => k.row === 2) as { key, label, modifier, combo, toggle } (key)}
            <button
              type="button"
              tabindex="-1"
              class="quick-key-btn {getButtonFontClass(label)} min-w-0 {getButtonSizeClass(label)} bg-slate-700 text-slate-200 font-mono rounded border border-slate-600 hover:bg-slate-600 hover:border-slate-500 transition-all whitespace-nowrap select-none touch-manipulation {modifier ? 'modifier-key' : ''} {combo ? 'combo-key' : ''} {toggle ? 'toggle-key' : ''} {toggle && showFunctionKeys ? 'active' : ''}"
              onmousedown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              ontouchstart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              ontouchend={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (key === 'Paste') {
                  handlePasteImmediate(e);
                } else {
                  handleKeyPress(key, modifier || combo, false, false, e);
                }
              }}
              onclick={(e) => {
                if (e.detail !== 0) {
                  handleKeyPress(key, modifier || combo, false, false, e);
                }
              }}
              aria-label={label}
            >
              {label}
            </button>
          {/each}
          <!-- Done button (in regular row 2) -->
          <button
            type="button"
            tabindex="-1"
            class="quick-key-btn {getButtonFontClass(DONE_BUTTON.label)} min-w-0 {getButtonSizeClass(DONE_BUTTON.label)} bg-blue-600 text-white font-mono rounded border border-blue-500 hover:bg-blue-500 transition-all whitespace-nowrap select-none touch-manipulation special-key"
            onmousedown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            ontouchstart={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            ontouchend={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleKeyPress(DONE_BUTTON.key, false, DONE_BUTTON.special, false, e);
            }}
            onclick={(e) => {
              if (e.detail !== 0) {
                handleKeyPress(DONE_BUTTON.key, false, DONE_BUTTON.special, false, e);
              }
            }}
            aria-label={DONE_BUTTON.label}
          >
            {DONE_BUTTON.label}
          </button>
        </div>
      {/if}

      <!-- Row 3 - Additional special characters (always visible) -->
      <div class="flex gap-0.5 overflow-x-auto">
        {#each TERMINAL_QUICK_KEYS.filter((k) => k.row === 3) as { key, label, modifier, combo } (key)}
          <button
            type="button"
            tabindex="-1"
            class="quick-key-btn {getButtonFontClass(label)} min-w-0 {getButtonSizeClass(label)} bg-slate-700 text-slate-200 font-mono rounded border border-slate-600 hover:bg-slate-600 hover:border-slate-500 transition-all whitespace-nowrap select-none touch-manipulation {modifier ? 'modifier-key' : ''} {combo ? 'combo-key' : ''} {modifier && key === 'Option' && activeModifiers.has('Option') ? 'active' : ''}"
            class:active={modifier && key === 'Option' && activeModifiers.has('Option')}
            onmousedown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            ontouchstart={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            ontouchend={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleKeyPress(key, modifier || combo, false, false, e);
            }}
            onclick={(e) => {
              if (e.detail !== 0) {
                handleKeyPress(key, modifier || combo, false, false, e);
              }
            }}
            aria-label={label}
          >
            {label}
          </button>
        {/each}
      </div>

      <!-- Custom Keys Row -->
      {#if allCustomKeys.length > 0}
        <div class="flex gap-0.5 mt-0.5 overflow-x-auto border-t border-slate-700/50 pt-0.5">
          {#each allCustomKeys as key (key.id)}
            <button
              type="button"
              tabindex="-1"
              class="custom-key-btn {getButtonFontClass(key.label)} min-w-0 {getButtonSizeClass(key.label)} bg-green-700 text-white font-mono rounded border border-green-600 hover:bg-green-600 hover:border-green-500 transition-all whitespace-nowrap select-none touch-manipulation"
              onmousedown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              ontouchstart={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              ontouchend={(e) => {
                e.preventDefault();
                e.stopPropagation();
                sendKeyToTerminal(key.command, key.type);
              }}
              onclick={(e) => {
                if (e.detail !== 0) {
                  sendKeyToTerminal(key.command, key.type);
                }
              }}
              aria-label={key.label}
              title={key.command}
            >
              {key.label}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Hide scrollbar but keep functionality */
  .overflow-x-auto::-webkit-scrollbar {
    display: none;
  }

  .overflow-x-auto {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  /* Active modifier styling */
  .modifier-key.active {
    @apply bg-blue-600 border-blue-500 text-white;
  }

  .modifier-key.active:hover {
    @apply bg-blue-500;
  }

  /* Combo key styling */
  .combo-key {
    @apply bg-slate-600 border-slate-500;
  }

  .combo-key:hover {
    @apply bg-slate-500;
  }

  /* Special key styling */
  .special-key {
    @apply bg-blue-600 border-blue-500 text-white;
  }

  .special-key:hover {
    @apply bg-blue-500;
  }

  /* Toggle key styling */
  .toggle-key {
    @apply bg-slate-600 border-slate-500;
  }

  .toggle-key:hover {
    @apply bg-slate-500;
  }

  .toggle-key.active {
    @apply bg-blue-600 border-blue-500 text-white;
  }

  .toggle-key.active:hover {
    @apply bg-blue-500;
  }

  /* Arrow key styling */
  .arrow-key {
    @apply text-lg px-2 py-1;
  }

  /* Touch feedback */
  .quick-key-btn:active {
    @apply scale-95;
  }

  .ctrl-shortcut-btn:active,
  .func-key-btn:active,
  .custom-key-btn:active {
    @apply scale-95;
  }
</style>