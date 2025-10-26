<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';

  // Props interface
  interface Props {
    captureMode?: boolean;
    exitKey?: string;
  }

  // Props with defaults
  let {
    captureMode = false,
    exitKey = 'Ctrl+Shift+K'
  }: Props = $props();

  // State
  let animating = $state(false);
  let lastCapturedShortcut = $state('');
  let showDynamicTooltip = $state(false);
  let isHovered = $state(false);

  // Refs
  let animationTimeout: number | null = null;
  let tooltipTimeout: number | null = null;

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    'exit-capture': void;
  }>();

  // Platform detection
  let isMacOS = $state(false);

  onMount(() => {
    isMacOS = navigator.platform.toLowerCase().includes('mac');

    // Listen for captured shortcuts
    window.addEventListener('shortcut-captured', handleShortcutCaptured as EventListener);
  });

  onDestroy(() => {
    window.removeEventListener('shortcut-captured', handleShortcutCaptured as EventListener);
    if (animationTimeout) clearTimeout(animationTimeout);
    if (tooltipTimeout) clearTimeout(tooltipTimeout);
  });

  // Handle captured shortcut events
  function handleShortcutCaptured(event: CustomEvent) {
    const { shortcut, browserAction, terminalAction } = event.detail;
    lastCapturedShortcut = `"${shortcut}" → Terminal: ${terminalAction} (not Browser: ${browserAction})`;
    animating = true;
    showDynamicTooltip = true;

    // Clear existing timeouts
    if (animationTimeout) clearTimeout(animationTimeout);
    if (tooltipTimeout) clearTimeout(tooltipTimeout);

    // Remove animation class after animation completes
    animationTimeout = window.setTimeout(() => {
      animating = false;
    }, 400);

    // Hide dynamic tooltip after 3 seconds
    tooltipTimeout = window.setTimeout(() => {
      showDynamicTooltip = false;
    }, 3000);
  }

  // Handle exit capture
  function handleExitCapture() {
    dispatch('exit-capture');
  }

  // Get OS-specific shortcuts
  function getOSSpecificShortcuts() {
    if (isMacOS) {
      return [
        { key: 'Cmd+1...9', desc: 'Switch to session 1 to 9' },
        { key: 'Cmd+0', desc: 'Switch to session 10' },
        { key: 'Cmd+A', desc: 'Line start (not select all)' },
        { key: 'Cmd+E', desc: 'Line end' },
        { key: 'Cmd+R', desc: 'History search (not reload)' },
        { key: 'Cmd+L', desc: 'Clear screen (not address bar)' },
        { key: 'Cmd+D', desc: 'EOF/Exit (not bookmark)' },
        { key: 'Cmd+F', desc: 'Forward char (not find)' },
        { key: 'Cmd+P', desc: 'Previous cmd (not print)' },
        { key: 'Cmd+U', desc: 'Delete to start (not view source)' },
        { key: 'Cmd+K', desc: 'Delete to end (not search bar)' },
        { key: 'Option+D', desc: 'Delete word forward' },
      ];
    } else {
      return [
        { key: 'Ctrl+1...9', desc: 'Switch to session 1 to 9' },
        { key: 'Ctrl+0', desc: 'Switch to session 10' },
        { key: 'Ctrl+A', desc: 'Line start (not select all)' },
        { key: 'Ctrl+E', desc: 'Line end' },
        { key: 'Ctrl+R', desc: 'History search (not reload)' },
        { key: 'Ctrl+L', desc: 'Clear screen (not address bar)' },
        { key: 'Ctrl+D', desc: 'EOF/Exit (not bookmark)' },
        { key: 'Ctrl+F', desc: 'Forward char (not find)' },
        { key: 'Ctrl+P', desc: 'Previous cmd (not print)' },
        { key: 'Ctrl+U', desc: 'Delete to start (not view source)' },
        { key: 'Ctrl+K', desc: 'Delete to end (not search bar)' },
        { key: 'Alt+D', desc: 'Delete word forward' },
      ];
    }
  }

  // Render keyboard icon
  function renderKeyboardIcon() {
    return `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="6" width="20" height="12" rx="2"/>
        <circle cx="7" cy="10" r="1"/>
        <circle cx="12" cy="10" r="1"/>
        <circle cx="17" cy="10" r="1"/>
        <circle cx="7" cy="14" r="1"/>
        <rect x="9" y="13" width="6" height="2" rx="1"/>
        <circle cx="17" cy="14" r="1"/>
      </svg>
    `;
  }
</script>

{#if captureMode}
  <div
    class="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-2 bg-red-600 text-white px-3 py-2 rounded-lg shadow-lg border border-red-500"
    class:animating
    role="status"
    aria-live="polite"
    aria-label="Keyboard capture active"
  >
    <!-- Keyboard icon -->
    <div class="flex-shrink-0">
      {@html renderKeyboardIcon()}
    </div>

    <!-- Text -->
    <div class="text-sm font-medium">
      Keyboard Captured
    </div>

    <!-- Exit hint -->
    <div class="text-xs opacity-90">
      Press {exitKey} to exit
    </div>

    <!-- Close button -->
    <button
      onclick={handleExitCapture}
      class="ml-2 flex-shrink-0 w-5 h-5 flex items-center justify-center hover:bg-red-700 rounded transition-colors"
      aria-label="Exit keyboard capture mode"
    >
      ✕
    </button>
  </div>

  <!-- Tooltip on hover -->
  {#if isHovered}
    <div
      class="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 bg-gray-900 text-gray-100 p-3 rounded-lg shadow-xl border border-gray-700 max-w-sm w-full"
      role="tooltip"
    >
      <div class="text-sm font-medium mb-2">
        Keyboard Capture Active
      </div>
      <div class="text-xs mb-2">
        Terminal receives priority for shortcuts
      </div>
      <div class="text-xs mb-2">
        Double-tap <strong>Escape</strong> to toggle
      </div>
      <div class="text-xs">
        <div class="font-medium mb-1">Captured for terminal:</div>
        <div class="space-y-1 max-h-32 overflow-y-auto">
          {#each getOSSpecificShortcuts() as { key, desc }}
            <div class="flex justify-between text-xs">
              <span class="font-mono">{key}</span>
              <span class="text-gray-400">{desc}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .animating {
    animation: pulse 0.4s ease-in-out;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: translateX(-50%) scale(1);
    }
    50% {
      opacity: 0.8;
      transform: translateX(-50%) scale(1.05);
    }
  }
</style>