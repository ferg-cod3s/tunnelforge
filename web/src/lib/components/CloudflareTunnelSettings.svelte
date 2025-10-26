<script lang="ts">
  import SettingsSection from './SettingsSection.svelte';
  import SettingToggle from './SettingToggle.svelte';
  import SettingInput from './SettingInput.svelte';

  interface TunnelStatus {
    running: boolean;
    publicURL: string;
    type: string;
  }

  interface TunnelConfig {
    tunnelId: string;
    tunnelName: string;
    hostname: string;
    credPath: string;
    useQuickTunnel: boolean;
  }

  let isLoading = $state(false);
  let status = $state<TunnelStatus>({
    running: false,
    publicURL: '',
    type: ''
  });

  let config = $state<TunnelConfig>({
    tunnelId: '',
    tunnelName: '',
    hostname: '',
    credPath: '',
    useQuickTunnel: true
  });

  let errorMessage = $state('');
  let successMessage = $state('');

  async function loadTunnelStatus() {
    try {
      isLoading = true;
      errorMessage = '';

      const response = await fetch('/api/tunnels/status');
      if (!response.ok) {
        throw new Error(`Failed to load tunnel status: ${response.statusText}`);
      }

      const data = await response.json();
      status = data;
    } catch (error) {
      console.error('Failed to load tunnel status:', error);
      errorMessage = error instanceof Error ? error.message : 'Failed to load tunnel status';
    } finally {
      isLoading = false;
    }
  }

  async function startQuickTunnel() {
    try {
      isLoading = true;
      errorMessage = '';
      successMessage = '';

      const response = await fetch('/api/tunnels/cloudflare/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          useQuickTunnel: true
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to start quick tunnel');
      }

      successMessage = 'Quick tunnel started successfully';
      await loadTunnelStatus();
    } catch (error) {
      console.error('Failed to start quick tunnel:', error);
      errorMessage = error instanceof Error ? error.message : 'Failed to start quick tunnel';
    } finally {
      isLoading = false;
    }
  }

  async function startCustomTunnel() {
    try {
      isLoading = true;
      errorMessage = '';
      successMessage = '';

      // Validate required fields
      if (!config.hostname) {
        throw new Error('Hostname is required for custom tunnels');
      }
      if (!config.tunnelId && !config.tunnelName) {
        throw new Error('Either Tunnel ID or Tunnel Name is required');
      }

      const response = await fetch('/api/tunnels/cloudflare/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tunnelId: config.tunnelId,
          tunnelName: config.tunnelName,
          hostname: config.hostname,
          credPath: config.credPath,
          useQuickTunnel: false
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to start custom tunnel');
      }

      successMessage = 'Custom tunnel started successfully';
      await loadTunnelStatus();
    } catch (error) {
      console.error('Failed to start custom tunnel:', error);
      errorMessage = error instanceof Error ? error.message : 'Failed to start custom tunnel';
    } finally {
      isLoading = false;
    }
  }

  async function stopTunnel() {
    try {
      isLoading = true;
      errorMessage = '';
      successMessage = '';

      const response = await fetch('/api/tunnels/cloudflare/stop', {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to stop tunnel');
      }

      successMessage = 'Tunnel stopped successfully';
      await loadTunnelStatus();
    } catch (error) {
      console.error('Failed to stop tunnel:', error);
      errorMessage = error instanceof Error ? error.message : 'Failed to stop tunnel';
    } finally {
      isLoading = false;
    }
  }

  function toggleTunnelType(checked: boolean) {
    config.useQuickTunnel = checked;
  }

  // Load status on mount
  $effect(() => {
    loadTunnelStatus();
  });
</script>

<SettingsSection
  title="Cloudflare Tunnel"
  description="Expose your TunnelForge server to the internet using Cloudflare Tunnel. Choose between quick tunnel (temporary) or custom domain (permanent)."
>
  <!-- Current Status -->
  <div class="p-4 bg-bg-tertiary rounded-lg border border-border/50 space-y-3">
    <div class="flex items-center justify-between">
      <span class="text-sm font-medium text-text-secondary">Status</span>
      <span class="text-sm font-medium {status.running ? 'text-green-500' : 'text-text-tertiary'}">
        {status.running ? 'Running' : 'Stopped'}
      </span>
    </div>

    {#if status.running && status.publicURL}
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-text-secondary">Public URL</span>
        <a
          href={status.publicURL}
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm text-blue-500 hover:text-blue-400 underline"
        >
          {status.publicURL}
        </a>
      </div>
    {/if}

    {#if status.running}
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-text-secondary">Type</span>
        <span class="text-sm text-text-tertiary">
          {status.type === 'cloudflare' ? 'Cloudflare Tunnel' : status.type}
        </span>
      </div>
    {/if}
  </div>

  <!-- Error/Success Messages -->
  {#if errorMessage}
    <div class="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
      <p class="text-sm text-red-500">{errorMessage}</p>
    </div>
  {/if}

  {#if successMessage}
    <div class="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
      <p class="text-sm text-green-500">{successMessage}</p>
    </div>
  {/if}

  <!-- Tunnel Type Toggle -->
  <SettingToggle
    label="Use Quick Tunnel (Temporary)"
    description="Quick tunnel provides a temporary random subdomain. Turn off to use a custom domain."
    checked={config.useQuickTunnel}
    onchange={toggleTunnelType}
    disabled={status.running || isLoading}
  />

  <!-- Quick Tunnel Section -->
  {#if config.useQuickTunnel}
    <div class="p-4 bg-bg-tertiary/50 rounded-lg border border-border/30 space-y-3">
      <div class="space-y-1">
        <h4 class="text-sm font-medium text-text-primary">Quick Tunnel</h4>
        <p class="text-xs text-text-tertiary">
          Creates a temporary tunnel with a random subdomain like abc-123.trycloudflare.com
        </p>
      </div>

      <button
        onclick={status.running ? stopTunnel : startQuickTunnel}
        disabled={isLoading}
        class="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-bg-tertiary disabled:text-text-tertiary text-white rounded-lg text-sm font-medium transition-colors"
      >
        {isLoading ? 'Loading...' : status.running ? 'Stop Tunnel' : 'Start Quick Tunnel'}
      </button>
    </div>
  {:else}
    <!-- Custom Domain Section -->
    <div class="p-4 bg-bg-tertiary/50 rounded-lg border border-border/30 space-y-4">
      <div class="space-y-1">
        <h4 class="text-sm font-medium text-text-primary">Custom Domain</h4>
        <p class="text-xs text-text-tertiary">
          Use your own domain with a named Cloudflare tunnel.
          <a href="/docs/cloudflare-custom-domains.md" target="_blank" class="text-blue-500 hover:text-blue-400 underline">
            Setup guide
          </a>
        </p>
      </div>

      <SettingInput
        label="Hostname"
        placeholder="tunnelforge.yourdomain.com"
        value={config.hostname}
        onchange={(value) => config.hostname = value}
        disabled={status.running || isLoading}
        description="Your custom domain name"
      />

      <SettingInput
        label="Tunnel ID"
        placeholder="00000000-0000-0000-0000-000000000000"
        value={config.tunnelId}
        onchange={(value) => config.tunnelId = value}
        disabled={status.running || isLoading}
        description="Cloudflare tunnel ID (or use Tunnel Name below)"
      />

      <SettingInput
        label="Tunnel Name"
        placeholder="tunnelforge"
        value={config.tunnelName}
        onchange={(value) => config.tunnelName = value}
        disabled={status.running || isLoading}
        description="Cloudflare tunnel name (alternative to Tunnel ID)"
      />

      <SettingInput
        label="Credentials Path"
        placeholder="/home/user/.cloudflared/tunnel-id.json"
        value={config.credPath}
        onchange={(value) => config.credPath = value}
        disabled={status.running || isLoading}
        description="Path to tunnel credentials file (optional if using default location)"
      />

      <div class="flex gap-3">
        <button
          onclick={status.running ? stopTunnel : startCustomTunnel}
          disabled={isLoading}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-bg-tertiary disabled:text-text-tertiary text-white rounded-lg text-sm font-medium transition-colors"
        >
          {isLoading ? 'Loading...' : status.running ? 'Stop Tunnel' : 'Start Custom Tunnel'}
        </button>

        <button
          onclick={loadTunnelStatus}
          disabled={isLoading}
          class="px-4 py-2 bg-bg-tertiary hover:bg-bg-secondary disabled:opacity-50 text-text-primary rounded-lg text-sm font-medium transition-colors"
        >
          Refresh Status
        </button>
      </div>
    </div>
  {/if}

  <!-- Help Text -->
  <div class="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
    <p class="text-xs text-blue-400">
      <strong>Note:</strong> Cloudflared must be installed on your system.
      <a href="https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
         target="_blank"
         rel="noopener noreferrer"
         class="underline hover:text-blue-300">
        Installation instructions
      </a>
    </p>
  </div>
</SettingsSection>
