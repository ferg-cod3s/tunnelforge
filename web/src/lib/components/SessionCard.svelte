<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Session } from '$lib/types';
  import { createLogger } from '$lib/utils/logger';

  const logger = createLogger('session-card');

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
    showStopButton?: boolean;
    showDeleteButton?: boolean;
  }

  let {
    session,
    isSelected = false,
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
  function getStatusColor(status: string): string {
    switch (status) {
      case 'running':
        return session.activityStatus?.isActive !== false ? 'text-status-success' : 'text-status-warning';
      case 'exited':
        return 'text-status-error';
      case 'starting':
        return 'text-status-info';
      default:
        return 'text-text-muted';
    }
  }

  // Get status icon
  function getStatusIcon(status: string): string {
    switch (status) {
      case 'running':
        return session.activityStatus?.isActive !== false ? '●' : '○';
      case 'exited':
        return '■';
      case 'starting':
        return '◐';
      default:
        return '?';
    }
  }

  // Format elapsed time
  function formatElapsedTime(startTime?: string): string {
    if (!startTime) return '';

    const start = new Date(startTime);
    const now = new Date();
    const elapsed = now.getTime() - start.getTime();

    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
</script>

<div
  class="session-card {isSelected ? 'selected' : ''}"
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
  <!-- Header -->
  <div class="session-card-header">
    <div class="session-name" title={session.name}>
      {session.name}
    </div>
    <div class="session-actions">
      {#if showStopButton && session.status === 'running'}
        <button
          class="action-button stop-button"
          onclick={handleStop}
          title="Stop session"
          aria-label="Stop session {session.name}"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      {/if}
    </div>
  </div>

  <!-- Status -->
  <div class="session-status">
    <span class="status-indicator {getStatusColor(session.status)}">
      {getStatusIcon(session.status)}
    </span>
    <span class="status-text capitalize">
      {session.status}
      {#if session.status === 'running' && session.activityStatus?.isActive === false}
        (idle)
      {/if}
    </span>
  </div>

  <!-- Details -->
  <div class="session-details">
    {#if session.command}
      <div class="session-command" title={session.command}>
        <svg class="w-3 h-3 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span class="truncate">{session.command}</span>
      </div>
    {/if}

    {#if session.workingDir}
      <div class="session-directory" title={session.workingDir}>
        <svg class="w-3 h-3 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
        </svg>
        <span class="truncate">{session.workingDir.split('/').pop() || session.workingDir}</span>
      </div>
    {/if}
  </div>

  <!-- Footer -->
  <div class="session-footer">
    {#if session.createdAt}
      <div class="session-time">
        {formatElapsedTime(session.createdAt)}
      </div>
    {/if}
    {#if session.gitRepoPath}
      <div class="session-repo" title={session.gitRepoPath}>
        <svg class="w-3 h-3 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
        </svg>
        <span class="truncate">{session.gitRepoPath.split('/').pop()}</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .session-card {
    @apply bg-bg-elevated border border-border rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md;
    min-height: 140px;
    display: flex;
    flex-direction: column;
  }

  .session-card:hover {
    @apply border-accent-primary/50 shadow-lg;
  }

  .session-card.selected {
    @apply border-accent-primary bg-accent-primary/5 shadow-lg ring-2 ring-accent-primary/20;
  }

  .session-card:focus {
    @apply outline-none ring-2 ring-accent-primary/50;
  }

  .session-card-header {
    @apply flex items-start justify-between gap-2 mb-3;
  }

  .session-name {
    @apply font-medium text-text-primary truncate flex-1;
    font-size: 0.875rem;
    line-height: 1.25rem;
  }

  .session-actions {
    @apply flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity;
  }

  .session-card:hover .session-actions {
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

  .session-status {
    @apply flex items-center gap-2 mb-3;
  }

  .status-indicator {
    @apply font-mono text-sm;
  }

  .status-text {
    @apply text-xs font-medium;
  }

  .session-details {
    @apply flex flex-col gap-2 mb-3 flex-1;
  }

  .session-command,
  .session-directory {
    @apply flex items-center gap-2 text-xs text-text-muted;
  }

  .session-command span,
  .session-directory span {
    @apply truncate;
  }

  .session-footer {
    @apply flex items-center justify-between gap-2 pt-2 border-t border-border;
  }

  .session-time,
  .session-repo {
    @apply flex items-center gap-1 text-xs text-text-dim;
  }

  .session-time span,
  .session-repo span {
    @apply truncate;
  }
</style>