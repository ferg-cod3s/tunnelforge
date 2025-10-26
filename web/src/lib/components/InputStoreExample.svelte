<!--
  Example component demonstrating usage of the input store
  This shows how to use the input store for terminal input handling
-->
<script lang="ts">
  import { inputStore } from '$lib/stores/input';
  import { onMount } from 'svelte';

  let terminalElement: HTMLElement;

  onMount(() => {
    // Set up callbacks for input handling
    inputStore.setCallbacks({
      requestUpdate: () => {
        console.log('Request update called');
      },
      getKeyboardCaptureActive: () => false,
      getTerminalElement: () => null,
    });
  });

  function handleKeyDown(event: KeyboardEvent) {
    inputStore.handleKeyDown(event);
  }

  function handlePaste(event: ClipboardEvent) {
    inputStore.handlePaste(event);
  }
</script>

<div class="input-store-example">
  <h2>Input Store Example</h2>

  <div class="controls">
    <button on:click={() => inputStore.focusTerminal()}>
      Focus Terminal
    </button>

    <button on:click={() => inputStore.blurTerminal()}>
      Blur Terminal
    </button>

    <button on:click={() => inputStore.enableIME()}>
      Enable IME
    </button>

    <button on:click={() => inputStore.disableIME()}>
      Disable IME
    </button>
  </div>

  <div class="status">
    <p>IME Enabled: {$inputStore.imeEnabled}</p>
    <p>Composing: {$inputStore.isComposing}</p>
    <p>Platform: {$inputStore.platform}</p>
  </div>

  <!-- Mock terminal element for demonstration -->
  <div
    bind:this={terminalElement}
    class="mock-terminal"
    tabindex="0"
    role="textbox"
    aria-label="Mock Terminal"
  >
    <div class="terminal-content">
      <div class="terminal-line">$ <span class="cursor">|</span></div>
    </div>
  </div>
</div>

<style>
  .input-store-example {
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

  .controls button {
    padding: 0.5rem 1rem;
    background: #007acc;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }

  .controls button:hover {
    background: #005aa3;
  }

  .status {
    margin-bottom: 1rem;
  }

  .status p {
    margin: 0.25rem 0;
    font-family: monospace;
  }

  .mock-terminal {
    width: 100%;
    height: 200px;
    background: #1e1e1e;
    color: #d4d4d4;
    font-family: 'Courier New', monospace;
    font-size: 14px;
    padding: 1rem;
    border-radius: 4px;
    overflow: auto;
    outline: none;
  }

  .mock-terminal:focus {
    border: 2px solid #007acc;
  }

  .terminal-content {
    height: 100%;
  }

  .terminal-line {
    margin: 0;
    white-space: pre;
  }

  .cursor {
    animation: blink 1s infinite;
  }

  @keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0; }
  }
</style>