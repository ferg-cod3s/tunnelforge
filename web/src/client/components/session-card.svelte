<!-- SessionCard.svelte - Full-size session card component -->
<script lang="ts">
  import { props, state, effect } from 'svelte';
  import type { Session } from '../../shared/types.js';
  import { formatSessionDuration } from '../../shared/utils/time.js';
  import { formatPathForDisplay } from '../utils/path-utils.js';
  import { createLogger } from '../utils/logger.js';
  import ClickablePath from './clickable-path.svelte';
  import InlineEdit from './inline-edit.svelte';

  const logger = createLogger('session-card');

  interface Props {
    session: Session;
    compact?: boolean;
    onView: (id: string) => void;
    onDelete: (id: string) => void;
  }

  let {
    session,
    compact = false,
    onView,
    onDelete
  }: Props = $props();

  let killing = $state(false);
  let killingFrame = $state(0);
  let isActive = $state(false);
  let isHovered = $state(false);
  let activityTimeout: number | null = null;
  let killingInterval: number | null = null;

  // Activity tracking
  $effect(() => {
    if (session.status !== 'running') return;

    isActive = true;

    if (activityTimeout) {
      clearTimeout(activityTimeout);
    }

    activityTimeout = window.setTimeout(() => {
      isActive = false;
      activityTimeout = null;
    }, 500);
  });

  // Cleanup timeouts on unmount
  $effect(() => {
    return () => {
      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }
      if (killingInterval) {
        clearInterval(killingInterval);
      }
    };
  });

  function handleCardClick() {
    onView(session.id);
  }

  function handleKillClick(e: Event) {
    e.stopPropagation();
    e.preventDefault();
    onDelete(session.id);
  }

  function handleMouseEnter() {
    isHovered = true;
  }

  function handleMouseLeave() {
    isHovered = false;
  }

  function getKillingText(): string {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    return frames[killingFrame % frames.length];
  }

  function getActivityStatusText(): string {
    if (killing) return 'killing...';
    if (session.active === false) return 'waiting';
    if (session.status === 'running' && session.activityStatus?.specificStatus) {
      return session.activityStatus.specificStatus.status;
    }
    return session.status;
  }

  function getActivityStatusColor(): string {
    if (killing) return 'text-status-error';
    if (session.active === false) return 'text-text-muted';
    if (session.status === 'running' && session.activityStatus?.specificStatus) {
      return 'text-status-warning';
    }
    return session.status === 'running' ? 'text-status-success' : 'text-status-warning';
  }

  function getStatusDotColor(): string {
    if (killing) return 'bg-status-error animate-pulse';
    if (session.active === false) return 'bg-muted';
    if (session.status === 'running') {
      if (session.activityStatus?.specificStatus) {
        return 'bg-status-warning animate-pulse';
      } else if (session.activityStatus?.isActive || isActive) {
        return 'bg-status-success';
      } else {
        return 'bg-status-success ring-1 ring-status-success/50';
      }
    }
    return 'bg-status-warning';
  }
</script>

<div
  class="card cursor-pointer overflow-hidden flex flex-col h-full {killing ? 'opacity-60' : ''} {(isActive && session.status === 'running') ? 'ring-2 ring-primary shadow-glow-sm' : ''}"
  style="view-transition-name: session-{session.id}; --session-id: session-{session.id}"
  data-session-id={session.id}
  data-testid="session-card"
  data-session-status={session.status}
  data-is-killing={killing}
  onclick={handleCardClick}
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
>
  <!-- Compact Header -->
  <div class="flex justify-between items-center px-3 py-2 border-b border-border bg-gradient-to-r from-bg-secondary to-bg-tertiary">
    <div class="text-xs font-mono pr-2 flex-1 min-w-0 text-primary">
      <div class="flex items-center gap-2">
        <span class="truncate">
          {session.name || session.command?.join(' ') || ''}
        </span>
      </div>
    </div>
    <div class="flex items-center gap-1 flex-shrink-0">
      {#if session.status === 'running' || session.status === 'exited'}
        <button
          class="p-1 rounded-full transition-all duration-200 disabled:opacity-50 flex-shrink-0 {session.status === 'running' ? 'text-status-error hover:bg-status-error/20' : 'text-status-warning hover:bg-status-warning/20'}"
          onclick={handleKillClick}
          disabled={killing}
          title={session.status === 'running' ? 'Kill session' : 'Clean up session'}
          data-testid="kill-session-button"
        >
          {#if killing}
            <span class="block w-5 h-5 flex items-center justify-center">{getKillingText()}</span>
          {:else}
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke-width="2" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 9l-6 6m0-6l6 6" />
            </svg>
          {/if}
        </button>
      {/if}
    </div>
  </div>

  <!-- Terminal display (main content) -->
  <div class="session-preview bg-bg overflow-hidden flex-1 relative {session.status === 'exited' ? 'session-exited' : ''}"
       style="background: linear-gradient(to bottom, rgb(var(--color-bg)), rgb(var(--color-bg-secondary))); box-shadow: inset 0 1px 3px rgb(var(--color-bg) / 0.5);">
    {#if killing}
      <div class="w-full h-full flex items-center justify-center text-status-error">
        <div class="text-center font-mono">
          <div class="text-4xl mb-2">{getKillingText()}</div>
          <div class="text-sm">Killing session...</div>
        </div>
      </div>
    {:else}
      <!-- TODO: Implement terminal buffer component -->
      <div class="w-full h-full flex items-center justify-center text-text-muted">
        Terminal preview not yet implemented
      </div>
    {/if}
  </div>

  <!-- Compact Footer -->
  <div class="px-3 py-2 text-text-muted text-xs border-t border-border bg-gradient-to-r from-bg-tertiary to-bg-secondary">
    <div class="flex justify-between items-center min-w-0">
      <span class="{getActivityStatusColor()} text-xs flex items-center gap-1 flex-shrink-0" data-status={session.status} data-killing={killing}>
        <div class="w-2 h-2 rounded-full {getStatusDotColor()}"></div>
        {getActivityStatusText()}
        {#if session.status === 'running' && isActive && !session.activityStatus?.specificStatus}
          <span class="text-primary animate-pulse ml-1">●</span>
        {/if}
      </span>
      <!-- Git Status -->
      {#if session.gitBranch}
        <div class="flex items-center gap-1 text-[10px] flex-shrink-0">
          <span class="px-1.5 py-0.5 bg-surface-2 rounded-sm">{session.gitBranch}</span>

          {#if session.gitAheadCount && session.gitAheadCount > 0}
            <span class="text-status-success flex items-center gap-0.5">
              <svg width="8" height="8" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 4l-4 4h3v4h2v-4h3L8 4z"/>
              </svg>
              {session.gitAheadCount}
            </span>
          {/if}

          {#if session.gitBehindCount && session.gitBehindCount > 0}
            <span class="text-status-warning flex items-center gap-0.5">
              <svg width="8" height="8" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 12l4-4h-3V4H7v4H4l4 4z"/>
              </svg>
              {session.gitBehindCount}
            </span>
          {/if}

          {#if session.gitHasChanges}
            <span class="text-yellow-500">●</span>
          {/if}

          {#if session.gitIsWorktree}
            <span class="text-purple-400" title="Git worktree">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5 3.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm0 2.122a2.25 2.25 0 10-1.5 0v.878A2.25 2.25 0 005.75 8.5h1.5v2.128a2.251 2.251 0 101.5 0V8.5h1.5a2.25 2.25 0 002.25-2.25v-.878a2.25 2.25 0 10-1.5 0v.878a.75.75 0 01-.75.75h-4.5A.75.75 0 015 6.25v-.878zm3.75 7.378a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm3-8.75a.75.75 0 100-1.5.75.75 0 000 1.5z"/>
              </svg>
            </span>
          {/if}
        </div>
      {/if}
    </div>
    <div class="text-xs opacity-75 min-w-0 mt-1">
      <ClickablePath path={session.workingDir} iconSize={12} />
    </div>
  </div>
</div>

<style>
  .card {
    background-color: rgb(var(--color-bg-secondary));
    border: 1px solid rgb(var(--color-border));
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
    transition: all 200ms;
  }

  .card:hover {
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
    transform: translateY(-1px);
  }

  .session-exited {
    opacity: 0.7;
  }

  .session-exited::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(45deg, transparent 30%, rgba(239, 68, 68, 0.1) 50%, transparent 70%);
    pointer-events: none;
  }
</style>