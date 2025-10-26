<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Session } from '$lib/types';
  import { createLogger } from '$lib/utils/logger';

  const logger = createLogger('compact-session-card');

  // Event dispatcher for session actions
  const dispatch = createEventDispatcher<{
    'session-select': { session: Session };
    'session-stop': { sessionId: string };
    'session-delete': { sessionId: string };
  }>();

  // Props
  interface Props {
    session: Session;
    isSelected?: boolean;
    sessionType?: 'active' | 'idle' | 'exited';
    sessionNumber?: number;
    showStopButton?: boolean;
    showDeleteButton?: boolean;
  }

  let {
    session,
    isSelected = false,
    sessionType = 'active',
    sessionNumber,
    showStopButton = true,
    showDeleteButton = false
  }: Props = $props();

  // Handle session selection
  function handleSelect() {
    dispatch('session-select', { session });
  }

  // Handle stop session
  function handleStop(event: Event) {
    event.stopPropagation();
    dispatch('session-stop', { sessionId: session.id });
  }

  // Handle delete session
  function handleDelete(event: Event) {
    event.stopPropagation();
    if (confirm(`Are you sure you want to delete session "${session.name}"?`)) {
      dispatch('session-delete', { sessionId: session.id });
    }
  }

  // Get status color class
  function getStatusColor(status: string, sessionType: string): string {
    if (sessionType === 'exited') return 'text-status-error';
    if (sessionType === 'idle') return 'text-status-warning';

    switch (status) {
      case 'running':
        return 'text-status-success';
      case 'exited':
        return 'text-status-error';
      case 'starting':
        return 'text-status-info';
      default:
        return 'text-text-muted';
    }
  }

  // Get status icon
  function getStatusIcon(status: string, sessionType: string): string {
    if (sessionType === 'exited') return '■';
    if (sessionType === 'idle') return '○';

    switch (status) {
      case 'running':
        return '●';
      case 'exited':
        return '■';
      case 'starting':
        return '◐';
      default:
        return '?';
    }
  }

  // Format elapsed time (compact)
  function formatElapsedTime(startTime?: string): string {
    if (!startTime) return '';

    const start = new Date(startTime);
    const now = new Date();
    const elapsed = now.getTime() - start.getTime();

    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  }
</script>

<div
  class="compact-session-card {isSelected ? 'selected' : ''} {sessionType}"
  data-session-id={session.id}
  onclick={handleSelect}
  role="button"
  tabindex="0"
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect();
    }
  }}
>
  <!-- Left side: Status and number -->
  <div class="session-left">
    {#if sessionNumber}
      <span class="session-number">{sessionNumber}</span>
    {/if}
    <span class="status-indicator {getStatusColor(session.status, sessionType)}">
      {getStatusIcon(session.status, sessionType)}
    </span>
  </div>

  <!-- Center: Session info -->
  <div class="session-center">
    <div class="session-name" title={session.name}>
      {session.name}
    </div>
    {#if session.command}
      <div class="session-command" title={session.command}>
        {session.command.split(' ').slice(0, 3).join(' ')}
        {session.command.split(' ').length > 3 ? '...' : ''}
      </div>
    {/if}
  </div>

  <!-- Right side: Time and actions -->
  <div class="session-right">
    {#if session.createdAt}
      <div class="session-time">
        {formatElapsedTime(session.createdAt)}
      </div>
    {/if}

    <div class="session-actions">
      {#if showStopButton && session.status === 'running'}
        <button
          class="action-button stop-button"
          onclick={handleStop}
          title="Stop session"
          aria-label="Stop session {session.name}"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 10h6m-6 4h6m-6 4h6" />
          </svg>
        </button>
      {/if}
      {#if showDeleteButton}
        <button
          class="action-button delete-button"
          onclick={handleDelete}
          title="Delete session"
          aria-label="Delete session {session.name}"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      {/if}
    </div>
  </div>
</div>

<style>
  .compact-session-card {
    @apply flex items-center gap-3 p-3 bg-bg-elevated border border-border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-sm;
    min-height: 60px;
  }

  .compact-session-card:hover {
    @apply border-accent-primary/50 shadow-md;
  }

  .compact-session-card.selected {
    @apply border-accent-primary bg-accent-primary/5 shadow-lg ring-2 ring-accent-primary/20;
  }

  .compact-session-card:focus {
    @apply outline-none ring-2 ring-accent-primary/50;
  }

  .compact-session-card.idle {
    @apply opacity-75;
  }

  .compact-session-card.exited {
    @apply opacity-60;
  }

  .session-left {
    @apply flex items-center gap-2 flex-shrink-0;
  }

  .session-number {
    @apply font-mono text-xs text-text-dim bg-bg-secondary px-2 py-1 rounded;
    min-width: 24px;
    text-align: center;
  }

  .status-indicator {
    @apply font-mono text-sm;
  }

  .session-center {
    @apply flex-1 min-w-0;
  }

  .session-name {
    @apply font-medium text-text-primary truncate text-sm;
  }

  .session-command {
    @apply text-xs text-text-muted truncate mt-1;
  }

  .session-right {
    @apply flex items-center gap-2 flex-shrink-0;
  }

  .session-time {
    @apply font-mono text-xs text-text-dim;
  }

  .session-actions {
    @apply flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity;
  }

  .compact-session-card:hover .session-actions {
    @apply opacity-100;
  }

  .action-button {
    @apply p-1 rounded transition-colors hover:bg-bg-secondary;
  }

  .stop-button {
    @apply text-status-warning hover:text-status-error hover:bg-status-error/10;
  }

  .delete-button {
    @apply text-status-error hover:bg-status-error/10;
  }
</style>