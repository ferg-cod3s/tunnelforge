<script lang="ts">
  /**
   * TunnelForge Desktop Settings
   *
   * Native settings panel for the Tauri desktop application.
   * Manages server configuration, power settings, integrations, and notifications.
   *
   * This is NOT the web terminal UI - this is just for app configuration.
   * The web terminal is accessed via browser at http://localhost:4020
   */

  import { invoke } from '@tauri-apps/api/core';
  import { onMount } from 'svelte';

  interface SettingsConfig {
    autostart: boolean;
    show_in_dock: boolean;
    prevent_sleep: boolean;
    server_port: string;
    access_mode: string;
    notifications_enabled: boolean;
    notification_sound: boolean;
    show_in_notification_center: boolean;
    notification_session_start: boolean;
    notification_session_exit: boolean;
    notification_command_error: boolean;
    notification_command_completion: boolean;
    notification_bell: boolean;
    notification_claude_turn: boolean;
    tailscale_enabled: boolean;
    cloudflare_enabled: boolean;
    ngrok_enabled: boolean;
  }

  let config = $state<SettingsConfig>({
    autostart: false,
    show_in_dock: true,
    prevent_sleep: true,
    server_port: '4020',
    access_mode: 'localhost',
    notifications_enabled: true,
    notification_sound: true,
    show_in_notification_center: true,
    notification_session_start: true,
    notification_session_exit: true,
    notification_command_error: true,
    notification_command_completion: false,
    notification_bell: false,
    notification_claude_turn: false,
    tailscale_enabled: false,
    cloudflare_enabled: false,
    ngrok_enabled: false,
  });

  let serverStatus = $state<'running' | 'stopped' | 'unknown'>('unknown');
  let saving = $state(false);
  let message = $state<{ type: 'success' | 'error'; text: string } | null>(null);

  onMount(async () => {
    await loadConfig();
    await checkServerStatus();
  });

  async function loadConfig() {
    try {
      const loadedConfig = await invoke<SettingsConfig>('get_settings_config');
      config = loadedConfig;
    } catch (err) {
      console.error('Failed to load config:', err);
    }
  }

  async function checkServerStatus() {
    try {
      const status = await invoke<any>('get_server_status');
      serverStatus = status.running ? 'running' : 'stopped';
    } catch (err) {
      console.error('Failed to get server status:', err);
      serverStatus = 'unknown';
    }
  }

  async function saveSettings() {
    saving = true;
    message = null;

    try {
      await invoke('save_settings_config', { config });
      message = { type: 'success', text: 'Settings saved successfully!' };

      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        if (message?.type === 'success') {
          message = null;
        }
      }, 3000);
    } catch (err) {
      message = { type: 'error', text: `Failed to save: ${err}` };
    } finally {
      saving = false;
    }
  }

  async function openWebUI() {
    const url = `http://localhost:${config.server_port}`;
    await invoke('open_external_url', { url });
  }

  async function startServer() {
    try {
      await invoke('start_server');
      await checkServerStatus();
      message = { type: 'success', text: 'Server started successfully!' };
    } catch (err) {
      message = { type: 'error', text: `Failed to start server: ${err}` };
    }
  }

  async function stopServer() {
    try {
      await invoke('stop_server');
      await checkServerStatus();
      message = { type: 'success', text: 'Server stopped' };
    } catch (err) {
      message = { type: 'error', text: `Failed to stop server: ${err}` };
    }
  }
</script>

<main class="settings-container">
  <header class="settings-header">
    <h1>TunnelForge Settings</h1>
    <p class="subtitle">Configure your terminal sharing application</p>
  </header>

  {#if message}
    <div class="message {message.type}">
      {message.text}
    </div>
  {/if}

  <div class="settings-sections">
    <!-- Server Section -->
    <section class="settings-section">
      <h2>Server</h2>

      <div class="setting-group">
        <div class="server-status">
          <span class="label">Status:</span>
          <span class="status-badge {serverStatus}">
            {serverStatus === 'running' ? '🟢 Running' : serverStatus === 'stopped' ? '🔴 Stopped' : '⚪ Unknown'}
          </span>
        </div>

        <div class="button-group">
          {#if serverStatus !== 'running'}
            <button class="btn btn-primary" onclick={startServer}>Start Server</button>
          {:else}
            <button class="btn btn-secondary" onclick={stopServer}>Stop Server</button>
          {/if}
          <button class="btn btn-secondary" onclick={openWebUI}>
            Open Web UI →
          </button>
        </div>
      </div>

      <div class="form-field">
        <label for="server-port">Server Port</label>
        <input
          id="server-port"
          type="number"
          bind:value={config.server_port}
          min="1024"
          max="65535"
        />
        <span class="help-text">Port for the web server (requires restart)</span>
      </div>

      <div class="form-field">
        <label>
          <input type="checkbox" bind:checked={config.autostart} />
          Start server automatically on login
        </label>
      </div>
    </section>

    <!-- Power Management -->
    <section class="settings-section">
      <h2>Power Management</h2>

      <div class="form-field">
        <label>
          <input type="checkbox" bind:checked={config.prevent_sleep} />
          Prevent sleep when terminal sessions are active
        </label>
        <span class="help-text">Keep your computer awake while terminals are running</span>
      </div>
    </section>

    <!-- Access Mode -->
    <section class="settings-section">
      <h2>Access Mode</h2>

      <div class="form-field">
        <label for="access-mode">Connection Type</label>
        <select id="access-mode" bind:value={config.access_mode}>
          <option value="localhost">Localhost only (most secure)</option>
          <option value="lan">Local network</option>
          <option value="internet">Internet (with tunnel)</option>
        </select>
        <span class="help-text">
          {#if config.access_mode === 'localhost'}
            Only accessible from this computer (http://localhost:{config.server_port})
          {:else if config.access_mode === 'lan'}
            Accessible from devices on your local network
          {:else}
            Accessible from anywhere (requires tunnel service)
          {/if}
        </span>
      </div>
    </section>

    <!-- Tunnel Integrations -->
    <section class="settings-section">
      <h2>Tunnel Services</h2>
      <p class="section-description">Enable secure tunneling for remote access</p>

      <div class="form-field">
        <label>
          <input type="checkbox" bind:checked={config.ngrok_enabled} />
          ngrok
        </label>
        <span class="help-text">Fast tunnels with free tier</span>
      </div>

      <div class="form-field">
        <label>
          <input type="checkbox" bind:checked={config.cloudflare_enabled} />
          Cloudflare Tunnel
        </label>
        <span class="help-text">Cloudflare's secure tunnel service</span>
      </div>

      <div class="form-field">
        <label>
          <input type="checkbox" bind:checked={config.tailscale_enabled} />
          Tailscale
        </label>
        <span class="help-text">Private network overlay</span>
      </div>
    </section>

    <!-- Notifications -->
    <section class="settings-section">
      <h2>Notifications</h2>

      <div class="form-field">
        <label>
          <input type="checkbox" bind:checked={config.notifications_enabled} />
          Enable notifications
        </label>
      </div>

      {#if config.notifications_enabled}
        <div class="notification-options">
          <div class="form-field">
            <label>
              <input type="checkbox" bind:checked={config.notification_sound} />
              Play sound
            </label>
          </div>

          <div class="form-field">
            <label>
              <input type="checkbox" bind:checked={config.notification_session_start} />
              Notify when session starts
            </label>
          </div>

          <div class="form-field">
            <label>
              <input type="checkbox" bind:checked={config.notification_session_exit} />
              Notify when session exits
            </label>
          </div>

          <div class="form-field">
            <label>
              <input type="checkbox" bind:checked={config.notification_command_error} />
              Notify on command errors
            </label>
          </div>
        </div>
      {/if}
    </section>

    <!-- Appearance -->
    <section class="settings-section">
      <h2>Appearance</h2>

      <div class="form-field">
        <label>
          <input type="checkbox" bind:checked={config.show_in_dock} />
          Show icon in Dock/Taskbar
        </label>
        <span class="help-text">When disabled, only shows in system tray</span>
      </div>
    </section>
  </div>

  <footer class="settings-footer">
    <button class="btn btn-primary btn-large" onclick={saveSettings} disabled={saving}>
      {saving ? 'Saving...' : 'Save Settings'}
    </button>
  </footer>
</main>

<style>
  .settings-container {
    max-width: 700px;
    margin: 0 auto;
    padding: 2rem;
  }

  .settings-header {
    margin-bottom: 2rem;
  }

  .settings-header h1 {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  .subtitle {
    color: var(--text-muted);
    font-size: 0.95rem;
  }

  .message {
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
    font-size: 0.95rem;
  }

  .message.success {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgb(16, 185, 129);
    color: rgb(16, 185, 129);
  }

  .message.error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgb(239, 68, 68);
    color: rgb(239, 68, 68);
  }

  .settings-sections {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .settings-section {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    padding: 1.5rem;
  }

  .settings-section h2 {
    font-size: 1.25rem;
    margin-bottom: 1rem;
  }

  .section-description {
    color: var(--text-muted);
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }

  .setting-group {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .server-status {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .status-badge.running {
    background: rgba(16, 185, 129, 0.1);
    color: rgb(16, 185, 129);
  }

  .status-badge.stopped {
    background: rgba(239, 68, 68, 0.1);
    color: rgb(239, 68, 68);
  }

  .status-badge.unknown {
    background: rgba(163, 163, 163, 0.1);
    color: var(--text-muted);
  }

  .button-group {
    display: flex;
    gap: 0.75rem;
  }

  .form-field {
    margin-bottom: 1.25rem;
  }

  .form-field:last-child {
    margin-bottom: 0;
  }

  .form-field label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
    font-size: 0.95rem;
  }

  .form-field label input[type="checkbox"] {
    margin-right: 0.5rem;
  }

  .form-field input[type="text"],
  .form-field input[type="number"],
  .form-field select {
    width: 100%;
    padding: 0.625rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 0.375rem;
    color: var(--text);
    font-size: 0.95rem;
  }

  .help-text {
    display: block;
    margin-top: 0.375rem;
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  .notification-options {
    margin-left: 1.5rem;
    padding-left: 1rem;
    border-left: 2px solid var(--border);
  }

  .btn {
    padding: 0.625rem 1.25rem;
    border-radius: 0.375rem;
    border: none;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 0.95rem;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--accent-primary);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--accent-primary-hover);
  }

  .btn-secondary {
    background: transparent;
    color: var(--text);
    border: 1px solid var(--border);
  }

  .btn-secondary:hover:not(:disabled) {
    background: var(--bg-elevated);
  }

  .btn-large {
    padding: 0.75rem 2rem;
    font-size: 1rem;
  }

  .settings-footer {
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: flex-end;
  }
</style>
