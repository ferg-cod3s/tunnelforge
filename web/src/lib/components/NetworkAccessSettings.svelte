<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import SettingToggle from './SettingToggle.svelte';
  import SettingsSection from './SettingsSection.svelte';

  interface AccessModeStatus {
    current_mode: 'LocalhostOnly' | 'NetworkAccess';
    server_port: number;
    network_interfaces: string[];
    can_bind_network: boolean;
    firewall_status: string | null;
  }

  let isLoading = $state(false);
  let isTesting = $state(false);
  let testResults = $state<string[]>([]);
  let errorMessage = $state<string>('');
  let status = $state<AccessModeStatus>({
    current_mode: 'LocalhostOnly',
    server_port: 4021,
    network_interfaces: [],
    can_bind_network: false,
    firewall_status: null,
  });

  onMount(async () => {
    await loadAccessModeStatus();
  });

  async function loadAccessModeStatus() {
    try {
      isLoading = true;
      errorMessage = '';
      
      // Check network access first
      await invoke('check_network_access');
      
      // Then get the status
      const result = (await invoke('get_access_mode_status')) as AccessModeStatus;
      status = result;
    } catch (error) {
      console.error('Failed to load access mode status:', error);
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      isLoading = false;
    }
  }

  async function toggleNetworkAccess() {
    try {
      isLoading = true;
      errorMessage = '';
      
      // Toggle the access mode via config command
      const newMode = status.current_mode === 'LocalhostOnly' ? 'NetworkAccess' : 'LocalhostOnly';
      await invoke('toggle_access_mode');
      
      // Reload status
      await loadAccessModeStatus();
    } catch (error) {
      console.error('Failed to toggle network access:', error);
      errorMessage = error instanceof Error ? error.message : String(error);
    } finally {
      isLoading = false;
    }
  }

  async function testConnectivity() {
    try {
      isTesting = true;
      testResults = [];
      
      const results = (await invoke('test_network_connectivity')) as string[];
      testResults = results;
    } catch (error) {
      console.error('Failed to test connectivity:', error);
      testResults = ['Error: ' + (error instanceof Error ? error.message : String(error))];
    } finally {
      isTesting = false;
    }
  }

  function getCurrentBinding(): string {
    return status.current_mode === 'LocalhostOnly'
      ? `127.0.0.1:${status.server_port}`
      : `0.0.0.0:${status.server_port}`;
  }

  function canToggle(): boolean {
    return !isLoading && (status.current_mode === 'LocalhostOnly' || status.can_bind_network);
  }
</script>

<SettingsSection title="Network Access" description="Control how TunnelForge is accessible on your network">
  {#if errorMessage}
    <div class="p-4 bg-status-error/10 border border-status-error rounded-lg mb-4">
      <p class="text-sm text-status-error">{errorMessage}</p>
    </div>
  {/if}

  <!-- Current Status Display -->
  <div class="p-4 bg-bg-tertiary rounded-lg border border-border/50 mb-4">
    <div class="flex items-center justify-between">
      <div class="flex-1">
        <div class="flex items-center gap-2">
          <span class="text-primary font-medium">
            {status.current_mode === 'LocalhostOnly' ? '🔒 Localhost Only' : '🌐 Network Access'}
          </span>
          {#if isLoading}
            <span class="text-xs text-muted">Loading...</span>
          {/if}
        </div>
        <p class="text-muted text-xs mt-2">
          Binding: <code class="bg-bg-elevated px-2 py-1 rounded font-mono text-xs">{getCurrentBinding()}</code>
        </p>
        {#if status.firewall_status}
          <p class="text-muted text-xs mt-1">
            Firewall: <span class="text-status-info">{status.firewall_status}</span>
          </p>
        {/if}
      </div>
      <button
        onclick={loadAccessModeStatus}
        disabled={isLoading}
        class="px-3 py-2 text-xs bg-bg-elevated hover:bg-border rounded transition-colors duration-200"
        title="Refresh network status"
      >
        {isLoading ? '...' : '↻'}
      </button>
    </div>
  </div>

  <!-- Network Interfaces List -->
  {#if status.network_interfaces.length > 0}
    <div class="mb-4 p-4 bg-bg-tertiary rounded-lg border border-border/50">
      <p class="text-primary text-xs font-medium mb-2">Available Network Interfaces:</p>
      <div class="flex flex-wrap gap-2">
        {#each status.network_interfaces as iface}
          <span class="px-2 py-1 bg-status-success/10 text-status-success text-xs rounded font-mono">
            {iface}
          </span>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Access Mode Toggle -->
  <div class="p-4 bg-bg-tertiary rounded-lg border border-border/50 mb-4">
    <div class="flex items-center justify-between">
      <div class="flex-1">
        <span class="text-primary font-medium block">Enable Network Access</span>
        <p class="text-muted text-xs mt-1">
          {#if status.current_mode === 'LocalhostOnly'}
            TunnelForge is accessible only from this machine. Enable to access from other devices on your network.
          {:else}
            TunnelForge is accessible from other devices on your network.
          {/if}
        </p>
        {#if status.current_mode === 'NetworkAccess' && !status.can_bind_network}
          <p class="text-status-warning text-xs mt-1">
            ⚠️ Network access may not be available on this system
          </p>
        {/if}
      </div>
      <SettingToggle
        label="Network Access"
        checked={status.current_mode === 'NetworkAccess'}
        disabled={!canToggle()}
        onchange={toggleNetworkAccess}
      />
    </div>
  </div>

  <!-- Connectivity Test -->
  <div class="p-4 bg-bg-tertiary rounded-lg border border-border/50">
    <div class="flex items-center justify-between mb-3">
      <span class="text-primary font-medium text-sm">Network Connectivity Test</span>
      <button
        onclick={testConnectivity}
        disabled={isTesting || isLoading}
        class="px-3 py-2 text-xs bg-primary text-bg hover:opacity-90 rounded transition-opacity duration-200"
      >
        {isTesting ? 'Testing...' : 'Test Connection'}
      </button>
    </div>

    {#if testResults.length > 0}
      <div class="bg-bg-elevated p-3 rounded border border-border text-xs font-mono text-muted max-h-40 overflow-y-auto">
        {#each testResults as result}
          <div class="break-all">{result}</div>
        {/each}
      </div>
    {/if}
  </div>
</SettingsSection>
