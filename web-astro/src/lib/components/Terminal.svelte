<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Terminal as XtermTerminal } from '@xterm/xterm';
  import { FitAddon } from '@xterm/addon-fit';

  import { TERMINAL_IDS, TERMINAL_FONT_FAMILY } from '$lib/utils/terminal-constants';
  import { TERMINAL_THEMES, type TerminalThemeId } from '$lib/utils/terminal-themes';
  import { getCurrentTheme } from '$lib/utils/theme-utils';
  import { processLinks } from '$lib/utils/url-highlighter';
  import { processKeyboardShortcuts } from '$lib/utils/keyboard-shortcut-highlighter';

  // Props
  interface Props {
    sessionId?: string;
    sessionStatus?: string;
    cols?: number;
    rows?: number;
    fontSize?: number;
    theme?: TerminalThemeId;
  }

  let {
    sessionId = '',
    sessionStatus = 'running',
    cols = 80,
    rows = 24,
    fontSize = 14,
    theme = 'auto' as TerminalThemeId,
  }: Props = $props();

  // State
  let terminal: XtermTerminal | null = null;
  let container: HTMLElement | null = null;
  let fitAddon: FitAddon | null = null;
  let websocket: WebSocket | null = null;

  // Simple terminal API
  function write(data: string) {
    if (terminal) {
      terminal.write(data);
    }
  }

  function clear() {
    if (terminal) {
      terminal.clear();
    }
  }

  function getTerminalSize(): { cols: number; rows: number } {
    return { cols, rows };
  }

  // WebSocket connection
  function connectWebSocket() {
    if (!sessionId) {
      console.warn('No sessionId provided, skipping WebSocket connection');
      return;
    }

    try {
      // Connect to the Go server WebSocket endpoint
      const wsUrl = `ws://localhost:4021/ws/terminal/${sessionId}`;
      websocket = new WebSocket(wsUrl);

      websocket.onopen = () => {
        console.log('Terminal WebSocket connected');
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'output' && data.data) {
            write(data.data);
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      websocket.onclose = () => {
        console.log('Terminal WebSocket disconnected');
        websocket = null;
      };

      websocket.onerror = (error) => {
        console.error('Terminal WebSocket error:', error);
      };

      // Handle terminal input
      if (terminal) {
        terminal.onData((data) => {
          if (websocket && websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({
              type: 'input',
              data: data
            }));
          }
        });

        // Process URLs and keyboard shortcuts when content changes
        terminal.onLineFeed(() => {
          // Small delay to ensure DOM is updated
          setTimeout(() => {
            if (container) {
              processLinks(container);
              processKeyboardShortcuts(container, (keySequence) => {
                // Send keyboard shortcut as input
                if (websocket && websocket.readyState === WebSocket.OPEN) {
                  websocket.send(JSON.stringify({
                    type: 'input',
                    data: keySequence
                  }));
                }
              });
            }
          }, 10);
        });

        // Add touch scrolling support for mobile
        if (container) {
          let touchStartY = 0;
          let touchStartX = 0;

          container.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
            touchStartX = e.touches[0].clientX;
          }, { passive: true });

          container.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
              const touch = e.touches[0];
              const deltaY = touchStartY - touch.clientY;
              const deltaX = touchStartX - touch.clientX;

              // If vertical scroll is more significant, handle it
              if (Math.abs(deltaY) > Math.abs(deltaX)) {
                // Let the browser handle natural scrolling
                return;
              }
            }
          }, { passive: true });
        }
      }
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }

  // Expose public API
  let terminalAPI = $derived({
    write,
    clear,
    getTerminalSize,
  });

  // Lifecycle
  onMount(async () => {
    try {
      // Create terminal
      terminal = new XtermTerminal({
        cols,
        rows,
        fontSize,
        fontFamily: TERMINAL_FONT_FAMILY,
        theme: getTerminalTheme(),
        cursorBlink: true,
      });

      // Load fit addon
      fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);

      // Find container and open terminal
      container = document.querySelector(`#${TERMINAL_IDS.TERMINAL_CONTAINER}`) as HTMLElement;
      if (container) {
        terminal.open(container);
        fitAddon.fit();
      }

      // Register this component globally for testing
      if (typeof window !== 'undefined' && (window as any).registerTerminal) {
        (window as any).registerTerminal({ getTerminalAPI });
      }

      // Connect to WebSocket for real-time I/O
      connectWebSocket();
    } catch (error) {
      console.error('Failed to initialize terminal:', error);
    }
  });

  onDestroy(() => {
    if (websocket) {
      websocket.close();
      websocket = null;
    }
    if (terminal) {
      terminal.dispose();
      terminal = null;
    }
  });

  function getTerminalTheme(): Record<string, string> {
    let themeId = theme;

    if (themeId === 'auto') {
      themeId = getCurrentTheme();
    }

    const preset = TERMINAL_THEMES.find((t) => t.id === themeId) || TERMINAL_THEMES[0];
    return { ...preset.colors };
  }

  // Effects for prop changes
  $effect(() => {
    if (terminal && theme) {
      terminal.options.theme = getTerminalTheme();
    }
  });

  $effect(() => {
    if (terminal && (cols || rows)) {
      terminal.resize(cols, rows);
    }
  });

  $effect(() => {
    if (terminal && fontSize) {
      terminal.options.fontSize = fontSize;
    }
  });

  // Expose the terminal API to parent components
  export function getTerminalAPI() {
    return terminalAPI;
  }
</script>

<div class="relative w-full h-full p-0 m-0">
  <div
    id="{TERMINAL_IDS.TERMINAL_CONTAINER}"
    class="terminal-container w-full h-full overflow-hidden p-0 m-0"
    class:font-size={`${fontSize}px`}
    class:line-height={`${fontSize * 1.2}px`}
    tabindex="0"
    contenteditable="false"
    style="background-color: {getTerminalTheme().background || 'var(--terminal-background, #0a0a0a)'}; color: {getTerminalTheme().foreground || 'var(--terminal-foreground, #e4e4e4)'}; touch-action: none !important;"
  ></div>
</div>

<style>
  /* Dynamic terminal sizing */
  .terminal-container {
    font-family: ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace;
  }

  .terminal-line {
    white-space: pre;
    font-variant-ligatures: none;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .terminal-char {
    display: inline-block;
    vertical-align: top;
  }

  .terminal-char.cursor {
    position: relative;
  }

  .terminal-char.cursor::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgb(var(--color-primary));
    animation: blink 1s infinite;
    opacity: 0.8;
  }

  @keyframes blink {
    0%, 50% { opacity: 0.8; }
    51%, 100% { opacity: 0; }
  }

  .terminal-char.bold {
    font-weight: bold;
  }

  .terminal-char.italic {
    font-style: italic;
  }

  .terminal-char.underline {
    text-decoration: underline;
  }

  .terminal-char.dim {
    opacity: 0.6;
  }

  .terminal-char.strikethrough {
    text-decoration: line-through;
  }

  .terminal-char.overline {
    text-decoration: overline;
  }

  .scroll-to-bottom {
    position: absolute;
    bottom: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 20px;
    z-index: 10;
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .scroll-to-bottom:hover {
    background: rgba(0, 0, 0, 0.9);
  }

  .debug-overlay {
    position: absolute;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px;
    border-radius: 4px;
    font-size: 12px;
    font-family: monospace;
    z-index: 10;
  }

  .metric {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .metric-label {
    opacity: 0.7;
  }

  .metric-value {
    font-weight: bold;
  }

  /* Terminal link styles */
  .terminal-link {
    color: #4fc3f7 !important;
    text-decoration: underline !important;
    cursor: pointer !important;
  }

  .terminal-link:hover {
    background-color: rgba(79, 195, 247, 0.2) !important;
  }

  /* Terminal shortcut styles */
  .terminal-shortcut {
    color: #9ca3af !important;
    text-decoration: underline !important;
    text-decoration-style: dotted !important;
    cursor: pointer !important;
    font-weight: 500 !important;
  }

  .terminal-shortcut:hover {
    background-color: rgba(156, 163, 175, 0.2) !important;
    color: #d1d5db !important;
  }
</style>