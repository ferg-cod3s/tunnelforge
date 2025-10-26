<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';

  const dispatch = createEventDispatcher();

  // ngrok status
  let status = {
    is_installed: false,
    is_running: false,
    public_url: null as string | null,
    auth_token_configured: false,
    status_error: null as string | null
  };

  let isLoading = false;
  let isStarting = false;
  let port = 4021;
  let authToken = '';

  // Load status on mount
  onMount(async () => {
    await checkStatus();
  });

  async function checkStatus() {
    try {
      isLoading = true;
      const result = await invoke('get_ngrok_status');
      status = result as typeof status;
    } catch (error) {
      console.error('Failed to check ngrok status:', error);
      status.status_error = 'Failed to check status';
    } finally {
      isLoading = false;
    }
  }

  async function startTunnel() {
    try {
      isStarting = true;
      const url = await invoke('start_ngrok_tunnel', {
        port,
        authToken: authToken || undefined
      });
      status.is_running = true;
      status.public_url = url;
      status.status_error = null;
      dispatch('tunnel-started', { url });
    } catch (error) {
      console.error('Failed to start tunnel:', error);
      status.status_error = error as string;
    } finally {
      isStarting = false;
    }
  }

  async function stopTunnel() {
    try {
      await invoke('stop_ngrok_tunnel');
      status.is_running = false;
      status.public_url = null;
      status.status_error = null;
      dispatch('tunnel-stopped');
    } catch (error) {
      console.error('Failed to stop tunnel:', error);
      status.status_error = error as string;
    }
  }

  async function openDownloadPage() {
    try {
      await invoke('open_ngrok_download');
    } catch (error) {
      console.error('Failed to open download page:', error);
    }
  }

  async function openSetupGuide() {
    try {
      await invoke('open_ngrok_setup_guide');
    } catch (error) {
      console.error('Failed to open setup guide:', error);
    }
  }
</script>

<div class="settings-section">
  <h3 class="flex items-center">
    <span class="mr-2">🚇</span>
    ngrok Tunnels
  </h3>
  <p class="mb-4">
    Create secure tunnels to expose your local development server using ngrok's tunneling service.
    Configure your auth token for authenticated tunnels.
  </p>

  <!-- Status Display -->
  <div class="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded">
    <div class="flex items-center justify-between">
      <div>
        <div class="font-medium">
          Status: {status.is_installed ? (status.is_running ? 'Running' : 'Installed') : 'Not Installed'}
          {#if status.auth_token_configured}
            <span class="text-green-600 dark:text-green-400">✓ Authenticated</span>
          {/if}
        </div>
        {#if status.public_url}
          <div class="text-sm text-green-600 dark:text-green-400 mt-1">
            Public URL: <a href={status.public_url} target="_blank" class="underline">{status.public_url}</a>
          </div>
        {/if}
        {#if status.status_error}
          <div class="text-sm text-red-600 dark:text-red-400 mt-1">
            Error: {status.status_error}
          </div>
        {/if}
      </div>
      <button
        class="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
        on:click={checkStatus}
        disabled={isLoading}
      >
        {isLoading ? '...' : 'Refresh'}
      </button>
    </div>
  </div>

  <!-- Installation Section -->
  {#if !status.is_installed}
    <div class="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
      <div class="font-medium text-yellow-800 dark:text-yellow-200 mb-2">Installation Required</div>
      <p class="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
        ngrok is not installed on your system. Install it to use ngrok tunnels.
      </p>
      <div class="flex space-x-2">
        <button
          class="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700"
          on:click={openDownloadPage}
        >
          Download ngrok
        </button>
        <button
          class="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
          on:click={openSetupGuide}
        >
          Setup Guide
        </button>
      </div>
    </div>
  {/if}

  <!-- Configuration Section -->
  {#if status.is_installed}
    <div class="space-y-3">
      <!-- Auth Token -->
      <div>
        <label for="auth-token" class="block text-sm font-medium mb-1">
          Auth Token (optional)
        </label>
        <input
          id="auth-token"
          type="password"
          bind:value={authToken}
          placeholder="Enter your ngrok auth token"
          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded text-sm"
        />
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Get your auth token from <a href="https://dashboard.ngrok.com/get-started/your-authtoken" target="_blank" class="underline">ngrok dashboard</a>
        </p>
      </div>

      <!-- Port -->
      <div class="flex items-center space-x-3">
        <label for="ngrok-port" class="text-sm font-medium">Port:</label>
        <input
          id="ngrok-port"
          type="number"
          bind:value={port}
          min="1"
          max="65535"
          class="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm w-20"
        />
      </div>

      <!-- Tunnel Controls -->
      <div class="flex space-x-2">
        {#if !status.is_running}
          <button
            class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            on:click={startTunnel}
            disabled={isStarting}
          >
            {isStarting ? 'Starting...' : 'Start Tunnel'}
          </button>
        {:else}
          <button
            class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            on:click={stopTunnel}
          >
            Stop Tunnel
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>
