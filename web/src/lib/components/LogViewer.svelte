<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { authToken } from '$lib/stores/auth';
  import { createLogger } from '$lib/utils/logger';
  import TerminalIcon from './TerminalIcon.svelte';

  const logger = createLogger('log-viewer');

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    'navigate-back': void;
    error: { detail: string };
  }>();

  // Props interface
  interface Props {
    showBackButton?: boolean;
  }

  let { showBackButton = true }: Props = $props();

  // Log entry interface
  interface LogEntry {
    timestamp: string;
    level: string;
    module: string;
    message: string;
    isClient: boolean;
  }

  // Auth client for API calls
  const authClient = {
    getAuthHeader: () => ({
      'Authorization': `Bearer ${$authToken}`,
      'Content-Type': 'application/json'
    })
  };

  // Reactive state using Svelte 5 runes
  let logs = $state<LogEntry[]>([]);
  let loading = $state(true);
  let filter = $state('');
  let levelFilter = $state<Set<string>>(new Set(['error', 'warn', 'log', 'debug']));
  let autoScroll = $state(true);
  let logSize = $state('');
  let showClient = $state(true);
  let showServer = $state(true);

  // DOM references
  let logContainer: HTMLElement | null = null;
  let refreshInterval: number | null = null;
  let isFirstLoad = $state(true);

  // Function to get filtered logs
  function getFilteredLogs(): LogEntry[] {
    return logs.filter((log) => {
      // Filter by level
      if (!levelFilter.has(log.level)) {
        return false;
      }

      // Filter by client/server
      if (!showClient && log.isClient) {
        return false;
      }
      if (!showServer && !log.isClient) {
        return false;
      }

      // Filter by search term
      if (filter) {
        const searchTerm = filter.toLowerCase();
        return (
          log.module.toLowerCase().includes(searchTerm) ||
          log.message.toLowerCase().includes(searchTerm)
        );
      }

      return true;
    });
  }

  // Levels for filtering
  const levels = ['error', 'warn', 'log', 'debug'] as const;

  // Event handlers
  function handleBack() {
    dispatch('navigate-back');
  }

  function toggleLevel(level: string): void {
    if (levelFilter.has(level)) {
      levelFilter.delete(level);
    } else {
      levelFilter.add(level);
    }
    levelFilter = new Set(levelFilter); // Trigger reactivity
  }

  async function clearLogs(): Promise<void> {
    if (!confirm('Are you sure you want to clear all logs?')) {
      return;
    }

    try {
      const response = await fetch('/api/logs/clear', {
        method: 'DELETE',
        headers: { ...authClient.getAuthHeader() },
      });
      if (!response.ok) {
        throw new Error('Failed to clear logs');
      }
      logs = [];
      logSize = '0 Bytes';
    } catch (err) {
      logger.error('Failed to clear logs:', err);
      dispatch('error', { detail: 'Failed to clear logs' });
    }
  }

  async function downloadLogs(): Promise<void> {
    try {
      const response = await fetch('/api/logs/raw', {
        headers: { ...authClient.getAuthHeader() },
      });
      if (!response.ok) {
        throw new Error('Failed to download logs');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tunnelforge-logs-${new Date().toISOString().split('T')[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      logger.error('Failed to download logs:', err);
      dispatch('error', { detail: 'Failed to download logs' });
    }
  }

  function formatRelativeTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);

    if (diffSec < 60) {
      return `${diffSec}s ago`;
    } else if (diffMin < 60) {
      return `${diffMin}m ago`;
    } else if (diffHour < 24) {
      return `${diffHour}h ago`;
    } else {
      // For older logs, show HH:MM:SS
      return date.toLocaleTimeString('en-US', { hour12: false });
    }
  }

  function parseLogs(text: string): void {
    const lines = text.split('\n');
    const parsedLogs: LogEntry[] = [];
    let currentLog: LogEntry | null = null;

    for (const line of lines) {
      if (!line.trim()) continue;

      // Try to parse as a new log entry
      const match = line.match(/^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+(.*)$/);
      if (match) {
        // If we have a current log, push it before starting a new one
        if (currentLog) {
          parsedLogs.push(currentLog);
        }

        const [, timestamp, level, module, message] = match;
        const isClient = module.startsWith('CLIENT:');
        currentLog = {
          timestamp,
          level: level.trim().toLowerCase(),
          module: isClient ? module.substring(7) : module, // Remove CLIENT: prefix
          message,
          isClient,
        };
      } else if (currentLog) {
        // This is a continuation line - append to the current log's message
        currentLog.message += `\n${line}`;
      } else {
        // Unparseable line with no current log - create a new entry
        parsedLogs.push({
          timestamp: '',
          level: 'log',
          module: 'unknown',
          message: line,
          isClient: false,
        });
      }
    }

    // Don't forget the last log
    if (currentLog) {
      parsedLogs.push(currentLog);
    }

    logs = parsedLogs;
  }

  async function loadLogs(): Promise<void> {
    try {
      // Get log info
      const infoResponse = await fetch('/api/logs/info', {
        headers: { ...authClient.getAuthHeader() },
      });
      if (infoResponse.ok) {
        const info = await infoResponse.json();
        logSize = info.sizeHuman || '';
      }

      // Get raw logs
      const response = await fetch('/api/logs/raw', {
        headers: { ...authClient.getAuthHeader() },
      });
      if (!response.ok) {
        throw new Error('Failed to load logs');
      }

      const text = await response.text();
      parseLogs(text);
      loading = false;

      // Auto-scroll to bottom if enabled and user is near bottom (or first load)
      if (autoScroll) {
        requestAnimationFrame(() => {
          if (logContainer) {
            if (isFirstLoad) {
              // Always scroll to bottom on first load
              logContainer.scrollTop = logContainer.scrollHeight;
              isFirstLoad = false;
            } else {
              // Only scroll if we're within 100px of the bottom
              const isNearBottom =
                logContainer.scrollHeight - logContainer.scrollTop - logContainer.clientHeight < 100;
              if (isNearBottom) {
                logContainer.scrollTop = logContainer.scrollHeight;
              }
            }
          }
        });
      }
    } catch (err) {
      logger.error('Failed to load logs:', err);
      loading = false;
      dispatch('error', { detail: 'Failed to load logs' });
    }
  }

  // Lifecycle
  onMount(() => {
    loadLogs();
    // Refresh logs every 2 seconds
    refreshInterval = window.setInterval(() => loadLogs(), 2000);
  });

  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });


</script>

<!-- Custom scrollbar styles -->
<style>
  .log-container {
    /* Hide scrollbar by default */
    scrollbar-width: none; /* Firefox */
  }

  .log-container::-webkit-scrollbar {
    width: 8px;
    background: transparent;
  }

  .log-container::-webkit-scrollbar-track {
    background: transparent;
  }

  .log-container::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 4px;
  }

  /* Show scrollbar on hover */
  .log-container:hover::-webkit-scrollbar-thumb {
    background: rgb(var(--color-text-bright) / 0.2);
  }

  .log-container::-webkit-scrollbar-thumb:hover {
    background: rgb(var(--color-text-bright) / 0.3);
  }

  /* Firefox */
  .log-container:hover {
    scrollbar-width: thin;
    scrollbar-color: rgb(var(--color-text-bright) / 0.2) transparent;
  }
</style>

<div class="flex flex-col h-full bg-bg text-primary font-mono">
  <!-- Header - single row on desktop, two rows on mobile -->
  <div class="bg-bg-secondary border-b border-border/50 p-3 sm:p-4">
    <!-- Mobile layout (two rows) -->
    <div class="sm:hidden">
      <!-- Top row with back button and title -->
      <div class="flex items-center gap-2 mb-3">
        {#if showBackButton}
          <!-- Back button -->
          <button
            class="p-2 bg-bg border border-border/50 rounded text-sm text-primary hover:border-primary hover:text-primary transition-colors flex items-center gap-1 flex-shrink-0"
            onclick={handleBack}
            aria-label="Go back"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        {/if}

        <h1
          class="text-base font-bold text-primary flex items-center gap-2 flex-shrink-0"
        >
          <TerminalIcon size={20} />
          <span>System Logs</span>
        </h1>

        <!-- Auto-scroll toggle (mobile position) -->
        <div class="ml-auto">
          <button
            class="p-2 text-xs uppercase font-bold rounded transition-colors {autoScroll
              ? 'bg-primary text-bg'
              : 'bg-bg-tertiary text-text-muted border border-border/50'}"
            onclick={() => autoScroll = !autoScroll}
            title="Auto Scroll"
            aria-label="Toggle auto scroll"
            aria-pressed={autoScroll}
            tabindex={0}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Filters row -->
      <div class="flex flex-wrap gap-2">
        <!-- Search input -->
        <input
          type="text"
          class="px-3 py-1.5 bg-bg border border-border/50 rounded text-sm text-primary placeholder-text-muted focus:outline-none focus:border-primary transition-colors w-full"
          placeholder="Filter logs..."
          bind:value={filter}
          aria-label="Filter logs"
        />

        <!-- Filters container -->
        <div class="flex gap-2 items-center">
          <!-- Level filters -->
          <div class="flex gap-1">
            {#each levels as level}
              <button
                class="px-1.5 py-1 text-xs uppercase font-bold rounded transition-colors {levelFilter.has(level)
                  ? level === 'error'
                    ? 'bg-status-error/20 text-status-error border border-status-error'
                    : level === 'warn'
                      ? 'bg-status-warning/20 text-status-warning border border-status-warning'
                      : level === 'debug'
                        ? 'bg-bg-tertiary text-text-muted border border-border'
                        : 'bg-primary/20 text-primary border border-primary'
                  : 'bg-bg-tertiary text-text-muted border border-border'}"
                onclick={() => toggleLevel(level)}
                title="{level} logs"
                aria-label="Filter {level} logs"
                aria-pressed={levelFilter.has(level)}
              >
                {level === 'error'
                  ? 'ERR'
                  : level === 'warn'
                    ? 'WRN'
                    : level === 'debug'
                      ? 'DBG'
                      : 'LOG'}
              </button>
            {/each}
          </div>

          <!-- Client/Server toggles -->
          <div class="flex gap-1">
            <button
              class="px-1.5 py-1 text-xs uppercase font-bold rounded transition-colors {showClient
                ? 'bg-status-warning/20 text-status-warning border border-status-warning'
                : 'bg-bg-tertiary text-text-muted border border-border'}"
              onclick={() => showClient = !showClient}
              title="Client logs"
              aria-label="Show client logs"
              aria-pressed={showClient}
            >
              C
            </button>
            <button
              class="px-1.5 py-1 text-xs uppercase font-bold rounded transition-colors {showServer
                ? 'bg-primary/20 text-primary border border-primary'
                : 'bg-bg-tertiary text-text-muted border border-border'}"
              onclick={() => showServer = !showServer}
              title="Server logs"
              aria-label="Show server logs"
              aria-pressed={showServer}
            >
              S
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Desktop layout (single row) -->
    <div class="hidden sm:flex items-center gap-3">
      {#if showBackButton}
        <!-- Back button -->
        <button
          class="px-3 py-1.5 bg-bg border border-border rounded text-sm text-primary hover:border-primary hover:text-primary transition-colors flex items-center gap-2 flex-shrink-0"
          onclick={handleBack}
          aria-label="Go back"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back
        </button>
      {/if}

      <h1 class="text-lg font-bold text-primary flex items-center gap-2 flex-shrink-0">
        <TerminalIcon size={24} />
        <span>System Logs</span>
      </h1>

      <div class="flex-1 flex flex-wrap gap-2 items-center justify-end">
        <!-- Search input -->
        <input
          type="text"
          class="px-3 py-1.5 bg-bg border border-border rounded text-sm text-primary placeholder-text-muted focus:outline-none focus:border-primary transition-colors flex-1 sm:flex-initial sm:w-64 md:w-80"
          placeholder="Filter logs..."
          bind:value={filter}
          aria-label="Filter logs"
        />

        <!-- Level filters -->
        <div class="flex gap-1">
          {#each levels as level}
            <button
              class="px-2 py-1 text-xs uppercase font-bold rounded transition-colors {levelFilter.has(level)
                ? level === 'error'
                  ? 'bg-status-error/20 text-status-error border border-status-error'
                  : level === 'warn'
                    ? 'bg-status-warning/20 text-status-warning border border-status-warning'
                    : level === 'debug'
                      ? 'bg-bg-tertiary text-text-muted border border-border'
                      : 'bg-primary/20 text-primary border border-primary'
                : 'bg-bg-tertiary text-text-muted border border-border'}"
              onclick={() => toggleLevel(level)}
              aria-label="Filter {level} logs"
              aria-pressed={levelFilter.has(level)}
            >
              {level}
            </button>
          {/each}
        </div>

        <!-- Client/Server toggles -->
        <div class="flex gap-1">
          <button
            class="px-2 py-1 text-xs uppercase font-bold rounded transition-colors {showClient
              ? 'bg-status-warning/20 text-status-warning border border-status-warning'
              : 'bg-bg-tertiary text-text-muted border border-border'}"
            onclick={() => showClient = !showClient}
            aria-label="Show client logs"
            aria-pressed={showClient}
          >
            CLIENT
          </button>
          <button
            class="px-2 py-1 text-xs uppercase font-bold rounded transition-colors {showServer
              ? 'bg-primary/20 text-primary border border-primary'
              : 'bg-bg-tertiary text-text-muted border border-border'}"
            onclick={() => showServer = !showServer}
            aria-label="Show server logs"
            aria-pressed={showServer}
          >
            SERVER
          </button>
        </div>

        <!-- Auto-scroll toggle -->
        <button
          class="px-3 py-1 text-xs uppercase font-bold rounded transition-colors {autoScroll
            ? 'bg-primary/20 text-primary border border-primary'
            : 'bg-bg-tertiary text-text-muted border border-border'}"
          onclick={() => autoScroll = !autoScroll}
          aria-label="Toggle auto scroll"
          aria-pressed={autoScroll}
        >
          AUTO SCROLL
        </button>
      </div>
    </div>
  </div>

  <!-- Log container -->
  <div
    bind:this={logContainer}
    class="log-container flex-1 overflow-y-auto p-4 bg-bg font-mono text-xs leading-relaxed"
    role="log"
    aria-live="polite"
    aria-label="System logs"
  >
    {#if loading}
      <div class="flex items-center justify-center h-full text-center">
        <div class="text-center">
          <div
            class="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4 mx-auto"
          ></div>
          <div>Loading logs...</div>
        </div>
      </div>
    {:else if getFilteredLogs().length === 0}
      <div class="flex items-center justify-center h-full text-text-muted">
        <div class="text-center">
          <div>No logs to display</div>
        </div>
      </div>
    {:else}
      {#each getFilteredLogs() as log (log.timestamp)}
        {@const isMultiline = log.message.includes('\n')}
        {@const messageLines = log.message.split('\n')}

        <div
          class="group hover:bg-bg-secondary/50 transition-colors rounded {log.isClient ? 'bg-status-warning/5 pl-2' : 'pl-2'}"
        >
          <!-- Desktop layout (hidden on mobile) -->
          <div class="hidden sm:flex items-start gap-2 py-0.5">
            <!-- Timestamp -->
            <span class="text-text-muted w-16 flex-shrink-0 opacity-50"
              >{formatRelativeTime(log.timestamp)}</span
            >

            <!-- Level -->
            <span
              class="w-10 text-center font-mono uppercase tracking-wider flex-shrink-0 {log.level === 'error'
                ? 'text-status-error bg-status-error/20 px-1 rounded font-bold'
                : log.level === 'warn'
                  ? 'text-status-warning bg-status-warning/20 px-1 rounded font-bold'
                  : log.level === 'debug'
                    ? 'text-text-muted'
                    : 'text-primary'}"
            >
              {log.level === 'error'
                ? 'ERR'
                : log.level === 'warn'
                  ? 'WRN'
                  : log.level === 'debug'
                    ? 'DBG'
                    : 'LOG'}
            </span>

            <!-- Source indicator -->
            <span
              class="flex-shrink-0 {log.isClient ? 'text-status-warning font-bold' : 'text-primary'}"
              >{log.isClient ? '◆ C' : '▸ S'}</span
            >

            <!-- Module -->
            <span class="text-text-muted flex-shrink-0 font-mono">{log.module}</span>

            <!-- Separator -->
            <span class="text-text-muted flex-shrink-0">│</span>

            <!-- Message -->
            <span
              class="flex-1 {log.level === 'error'
                ? 'text-status-error'
                : log.level === 'warn'
                  ? 'text-status-warning'
                  : log.level === 'debug'
                    ? 'text-text-muted'
                    : log.isClient
                      ? 'text-status-warning opacity-80'
                      : 'text-primary'}"
              >{messageLines[0]}</span
            >
          </div>

          <!-- Mobile layout (visible only on mobile) -->
          <div class="sm:hidden py-1">
            <div class="flex items-center gap-2 text-xs">
              <span class="text-text-muted opacity-50"
                >{formatRelativeTime(log.timestamp)}</span
              >
              <span
                class="{log.level === 'error'
                  ? 'text-status-error font-bold'
                  : log.level === 'warn'
                    ? 'text-status-warning font-bold'
                    : log.level === 'debug'
                      ? 'text-text-muted'
                      : 'text-primary'} uppercase"
                >{log.level}</span
              >
              <span class="{log.isClient ? 'text-status-warning' : 'text-primary'}"
                >{log.isClient ? '[C]' : '[S]'}</span
              >
              <span class="text-text-muted">{log.module}</span>
            </div>
            <div
              class="mt-1 {log.level === 'error'
                ? 'text-status-error'
                : log.level === 'warn'
                  ? 'text-status-warning'
                  : log.level === 'debug'
                    ? 'text-text-muted'
                    : log.isClient
                      ? 'text-status-warning opacity-80'
                      : 'text-primary'}"
            >
              {messageLines[0]}
            </div>
          </div>
          {#if isMultiline}
            <div
              class="hidden sm:block ml-36 {log.level === 'error'
                ? 'text-status-error'
                : log.level === 'warn'
                  ? 'text-status-warning'
                  : 'text-text-muted'}"
            >
              {#each messageLines.slice(1) as line}
                <div class="py-0.5">{line}</div>
              {/each}
            </div>
            <div
              class="sm:hidden mt-1 {log.level === 'error'
                ? 'text-status-error'
                : log.level === 'warn'
                  ? 'text-status-warning'
                  : 'text-text-muted'}"
            >
              {#each messageLines.slice(1) as line}
                <div class="py-0.5">{line}</div>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  <!-- Footer -->
  <div
    class="flex items-center justify-between p-3 bg-bg-secondary border-t border-border text-xs"
  >
    <div class="text-text-muted">
      {getFilteredLogs().length} / {logs.length} logs
      {#if logSize}
        <span class="text-text-muted">• {logSize}</span>
      {/if}
    </div>
    <div class="flex gap-2">
      <button
        class="px-3 py-1 bg-bg border border-border rounded hover:border-primary hover:text-primary transition-colors"
        onclick={downloadLogs}
        aria-label="Download logs"
      >
        Download
      </button>
      <button
        class="px-3 py-1 bg-bg border border-status-error text-status-error rounded hover:bg-status-error hover:text-text-bright transition-colors"
        onclick={clearLogs}
        aria-label="Clear all logs"
      >
        Clear
      </button>
    </div>
  </div>
</div>