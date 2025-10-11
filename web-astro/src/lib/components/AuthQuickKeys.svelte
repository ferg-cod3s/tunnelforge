<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { isMobile } from '$lib/stores/media';

  // Props interface
  interface Props {
    visible?: boolean;
    position?: 'top' | 'bottom' | 'overlay';
    authMethods?: AuthMethod[];
    currentUser?: string;
    showUserSwitch?: boolean;
  }

  // Auth method interface
  interface AuthMethod {
    id: string;
    label: string;
    icon?: string;
    shortcut?: string;
    description?: string;
    action: 'login' | 'logout' | 'switch-user' | 'ssh-key' | 'password';
  }

  // Props with defaults
  let {
    visible = false,
    position = 'overlay',
    authMethods = [],
    currentUser = '',
    showUserSwitch = true
  }: Props = $props();

  // State
  let isVisible = $state(visible);
  let activeMethod = $state<string | null>(null);
  let keyboardShortcuts = $state<Map<string, string>>(new Map());

  // Default auth methods
  const DEFAULT_AUTH_METHODS: AuthMethod[] = [
    {
      id: 'password-login',
      label: 'Password Login',
      icon: '🔑',
      shortcut: 'Ctrl+Enter',
      description: 'Login with system password',
      action: 'password'
    },
    {
      id: 'ssh-login',
      label: 'SSH Key Login',
      icon: '🔐',
      shortcut: 'Ctrl+Shift+K',
      description: 'Login with SSH key',
      action: 'ssh-key'
    },
    {
      id: 'logout',
      label: 'Logout',
      icon: '🚪',
      shortcut: 'Ctrl+Shift+L',
      description: 'Sign out current user',
      action: 'logout'
    },
    {
      id: 'switch-user',
      label: 'Switch User',
      icon: '👤',
      shortcut: 'Ctrl+Shift+U',
      description: 'Change to different user',
      action: 'switch-user'
    }
  ];

  // Combined auth methods
  let allAuthMethods = $derived([...DEFAULT_AUTH_METHODS, ...authMethods]);

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    'auth-action': { action: AuthMethod['action']; method: AuthMethod };
    'visibility-changed': { visible: boolean };
    'user-switch-requested': void;
  }>();

  // Handle auth method activation
  function handleAuthAction(method: AuthMethod) {
    activeMethod = method.id;

    // Dispatch auth action
    dispatch('auth-action', {
      action: method.action,
      method
    });

    // Handle specific actions
    switch (method.action) {
      case 'switch-user':
        dispatch('user-switch-requested');
        break;
      case 'logout':
        // Close overlay after logout action
        setTimeout(() => {
          isVisible = false;
          dispatch('visibility-changed', { visible: false });
        }, 100);
        break;
    }

    // Clear active state after animation
    setTimeout(() => {
      activeMethod = null;
    }, 200);
  }

  // Handle keyboard shortcuts
  function handleGlobalKeyDown(event: KeyboardEvent) {
    if (!isVisible) return;

    // Check for auth shortcuts
    const key = event.key.toLowerCase();
    const ctrl = event.ctrlKey;
    const shift = event.shiftKey;

    // Ctrl+Enter - Password login
    if (ctrl && key === 'enter') {
      event.preventDefault();
      const method = allAuthMethods.find(m => m.action === 'password');
      if (method) handleAuthAction(method);
      return;
    }

    // Ctrl+Shift+K - SSH key login
    if (ctrl && shift && key === 'k') {
      event.preventDefault();
      const method = allAuthMethods.find(m => m.action === 'ssh-key');
      if (method) handleAuthAction(method);
      return;
    }

    // Ctrl+Shift+L - Logout
    if (ctrl && shift && key === 'l') {
      event.preventDefault();
      const method = allAuthMethods.find(m => m.action === 'logout');
      if (method) handleAuthAction(method);
      return;
    }

    // Ctrl+Shift+U - Switch user
    if (ctrl && shift && key === 'u') {
      event.preventDefault();
      const method = allAuthMethods.find(m => m.action === 'switch-user');
      if (method) handleAuthAction(method);
      return;
    }

    // Escape - Close overlay
    if (key === 'escape') {
      event.preventDefault();
      isVisible = false;
      dispatch('visibility-changed', { visible: false });
    }
  }

  // Toggle visibility
  function toggleVisibility() {
    isVisible = !isVisible;
    dispatch('visibility-changed', { visible: isVisible });
  }

  // Close overlay
  function closeOverlay() {
    isVisible = false;
    dispatch('visibility-changed', { visible: false });
  }

  // Get button size class based on screen size
  function getButtonSizeClass(): string {
    return $isMobile ? 'p-3' : 'p-4';
  }

  // Get grid columns based on content
  function getGridCols(): string {
    const count = allAuthMethods.length;
    if (count <= 2) return 'grid-cols-1 sm:grid-cols-2';
    if (count <= 4) return 'grid-cols-2 sm:grid-cols-2';
    return 'grid-cols-2 sm:grid-cols-3';
  }

  // Lifecycle - add/remove keyboard listeners
  $effect(() => {
    if (isVisible) {
      document.addEventListener('keydown', handleGlobalKeyDown);
    } else {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  });

  // Update visibility when prop changes
  $effect(() => {
    isVisible = visible;
  });
</script>

<!-- Auth Quick Keys Overlay -->
{#if isVisible}
  <div
    class="auth-quick-keys-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    class:top-0={position === 'top'}
    class:bottom-0={position === 'bottom'}
    class:inset-0={position === 'overlay'}
    role="dialog"
    aria-modal="true"
    aria-labelledby="auth-quick-keys-title"
    aria-describedby="auth-quick-keys-description"
    onclick={closeOverlay}
  >
    <div
      class="auth-quick-keys-panel bg-bg-elevated border border-border rounded-lg shadow-xl max-w-md w-full mx-4"
      onclick={(e) => e.stopPropagation()}
      role="toolbar"
      aria-label="Authentication Quick Actions"
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h3 id="auth-quick-keys-title" class="text-lg font-semibold text-text-primary">
            Quick Auth Actions
          </h3>
          {#if currentUser}
            <p class="text-sm text-text-muted">Current user: {currentUser}</p>
          {/if}
        </div>
        <button
          type="button"
          class="text-text-muted hover:text-text-primary transition-colors p-1"
          onclick={closeOverlay}
          aria-label="Close authentication quick keys"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      <!-- Description -->
      <div id="auth-quick-keys-description" class="px-4 py-2 text-sm text-text-muted">
        Use keyboard shortcuts or tap buttons to quickly perform authentication actions
      </div>

      <!-- Auth Methods Grid -->
      <div class="p-4">
        <div class="grid {getGridCols()} gap-3">
          {#each allAuthMethods as method (method.id)}
            <button
              type="button"
              class="auth-method-btn {getButtonSizeClass()} bg-bg-secondary hover:bg-bg-tertiary border border-border rounded-lg transition-all duration-200 flex flex-col items-center justify-center gap-2 group {activeMethod === method.id ? 'ring-2 ring-primary bg-primary/10' : ''}"
              onclick={() => handleAuthAction(method)}
              aria-label="{method.label}{method.shortcut ? ` (${method.shortcut})` : ''}"
              title="{method.description || method.label}{method.shortcut ? ` - ${method.shortcut}` : ''}"
            >
              <!-- Icon -->
              {#if method.icon}
                <span class="text-2xl" role="img" aria-hidden="true">{method.icon}</span>
              {:else}
                <div class="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                  <span class="text-primary font-bold text-sm">{method.label.charAt(0)}</span>
                </div>
              {/if}

              <!-- Label -->
              <span class="text-sm font-medium text-text-primary text-center leading-tight">
                {method.label}
              </span>

              <!-- Shortcut hint -->
              {#if method.shortcut && !$isMobile}
                <span class="text-xs text-text-muted bg-bg-tertiary px-2 py-0.5 rounded font-mono">
                  {method.shortcut}
                </span>
              {/if}

              <!-- Description (mobile only) -->
              {#if $isMobile && method.description}
                <span class="text-xs text-text-muted text-center leading-tight max-w-full">
                  {method.description}
                </span>
              {/if}
            </button>
          {/each}
        </div>
      </div>

      <!-- Footer with keyboard hints -->
      {#if !$isMobile}
        <div class="px-4 pb-4">
          <div class="text-xs text-text-muted space-y-1">
            <p><strong>Keyboard Shortcuts:</strong></p>
            <div class="grid grid-cols-2 gap-2 font-mono text-xs">
              {#each allAuthMethods.filter(m => m.shortcut) as method}
                <div class="flex justify-between">
                  <span>{method.shortcut}:</span>
                  <span>{method.label}</span>
                </div>
              {/each}
            </div>
            <p class="text-center pt-2 border-t border-border">Press <kbd class="bg-bg-tertiary px-1 rounded">Esc</kbd> to close</p>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Overlay animations */
  .auth-quick-keys-overlay {
    animation: fadeIn 0.2s ease-out;
  }

  .auth-quick-keys-panel {
    animation: slideIn 0.3s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(-10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  /* Button hover effects */
  .auth-method-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .auth-method-btn:active {
    transform: translateY(0);
    transition-duration: 0.1s;
  }

  /* Active state styling */
  .auth-method-btn.ring-2 {
    animation: pulse 0.2s ease-in-out;
  }

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }

  /* Focus styles for accessibility */
  .auth-method-btn:focus {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  /* Mobile optimizations */
  @media (max-width: 640px) {
    .auth-quick-keys-panel {
      margin: 1rem;
      max-width: calc(100vw - 2rem);
    }

    .auth-method-btn {
      min-height: 80px;
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    .auth-method-btn {
      border-width: 2px;
    }

    .auth-quick-keys-panel {
      border-width: 2px;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .auth-quick-keys-overlay,
    .auth-quick-keys-panel,
    .auth-method-btn {
      animation: none;
    }

    .auth-method-btn:hover {
      transform: none;
    }
  }
</style>