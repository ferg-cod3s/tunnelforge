<!--
  Mobile Input Store Example Component

  Demonstrates how to use the mobile-input store for mobile-specific input handling.
  Shows text input overlay and mobile input management functionality.
-->

<script lang="ts">
  import { mobileInputStore } from '$lib/stores/mobile-input';
  import { onMount } from 'svelte';

  // Mock callbacks for demonstration
  const mockCallbacks = {
    toggleMobileInputDisplay: () => console.log('Toggle mobile input display'),
    shouldUseDirectKeyboard: () => false,
    focusHiddenInput: () => console.log('Focus hidden input'),
    refreshTerminalAfterMobileInput: () => console.log('Refresh terminal after mobile input'),
    getMobileInputText: () => 'mock input text',
    clearMobileInputText: () => console.log('Clear mobile input text'),
    closeMobileInput: () => console.log('Close mobile input'),
    requestUpdate: () => console.log('Request update'),
    querySelector: (selector: string) => document.querySelector(selector),
    shouldRefocusHiddenInput: () => false,
    refocusHiddenInput: () => console.log('Refocus hidden input'),
    startFocusRetention: () => console.log('Start focus retention'),
    delayedRefocusHiddenInput: () => console.log('Delayed refocus hidden input'),
  };

  // Mock input manager for demonstration
  const mockInputManager = {
    sendInputText: (text: string) => console.log('Sending input text:', text),
    sendInput: (input: string) => console.log('Sending input:', input),
    sendControlSequence: (seq: string) => console.log('Sending control sequence:', seq),
  };

  onMount(() => {
    // Set up the store with mock dependencies
    mobileInputStore.setCallbacks(mockCallbacks);
    mobileInputStore.setInputManager(mockInputManager);
  });

  // Reactive statements for store state
  $: showOverlay = $mobileInputStore.showOverlay;
  $: inputText = $mobileInputStore.inputText;
  $: isCreating = $mobileInputStore.isCreating;

  // Actions
  function toggleOverlay() {
    mobileInputStore.toggleOverlay();
  }

  function clearInput() {
    mobileInputStore.clearInputText();
  }

  function handleMobileInputToggle() {
    mobileInputStore.handleMobileInputToggle();
  }

  async function sendInput() {
    await mobileInputStore.handleMobileInputSend(inputText);
  }

  function cancelInput() {
    mobileInputStore.handleMobileInputCancel();
  }

  function setInputText(text: string) {
    mobileInputStore.setInputText(text);
  }
</script>

<div class="mobile-input-example">
  <h3>Mobile Input Store Example</h3>

  <div class="controls">
    <button on:click={toggleOverlay}>
      {showOverlay ? 'Hide' : 'Show'} Overlay
    </button>
    <button on:click={handleMobileInputToggle}>Toggle Mobile Input</button>
    {#if showOverlay}
      <button on:click={clearInput}>Clear Input</button>
    {/if}
  </div>

  <div class="status">
    <p><strong>Show Overlay:</strong> {showOverlay}</p>
    <p><strong>Input Text:</strong> "{inputText}"</p>
    <p><strong>Is Creating:</strong> {isCreating}</p>
  </div>

  {#if showOverlay}
    <div class="mobile-input-overlay">
      <div class="input-container">
        <textarea
          value={inputText}
          on:input={(e) => setInputText((e.target as HTMLTextAreaElement).value)}
          placeholder="Type your input here..."
          rows="4"
          class="mobile-textarea"
        ></textarea>

        <div class="buttons">
          <button on:click={cancelInput} class="cancel-btn">Cancel</button>
          <button on:click={sendInput} class="send-btn">Send</button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .mobile-input-example {
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

  .mobile-input-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .input-container {
    background: white;
    padding: 1rem;
    border-radius: 8px;
    width: 90%;
    max-width: 400px;
  }

  .mobile-textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-family: monospace;
    resize: vertical;
  }

  .buttons {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    margin-top: 0.5rem;
  }

  .cancel-btn {
    background: #f44336;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }

  .send-btn {
    background: #4caf50;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
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