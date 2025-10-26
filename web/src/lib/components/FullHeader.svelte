<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Session, User } from '$lib/types';
  import { sessions, activeSessionCount } from '$lib/stores/sessions';
  import { isAuthenticated, currentUserId } from '$lib/stores/auth';
  import TerminalIcon from './TerminalIcon.svelte';
  import NotificationStatus from './NotificationStatus.svelte';
  import ThemeToggle from './ThemeToggle.svelte';

  // Props
  interface Props {
    sessions?: Session[];
    hideExited?: boolean;
    user?: User;
    notificationCount?: number;
    currentPath?: string;
    sessionCount?: number;
    connected?: boolean;
    showSearch?: boolean;
  }

  let {
    sessions: sessionsProp = [],
    hideExited = true,
    user,
    notificationCount = 0,
    currentPath = '',
    sessionCount: sessionCountProp,
    connected = false,
    showSearch = false
  }: Props = $props();

  // Reactive state
  let showUserMenu = $state(false);
  let searchQuery = $state('');
  let showSearchBar = $state(false);

  // Derived values
  let runningSessions = $derived(sessionsProp.filter(s => s.status === 'running'));
  let sessionCount = $derived(sessionCountProp ?? $activeSessionCount);
  let currentUser = $derived(user?.username || $currentUserId || 'anonymous');

  // Events
  const dispatch = createEventDispatcher<{
    'create-session': void;
    'hide-exited-change': { hideExited: boolean };
    'kill-all-sessions': void;
    'clean-exited-sessions': void;
    'open-file-browser': void;
    'open-tmux-sessions': void;
    'open-settings': void;
    logout: void;
    'navigate-to-list': void;
    search: { query: string };
    action: { type: string; data?: any };
    'notification-click': { notification: any };
  }>();

  // Event handlers
  function handleCreateSession() {
    dispatch('create-session');
  }

  function handleHomeClick() {
    dispatch('navigate-to-list');
  }

  function handleOpenFileBrowser() {
    dispatch('open-file-browser');
  }

  function handleOpenTmuxSessions() {
    dispatch('open-tmux-sessions');
  }

  function handleOpenSettings() {
    showUserMenu = false;
    dispatch('open-settings');
  }

  function handleLogout() {
    showUserMenu = false;
    dispatch('logout');
  }

  function toggleUserMenu() {
    showUserMenu = !showUserMenu;
  }

  function handleSearchSubmit() {
    if (searchQuery.trim()) {
      dispatch('search', { query: searchQuery.trim() });
    }
  }

  function handleSearchKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      handleSearchSubmit();
    } else if (event.key === 'Escape') {
      showSearchBar = false;
      searchQuery = '';
    }
  }

  function handleQuickAction(type: string, data?: any) {
    dispatch('action', { type, data });
  }

  // Close user menu when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu-container')) {
      showUserMenu = false;
    }
  }

  // Lifecycle
  $effect(() => {
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  });
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class="app-header bg-bg-secondary border-b border-border p-3 sticky top-0 z-40"
  style="padding-top: max(0.75rem, calc(0.75rem + env(safe-area-inset-top)));"
  onkeydown={(e) => {
    if (e.key === 'Escape' && showUserMenu) {
      showUserMenu = false;
    }
  }}
>
  <div class="flex items-center justify-between max-w-full">
    <!-- Left section: Logo and session count -->
    <button
      class="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer group flex-shrink-0"
      title="Go to home"
      onclick={handleHomeClick}
      aria-label="Go to home"
    >
      <TerminalIcon size={24} />
      <div class="flex items-baseline gap-2 min-w-0">
        <h1 class="text-xl font-bold text-primary font-mono group-hover:underline truncate">
          TunnelForge
        </h1>
        <p class="text-text-muted text-xs font-mono flex-shrink-0">
          ({sessionCount})
        </p>
      </div>
    </button>

    <!-- Center section: Search bar (when enabled) -->
    {#if showSearch || showSearchBar}
      <div class="flex-1 max-w-md mx-4">
        <div class="relative">
          <input
            bind:value={searchQuery}
            type="text"
            placeholder="Search sessions, files..."
            class="w-full px-3 py-2 bg-bg-tertiary border border-border rounded-lg text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            onkeydown={handleSearchKeydown}
            aria-label="Search"
          />
          <button
            onclick={handleSearchSubmit}
            class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-primary transition-colors"
            aria-label="Submit search"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
      </div>
    {/if}

    <!-- Right section: Actions and user menu -->
    <div class="flex items-center gap-2 flex-shrink-0">
      <!-- Quick actions -->
      {#if showSearch && !showSearchBar}
        <button
          onclick={() => showSearchBar = true}
          class="p-2 bg-bg-tertiary text-muted border border-border hover:border-primary hover:text-primary hover:bg-surface-hover rounded-lg transition-all duration-200"
          title="Search (⌘K)"
          aria-label="Open search"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd"/>
          </svg>
        </button>
      {/if}

      <!-- Notifications -->
      <NotificationStatus
        isSSEConnected={connected}
        on:open-settings={() => dispatch('open-settings')}
      />

      <!-- Theme toggle -->
      <ThemeToggle />

      <!-- File browser -->
      <button
        onclick={handleOpenFileBrowser}
        class="p-2 bg-bg-tertiary text-muted border border-border hover:border-primary hover:text-primary hover:bg-surface-hover rounded-lg transition-all duration-200"
        title="Browse Files (⌘O)"
        aria-label="Browse files"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M1.75 1h5.5c.966 0 1.75.784 1.75 1.75v1h4c.966 0 1.75.784 1.75 1.75v7.75A1.75 1.75 0 0113 15H3a1.75 1.75 0 01-1.75-1.75V2.75C1.25 1.784 1.784 1 1.75 1zM2.75 2.5v10.75c0 .138.112.25.25.25h10a.25.25 0 00.25-.25V5.5a.25.25 0 00-.25-.25H8.75v-2.5a.25.25 0 00-.25-.25h-5.5a.25.25 0 00-.25.25z"/>
        </svg>
      </button>

      <!-- tmux Sessions -->
      <button
        onclick={handleOpenTmuxSessions}
        class="p-2 bg-bg-tertiary text-muted border border-border hover:border-primary hover:text-primary hover:bg-surface-hover rounded-lg transition-all duration-200"
        title="tmux Sessions"
        aria-label="tmux sessions"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 2v12h12V2H2zM1 2a1 1 0 011-1h12a1 1 0 011 1v12a1 1 0 01-1 1H2a1 1 0 01-1-1V2zm7 3h5v2H8V5zm0 3h5v2H8V8zm0 3h5v2H8v-2zM3 5h4v2H3V5zm0 3h4v2H3V8zm0 3h4v2H3v-2z"/>
        </svg>
      </button>

      <!-- Create Session -->
      <button
        onclick={handleCreateSession}
        class="p-2 bg-primary text-text-bright hover:bg-primary-light rounded-lg transition-all duration-200 vt-create-button"
        title="Create New Session"
        aria-label="Create new session"
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
        </svg>
      </button>

      <!-- User menu -->
      {#if $isAuthenticated && currentUser}
        <div class="user-menu-container relative flex-shrink-0">
          <button
            onclick={toggleUserMenu}
            class="font-mono text-sm px-3 py-2 text-text border border-border hover:bg-bg-tertiary hover:text-text rounded-lg transition-all duration-200 flex items-center gap-2"
            title="User menu"
            aria-label="User menu"
            aria-expanded={showUserMenu}
          >
            <span class="hidden sm:inline">{currentUser}</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 20 20"
              fill="currentColor"
              class="sm:hidden"
            >
              <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM3 18a7 7 0 1114 0H3z" />
            </svg>
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="currentColor"
              class="transition-transform {showUserMenu ? 'rotate-180' : ''}"
            >
              <path d="M5 7L1 3h8z" />
            </svg>
          </button>

          {#if showUserMenu}
            <div
              class="absolute right-0 top-full mt-1 bg-surface border border-border rounded-lg shadow-lg py-1 z-50 min-w-36"
              role="menu"
            >
              <div class="px-3 py-2 text-sm text-text-muted border-b border-border">
                authenticated
              </div>
              <button
                onclick={handleLogout}
                class="w-full text-left px-3 py-2 text-sm font-mono text-status-warning hover:bg-bg-secondary hover:text-status-error"
                role="menuitem"
              >
                Logout
              </button>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </div>

  <!-- Breadcrumbs (when currentPath is provided) -->
  {#if currentPath}
    <div class="mt-2 text-sm text-text-muted font-mono">
      <span class="text-primary">~</span>{currentPath}
    </div>
  {/if}
</div>