<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createLogger } from '$lib/utils/logger';
  import SettingToggle from './SettingToggle.svelte';
  import SettingInput from './SettingInput.svelte';
  import SettingSelect from './SettingSelect.svelte';
  import NetworkAccessSettings from './NetworkAccessSettings.svelte';
  import CloudflareTunnelSettings from './CloudflareTunnelSettings.svelte';
  import SettingsSection from './SettingsSection.svelte';
  import {
    type AppPreferences,
    type NotificationPreferences,
    type TunnelStatus,
    type MediaQueryState,
    getAppPreferences,
    saveAppPreferences,
    getNotificationPreferences,
    saveNotificationPreferences,
    initializeNotifications,
    getNotificationPermission,
    isNotificationsSupported,
    getRecommendedPreferences,
    discoverRepositories,
    getRepositoryBasePath,
    updateRepositoryBasePath,
    listTunnelServices,
    getCloudflareStatus,
    startTunnel,
    stopTunnel,
    responsiveObserver,
    VERSION
  } from '$lib/services/settings';

  const logger = createLogger('settings');

  // Svelte 5 event props
  interface Props {
    visible?: boolean;
    onclose?: () => void;
    onsuccess?: (detail: { detail: string }) => void;
    onerror?: (detail: { detail: string }) => void;
    onnotificationsenabled?: () => void;
    onnotificationsdisabled?: () => void;
  }

  let {
    visible = false,
    onclose,
    onsuccess,
    onerror,
    onnotificationsenabled,
    onnotificationsdisabled
  }: Props = $props();

  // Svelte 5 state
  let activeTab = $state<'general' | 'notifications' | 'domains' | 'tunnels'>('general');
  let isLoading = $state(false);
  let testingNotification = $state(false);
  let notificationPreferences = $state<NotificationPreferences>(getNotificationPreferences());
  let permission = $state<NotificationPermission>('default');
  let appPreferences = $state<AppPreferences>(getAppPreferences());
  let repositoryBasePath = $state('');
  let mediaState = $state<MediaQueryState>(responsiveObserver.getCurrentState());
  let repositoryCount = $state(0);
  let isDiscoveringRepositories = $state(false);
  let tunnelStatus = $state<TunnelStatus>({ running: false });
  let tunnelInstalled = $state(false);
  let quickTunnelPort = $state(3000);
  let isTunnelLoading = $state(false);

  let unsubscribeResponsive: (() => void) | undefined;

  onMount(async () => {
    logger.debug('Settings component mounted');

    // Initialize notifications
    await initializeNotifications();
    permission = getNotificationPermission();

    // Load initial data
    await loadAppPreferences();
    await loadTunnelStatus();

    // Subscribe to responsive changes
    unsubscribeResponsive = responsiveObserver.subscribe((state) => {
      mediaState = state;
    });

    // Listen for keyboard events when visible
    document.addEventListener('keydown', handleKeyDown);
  });

  onDestroy(() => {
    if (unsubscribeResponsive) {
      unsubscribeResponsive();
    }
    document.removeEventListener('keydown', handleKeyDown);
  });

  // Watch for visible changes
  $effect(() => {
    if (visible) {
      // Component just became visible
      loadAppPreferences();
      loadTunnelStatus();
      discoverRepositories(repositoryBasePath);
    }
  });

  async function loadAppPreferences() {
    try {
      appPreferences = getAppPreferences();

      // Fetch server configuration
      try {
        repositoryBasePath = await getRepositoryBasePath();
        logger.debug('Loaded repository base path:', repositoryBasePath);
      } catch (error) {
        logger.warn('Failed to fetch server config', error);
      }

      // Discover repositories if visible
      if (visible) {
        discoverRepositories(repositoryBasePath);
      }
    } catch (error) {
      logger.error('Failed to load app preferences', error);
    }
  }

  async function loadTunnelStatus() {
    try {
      const [tunnels, status] = await Promise.all([
        listTunnelServices(),
        getCloudflareStatus().catch(() => ({ running: false })),
      ]);

      const cloudflare = tunnels.find((t) => t.type === 'cloudflare');
      tunnelInstalled = cloudflare?.installed || false;
      tunnelStatus = status;
    } catch (error) {
      logger.error('Failed to load tunnel status', error);
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (!visible) return;

    if (e.key === 'Escape') {
      handleClose();
    }
  }

  function handleClose() {
    onclose?.();
  }

  function handleBackdropClick(e: Event) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }

  async function handleToggleNotifications() {
    if (isLoading) return;

    isLoading = true;
    try {
      if (notificationPreferences.enabled) {
        // Disable notifications
        notificationPreferences = { ...notificationPreferences, enabled: false };
        saveNotificationPreferences(notificationPreferences);
        onnotificationsdisabled?.();
      } else {
        // Enable notifications
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          // Check if this is the first time enabling notifications
          const currentPrefs = getNotificationPreferences();
          if (!currentPrefs.enabled) {
            // First time enabling - use recommended defaults
            notificationPreferences = getRecommendedPreferences();
            logger.log('Using recommended notification preferences for first-time enable');
          } else {
            // Already enabled before - just toggle the enabled state
            notificationPreferences = { ...notificationPreferences, enabled: true };
          }

          saveNotificationPreferences(notificationPreferences);

          // Show welcome notification
          await showWelcomeNotification();

          onnotificationsenabled?.();
        } else {
          onerror?.({ detail: 'Notification permission denied. Please enable notifications in your browser settings.' });
        }
      }
    } catch (error) {
      logger.error('Failed to toggle notifications:', error);
      onerror?.({ detail: 'Failed to toggle notifications' });
    } finally {
      isLoading = false;
    }
  }

  async function handleTestNotification() {
    if (testingNotification) return;

    testingNotification = true;
    try {
      logger.log('🧪 Starting test notification...');

      // Step 1: Check service worker
      if (!isNotificationsSupported()) {
        throw new Error('Push notifications not supported in this browser');
      }

      // Step 2: Check permissions
      const perm = getNotificationPermission();
      if (perm !== 'granted') {
        throw new Error(`Notification permission is ${perm}, not granted`);
      }

      // For now, just show a basic notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('TunnelForge Test', {
          body: 'Test notification from TunnelForge',
          icon: '/apple-touch-icon.png',
          badge: '/favicon-32.png',
          tag: 'tunnelforge-test',
          requireInteraction: false,
          silent: false,
        });
      }

      logger.log('✅ Test notification sent successfully');
      onsuccess?.({ detail: 'Test notification sent successfully' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('❌ Test notification failed:', errorMessage);
      onerror?.({ detail: `Test notification failed: ${errorMessage}` });
    } finally {
      testingNotification = false;
    }
  }

  function handleNotificationPreferenceChange(key: keyof NotificationPreferences, value: boolean) {
    notificationPreferences = { ...notificationPreferences, [key]: value };
    saveNotificationPreferences(notificationPreferences);
  }

  async function showWelcomeNotification(): Promise<void> {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('TunnelForge Notifications Enabled', {
          body: "You'll now receive notifications for session events",
          icon: '/apple-touch-icon.png',
          badge: '/favicon-32.png',
          tag: 'tunnelforge-settings-welcome',
          requireInteraction: false,
          silent: false,
        });
      }
      logger.log('Settings welcome notification displayed');
    } catch (error) {
      logger.error('Failed to show settings welcome notification:', error);
    }
  }

  function handleAppPreferenceChange(key: keyof AppPreferences, value: boolean | string) {
    appPreferences = { ...appPreferences, [key]: value };
    saveAppPreferences(appPreferences);
  }

  async function handleRepositoryBasePathChange(value: string) {
    try {
      await updateRepositoryBasePath(value);
      repositoryBasePath = value;
      discoverRepositories(value);
    } catch (error) {
      logger.error('Failed to update repository base path:', error);
    }
  }

  async function handleStartQuickTunnel() {
    if (isTunnelLoading) return;

    isTunnelLoading = true;
    try {
      await startTunnel({ port: quickTunnelPort });

      await new Promise((resolve) => setTimeout(resolve, 2000));
      await loadTunnelStatus();

      onsuccess?.({ detail: `Tunnel started on port ${quickTunnelPort}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start tunnel';
      onerror?.({ detail: message });
    } finally {
      isTunnelLoading = false;
    }
  }

  async function handleStopTunnel() {
    if (isTunnelLoading) return;

    isTunnelLoading = true;
    try {
      await stopTunnel();
      await loadTunnelStatus();

      onsuccess?.({ detail: 'Tunnel stopped' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stop tunnel';
      onerror?.({ detail: message });
    } finally {
      isTunnelLoading = false;
    }
  }

  function renderSubscriptionStatus() {
    if (notificationPreferences.enabled && permission === 'granted') {
      return '● Active';
    } else if (permission === 'granted') {
      return '● Not subscribed';
    } else {
      return '● Disabled';
    }
  }

  function isIOSSafari(): boolean {
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    return isIOS;
  }

  function isStandalone(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator &&
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true)
    );
  }
</script>

{#if visible}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="settings-backdrop"
    onclick={handleBackdropClick}
    onkeydown={(e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    }}
    role="dialog"
    aria-modal="true"
    aria-labelledby="settings-title"
    tabindex="-1"
  >
    <div class="settings-modal">
      <!-- Header -->
      <div class="settings-header">
        <h2 id="settings-title" class="settings-title">Settings</h2>
        <button
          class="close-button"
          onclick={handleClose}
          title="Close"
          aria-label="Close settings"
        >
          <svg class="close-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Tabs -->
      <div class="tabs-container">
        <div class="tabs-list">
          <button
            class="tab-button"
            class:active={activeTab === 'general'}
            onclick={() => activeTab = 'general'}
          >
            General
          </button>
          <button
            class="tab-button"
            class:active={activeTab === 'notifications'}
            onclick={() => activeTab = 'notifications'}
          >
            Notifications
          </button>
          <button
            class="tab-button"
            class:active={activeTab === 'domains'}
            onclick={() => activeTab = 'domains'}
          >
            Domains
          </button>
          <button
            class="tab-button"
            class:active={activeTab === 'tunnels'}
            onclick={() => activeTab = 'tunnels'}
          >
            Tunnels
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4">
        {#if activeTab === 'general'}
          <SettingsSection title="Application">
            <!-- Direct keyboard input (Mobile only) -->
            {#if mediaState.isMobile}
              <SettingToggle
                label="Use Direct Keyboard"
                description="Capture keyboard input directly without showing a text field (desktop-like experience)"
                checked={appPreferences.useDirectKeyboard}
                onchange={(checked) => handleAppPreferenceChange('useDirectKeyboard', checked)}
              />
            {/if}

             <!-- Repository Base Path -->
            <div class="p-4 bg-bg-tertiary rounded-lg border border-border/50">
              <div class="mb-3">
                <div class="flex items-center justify-between">
                  <span class="text-primary font-medium">Repository Base Path</span>
                  <div class="flex items-center gap-2">
                    {#if isDiscoveringRepositories}
                      <span class="text-muted text-xs">Scanning...</span>
                    {:else}
                      <span class="text-muted text-xs">{repositoryCount} repositories found</span>
                    {/if}
                    <button
                      onclick={() => discoverRepositories(repositoryBasePath)}
                      disabled={isDiscoveringRepositories}
                      class="text-primary hover:text-primary-hover text-xs transition-colors duration-200"
                      title="Refresh repository list"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p class="text-muted text-xs mt-1">
                  Default directory for new sessions and repository discovery.
                </p>
              </div>
              <div class="flex gap-2">
                <SettingInput
                  label="Path"
                  value={repositoryBasePath}
                  placeholder="~/"
                  onchange={handleRepositoryBasePathChange}
                />
              </div>
            </div>
          </SettingsSection>
          <NetworkAccessSettings />
        {:else if activeTab === 'notifications'}
          <SettingsSection title="Notifications" description={renderSubscriptionStatus()}>
            {#if !isNotificationsSupported()}
              <div class="p-4 bg-status-warning/10 border border-status-warning rounded-lg">
                {#if isIOSSafari() && !isStandalone()}
                  <p class="text-sm text-status-warning mb-2">
                    Push notifications require installing this app to your home screen.
                  </p>
                  <p class="text-xs text-status-warning opacity-80">
                    Tap the share button in Safari and select "Add to Home Screen" to enable push notifications.
                  </p>
                {:else if !window.isSecureContext}
                  <p class="text-sm text-status-warning mb-2">
                    ⚠️ Push notifications require a secure connection
                  </p>
                  <p class="text-xs text-status-warning opacity-80 mb-2">
                    You're accessing TunnelForge via {window.location.protocol}//{window.location.hostname}
                  </p>
                  <p class="text-xs text-status-info opacity-90">
                    To enable notifications, access TunnelForge using:
                    <br>• https://{window.location.hostname}{window.location.port ? `:${window.location.port}` : ''}
                    <br>• http://localhost:{window.location.port || '4020'}
                    <br>• http://127.0.0.1:{window.location.port || '4020'}
                  </p>
                {:else}
                  <p class="text-sm text-status-warning">
                    Push notifications are not supported in this browser.
                  </p>
                {/if}
              </div>
            {:else}
               <!-- Main toggle -->
              <div class="flex items-center justify-between p-4 bg-bg-tertiary rounded-lg border border-border/50">
                <div class="flex-1">
                  <span class="text-primary font-medium">Enable Notifications</span>
                  <p class="text-muted text-xs mt-1">
                    Receive alerts for session events
                  </p>
                </div>
                <SettingToggle
                  label="Enable Notifications"
                  checked={notificationPreferences.enabled}
                  disabled={isLoading}
                  onchange={handleToggleNotifications}
                />
              </div>

              {#if notificationPreferences.enabled}
                <!-- Notification types -->
                <div class="mt-4 space-y-4">
                  <div>
                    <h4 class="text-sm font-medium text-text-muted mb-3">Notification Types</h4>
                    <div class="space-y-2 bg-bg rounded-lg p-3">
                      <SettingToggle
                        label="Session Exit"
                        description="When a session terminates or crashes (shows exit code)"
                        checked={notificationPreferences.sessionExit}
                        onchange={(checked) => handleNotificationPreferenceChange('sessionExit', checked)}
                      />
                      <SettingToggle
                        label="Session Start"
                        description="When a new session starts (useful for shared terminals)"
                        checked={notificationPreferences.sessionStart}
                        onchange={(checked) => handleNotificationPreferenceChange('sessionStart', checked)}
                      />
                      <SettingToggle
                        label="Session Errors"
                        description="When commands fail with non-zero exit codes"
                        checked={notificationPreferences.commandError}
                        onchange={(checked) => handleNotificationPreferenceChange('commandError', checked)}
                      />
                      <SettingToggle
                        label="Command Completion"
                        description="When commands taking >3 seconds finish (builds, tests, etc.)"
                        checked={notificationPreferences.commandCompletion}
                        onchange={(checked) => handleNotificationPreferenceChange('commandCompletion', checked)}
                      />
                      <SettingToggle
                        label="System Alerts"
                        description="Terminal bell (^G) from vim, IRC mentions, completion sounds"
                        checked={notificationPreferences.bell}
                        onchange={(checked) => handleNotificationPreferenceChange('bell', checked)}
                      />
                      <SettingToggle
                        label="Claude Turn"
                        description="When Claude AI finishes responding and awaits input"
                        checked={notificationPreferences.claudeTurn}
                        onchange={(checked) => handleNotificationPreferenceChange('claudeTurn', checked)}
                      />
                    </div>
                  </div>

                  <!-- Sound and vibration -->
                  <div>
                    <h4 class="text-sm font-medium text-text-muted mb-3">Notification Behavior</h4>
                    <div class="space-y-2 bg-bg rounded-lg p-3">
                      <SettingToggle
                        label="Sound"
                        description="Play a notification sound when alerts are triggered"
                        checked={notificationPreferences.soundEnabled}
                        onchange={(checked) => handleNotificationPreferenceChange('soundEnabled', checked)}
                      />
                      <SettingToggle
                        label="Vibration"
                        description="Vibrate device with notifications (mobile devices only)"
                        checked={notificationPreferences.vibrationEnabled}
                        onchange={(checked) => handleNotificationPreferenceChange('vibrationEnabled', checked)}
                      />
                    </div>
                  </div>
                </div>

                <!-- Test button -->
                <div class="flex items-center justify-between pt-3 mt-3 border-t border-border/50">
                  <p class="text-xs text-muted">Test your notification settings</p>
                  <button
                    class="btn-secondary text-xs px-3 py-1.5"
                    onclick={handleTestNotification}
                    disabled={testingNotification || permission !== 'granted'}
                  >
                    {testingNotification ? 'Testing...' : 'Test Notification'}
                  </button>
                </div>
              {/if}
            {/if}
          </SettingsSection>
        {:else if activeTab === 'domains'}
          <div class="placeholder">Domain setup coming soon...</div>
        {:else if activeTab === 'tunnels'}
          <CloudflareTunnelSettings />
        {/if}
      </div>

      <!-- Footer -->
      <div class="settings-footer">
        <div class="footer-content">
          <span class="version-text">v{VERSION}</span>
          <a href="/logs" class="logs-link" target="_blank">
            View Logs
          </a>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  /* Backdrop */
  .settings-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(var(--color-bg-rgb, 250 250 250), 0.8);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
  }

  /* Modal container */
  .settings-modal {
    font-family: var(--font-mono);
    font-size: var(--font-size-sm);
    width: 100%;
    max-width: calc(100vw - 1rem);
    margin: 0 0.5rem;
    max-height: calc(100vh - 2rem);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--color-bg-elevated);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
  }

  @media (min-width: 640px) {
    .settings-modal {
      max-width: 28rem;
      margin: 0 1rem;
    }
  }

  @media (min-width: 1024px) {
    .settings-modal {
      max-width: 42rem;
    }
  }

  /* Header */
  .settings-header {
    padding: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid rgba(var(--color-border-rgb, 229 229 229), 0.5);
    position: relative;
    flex-shrink: 0;
  }

  .settings-title {
    color: var(--color-primary);
    font-size: var(--font-size-lg);
    font-weight: 700;
  }

  .close-button {
    position: absolute;
    top: 1rem;
    right: 1rem;
    color: var(--color-text-muted);
    transition: color var(--transition-base);
    padding: 0.25rem;
    background: none;
    border: none;
    cursor: pointer;
  }

  .close-button:hover {
    color: var(--color-primary);
  }

  .close-icon {
    width: 1.5rem;
    height: 1.5rem;
  }

  /* Tabs */
  .tabs-container {
    border-bottom: 1px solid rgba(var(--color-border-rgb, 229 229 229), 0.5);
    flex-shrink: 0;
  }

  .tabs-list {
    display: flex;
  }

  .tab-button {
    padding: 0.5rem 1rem;
    font-size: var(--font-size-sm);
    font-weight: 500;
    border-bottom: 2px solid transparent;
    transition: all var(--transition-base);
    color: var(--color-text-muted);
    background: none;
    border-left: none;
    border-right: none;
    border-top: none;
    cursor: pointer;
  }

  .tab-button:hover {
    color: var(--color-primary);
  }

  .tab-button.active {
    border-bottom-color: var(--color-primary);
    color: var(--color-primary);
  }

  /* Footer */
  .settings-footer {
    padding: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(var(--color-border-rgb, 229 229 229), 0.5);
    flex-shrink: 0;
  }

  .footer-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: var(--font-size-xs);
    font-family: var(--font-mono);
  }

  .version-text {
    color: var(--color-text-muted);
  }

  .logs-link {
    color: var(--color-primary);
    transition: color var(--transition-base);
    text-decoration: none;
  }

  .logs-link:hover {
    opacity: 0.8;
  }
</style>
