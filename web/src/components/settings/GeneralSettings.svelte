<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let settings: any = {};

  let autoStart = settings.auto_start ?? true;
  let theme = settings.theme ?? 'system';
  let startMinimized = settings.start_minimized ?? false;

  function updateSetting(key: string, value: any) {
    settings[key] = value;
    dispatch('settings-changed', { key, value });
  }
</script>

<div class="settings-section">
  <h3 class="flex items-center">
    <span class="mr-2">⚙️</span>
    General Settings
  </h3>

  <div class="space-y-4">
    <!-- Auto Start -->
    <div class="flex items-center justify-between">
      <div>
        <div class="font-medium">Start on Login</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">
          Automatically start TunnelForge when you log in
        </div>
      </div>
      <label class="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          bind:checked={autoStart}
          on:change={() => updateSetting('auto_start', autoStart)}
          class="sr-only peer"
        />
        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
      </label>
    </div>

    <!-- Start Minimized -->
    <div class="flex items-center justify-between">
      <div>
        <div class="font-medium">Start Minimized</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">
          Start TunnelForge minimized to system tray
        </div>
      </div>
      <label class="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          bind:checked={startMinimized}
          on:change={() => updateSetting('start_minimized', startMinimized)}
          class="sr-only peer"
        />
        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
      </label>
    </div>

    <!-- Theme Selection -->
    <div>
      <label for="theme-select" class="block font-medium mb-2">Theme</label>
      <select
        id="theme-select"
        bind:value={theme}
        on:change={() => updateSetting('theme', theme)}
        class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded"
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
    </div>
  </div>
</div>
