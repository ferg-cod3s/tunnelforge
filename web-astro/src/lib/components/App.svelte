<script lang="ts">
  import { onMount } from 'svelte';
  import { createLogger } from '$lib/utils/logger';
  import { SimpleAuthClient } from '$lib/utils/auth-client';
  import AuthLogin from './AuthLogin.svelte';
  import AppHeader from './AppHeader.svelte';
  import SessionList from './SessionList.svelte';
  import SessionView from './SessionView.svelte';
  import Settings from './Settings.svelte';
  import SSHKeyManager from './SSHKeyManager.svelte';
  import type { AuthResponse, AuthClient, Session } from '$lib/types';
  import { sessions } from '$lib/stores/sessions';
  import { get } from 'svelte/store';

  const logger = createLogger('app');

  type AppView = 'login' | 'sessionList' | 'session' | 'settings';

  let currentView = $state<AppView>('login');
  let authClient = $state<AuthClient | undefined>(undefined);
  let currentSession = $state<Session | null>(null);
  let showSSHKeyManager = $state(false);
  let hideExited = $state(true);
  
  // Reactive sessions from store
  let sessionsList = $state<Session[]>([]);

  onMount(() => {
    logger.log('🚀 TunnelForge app mounted');

    const token = localStorage.getItem('authToken');
    if (token) {
      logger.log('🔑 Found existing auth token');
      authClient = new SimpleAuthClient(token);
      currentView = 'sessionList';
    }
    
    // Subscribe to sessions store
    const unsubscribe = sessions.subscribe(value => {
      sessionsList = value;
    });
    
    return () => {
      unsubscribe();
    };
  });

  function handleAuthSuccess(detail: AuthResponse) {
    logger.log('✅ Authentication successful', { userId: detail.userId });

    if (detail.token) {
      localStorage.setItem('authToken', detail.token);
      localStorage.setItem('userId', detail.userId || '');
      
      authClient = new SimpleAuthClient(detail.token);
    }

    currentView = 'sessionList';
  }

  function handleShowSSHKeyManager() {
    logger.log('🔑 Opening SSH key manager');
    showSSHKeyManager = true;
  }

  function handleCloseSSHKeyManager() {
    logger.log('🔑 Closing SSH key manager');
    showSSHKeyManager = false;
  }

  function handleOpenSettings() {
    logger.log('⚙️ Opening settings from login');
    currentView = 'settings';
  }

  function handleNavigateToSession(detail: { sessionId: string }) {
    logger.log('📍 Navigating to session', { sessionId: detail.sessionId });
    
    const sessionsList = get(sessions);
    const session = sessionsList.find(s => s.id === detail.sessionId);
    
    if (session) {
      currentSession = session;
      currentView = 'session';
    } else {
      logger.error('Session not found', { sessionId: detail.sessionId });
    }
  }

  function handleBackToSessionList() {
    logger.log('📍 Navigating back to session list');
    currentSession = null;
    currentView = 'sessionList';
  }

  function handleNavigateToSettings() {
    logger.log('⚙️ Opening settings');
    currentView = 'settings';
  }

  function handleSettingsClose() {
    logger.log('⚙️ Closing settings');
    if (authClient) {
      currentView = 'sessionList';
    } else {
      currentView = 'login';
    }
  }

  function handleLogout() {
    logger.log('👋 Logging out');
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    authClient = undefined;
    currentSession = null;
    currentView = 'login';
  }
  
  function handleHideExitedChange(detail: { hideExited: boolean }) {
    logger.log('👁️ Hide exited changed', { hideExited: detail.hideExited });
    hideExited = detail.hideExited;
  }

</script>

{#if showSSHKeyManager}
  <SSHKeyManager
    onclose={handleCloseSSHKeyManager}
  />
{/if}

<div class="app-container">
  {#if currentView === 'login'}
    <AuthLogin
      onauthsuccess={handleAuthSuccess}
      onshowsshkeymanager={handleShowSSHKeyManager}
      onopensettings={handleOpenSettings}
    />
  {:else if currentView === 'sessionList'}
    <AppHeader
      sessions={sessionsList}
      hideExited={hideExited}
      on:open-settings={handleNavigateToSettings}
      on:logout={handleLogout}
      on:hide-exited-change={(e) => handleHideExitedChange(e.detail)}
    />
    <SessionList
      loading={false}
      hideExited={hideExited}
      authClient={authClient}
      compactMode={false}
      onnavigateToSession={handleNavigateToSession}
    />
  {:else if currentView === 'session' && currentSession}
    <SessionView
      session={currentSession}
    />
  {:else if currentView === 'settings'}
    <Settings
      visible={true}
      onclose={handleSettingsClose}
    />
  {/if}
</div>

<style>
  .app-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    overflow: hidden;
    background: var(--color-bg);
  }
</style>
