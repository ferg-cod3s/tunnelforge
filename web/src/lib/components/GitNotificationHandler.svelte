<script lang="ts">
  import { onDestroy, createEventDispatcher } from 'svelte';
  import { createLogger } from '$lib/utils/logger';
  import { getNotificationPreferences } from '$lib/services/settings';

  const logger = createLogger('git-notification-handler');

  // Props interface
  interface Props {
    sessionId?: string;
    maxNotifications?: number;
    defaultDuration?: number;
  }

  let {
    sessionId = undefined,
    maxNotifications = 5,
    defaultDuration = 10000
  }: Props = $props();

  // State management with Svelte 5 runes
  let notifications = $state<GitNotification[]>([]);
  let autoHideTimers = $state<Map<string, NodeJS.Timeout>>(new Map());
  let eventSource: EventSource | null = $state(null);
  let isDestroyed = $state(false);

  // Derived state
  let visibleNotifications = $derived(notifications.slice(0, maxNotifications));
  let notificationPreferences = $derived(getNotificationPreferences());

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    'notification-action': { notification: GitNotification; action: string };
    'notification-dismissed': { notification: GitNotification };
    'notification-shown': { notification: GitNotification };
  }>();

  // Git notification data interface
  interface GitNotificationData {
    type: 'branch_switched' | 'branch_diverged' | 'follow_enabled' | 'follow_disabled' |
          'commit_pushed' | 'commit_pulled' | 'merge_conflict' | 'worktree_created' |
          'worktree_deleted' | 'worktree_switched' | 'repo_status_changed';
    sessionTitle?: string;
    currentBranch?: string;
    divergedBranch?: string;
    aheadBy?: number;
    behindBy?: number;
    commitMessage?: string;
    worktreePath?: string;
    worktreeBranch?: string;
    hasConflicts?: boolean;
    isDirty?: boolean;
    message?: string;
  }

  interface GitNotification {
    id: string;
    data: GitNotificationData;
    timestamp: number;
    priority: 'low' | 'medium' | 'high';
  }

  // Notification history for persistence
  let notificationHistory = $state<GitNotification[]>([]);
  let doNotDisturb = $state(false);

  // Effects
  $effect(() => {
    // Load notification history from localStorage
    loadNotificationHistory();

    // Setup event listeners
    setupEventListeners();

    return () => {
      cleanup();
    };
  });

  $effect(() => {
    // Save notification history when it changes
    if (notificationHistory.length > 0) {
      saveNotificationHistory();
    }
  });

  function setupEventListeners(): void {
    if (typeof window === 'undefined') return;

    // Listen for custom git events
    window.addEventListener('git-notification', handleCustomGitEvent as EventListener);

    // Setup SSE connection for git notifications
    setupSSEConnection();
  }

  function setupSSEConnection(): void {
    if (eventSource || isDestroyed) return;

    try {
      const url = sessionId ? `/api/sessions/${sessionId}/git-events` : '/api/git-events';
      eventSource = new EventSource(url);

      eventSource.onmessage = (event) => {
        try {
          const data: GitNotificationData = JSON.parse(event.data);
          handleGitNotification(data);
        } catch (error) {
          logger.error('Failed to parse SSE message:', error);
        }
      };

      eventSource.onerror = (error) => {
        logger.error('SSE connection error:', error);
        // Attempt reconnection after delay
        setTimeout(() => {
          if (!isDestroyed) {
            eventSource = null;
            setupSSEConnection();
          }
        }, 5000);
      };

      logger.log('SSE connection established for git notifications');
    } catch (error) {
      logger.error('Failed to setup SSE connection:', error);
    }
  }

  function handleCustomGitEvent(event: CustomEvent<GitNotificationData>): void {
    handleGitNotification(event.detail);
  }

  function handleGitNotification(data: GitNotificationData): void {
    if (doNotDisturb) return;

    const notification: GitNotification = {
      id: `git-notif-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      data,
      timestamp: Date.now(),
      priority: getNotificationPriority(data.type)
    };

    logger.debug('Received Git notification:', data);

    // Add to notifications
    notifications = [notification, ...notifications];

    // Add to history
    notificationHistory = [notification, ...notificationHistory.slice(0, 49)]; // Keep last 50

    // Auto-hide after duration
    const duration = getNotificationDuration(notification.priority);
    const timer = setTimeout(() => {
      dismissNotification(notification.id);
    }, duration);

    autoHideTimers.set(notification.id, timer);

    // Dispatch shown event
    dispatch('notification-shown', { notification });

    // Show browser notification if enabled
    if (notificationPreferences.enabled && notificationPreferences.sessionExit) {
      showBrowserNotification(notification);
    }

    // Play sound if enabled
    if (notificationPreferences.soundEnabled) {
      playNotificationSound();
    }

    // Vibrate if enabled
    if (notificationPreferences.vibrationEnabled && 'vibrate' in navigator) {
      navigator.vibrate(200);
    }
  }

  function getNotificationPriority(type: GitNotificationData['type']): 'low' | 'medium' | 'high' {
    switch (type) {
      case 'merge_conflict':
        return 'high';
      case 'branch_diverged':
      case 'commit_pushed':
      case 'commit_pulled':
        return 'medium';
      default:
        return 'low';
    }
  }

  function getNotificationDuration(priority: 'low' | 'medium' | 'high'): number {
    switch (priority) {
      case 'high':
        return defaultDuration * 1.5; // 15 seconds
      case 'medium':
        return defaultDuration; // 10 seconds
      case 'low':
        return defaultDuration * 0.75; // 7.5 seconds
    }
  }

  function dismissNotification(id: string): void {
    const notification = notifications.find(n => n.id === id);
    if (!notification) return;

    notifications = notifications.filter(n => n.id !== id);

    const timer = autoHideTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      autoHideTimers.delete(id);
    }

    dispatch('notification-dismissed', { notification });
  }

  function handleNotificationAction(notification: GitNotification, action: string): void {
    dispatch('notification-action', { notification, action });

    // Dismiss notification after action
    dismissNotification(notification.id);
  }

  function showBrowserNotification(notification: GitNotification): void {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const title = getNotificationTitle(notification.data);
    const options: NotificationOptions = {
      body: formatNotificationMessage(notification.data),
      icon: '/favicon.svg',
      tag: `git-${notification.data.type}`,
      requireInteraction: notification.priority === 'high'
    };

    const browserNotification = new Notification(title, options);

    browserNotification.onclick = () => {
      window.focus();
      browserNotification.close();
      handleNotificationAction(notification, 'view');
    };

    // Auto-close after 5 seconds for non-high priority
    if (notification.priority !== 'high') {
      setTimeout(() => browserNotification.close(), 5000);
    }
  }

  function playNotificationSound(): void {
    try {
      // Create a simple beep sound
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      logger.warn('Failed to play notification sound:', error);
    }
  }

  function getNotificationIcon(type: GitNotificationData['type']): string {
    switch (type) {
      case 'branch_switched':
      case 'worktree_switched':
        return 'branch';
      case 'branch_diverged':
        return 'diverged';
      case 'follow_enabled':
      case 'follow_disabled':
        return 'follow';
      case 'commit_pushed':
        return 'push';
      case 'commit_pulled':
        return 'pull';
      case 'merge_conflict':
        return 'conflict';
      case 'worktree_created':
      case 'worktree_deleted':
        return 'worktree';
      case 'repo_status_changed':
        return 'status';
      default:
        return 'git';
    }
  }

  function getNotificationClass(type: GitNotificationData['type']): string {
    switch (type) {
      case 'branch_switched':
      case 'follow_enabled':
      case 'commit_pushed':
      case 'commit_pulled':
      case 'worktree_created':
      case 'worktree_switched':
        return 'bg-blue-500 text-white';
      case 'branch_diverged':
      case 'repo_status_changed':
        return 'bg-yellow-500 text-black';
      case 'follow_disabled':
      case 'worktree_deleted':
        return 'bg-gray-500 text-white';
      case 'merge_conflict':
        return 'bg-red-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  }

  function getNotificationTitle(data: GitNotificationData): string {
    switch (data.type) {
      case 'branch_switched':
        return 'Branch Switched';
      case 'branch_diverged':
        return 'Branch Diverged';
      case 'follow_enabled':
        return 'Follow Mode Enabled';
      case 'follow_disabled':
        return 'Follow Mode Disabled';
      case 'commit_pushed':
        return 'Commit Pushed';
      case 'commit_pulled':
        return 'Commit Pulled';
      case 'merge_conflict':
        return 'Merge Conflict';
      case 'worktree_created':
        return 'Worktree Created';
      case 'worktree_deleted':
        return 'Worktree Deleted';
      case 'worktree_switched':
        return 'Worktree Switched';
      case 'repo_status_changed':
        return 'Repository Status Changed';
      default:
        return 'Git Notification';
    }
  }

  function formatNotificationMessage(data: GitNotificationData): string {
    switch (data.type) {
      case 'branch_switched':
        return data.message || `Switched to branch ${data.currentBranch || 'unknown'}`;
      case 'branch_diverged':
        return data.message || `Branch ${data.divergedBranch || 'unknown'} has diverged (${data.aheadBy || 0} ahead, ${data.behindBy || 0} behind)`;
      case 'follow_enabled':
        return data.message || `Follow mode enabled for ${data.currentBranch || 'current branch'}`;
      case 'follow_disabled':
        return data.message || 'Follow mode disabled';
      case 'commit_pushed':
        return data.message || `Pushed commit: ${data.commitMessage || 'No message'}`;
      case 'commit_pulled':
        return data.message || `Pulled commit: ${data.commitMessage || 'No message'}`;
      case 'merge_conflict':
        return data.message || 'Merge conflict detected - manual resolution required';
      case 'worktree_created':
        return data.message || `Worktree created: ${data.worktreePath || 'unknown path'}`;
      case 'worktree_deleted':
        return data.message || `Worktree deleted: ${data.worktreePath || 'unknown path'}`;
      case 'worktree_switched':
        return data.message || `Switched to worktree: ${data.worktreeBranch || 'unknown branch'}`;
      case 'repo_status_changed':
        return data.message || `Repository status: ${data.isDirty ? 'dirty' : 'clean'}`;
      default:
        return data.message || 'Git operation completed';
    }
  }

  function getNotificationActions(notification: GitNotification): Array<{ label: string; action: string }> {
    const actions: Array<{ label: string; action: string }> = [];

    switch (notification.data.type) {
      case 'merge_conflict':
        actions.push({ label: 'Resolve', action: 'resolve' });
        break;
      case 'branch_diverged':
        actions.push({ label: 'Sync', action: 'sync' });
        break;
      case 'worktree_created':
      case 'worktree_switched':
        actions.push({ label: 'Open', action: 'open' });
        break;
    }

    actions.push({ label: 'View', action: 'view' });
    return actions;
  }

  function loadNotificationHistory(): void {
    try {
      const stored = localStorage.getItem('tunnelforge_git_notifications');
      if (stored) {
        const parsed = JSON.parse(stored);
        notificationHistory = parsed.filter((n: any) =>
          Date.now() - n.timestamp < 24 * 60 * 60 * 1000 // Keep last 24 hours
        );
      }
    } catch (error) {
      logger.warn('Failed to load notification history:', error);
    }
  }

  function saveNotificationHistory(): void {
    try {
      localStorage.setItem('tunnelforge_git_notifications', JSON.stringify(notificationHistory));
    } catch (error) {
      logger.warn('Failed to save notification history:', error);
    }
  }

  function toggleDoNotDisturb(): void {
    doNotDisturb = !doNotDisturb;
  }



  function cleanup(): void {
    isDestroyed = true;

    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    window.removeEventListener('git-notification', handleCustomGitEvent as EventListener);

    autoHideTimers.forEach(timer => clearTimeout(timer));
    autoHideTimers.clear();
  }

  // Cleanup on destroy
  onDestroy(cleanup);
</script>

<!-- Notification Container -->
{#if visibleNotifications.length > 0}
  <div class="fixed top-4 right-4 z-50 space-y-2 max-w-md">
    {#each visibleNotifications as notification (notification.id)}
      <div
        class="flex items-start gap-3 p-4 rounded-lg shadow-lg animate-slide-in-right {getNotificationClass(notification.data.type)}"
        class:high-priority={notification.priority === 'high'}
        class:medium-priority={notification.priority === 'medium'}
        class:low-priority={notification.priority === 'low'}
      >
        <!-- Icon -->
        <div class="flex-shrink-0">
          {#if getNotificationIcon(notification.data.type) === 'branch'}
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.632 4.684C18.114 15.938 18 15.482 18 15c0-.482.114-.938.316-1.342m0 2.684a3 3 0 110-2.684M15 9a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          {:else if getNotificationIcon(notification.data.type) === 'diverged'}
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          {:else if getNotificationIcon(notification.data.type) === 'follow'}
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          {:else if getNotificationIcon(notification.data.type) === 'push'}
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
          {:else if getNotificationIcon(notification.data.type) === 'pull'}
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M17 16l4-4m0 0l-4-4m4 4H3" />
            </svg>
          {:else if getNotificationIcon(notification.data.type) === 'conflict'}
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          {:else if getNotificationIcon(notification.data.type) === 'worktree'}
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          {:else}
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          {/if}
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          {#if notification.data.sessionTitle}
            <div class="font-semibold text-sm mb-1 opacity-90">
              {notification.data.sessionTitle}
            </div>
          {/if}
          <div class="text-sm leading-tight">
            {formatNotificationMessage(notification.data)}
          </div>

          <!-- Actions -->
          {#if getNotificationActions(notification).length > 0}
            <div class="flex gap-2 mt-2">
              {#each getNotificationActions(notification) as action}
                <button
                  class="text-xs px-2 py-1 rounded opacity-80 hover:opacity-100 transition-opacity"
                  onclick={() => handleNotificationAction(notification, action.action)}
                  aria-label={`${action.label} notification action`}
                >
                  {action.label}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Dismiss button -->
        <button
          onclick={() => dismissNotification(notification.id)}
          class="flex-shrink-0 opacity-80 hover:opacity-100 transition-opacity"
          aria-label="Dismiss notification"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    {/each}
  </div>
{/if}

<!-- Notification History Panel (can be toggled) -->
{#if notificationHistory.length > 0}
  <div class="fixed bottom-4 right-4 z-40">
    <button
      onclick={toggleDoNotDisturb}
      class="bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg hover:bg-gray-700 transition-colors text-sm"
      title={doNotDisturb ? 'Enable notifications' : 'Disable notifications'}
      aria-label={doNotDisturb ? 'Enable notifications' : 'Disable notifications'}
    >
      {#if doNotDisturb}
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.586 5.586a2 2 0 012.828 0L12 8.586l3.586-3.586a2 2 0 012.828 2.828L14.414 12l3.586 3.586a2 2 0 01-2.828 2.828L12 14.414l-3.586 3.586a2 2 0 01-2.828-2.828L9.586 12 5.586 8.414a2 2 0 010-2.828z" />
        </svg>
      {:else}
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-5 5v-5z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.868 12.683A17.925 17.925 0 0112 21c7.962 0 12-1.21 12-2.683m-12 2.683a17.925 17.925 0 01-7.132-8.317M12 21c4.411 0 8-4.03 8-9s-3.589-9-8-9-8 4.03-8 9a9.06 9.06 0 001.832 5.683L4 21l4.868-8.317z" />
        </svg>
      {/if}
      <span class="ml-2">{notificationHistory.length}</span>
    </button>
  </div>
{/if}

<style>
  @keyframes slide-in-right {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .animate-slide-in-right {
    animation: slide-in-right 0.3s ease-out;
  }

  .high-priority {
    border-left: 4px solid #ef4444;
  }

  .medium-priority {
    border-left: 4px solid #f59e0b;
  }

  .low-priority {
    border-left: 4px solid #6b7280;
  }
</style>