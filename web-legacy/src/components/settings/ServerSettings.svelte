<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let settings: any = {};

  let port = settings.port ?? 4021;
  let maxSessions = settings.max_sessions ?? 10;
  let sessionTimeout = settings.session_timeout ?? 3600; // 1 hour in seconds

  function updateSetting(key: string, value: any) {
    settings[key] = value;
    dispatch('settings-changed', { key, value });
  }
</script>

<div class="settings-section">
  <h3 class="flex items-center">
    <span class="mr-2">🖥️</span>
    Server Settings
  </h3>

  <div class="space-y-4">
    <!-- Server Port -->
    <div>
      <label for="server-port" class="block font-medium mb-2">Server Port</label>
      <input
        id="server-port"
        type="number"
        bind:value={port}
        on:change={() => updateSetting('port', port)}
        min="1024"
        max="65535"
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded"
      />
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
        Port number for the TunnelForge server (default: 4021)
      </p>
    </div>

    <!-- Max Sessions -->
    <div>
      <label for="max-sessions" class="block font-medium mb-2">Maximum Sessions</label>
      <input
        id="max-sessions"
        type="number"
        bind:value={maxSessions}
        on:change={() => updateSetting('max_sessions', maxSessions)}
        min="1"
        max="100"
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded"
      />
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
        Maximum number of concurrent terminal sessions
      </p>
    </div>

    <!-- Session Timeout -->
    <div>
      <label for="session-timeout" class="block font-medium mb-2">Session Timeout (seconds)</label>
      <input
        id="session-timeout"
        type="number"
        bind:value={sessionTimeout}
        on:change={() => updateSetting('session_timeout', sessionTimeout)}
        min="60"
        max="86400"
        step="60"
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded"
      />
      <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
        How long to keep inactive sessions alive (60-86400 seconds)
      </p>
    </div>
  </div>
</div>
