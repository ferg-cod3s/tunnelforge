<script lang="ts">
  import { onMount } from 'svelte';
  import SessionView from './SessionView.svelte';
  import TerminalSettingsModal from './TerminalSettingsModal.svelte';
  import type { Session } from '$lib/types';
  import { getTerminalPreferences, type TerminalPreferences } from '$lib/services/settings';

  // Example session data
  let session: Session | null = null;

  // Modal state
  let showSettingsModal = $state(false);

  // Listen for the 'open-settings' event dispatched by SessionView
  onMount(() => {
    const handleOpenSettings = () => {
      showSettingsModal = true;
    };

    window.addEventListener('open-settings', handleOpenSettings);

    return () => {
      window.removeEventListener('open-settings', handleOpenSettings);
    };
  });

  // Handle settings changes
  function handleSettingsChanged(event: CustomEvent<TerminalPreferences>) {
    const newSettings = event.detail;
    console.log('Terminal settings changed:', newSettings);

    // Here you would typically apply the settings to the terminal
    // For example, update the terminal component with new font size, theme, etc.
  }

  function handleModalClose() {
    showSettingsModal = false;
  }
</script>

<!-- Main session view -->
<SessionView {session} />

<!-- Terminal settings modal -->
<TerminalSettingsModal
  visible={showSettingsModal}
  on:close={handleModalClose}
  on:settings-changed={handleSettingsChanged}
/>

<style>
  /* Add any additional styling if needed */
</style>