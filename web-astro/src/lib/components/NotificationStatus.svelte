<script lang="ts">
  import { onMount } from 'svelte';

  // Props
  export let isSSEConnected: boolean = false;
  export let notificationPermission: NotificationPermission = 'default';

  // Events
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{
    'open-settings': void;
  }>();

  onMount(() => {
    initializeComponent();
  });

  function initializeComponent(): void {
    // Get initial notification permission state
    if (typeof Notification !== 'undefined') {
      notificationPermission = Notification.permission;
    }

    // Listen for notification permission changes
    if (typeof navigator !== 'undefined' && navigator.permissions) {
      navigator.permissions
        .query({ name: 'notifications' as PermissionName })
        .then((permission) => {
          permission.addEventListener('change', () => {
            if (typeof Notification !== 'undefined') {
              notificationPermission = Notification.permission;
            }
          });
        })
        .catch(() => {
          // Ignore permission query errors
        });
    }
  }

  function handleClick(): void {
    dispatch('open-settings');
  }

  function getStatusConfig() {
    // Check browser notification permission first
    if (notificationPermission === 'denied') {
      return {
        status: 'denied',
        tooltip: 'Settings (Notifications denied)',
      };
    }

    if (notificationPermission === 'default') {
      return {
        status: 'disabled',
        tooltip: 'Settings (Notifications disabled)',
      };
    }

    // Green when SSE is connected (Mac app notifications are working)
    if (isSSEConnected) {
      return {
        status: 'connected',
        tooltip: 'Settings (Notifications connected)',
      };
    }

    // Default color when SSE is not connected but notifications are allowed
    return {
      status: 'disconnected',
      tooltip: 'Settings (Notifications disconnected)',
    };
  }

  $: statusConfig = getStatusConfig();
</script>

<button
  on:click={handleClick}
  class="notification-status"
  class:status-denied={statusConfig.status === 'denied'}
  class:status-disabled={statusConfig.status === 'disabled'}
  class:status-connected={statusConfig.status === 'connected'}
  class:status-disconnected={statusConfig.status === 'disconnected'}
  title={statusConfig.tooltip}
>
  <svg class="status-icon" fill="currentColor" viewBox="0 0 20 20">
    <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>
  </svg>
</button>

<style>
  .notification-status {
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-sm);
    transition: all var(--transition-base);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .notification-status:hover {
    color: var(--color-primary);
    background: var(--color-bg-secondary);
    border-color: var(--color-primary);
    box-shadow: var(--shadow-sm);
  }

  .notification-status:focus {
    outline: none;
    box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-primary);
  }

  .status-icon {
    width: 1rem;
    height: 1rem;
  }

  .status-denied {
    color: var(--color-status-error);
  }

  .status-disabled {
    color: var(--color-text-muted);
  }

  .status-connected {
    color: var(--color-status-success);
  }

  .status-disconnected {
    color: var(--color-text-muted);
  }
</style>