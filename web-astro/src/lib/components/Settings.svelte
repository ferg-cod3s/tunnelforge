<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createLogger } from '$lib/utils/logger';
  import SettingToggle from './SettingToggle.svelte';
  import SettingInput from './SettingInput.svelte';
  import SettingSelect from './SettingSelect.svelte';
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
    class="fixed inset-0 bg-bg/80 backdrop-blur-sm flex items-center justify-center z-50"
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
    <div
      class="modal-content font-mono text-sm w-full max-w-[calc(100vw-1rem)] sm:max-w-md lg:max-w-2xl mx-2 sm:mx-4 max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col"
    >
      <!-- Header -->
      <div class="p-4 pb-4 border-b border-border/50 relative flex-shrink-0">
        <h2 id="settings-title" class="text-primary text-lg font-bold">Settings</h2>
        <button
          class="absolute top-4 right-4 text-text-muted hover:text-primary transition-colors p-1"
          onclick={handleClose}
          title="Close"
          aria-label="Close settings"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Tabs -->
      <div class="border-b border-border/50 flex-shrink-0">
        <div class="flex">
          <button
            class="px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeTab === 'general' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-primary'}"
            onclick={() => activeTab = 'general'}
          >
            General
          </button>
          <button
            class="px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeTab === 'notifications' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-primary'}"
            onclick={() => activeTab = 'notifications'}
          >
            Notifications
          </button>
          <button
            class="px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeTab === 'domains' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-primary'}"
            onclick={() => activeTab = 'domains'}
          >
            Domains
          </button>
          <button
            class="px-4 py-2 text-sm font-medium border-b-2 transition-colors {activeTab === 'tunnels' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-primary'}"
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
          <SettingsSection title="Cloudflare Quick Tunnels" description={tunnelStatus.running ? '● Running' : '● Stopped'}>
            {#if !tunnelInstalled}
              <div class="p-4 bg-status-warning/10 border border-status-warning rounded-lg">
                <p class="text-sm text-status-warning mb-2">
                  ⚠️ cloudflared is not installed
                </p>
                <p class="text-xs text-status-warning opacity-80">
                  Please install cloudflared to use tunnel features. Visit
                  <a
                    href="https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
                    target="_blank"
                    class="underline"
                  >
                    Cloudflare documentation
                  </a>
                  for installation instructions.
                </p>
              </div>
            {:else}
              <div class="p-4 bg-bg-tertiary rounded-lg border border-border/50">
                <p class="text-xs text-muted mb-3">
                  Start a temporary Cloudflare tunnel to expose your local development server. The tunnel creates a public URL that you can share for testing.
                </p>

                 <div class="space-y-3">
                  <SettingInput
                    label="Local Port"
                    type="number"
                    value={quickTunnelPort.toString()}
                    onchange={(value) => quickTunnelPort = Number.parseInt(value, 10) || 3000}
                    disabled={tunnelStatus.running}
                  />

                  {#if tunnelStatus.running}
                    <div class="p-3 bg-bg rounded-lg">
                      <div class="text-xs text-muted mb-1">Public URL</div>
                      <div class="flex items-center space-x-2">
                        <code class="text-xs text-primary flex-1 truncate break-all"
                          >{tunnelStatus.url || 'Starting tunnel...'}</code
                        >
                        {#if tunnelStatus.url}
                          <button
                            class="text-primary hover:text-primary-hover text-xs transition-colors flex-shrink-0"
                            onclick={() => {
                              navigator.clipboard.writeText(tunnelStatus.url!);
                              onsuccess?.({ detail: 'URL copied to clipboard' });
                            }}
                            title="Copy URL"
                          >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                          </button>
                        {/if}
                      </div>
                    </div>

                    <button
                      class="btn-secondary w-full text-sm py-2"
                      onclick={handleStopTunnel}
                      disabled={isTunnelLoading}
                    >
                      {isTunnelLoading ? 'Stopping...' : 'Stop Tunnel'}
                    </button>
                  {:else}
                    <button
                      class="btn-primary w-full text-sm py-2"
                      onclick={handleStartQuickTunnel}
                      disabled={isTunnelLoading}
                    >
                      {isTunnelLoading ? 'Starting...' : 'Start Tunnel'}
                    </button>
                  {/if}
                </div>
              </div>

              <div class="p-3 bg-bg-tertiary rounded-lg border border-border/50 text-xs text-muted">
                <p class="font-medium text-primary mb-1">Note:</p>
                <p>
                  Quick tunnels are temporary and will stop when the server restarts. For production use cases with custom domains,
                  configure an authenticated Cloudflare tunnel using the Cloudflare dashboard.
                </p>
              </div>
            {/if}
          </SettingsSection>
        {/if}
      </div>

      <!-- Footer -->
      <div class="p-4 pt-3 border-t border-border/50 flex-shrink-0">
        <div class="flex items-center justify-between text-xs font-mono">
          <span class="text-muted">v{VERSION}</span>
          <a href="/logs" class="text-primary hover:text-primary-hover transition-colors" target="_blank">
            View Logs
          </a>
        </div>
      </div>
    </div>
  </div>
{/if}