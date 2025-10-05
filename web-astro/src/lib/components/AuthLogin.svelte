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
    class="settings-button"
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

  <div class="auth-content">
    <div class="auth-header">
      <div class="header-inner">
        <div class="icon-wrapper">
          <TerminalIcon size={$isMobile ? 48 : 56} />
        </div>
        <h2 class="auth-title">TunnelForge</h2>
        <p class="auth-subtitle">Please authenticate to continue</p>
      </div>
    </div>

    {#if error}
      <div class="message-box error-message" data-testid="error-message">
        {error}
        <button
          onclick={() => { error = ''; }}
          class="message-close"
          data-testid="error-close"
        >
          ✕
        </button>
      </div>
    {/if}

    {#if success}
      <div class="message-box success-message">
        {success}
        <button
          onclick={() => { success = ''; }}
          class="message-close"
        >
          ✕
        </button>
      </div>
    {/if}

    <div class="auth-form">
      {#if !authConfig.disallowUserPassword}
        <div class="password-section">
          <div class="user-profile">
            <div class="avatar-container">
              {#if userAvatar}
                <img
                  src={userAvatar}
                  alt="User Avatar"
                  class="avatar-image"
                  width="80"
                  height="80"
                />
              {:else}
                <div class="avatar-placeholder">
                  <svg
                    class="avatar-icon"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                  </svg>
                </div>
              {/if}
            </div>
            <p class="welcome-text">
              Welcome back, {currentUserId || '...'}
            </p>
          </div>
          <form onsubmit={handlePasswordLogin} class="login-form">
            <div>
              <input
                type="password"
                class="password-input"
                data-testid="password-input"
                placeholder="System Password"
                bind:value={loginPassword}
                disabled={loading}
                required
              />
            </div>
            <button
              type="submit"
              class="login-button"
              data-testid="password-submit"
              disabled={loading || !loginPassword}
            >
              {loading ? 'Authenticating...' : 'Login with Password'}
            </button>
          </form>
        </div>
      {/if}

      {#if authConfig.disallowUserPassword}
        <div class="ssh-only-section">
          <div class="ssh-user-profile">
            <div class="ssh-avatar-container">
              {#if userAvatar}
                <img
                  src={userAvatar}
                  alt="User Avatar"
                  class="avatar-image"
                  width="80"
                  height="80"
                />
              {:else}
                <div class="avatar-placeholder">
                  <svg
                    class="ssh-avatar-icon"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                  </svg>
                </div>
              {/if}
            </div>
            <p class="ssh-welcome-text">
              {currentUserId ? `Welcome back, ${currentUserId}` : 'Please authenticate to continue'}
            </p>
            <p class="ssh-required-text">SSH key authentication required</p>
          </div>
        </div>
      {/if}

      {#if authConfig.enableSSHKeys}
        {#if !authConfig.disallowUserPassword}
          <div class="auth-divider">
            <span>or</span>
          </div>
        {/if}

        <div class="ssh-section">
          <div class="ssh-header">
            <div class="ssh-title-group">
              <div class="ssh-indicator"></div>
              <span class="ssh-title">SSH Key Management</span>
            </div>
            <button
              class="manage-keys-button"
              data-testid="manage-keys"
              onclick={handleShowSSHKeyManager}
            >
              Manage Keys
            </button>
          </div>

          <div class="ssh-content">
            <div class="ssh-info-box">
              <p class="ssh-info-text">
                Generate SSH keys for browser-based authentication
              </p>
              <p class="ssh-info-text">
                💡 SSH keys work in both browser and terminal
              </p>
            </div>

            <button
              class="ssh-login-button"
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

<style>
  .auth-container {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    padding: var(--spacing-md);
  }

  .settings-button {
    position: absolute;
    top: 1rem;
    right: 1rem;
    padding: var(--spacing-sm);
    color: var(--color-text-muted);
    transition: color var(--transition-base);
    background: transparent;
    border: none;
    cursor: pointer;
  }

  .settings-button:hover {
    color: var(--color-primary);
  }

  .auth-content {
    width: 100%;
    max-width: 24rem;
  }

  .auth-header {
    margin-bottom: var(--spacing-md);
  }

  .header-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-lg);
  }

  .icon-wrapper {
    filter: drop-shadow(0 0 15px rgba(255, 107, 53, 0.4));
  }

  .auth-title {
    font-size: 1.5rem;
    margin-top: var(--spacing-xs);
  }

  .auth-subtitle {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .message-box {
    padding: 0.75rem;
    border-radius: var(--radius-sm);
    margin-bottom: var(--spacing-sm);
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .error-message {
    background: var(--color-status-error);
    color: var(--color-bg);
  }

  .success-message {
    background: var(--color-status-success);
    color: var(--color-bg);
  }

  .message-close {
    margin-left: var(--spacing-sm);
    color: var(--color-bg);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: color var(--transition-base);
  }

  .message-close:hover {
    color: var(--color-primary);
  }

  .auth-form {
    background: var(--color-bg-elevated);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .password-section {
    padding: 1.25rem;
  }

  .user-profile {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: var(--spacing-md);
  }

  .avatar-container {
    width: 6rem;
    height: 6rem;
    border-radius: var(--radius-full);
    margin-bottom: var(--spacing-sm);
    overflow: hidden;
    box-shadow: 0 0 25px rgba(255, 107, 53, 0.3);
  }

  .avatar-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-placeholder {
    width: 100%;
    height: 100%;
    background: var(--color-bg-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .avatar-icon {
    width: 3rem;
    height: 3rem;
    color: var(--color-text-muted);
  }

  .welcome-text {
    color: var(--color-primary);
    font-size: var(--font-size-md);
    font-weight: 500;
  }

  .login-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .password-input {
    width: 100%;
    padding: var(--spacing-md);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    transition: border-color var(--transition-base);
  }

  .password-input:focus {
    outline: none;
    border-color: var(--color-primary);
  }

  .password-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .login-button {
    width: 100%;
    padding: 0.75rem;
    margin-top: var(--spacing-sm);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--transition-base);
  }

  .login-button:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .login-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .ssh-only-section {
    padding: 1.5rem;
  }

  .ssh-user-profile {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: var(--spacing-md);
  }

  .ssh-avatar-container {
    width: 4rem;
    height: 4rem;
    border-radius: var(--radius-full);
    margin-bottom: var(--spacing-sm);
    overflow: hidden;
    border: 2px solid var(--color-border);
  }

  .ssh-avatar-icon {
    width: 2rem;
    height: 2rem;
    color: var(--color-text-muted);
  }

  .ssh-welcome-text {
    color: var(--color-primary);
    font-size: var(--font-size-xs);
  }

  .ssh-required-text {
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
    margin-top: var(--spacing-xs);
  }

  .auth-divider {
    padding: var(--spacing-sm) 0;
    text-align: center;
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  .ssh-section {
    padding: 1.5rem;
  }

  .ssh-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-sm);
  }

  .ssh-title-group {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .ssh-indicator {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: var(--radius-full);
    background: var(--color-primary);
  }

  .ssh-title {
    font-family: var(--font-mono);
    font-size: var(--font-size-xs);
  }

  .manage-keys-button {
    background: transparent;
    border: none;
    color: var(--color-primary);
    font-size: var(--font-size-xs);
    cursor: pointer;
    transition: opacity var(--transition-base);
  }

  .manage-keys-button:hover {
    opacity: 0.8;
  }

  .ssh-content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .ssh-info-box {
    background: var(--color-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: var(--spacing-sm);
  }

  .ssh-info-text {
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
    margin-bottom: var(--spacing-xs);
  }

  .ssh-info-text:last-child {
    margin-bottom: 0;
  }

  .ssh-login-button {
    width: 100%;
    padding: 0.625rem;
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    cursor: pointer;
    transition: all var(--transition-base);
  }

  .ssh-login-button:hover:not(:disabled) {
    background: var(--color-bg-tertiary);
    border-color: var(--color-primary);
  }

  .ssh-login-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Responsive adjustments */
  @media (min-width: 640px) {
    .auth-title {
      font-size: 1.875rem;
      margin-top: var(--spacing-sm);
    }

    .auth-subtitle {
      font-size: var(--font-size-sm);
    }

    .message-box {
      font-size: var(--font-size-sm);
    }

    .password-section {
      padding: 2rem;
    }

    .avatar-container {
      width: 7rem;
      height: 7rem;
      margin-bottom: var(--spacing-md);
    }

    .avatar-icon {
      width: 3.5rem;
      height: 3.5rem;
    }

    .welcome-text {
      font-size: var(--font-size-lg);
    }

    .login-button {
      padding: 1rem;
    }

    .ssh-only-section {
      padding: 2rem;
    }

    .ssh-avatar-container {
      width: 5rem;
      height: 5rem;
      margin-bottom: var(--spacing-sm);
    }

    .ssh-avatar-icon {
      width: 2.5rem;
      height: 2.5rem;
    }

    .ssh-welcome-text {
      font-size: var(--font-size-sm);
    }

    .ssh-required-text {
      margin-top: var(--spacing-sm);
    }

    .auth-divider {
      padding: var(--spacing-sm) 0;
    }

    .ssh-section {
      padding: 2rem;
    }

    .ssh-title {
      font-size: var(--font-size-sm);
    }

    .ssh-login-button {
      padding: 0.75rem;
      font-size: var(--font-size-md);
    }
  }
</style>
