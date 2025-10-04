<script lang="ts">
  import { onMount } from 'svelte';
  import { isMobile } from '$lib/stores/media';
  import {
    getCurrentSystemUser,
    getUserAvatar,
    getAuthConfig,
    authenticateWithPassword,
    authenticateWithSSHKey,
    type AuthResponse,
    type AuthConfig,
  } from '$lib/services/auth';
  import TerminalIcon from './TerminalIcon.svelte';

  // Svelte 5 event props
  interface Props {
    onauthsuccess?: (detail: AuthResponse) => void;
    onshowsshkeymanager?: () => void;
    onopensettings?: () => void;
  }

  let { onauthsuccess, onshowsshkeymanager, onopensettings }: Props = $props();

  // Svelte 5 state
  let loading = $state(false);
  let error = $state('');
  let success = $state('');
  let currentUserId = $state('');
  let loginPassword = $state('');
  let userAvatar = $state('');
  let authConfig = $state<AuthConfig>({
    enableSSHKeys: false,
    disallowUserPassword: false,
    noAuth: false,
  });

  onMount(async () => {
    console.log('🔌 Auth login component connected');
    await loadUserInfo();
  });

  async function loadUserInfo() {
    try {
      try {
        authConfig = await getAuthConfig();
        console.log('⚙️ Auth config loaded:', authConfig);
      } catch (err) {
        console.error('❌ Error loading auth config:', err);
      }

      currentUserId = await getCurrentSystemUser();
      console.log('👤 Current user:', currentUserId);

      if (!authConfig.noAuth) {
        userAvatar = await getUserAvatar(currentUserId);
        console.log('🖼️ User avatar loaded');
      }

      if (authConfig.noAuth) {
        console.log('🔓 No auth required, auto-logging in');
        onauthsuccess?.({
          success: true,
          userId: currentUserId,
          authMethod: 'no-auth',
        });
      }
    } catch (err) {
      error = 'Failed to load user information';
    }
  }

  async function handlePasswordLogin(e: Event) {
    e.preventDefault();
    if (loading) return;

    console.log('🔐 Attempting password authentication...');
    loading = true;
    error = '';

    try {
      const result = await authenticateWithPassword(currentUserId, loginPassword);
      console.log('🎫 Password auth result:', result);

      if (result.success) {
        loginPassword = '';
        onauthsuccess?.(result);
      } else {
        error = result.error || 'Password authentication failed';
      }
    } catch (err) {
      error = 'Password authentication failed';
    } finally {
      loading = false;
    }
  }

  async function handleSSHKeyAuth() {
    if (loading) return;

    console.log('🔐 Attempting SSH key authentication...');
    loading = true;
    error = '';

    try {
      const authResult = await authenticateWithSSHKey(currentUserId);
      console.log('🎯 SSH auth result:', authResult);

      if (authResult.success) {
        onauthsuccess?.(authResult);
      } else {
        error = authResult.error || 'SSH key authentication failed. Please try password login.';
      }
    } catch (err) {
      console.error('SSH key authentication error:', err);
      error = 'SSH key authentication failed';
    } finally {
      loading = false;
    }
  }

  function handleShowSSHKeyManager() {
    onshowsshkeymanager?.();
  }

  function handleOpenSettings() {
    onopensettings?.();
  }
</script>

<div class="auth-container">
  <button
    class="absolute top-4 right-4 p-2 text-text-muted hover:text-primary transition-colors"
    onclick={handleOpenSettings}
    title="Settings"
  >
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path
        fill-rule="evenodd"
        d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z"
        clip-rule="evenodd"
      />
    </svg>
  </button>

  <div class="w-full max-w-sm">
    <div class="auth-header">
      <div class="flex flex-col items-center gap-2 sm:gap-3 mb-4 sm:mb-8">
        <div style="filter: drop-shadow(0 0 15px rgb(var(--color-primary) / 0.4));">
          <TerminalIcon size={$isMobile ? 48 : 56} />
        </div>
        <h2 class="auth-title text-2xl sm:text-3xl mt-1 sm:mt-2">TunnelForge</h2>
        <p class="auth-subtitle text-xs sm:text-sm">Please authenticate to continue</p>
      </div>
    </div>

    {#if error}
      <div
        class="bg-status-error text-bg px-3 py-1.5 rounded mb-3 font-mono text-xs sm:text-sm"
        data-testid="error-message"
      >
        {error}
        <button
          onclick={() => {
            error = '';
          }}
          class="ml-2 text-bg hover:text-primary"
          data-testid="error-close"
        >
          ✕
        </button>
      </div>
    {/if}

    {#if success}
      <div class="bg-status-success text-bg px-3 py-1.5 rounded mb-3 font-mono text-xs sm:text-sm">
        {success}
        <button
          onclick={() => {
            success = '';
          }}
          class="ml-2 text-bg hover:text-primary"
        >
          ✕
        </button>
      </div>
    {/if}

    <div class="auth-form">
      {#if !authConfig.disallowUserPassword}
        <div class="p-5 sm:p-8">
          <div class="flex flex-col items-center mb-4 sm:mb-6">
            <div
              class="w-24 h-24 sm:w-28 sm:h-28 rounded-full mb-3 sm:mb-4 overflow-hidden"
              style="box-shadow: 0 0 25px rgb(var(--color-primary) / 0.3);"
            >
              {#if userAvatar}
                <img
                  src={userAvatar}
                  alt="User Avatar"
                  class="w-full h-full object-cover"
                  width="80"
                  height="80"
                />
              {:else}
                <div class="w-full h-full bg-bg-secondary flex items-center justify-center">
                  <svg
                    class="w-12 h-12 sm:w-14 sm:h-14 text-text-muted"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                  </svg>
                </div>
              {/if}
            </div>
            <p class="text-primary text-base sm:text-lg font-medium">
              Welcome back, {currentUserId || '...'}
            </p>
          </div>
          <form onsubmit={handlePasswordLogin} class="space-y-3">
            <div>
              <input
                type="password"
                class="input-field"
                data-testid="password-input"
                placeholder="System Password"
                bind:value={loginPassword}
                disabled={loading}
                required
              />
            </div>
            <button
              type="submit"
              class="btn-primary w-full py-3 sm:py-4 mt-2"
              data-testid="password-submit"
              disabled={loading || !loginPassword}
            >
              {loading ? 'Authenticating...' : 'Login with Password'}
            </button>
          </form>
        </div>
      {/if}

      {#if authConfig.disallowUserPassword}
        <div class="ssh-key-item p-6 sm:p-8">
          <div class="flex flex-col items-center mb-4 sm:mb-6">
            <div
              class="w-16 h-16 sm:w-20 sm:h-20 rounded-full mb-2 sm:mb-3 overflow-hidden border-2 border-border"
            >
              {#if userAvatar}
                <img
                  src={userAvatar}
                  alt="User Avatar"
                  class="w-full h-full object-cover"
                  width="80"
                  height="80"
                />
              {:else}
                <div class="w-full h-full bg-bg-secondary flex items-center justify-center">
                  <svg
                    class="w-8 h-8 sm:w-10 sm:h-10 text-text-muted"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                  </svg>
                </div>
              {/if}
            </div>
            <p class="text-primary text-xs sm:text-sm">
              {currentUserId ? `Welcome back, ${currentUserId}` : 'Please authenticate to continue'}
            </p>
            <p class="text-text-muted text-xs mt-1 sm:mt-2">SSH key authentication required</p>
          </div>
        </div>
      {/if}

      {#if authConfig.enableSSHKeys}
        {#if !authConfig.disallowUserPassword}
          <div class="auth-divider py-2 sm:py-3">
            <span>or</span>
          </div>
        {/if}

        <div class="ssh-key-item p-6 sm:p-8">
          <div class="flex items-center justify-between mb-3 sm:mb-4">
            <div class="flex items-center gap-2">
              <div class="w-2 h-2 rounded-full bg-primary"></div>
              <span class="font-mono text-xs sm:text-sm">SSH Key Management</span>
            </div>
            <button
              class="btn-ghost text-xs"
              data-testid="manage-keys"
              onclick={handleShowSSHKeyManager}
            >
              Manage Keys
            </button>
          </div>

          <div class="space-y-3">
            <div class="bg-bg border border-border rounded p-3">
              <p class="text-text-muted text-xs mb-2">
                Generate SSH keys for browser-based authentication
              </p>
              <p class="text-text-muted text-xs">
                💡 SSH keys work in both browser and terminal
              </p>
            </div>

            <button
              class="btn-secondary w-full py-2.5 sm:py-3 text-sm sm:text-base"
              data-testid="ssh-login"
              onclick={handleSSHKeyAuth}
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Login with SSH Key'}
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
