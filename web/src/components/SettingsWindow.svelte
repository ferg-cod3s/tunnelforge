<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import CloudflareIntegration from './integrations/CloudflareIntegration.svelte';
  import NgrokIntegration from './integrations/NgrokIntegration.svelte';
  import AccessModeControls from './integrations/AccessModeControls.svelte';
  import NotificationSettings from './settings/NotificationSettings.svelte';
  import ServerSettings from './settings/ServerSettings.svelte';
  import GeneralSettings from './settings/GeneralSettings.svelte';

  // Settings state
  let activeTab = 'general';
  let isLoading = true;
  let settings = {
    general: {},
    server: {},
    notifications: {},
    integrations: {}
  };

  // Initialize Tauri window
  onMount(async () => {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.setTitle('TunnelForge Settings');

      // Load initial settings
      await loadSettings();
      isLoading = false;
    } catch (error) {
      console.error('Failed to initialize settings window:', error);
      isLoading = false;
    }
  });

  async function loadSettings() {
    try {
      // Load settings from Tauri backend
      const config = await invoke('get_config');
      settings = { ...settings, ...config };
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async function saveSettings() {
    try {
      await invoke('save_config', { config: settings });
      // Show success notification
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  const tabs = [
    { id: 'general', name: 'General', icon: '⚙️' },
    { id: 'server', name: 'Server', icon: '🖥️' },
    { id: 'notifications', name: 'Notifications', icon: '🔔' },
    { id: 'integrations', name: 'Integrations', icon: '🔗' }
  ];
</script>

<div class="h-full flex flex-col bg-white dark:bg-gray-900">
  <!-- Header -->
  <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
    <h1 class="text-xl font-semibold text-gray-900 dark:text-white">TunnelForge Settings</h1>
    <div class="flex items-center space-x-2">
      <button
        class="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        on:click={saveSettings}
      >
        Save
      </button>
      <button
        class="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
        on:click={() => getCurrentWindow().close()}
      >
        Close
      </button>
    </div>
  </div>

  <!-- Tab Navigation -->
  <div class="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
    {#each tabs as tab}
      <button
        class="flex items-center px-4 py-2 text-sm font-medium transition-colors {activeTab === tab.id
          ? 'text-blue-600 border-b-2 border-blue-600 bg-white dark:bg-gray-900 dark:text-blue-400'
          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}"
        on:click={() => activeTab = tab.id}
      >
        <span class="mr-2">{tab.icon}</span>
        {tab.name}
      </button>
    {/each}
  </div>

  <!-- Tab Content -->
  <div class="flex-1 overflow-auto">
    {#if isLoading}
      <div class="flex items-center justify-center h-full">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    {:else}
      {#if activeTab === 'general'}
        <GeneralSettings bind:settings={settings.general} />
      {:else if activeTab === 'server'}
        <ServerSettings bind:settings={settings.server} />
      {:else if activeTab === 'notifications'}
        <NotificationSettings bind:settings={settings.notifications} />
      {:else if activeTab === 'integrations'}
        <div class="p-6 space-y-6">
          <CloudflareIntegration />
          <NgrokIntegration />
          <AccessModeControls />
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
  /* Additional custom styles for the settings window */
  :global(.settings-section) {
    @apply bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6;
  }

  :global(.settings-section h3) {
    @apply text-lg font-medium text-gray-900 dark:text-white mb-4;
  }

  :global(.settings-section p) {
    @apply text-sm text-gray-600 dark:text-gray-400 mb-4;
  }
</style>
