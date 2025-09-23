<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  export let settings: any = {};

  let sessionStart = settings.notifications?.session_start ?? true;
  let sessionEnd = settings.notifications?.session_end ?? true;
  let commandError = settings.notifications?.command_error ?? true;
  let bellNotification = settings.notifications?.bell ?? false;
  let systemNotifications = settings.notifications?.system ?? true;

  function updateNotificationSetting(key: string, value: boolean) {
    if (!settings.notifications) {
      settings.notifications = {};
    }
    settings.notifications[key] = value;
    dispatch('settings-changed', { key: `notifications.${key}`, value });
  }
</script>

<div class="settings-section">
  <h3 class="flex items-center">
    <span class="mr-2">🔔</span>
    Notification Settings
  </h3>

  <div class="space-y-4">
    <!-- Session Start -->
    <div class="flex items-center justify-between">
      <div>
        <div class="font-medium">Session Started</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">
          Notify when a new terminal session is created
        </div>
      </div>
      <label class="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          bind:checked={sessionStart}
          on:change={() => updateNotificationSetting('session_start', sessionStart)}
          class="sr-only peer"
        />
        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
      </label>
    </div>

    <!-- Session End -->
    <div class="flex items-center justify-between">
      <div>
        <div class="font-medium">Session Ended</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">
          Notify when a terminal session is closed
        </div>
      </div>
      <label class="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          bind:checked={sessionEnd}
          on:change={() => updateNotificationSetting('session_end', sessionEnd)}
          class="sr-only peer"
        />
        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
      </label>
    </div>

    <!-- Command Error -->
    <div class="flex items-center justify-between">
      <div>
        <div class="font-medium">Command Errors</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">
          Notify when terminal commands fail
        </div>
      </div>
      <label class="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          bind:checked={commandError}
          on:change={() => updateNotificationSetting('command_error', commandError)}
          class="sr-only peer"
        />
        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
      </label>
    </div>

    <!-- Bell Notification -->
    <div class="flex items-center justify-between">
      <div>
        <div class="font-medium">Terminal Bell</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">
          Play sound for terminal bell character
        </div>
      </div>
      <label class="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          bind:checked={bellNotification}
          on:change={() => updateNotificationSetting('bell', bellNotification)}
          class="sr-only peer"
        />
        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
      </label>
    </div>

    <!-- System Notifications -->
    <div class="flex items-center justify-between">
      <div>
        <div class="font-medium">System Notifications</div>
        <div class="text-sm text-gray-600 dark:text-gray-400">
          Show native system notifications
        </div>
      </div>
      <label class="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          bind:checked={systemNotifications}
          on:change={() => updateNotificationSetting('system', systemNotifications)}
          class="sr-only peer"
        />
        <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
      </label>
    </div>
  </div>
</div>
