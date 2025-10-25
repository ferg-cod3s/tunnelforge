<script lang="ts">
  /**
   * Terminal.svelte - Main terminal component using xterm.js
   *
   * Migrated from: web/src/client/components/terminal.ts (Lit)
   *
   * This component handles:
   * - Terminal rendering with xterm.js
   * - WebSocket connection to Go server
   * - Keyboard input capture
   * - Terminal resizing and fitting
   */

  import { onMount, onDestroy } from 'svelte';
  import { Terminal as XTerm } from '@xterm/xterm';
  import { FitAddon } from '@xterm/addon-fit';
  import { CanvasAddon } from '@xterm/addon-canvas';
  import '@xterm/xterm/css/xterm.css';

  // Props
  interface Props {
    sessionId: string;
    readonly?: boolean;
  }

  let { sessionId, readonly = false }: Props = $props();

  // State
  let container: HTMLDivElement;
  let terminal: XTerm | null = $state(null);
  let ws: WebSocket | null = $state(null);
  let connected: boolean = $state(false);
  let fitAddon: FitAddon | null = null;
  let canvasAddon: CanvasAddon | null = null;

  // Derived state
  const status = $derived(connected ? 'connected' : 'connecting');

  // Terminal initialization
  onMount(() => {
    initializeTerminal();
    connectWebSocket();

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitTerminal();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  });

  // Cleanup
  onDestroy(() => {
    cleanup();
  });

  function initializeTerminal() {
    terminal = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: 'rgb(var(--color-primary))',
      },
      allowProposedApi: true,
    });

    // Add addons
    fitAddon = new FitAddon();
    canvasAddon = new CanvasAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(canvasAddon);

    // Open terminal in container
    terminal.open(container);

    // Fit terminal to container
    fitTerminal();

    // Handle user input
    if (!readonly) {
      terminal.onData((data) => {
        sendInput(data);
      });
    }
  }

  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host || 'localhost:4021';
    const wsUrl = `${protocol}//${host}/ws?sessionId=${sessionId}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      connected = true;
      console.log('[Terminal] WebSocket connected');
    };

    ws.onmessage = (event) => {
      if (terminal && event.data) {
        terminal.write(event.data);
      }
    };

    ws.onerror = (error) => {
      console.error('[Terminal] WebSocket error:', error);
      connected = false;
    };

    ws.onclose = () => {
      console.log('[Terminal] WebSocket closed');
      connected = false;

      // Attempt reconnection after 2 seconds
      setTimeout(() => {
        if (!ws || ws.readyState === WebSocket.CLOSED) {
          connectWebSocket();
        }
      }, 2000);
    };
  }

  function sendInput(data: string) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'input',
        data,
      }));
    }
  }

  function fitTerminal() {
    if (fitAddon && terminal) {
      try {
        fitAddon.fit();

        // Send resize to server
        const dims = fitAddon.proposeDimensions();
        if (dims && ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'resize',
            cols: dims.cols,
            rows: dims.rows,
          }));
        }
      } catch (error) {
        console.error('[Terminal] Fit error:', error);
      }
    }
  }

  function cleanup() {
    if (ws) {
      ws.close();
      ws = null;
    }

    if (terminal) {
      terminal.dispose();
      terminal = null;
    }

    fitAddon = null;
    canvasAddon = null;
  }

  // Export methods for parent component
  export function focus() {
    terminal?.focus();
  }

  export function clear() {
    terminal?.clear();
  }

  export function resize(cols: number, rows: number) {
    terminal?.resize(cols, rows);
  }
</script>

<div class="terminal-wrapper" class:connected class:readonly>
  <div class="terminal-container" bind:this={container}></div>

  {#if !connected}
    <div class="terminal-overlay">
      <div class="connecting-message">
        Connecting to session {sessionId}...
      </div>
    </div>
  {/if}
</div>

<style>
  .terminal-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    background: #1e1e1e;
  }

  .terminal-container {
    width: 100%;
    height: 100%;
  }

  .terminal-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.8);
    z-index: 10;
  }

  .connecting-message {
    color: #fff;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
  }

  .readonly {
    opacity: 0.8;
    pointer-events: none;
  }

  .connected .terminal-overlay {
    display: none;
  }
</style>
