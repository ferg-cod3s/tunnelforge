<script lang="ts">
  import { createConnectionStore, type ConnectionState } from '$lib/stores/connection';
  import type { Session } from '$lib/types';

  let { session, terminal }: { session: Session; terminal: any } = $props();

  let connectionStore = createConnectionStore(
    handleSessionExit,
    handleSessionUpdate,
    terminal
  );

  let connectionState: ConnectionState = $state({ status: 'disconnected', error: null, lastMessage: null });

  // Subscribe to connection state changes
  $effect(() => {
    const unsubscribe = connectionStore.subscribe((state) => {
      connectionState = state;
    });

    return unsubscribe;
  });

  function handleSessionExit(sessionId: string) {
    console.log('Session exited:', sessionId);
    // Handle session exit - maybe navigate away or show message
  }

  function handleSessionUpdate(updatedSession: Session) {
    console.log('Session updated:', updatedSession);
    // Handle session updates - maybe update UI state
  }

  function handleConnect() {
    connectionStore.connect(session.id);
  }

  function handleDisconnect() {
    connectionStore.disconnect();
  }

  function handleSendInput() {
    connectionStore.sendInput('echo "Hello from Svelte!"\n');
  }

  function handleResize() {
    connectionStore.sendResize(80, 24);
  }

  // Auto-connect when component mounts
  $effect(() => {
    handleConnect();
  });
</script>

<div class="connection-example">
  <h3>Connection Status: {connectionState.status}</h3>

  {#if connectionState.error}
    <p class="error">Error: {connectionState.error}</p>
  {/if}

  {#if connectionState.lastMessage}
    <p class="last-message">
      Last message: {connectionState.lastMessage!.toLocaleTimeString()}
    </p>
  {/if}

  <div class="controls">
    <button onclick={handleConnect} disabled={connectionState.status === 'connecting' || connectionState.status === 'connected'}>
      Connect
    </button>

    <button onclick={handleDisconnect} disabled={connectionState.status === 'disconnected'}>
      Disconnect
    </button>

    <button onclick={handleSendInput} disabled={connectionState.status !== 'connected'}>
      Send Test Input
    </button>

    <button onclick={handleResize} disabled={connectionState.status !== 'connected'}>
      Resize (80x24)
    </button>
  </div>
</div>

<style>
  .connection-example {
    padding: 1rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    margin: 1rem 0;
  }

  .error {
    color: red;
  }

  .last-message {
    color: green;
  }

  .controls {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  button {
    padding: 0.5rem 1rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: white;
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    background: #f0f0f0;
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>