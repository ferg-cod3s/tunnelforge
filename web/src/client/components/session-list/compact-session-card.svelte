<!-- CompactSessionCard.svelte - Condensed session card for mobile/sidebar views -->
<script lang="ts">
  import type { Session } from '../../../shared/types.js';
  import type { AuthClient } from '../../services/auth-client.js';
  import { formatSessionDuration } from '../../../shared/utils/time.js';
  import { formatPathForDisplay } from '../../utils/path-utils.js';

  interface Props {
    session: Session;
    authClient: AuthClient;
    selected?: boolean;
    sessionType?: 'active' | 'idle' | 'exited';
    sessionNumber?: number;
    onView: (sessionId: string) => void;
    onDelete: (sessionId: string) => void;
  }

  let {
    session,
    authClient,
    selected = false,
    sessionType = 'active',
    sessionNumber,
    onView,
    onDelete
  }: Props = $props();

  function handleClick() {
    onView(session.id);
  }

  function handleDelete(e: Event) {
    e.stopPropagation();
    onDelete(session.id);
  }

  function renderStatusIndicator() {
    if (session.status === 'exited') {
      return 'bg-status-warning';
    }

    if (session.activityStatus?.isActive === false) {
      // Idle
      return 'bg-status-success ring-1 ring-status-success/50';
    }

    // Active
    if (session.activityStatus?.specificStatus) {
      // Claude active - amber with pulse
      return 'bg-status-warning animate-pulse';
    } else {
      // Generic active
      return 'bg-status-success';
    }
  }

  function renderGitChanges() {
    if (!session.gitRepoPath) return '';

    const changes = [];

    // Show uncommitted changes indicator first
    if (session.gitHasChanges) {
      changes.push('●');
    }

    // Show ahead/behind counts
    if (session.gitAheadCount && session.gitAheadCount > 0) {
      changes.push(`↑${session.gitAheadCount}`);
    }
    if (session.gitBehindCount && session.gitBehindCount > 0) {
      changes.push(`↓${session.gitBehindCount}`);
    }

    return changes.join(' ');
  }

  function renderSessionName() {
    return session.name || (Array.isArray(session.command) ? session.command.join(' ') : session.command);
  }

  function renderDeleteButton() {
    const isExited = session.status === 'exited';
    const buttonClass = isExited
      ? 'text-text-muted p-1.5 rounded-md transition-all hover:text-status-warning hover:bg-bg-elevated hover:shadow-sm'
      : 'text-text-muted p-1.5 rounded-md transition-all hover:text-status-error hover:bg-bg-elevated hover:shadow-sm hover:scale-110';

    const buttonTitle = isExited ? 'Clean up session' : 'Kill Session';

    return buttonClass;
  }

  $: cardClasses = [
    'group',
    'flex',
    'items-center',
    'gap-3',
    'p-3',
    'rounded-lg',
    'cursor-pointer',
    selected
      ? 'bg-bg-elevated border border-accent-primary shadow-card-hover'
      : session.status === 'exited'
        ? 'bg-bg-secondary border border-border hover:bg-bg-tertiary hover:border-border-light hover:shadow-card opacity-75'
        : 'bg-bg-secondary border border-border hover:bg-bg-tertiary hover:border-border-light hover:shadow-card',
  ].join(' ');

  $: nameColorClass = selected
    ? 'text-accent-primary font-medium'
    : session.status === 'exited'
      ? 'text-text-muted group-hover:text-text transition-colors'
      : 'text-text group-hover:text-accent-primary transition-colors';

  $: pathColorClass = session.status === 'exited' ? 'text-text-dim' : 'text-text-muted';

  $: isTouchDevice = 'ontouchstart' in window;
</script>

<div class={cardClasses} style="margin-bottom: 12px;" onclick={handleClick}>
  <!-- Session number and status indicator -->
  <div class="flex items-center gap-2 flex-shrink-0">
    {#if sessionNumber}
      <span class="text-xs font-mono {selected ? 'text-accent-primary' : 'text-text-muted'} min-w-[1.5rem] text-center">
        {sessionNumber}
      </span>
    {/if}
    <div class="relative">
      <div class="w-2.5 h-2.5 rounded-full {renderStatusIndicator()}"></div>
      <!-- Pulse ring for active sessions -->
      {#if session.status === 'running' && session.activityStatus?.isActive}
        <div class="absolute inset-0 w-2.5 h-2.5 rounded-full bg-status-success opacity-30 animate-ping"></div>
      {/if}
    </div>
  </div>

  <!-- Elegant divider line -->
  <div class="w-px h-full self-stretch bg-gradient-to-b from-transparent via-border to-transparent"></div>

  <!-- Session content -->
  <div class="flex-1 min-w-0">
    <!-- Row 1: Session name -->
    <div class="text-sm font-mono truncate {nameColorClass}">
      {renderSessionName()}
    </div>

    <!-- Row 2: Path, branch, and git changes -->
    <div class="text-xs {pathColorClass} truncate flex items-center gap-1 mt-1">
      <span class="truncate">{formatPathForDisplay(session.workingDir)}</span>
      {#if session.gitBranch}
        <span class="text-text-muted/50">·</span>
        <span class="text-status-success font-mono">[${session.gitBranch}]</span>
        {#if session.gitIsWorktree}
          <span class="text-purple-400 ml-0.5">⎇</span>
        {/if}
        <!-- Git changes indicator after branch -->
        {#if renderGitChanges()}
          <span class="ml-1">{renderGitChanges()}</span>
        {/if}
      {/if}
    </div>

    <!-- Row 3: Activity status (only shown if there's activity) -->
    {#if sessionType === 'active' && session.activityStatus?.specificStatus}
      <div class="text-xs text-status-warning truncate mt-1">
        <span class="flex-shrink-0">{session.activityStatus.specificStatus.status}</span>
      </div>
    {/if}
  </div>

  <!-- Right side: duration and close button -->
  <div class="relative flex items-center flex-shrink-0 gap-1">
    {#if isTouchDevice}
      <!-- Touch devices: Close button left of time -->
      <button
        class={renderDeleteButton()}
        onclick={handleDelete}
        title={session.status === 'exited' ? 'Clean up session' : 'Kill Session'}
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
      <div class="text-xs {session.status === 'exited' ? 'text-text-dim' : 'text-text-muted'} font-mono">
        {session.startedAt ? formatSessionDuration(session.startedAt, session.status === 'exited' ? session.lastModified : undefined) : ''}
      </div>
    {:else}
      <!-- Desktop: Time that hides on hover -->
      <div class="text-xs {session.status === 'exited' ? 'text-text-dim' : 'text-text-muted'} font-mono transition-opacity group-hover:opacity-0">
        {session.startedAt ? formatSessionDuration(session.startedAt, session.status === 'exited' ? session.lastModified : undefined) : ''}
      </div>

      <!-- Desktop: Buttons show on hover -->
      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-0">
        <button
          class={renderDeleteButton()}
          onclick={handleDelete}
          title={session.status === 'exited' ? 'Clean up session' : 'Kill Session'}
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .bg-bg-secondary { background-color: rgb(var(--color-bg-secondary)); }
  .bg-bg-tertiary { background-color: rgb(var(--color-bg-tertiary)); }
  .bg-bg-elevated { background-color: rgb(var(--color-bg-elevated)); }
  .border-border { border-color: rgb(var(--color-border)); }
  .border-border-light { border-color: rgb(var(--color-border-light)); }
  .border-accent-primary { border-color: rgb(var(--color-accent-primary)); }
  .text-text { color: rgb(var(--color-text)); }
  .text-text-muted { color: rgb(var(--color-text-muted)); }
  .text-text-dim { color: rgb(var(--color-text-dim)); }
  .text-accent-primary { color: rgb(var(--color-accent-primary)); }
  .text-status-success { color: rgb(var(--color-status-success)); }
  .text-status-warning { color: rgb(var(--color-status-warning)); }
  .text-status-error { color: rgb(var(--color-status-error)); }
  .bg-status-success { background-color: rgb(var(--color-status-success)); }
  .bg-status-warning { background-color: rgb(var(--color-status-warning)); }
  .ring-status-success\/50 { --tw-ring-color: rgb(var(--color-status-success) / 0.5); }
  .shadow-card { box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1); }
  .shadow-card-hover { box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1); }
</style>