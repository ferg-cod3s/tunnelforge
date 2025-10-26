<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';

  const dispatch = createEventDispatcher();

  // Access mode status
  let status = {
    current_mode: 'LocalhostOnly' as 'LocalhostOnly' | 'NetworkAccess',
    server_port: 4021,
    network_interfaces: [] as string[],
    can_bind_network: false,
    firewall_status: null as string | null
  };

  let isLoading = false;
  let isTesting = false;
  let testResults: string[] = [];

  // Load status on mount
  onMount(async () => {
    await checkNetworkAccess();
  });

  async function checkNetworkAccess() {
    try {
      isLoading = true;
      await invoke('check_network_access');
      const result = await invoke('get_access_mode_status');
      status = result as typeof status;
    } catch (error) {
      console.error('Failed to check network access:', error);
    } finally {
      isLoading = false;
    }
  }

  async function setAccessMode(mode: 'LocalhostOnly' | 'NetworkAccess') {
    try {
      await invoke('set_access_mode', { mode, port: status.server_port });
      status.current_mode = mode;
      dispatch('mode-changed', { mode });
    } catch (error) {
      console.error('Failed to set access mode:', error);
    }
  }

  async function testConnectivity() {
    try {
      isTesting = true;
      const results = await invoke('test_network_connectivity');
      testResults = results as string[];
    } catch (error) {
      console.error('Failed to test connectivity:', error);
      testResults = ['Error testing connectivity'];
    } finally {
      isTesting = false;
    }
  }

  function getCurrentBinding() {
    return status.current_mode === 'LocalhostOnly'
      ? `127.0.0.1:${status.server_port}`
      : `0.0.0.0:${status.server_port}`;
  }
</script>

<div class="settings-section">
  <h3 class="flex items-center">
    <span class="mr-2">🌐</span>
    Access Mode Controls
  </h3>
  <p class="mb-4">
    Control how TunnelForge binds to network interfaces. Choose between localhost-only access or network-wide access.
  </p>

  <!-- Current Status -->
  <div class="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded">
    <div class="flex items-center justify-between">
      <div>
        <div class="font-medium">Current Mode: {status.current_mode === 'LocalhostOnly' ? 'Localhost Only' : 'Network Access'}</div>
        <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Binding: <code class="bg-gray-200 dark:bg-gray-700 px-1 rounded">{getCurrentBinding()}</code>
        </div>
        {#if status.firewall_status}
          <div class="text-sm text-blue-600 dark:text-blue-400 mt-1">
            Firewall: {status.firewall_status}
          </div>
        {/if}
      </div>
      <button
        class="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
        on:click={checkNetworkAccess}
        disabled={isLoading}
      >
        {isLoading ? '...' : 'Refresh'}
      </button>
    </div>
  </div>

  <!-- Network Interfaces -->
  {#if status.network_interfaces.length > 0}
    <div class="mb-4">
      <div class="font-medium text-sm mb-2">Available Network Interfaces:</div>
      <div class="flex flex-wrap gap-2">
        {#each status.network_interfaces as interface}
          <span class="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 text-xs rounded">
            {interface}
          </span>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Access Mode Selection -->
  <div class="space-y-3">
    <div class="flex items-center space-x-4">
      <label class="flex items-center">
        <input
          type="radio"
          bind:group={status.current_mode}
          value="LocalhostOnly"
          on:change={() => setAccessMode('LocalhostOnly')}
          class="mr-2"
        />
        <div>
          <div class="font-medium">Localhost Only</div>
          <div class="text-sm text-gray-600 dark:text-gray-400">Only accessible from this machine</div>
        </div>
      </label>
    </div>

    <div class="flex items-center space-x-4">
      <label class="flex items-center">
        <input
          type="radio"
          bind:group={status.current_mode}
          value="NetworkAccess"
          on:change={() => setAccessMode('NetworkAccess')}
          class="mr-2"
          disabled={!status.can_bind_network}
        />
        <div>
          <div class="font-medium">Network Access</div>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            Accessible from other devices on the network
            {#if !status.can_bind_network}
              <span class="text-red-600 dark:text-red-400">(Not available)</span>
            {/if}
          </div>
        </div>
      </label>
    </div>
  </div>

  <!-- Connectivity Test -->
  <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
    <div class="flex items-center justify-between mb-2">
      <div class="font-medium text-sm">Network Connectivity Test</div>
      <button
        class="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        on:click={testConnectivity}
        disabled={isTesting}
      >
        {isTesting ? 'Testing...' : 'Test Connectivity'}
      </button>
    </div>

    {#if testResults.length > 0}
      <div class="bg-gray-50 dark:bg-gray-800 p-3 rounded text-sm">
        {#each testResults as result}
          <div class="font-mono">{result}</div>
        {/each}
      </div>
    {/if}
  </div>
</div>
