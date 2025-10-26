<!--
  Direct Keyboard Store Example Component

  Demonstrates how to use the direct-keyboard store for mobile keyboard input handling.
  Shows quick keys, keyboard mode, and IME composition functionality.
-->

<script lang="ts">
  import { directKeyboardStore } from '$lib/stores/direct-keyboard';
  import { onMount } from 'svelte';

  // Mock callbacks for demonstration
  const mockCallbacks = {
    getShowMobileInput: () => false,
    getShowCtrlAlpha: () => false,
    getDisableFocusManagement: () => false,
    getVisualViewportHandler: () => () => {},
    getKeyboardHeight: () => 0,
    setKeyboardHeight: (height: number) => console.log('Keyboard height set to:', height),
    updateShowQuickKeys: (value: boolean) => console.log('Show quick keys:', value),
    toggleMobileInput: () => console.log('Toggle mobile input'),
    clearMobileInputText: () => console.log('Clear mobile input text'),
    toggleCtrlAlpha: () => console.log('Toggle ctrl alpha'),
    clearCtrlSequence: () => console.log('Clear ctrl sequence'),
  };

  // Mock input manager for demonstration
  const mockInputManager = {
    sendInputText: (text: string) => console.log('Sending input text:', text),
    sendInput: (input: string) => console.log('Sending input:', input),
    sendControlSequence: (seq: string) => console.log('Sending control sequence:', seq),
  };

  onMount(() => {
    // Set up the store with mock dependencies
    directKeyboardStore.setCallbacks(mockCallbacks);
    directKeyboardStore.setInputManager(mockInputManager);
  });

  // Reactive statements for store state
  $: showQuickKeys = $directKeyboardStore.showQuickKeys;
  $: keyboardMode = $directKeyboardStore.keyboardMode;
  $: isComposing = $directKeyboardStore.isComposing;
  $: compositionBuffer = $directKeyboardStore.compositionBuffer;
  $: keyboardHeight = $directKeyboardStore.keyboardHeight;

  // Actions
  function focusHiddenInput() {
    directKeyboardStore.focusHiddenInput();
  }

  function dismissKeyboard() {
    directKeyboardStore.dismissKeyboard();
  }

  async function handleQuickKey(key: string) {
    await directKeyboardStore.handleQuickKeyPress(key);
  }

  function showVisibleInput() {
    directKeyboardStore.showVisibleInputForKeyboard();
  }

  function cleanup() {
    directKeyboardStore.cleanup();
  }
</script>

<div class="direct-keyboard-example">
  <h3>Direct Keyboard Store Example</h3>

  <div class="controls">
    <button on:click={focusHiddenInput}>Focus Hidden Input</button>
    <button on:click={dismissKeyboard}>Dismiss Keyboard</button>
    <button on:click={showVisibleInput}>Show Visible Input</button>
    <button on:click={cleanup}>Cleanup</button>
  </div>

  <div class="status">
    <p><strong>Show Quick Keys:</strong> {showQuickKeys}</p>
    <p><strong>Keyboard Mode:</strong> {keyboardMode}</p>
    <p><strong>Is Composing:</strong> {isComposing}</p>
    <p><strong>Composition Buffer:</strong> "{compositionBuffer}"</p>
    <p><strong>Keyboard Height:</strong> {keyboardHeight}px</p>
  </div>

  {#if showQuickKeys}
    <div class="quick-keys">
      <h4>Quick Keys</h4>
      <div class="key-grid">
        <button on:click={() => handleQuickKey('Tab')}>Tab</button>
        <button on:click={() => handleQuickKey('Escape')}>Esc</button>
        <button on:click={() => handleQuickKey('Ctrl+A')}>Ctrl+A</button>
        <button on:click={() => handleQuickKey('Ctrl+C')}>Ctrl+C</button>
        <button on:click={() => handleQuickKey('Ctrl+V')}>Paste</button>
        <button on:click={() => handleQuickKey('ArrowUp')}>↑</button>
        <button on:click={() => handleQuickKey('ArrowDown')}>↓</button>
        <button on:click={() => handleQuickKey('ArrowLeft')}>←</button>
        <button on:click={() => handleQuickKey('ArrowRight')}>→</button>
        <button on:click={() => handleQuickKey('Done')}>Done</button>
      </div>
    </div>
  {/if}

  {#if keyboardMode}
    <div class="keyboard-mode-indicator">
      <p>🎹 Keyboard Mode Active - Hidden input is focused</p>
    </div>
  {/if}
</div>

<style>
  .direct-keyboard-example {
    padding: 1rem;
    border: 1px solid #ccc;
    border-radius: 8px;
    margin: 1rem 0;
  }

  .controls {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .status {
    background: #f5f5f5;
    padding: 0.5rem;
    border-radius: 4px;
    margin-bottom: 1rem;
  }

  .status p {
    margin: 0.25rem 0;
    font-family: monospace;
  }

  .quick-keys {
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 0.5rem;
    margin-bottom: 1rem;
  }

  .quick-keys h4 {
    margin: 0 0 0.5rem 0;
  }

  .key-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(60px, 1fr));
    gap: 0.25rem;
  }

  .key-grid button {
    padding: 0.25rem;
    font-size: 0.8rem;
    min-height: 32px;
  }

  .keyboard-mode-indicator {
    background: #e3f2fd;
    border: 1px solid #2196f3;
    border-radius: 4px;
    padding: 0.5rem;
    text-align: center;
    font-weight: bold;
    color: #1976d2;
  }

  button {
    padding: 0.5rem 1rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: white;
    cursor: pointer;
  }

  button:hover {
    background: #f0f0f0;
  }
</style>