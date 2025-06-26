import { html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';

// Import shared types
import type { Session } from '../shared/types.js';
// Import utilities
import { BREAKPOINTS, SIDEBAR, TIMING, TRANSITIONS } from './utils/constants.js';
// Import logger
import { createLogger } from './utils/logger.js';
import { type MediaQueryState, responsiveObserver } from './utils/responsive-utils.js';
import { triggerTerminalResize } from './utils/terminal-utils.js';
// Import version
import { VERSION } from './version.js';

// Import components
import './components/app-header.js';
import './components/session-create-form.js';
import './components/session-list.js';
import './components/session-view.js';
import './components/session-card.js';
import './components/file-browser.js';
import './components/log-viewer.js';
import './components/unified-settings.js';
import './components/notification-status.js';
import './components/auth-login.js';
import './components/ssh-key-manager.js';

import type { SessionCard } from './components/session-card.js';
import { authClient } from './services/auth-client.js';
import { bufferSubscriptionService } from './services/buffer-subscription-service.js';
import { pushNotificationService } from './services/push-notification-service.js';

const logger = createLogger('app');

// Interface for session view component's stream connection
interface SessionViewElement extends HTMLElement {
  streamConnection?: {
    disconnect: () => void;
  } | null;
}

@customElement('vibetunnel-app')
export class VibeTunnelApp extends LitElement {
  // Disable shadow DOM to use Tailwind
  createRenderRoot() {
    return this;
  }

  @state() private errorMessage = '';
  @state() private successMessage = '';
  @state() private sessions: Session[] = [];
  @state() private loading = false;
  @state() private currentView: 'list' | 'session' | 'auth' = 'auth';
  @state() private selectedSessionId: string | null = null;
  @state() private hideExited = this.loadHideExitedState();
  @state() private showCreateModal = false;
  @state() private showFileBrowser = false;
  @state() private showSSHKeyManager = false;
  @state() private showSettings = false;
  @state() private isAuthenticated = false;
  @state() private sidebarCollapsed = this.loadSidebarState();
  @state() private sidebarWidth = this.loadSidebarWidth();
  @state() private userInitiatedSessionChange = false;
  @state() private isResizing = false;
  @state() private mediaState: MediaQueryState = responsiveObserver.getCurrentState();
  @state() private showLogLink = false;
  @state() private hasActiveOverlay = false;
  private initialLoadComplete = false;
  private responsiveObserverInitialized = false;
  private initialRenderComplete = false;

  private hotReloadWs: WebSocket | null = null;
  private errorTimeoutId: number | null = null;
  private successTimeoutId: number | null = null;
  private autoRefreshIntervalId: number | null = null;
  private responsiveUnsubscribe?: () => void;
  private resizeCleanupFunctions: (() => void)[] = [];

  connectedCallback() {
    super.connectedCallback();
    this.setupHotReload();
    this.setupKeyboardShortcuts();
    this.setupNotificationHandlers();
    this.setupResponsiveObserver();
    this.setupPreferences();
    // Initialize authentication and routing together
    this.initializeApp();
  }

  firstUpdated() {
    // Mark initial render as complete after a microtask to ensure DOM is settled
    Promise.resolve().then(() => {
      this.initialRenderComplete = true;
    });
  }

  willUpdate(changedProperties: Map<string, unknown>) {
    // Update hasActiveOverlay whenever any overlay state changes
    if (
      changedProperties.has('showFileBrowser') ||
      changedProperties.has('showCreateModal') ||
      changedProperties.has('showSSHKeyManager') ||
      changedProperties.has('showSettings')
    ) {
      this.hasActiveOverlay =
        this.showFileBrowser || this.showCreateModal || this.showSSHKeyManager || this.showSettings;
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.hotReloadWs) {
      this.hotReloadWs.close();
    }
    // Clean up routing listeners
    window.removeEventListener('popstate', this.handlePopState);
    // Clean up keyboard shortcuts
    window.removeEventListener('keydown', this.handleKeyDown);
    // Clean up auto refresh interval
    if (this.autoRefreshIntervalId !== null) {
      clearInterval(this.autoRefreshIntervalId);
      this.autoRefreshIntervalId = null;
    }
    // Clean up responsive observer
    if (this.responsiveUnsubscribe) {
      this.responsiveUnsubscribe();
    }
    // Clean up any active resize listeners
    this.cleanupResizeListeners();
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    // Handle Cmd+O / Ctrl+O to open file browser
    if ((e.metaKey || e.ctrlKey) && e.key === 'o' && this.currentView === 'list') {
      e.preventDefault();
      this.showFileBrowser = true;
    }

    // Handle Escape to close the session and return to list view
    if (
      e.key === 'Escape' &&
      this.currentView === 'session' &&
      !this.showFileBrowser &&
      !this.showCreateModal
    ) {
      e.preventDefault();
      this.handleNavigateToList();
    }
  };

  private setupKeyboardShortcuts() {
    window.addEventListener('keydown', this.handleKeyDown);
  }

  private async initializeApp() {
    // First check authentication
    await this.checkAuthenticationStatus();

    // Then setup routing after auth is determined and sessions are loaded
    this.setupRouting();
  }

  private async checkAuthenticationStatus() {
    // Check if no-auth is enabled first
    try {
      const configResponse = await fetch('/api/auth/config');
      if (configResponse.ok) {
        const authConfig = await configResponse.json();
        console.log('🔧 Auth config:', authConfig);

        if (authConfig.noAuth) {
          console.log('🔓 No auth required, bypassing authentication');
          this.isAuthenticated = true;
          this.currentView = 'list';
          await this.initializeServices(); // Initialize services after auth
          await this.loadSessions(); // Wait for sessions to load
          this.startAutoRefresh();
          return;
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch auth config:', error);
    }

    this.isAuthenticated = authClient.isAuthenticated();
    console.log('🔐 Authentication status:', this.isAuthenticated);

    if (this.isAuthenticated) {
      this.currentView = 'list';
      await this.initializeServices(); // Initialize services after auth
      await this.loadSessions(); // Wait for sessions to load
      this.startAutoRefresh();
    } else {
      this.currentView = 'auth';
    }
  }

  private async handleAuthSuccess() {
    console.log('✅ Authentication successful');
    this.isAuthenticated = true;
    this.currentView = 'list';
    await this.initializeServices(); // Initialize services after auth
    await this.loadSessions();
    this.startAutoRefresh();

    // Check if there was a session ID in the URL that we should navigate to
    const url = new URL(window.location.href);
    const sessionId = url.searchParams.get('session');
    if (sessionId) {
      // Try to find the session and navigate to it
      const session = this.sessions.find((s) => s.id === sessionId);
      if (session) {
        this.userInitiatedSessionChange = false;
        this.selectedSessionId = sessionId;
        this.currentView = 'session';
      }
    }
  }

  private async initializeServices() {
    console.log('🚀 Initializing services...');
    try {
      // Initialize buffer subscription service for WebSocket connections
      await bufferSubscriptionService.initialize();

      // Initialize push notification service
      await pushNotificationService.initialize();

      console.log('✅ Services initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize services:', error);
      // Don't fail the whole app if services fail to initialize
      // These are optional features
    }
  }

  private async handleLogout() {
    console.log('👋 Logging out');
    await authClient.logout();
    this.isAuthenticated = false;
    this.currentView = 'auth';
    this.sessions = [];
  }

  private handleShowSSHKeyManager() {
    this.showSSHKeyManager = true;
  }

  private handleCloseSSHKeyManager() {
    this.showSSHKeyManager = false;
  }

  private showError(message: string) {
    // Clear any existing error timeout
    if (this.errorTimeoutId !== null) {
      clearTimeout(this.errorTimeoutId);
      this.errorTimeoutId = null;
    }

    this.errorMessage = message;
    // Clear error after configured timeout
    this.errorTimeoutId = window.setTimeout(() => {
      this.errorMessage = '';
      this.errorTimeoutId = null;
    }, TIMING.ERROR_MESSAGE_TIMEOUT);
  }

  private showSuccess(message: string) {
    // Clear any existing success timeout
    if (this.successTimeoutId !== null) {
      clearTimeout(this.successTimeoutId);
      this.successTimeoutId = null;
    }

    this.successMessage = message;
    // Clear success after configured timeout
    this.successTimeoutId = window.setTimeout(() => {
      this.successMessage = '';
      this.successTimeoutId = null;
    }, TIMING.SUCCESS_MESSAGE_TIMEOUT);
  }

  private clearError() {
    // Only clear if there's no active timeout
    if (this.errorTimeoutId === null) {
      this.errorMessage = '';
    }
  }

  private clearSuccess() {
    // Clear the timeout if active
    if (this.successTimeoutId !== null) {
      clearTimeout(this.successTimeoutId);
      this.successTimeoutId = null;
    }
    this.successMessage = '';
  }

  private async loadSessions() {
    // Only show loading state on initial load, not on refreshes
    if (!this.initialLoadComplete) {
      this.loading = true;
    }

    const performLoad = async () => {
      try {
        const headers = authClient.getAuthHeader();
        const response = await fetch('/api/sessions', { headers });
        if (response.ok) {
          this.sessions = (await response.json()) as Session[];
          this.clearError();
        } else if (response.status === 401) {
          // Authentication failed, redirect to login
          this.handleLogout();
          return;
        } else {
          this.showError('Failed to load sessions');
        }
      } catch (error) {
        logger.error('error loading sessions:', error);
        this.showError('Failed to load sessions');
      } finally {
        this.loading = false;
        this.initialLoadComplete = true;
      }
    };

    // Use view transition for initial load with fade effect
    if (
      !this.initialLoadComplete &&
      'startViewTransition' in document &&
      typeof document.startViewTransition === 'function'
    ) {
      logger.log('🎨 Using View Transition API for initial session load');
      // Add initial-load class for specific CSS handling
      document.body.classList.add('initial-session-load');

      const transition = document.startViewTransition(async () => {
        await performLoad();
        await this.updateComplete;
      });

      // Log when transition is ready
      transition.ready
        .then(() => {
          logger.log('✨ Initial load view transition ready');
        })
        .catch((err) => {
          logger.error('❌ Initial load view transition failed:', err);
        });

      // Clean up the class after transition completes
      transition.finished
        .finally(() => {
          logger.log('✅ Initial load view transition finished');
          document.body.classList.remove('initial-session-load');
        })
        .catch(() => {
          // Ignore errors, just make sure we clean up
          document.body.classList.remove('initial-session-load');
        });
    } else {
      // Regular load without transition
      if (!this.initialLoadComplete) {
        logger.log('🎨 Using CSS animation fallback for initial load');
        document.body.classList.add('initial-session-load');
        await performLoad();
        // Remove class after animation completes
        setTimeout(() => {
          document.body.classList.remove('initial-session-load');
        }, 600);
      } else {
        await performLoad();
      }
    }
  }

  private startAutoRefresh() {
    // Refresh sessions at configured interval, but only when showing session list
    this.autoRefreshIntervalId = window.setInterval(() => {
      if (this.currentView === 'list') {
        this.loadSessions();
      }
    }, TIMING.AUTO_REFRESH_INTERVAL);
  }

  private async handleSessionCreated(e: CustomEvent) {
    const sessionId = e.detail.sessionId;
    const message = e.detail.message;

    if (!sessionId) {
      this.showError('Session created but ID not found in response');
      return;
    }

    // Add class to prevent flicker when closing modal
    document.body.classList.add('modal-closing');
    this.showCreateModal = false;

    // Remove the class after a short delay
    setTimeout(() => {
      document.body.classList.remove('modal-closing');
    }, 300);

    // Check if this was a terminal spawn (not a web session)
    if (message?.includes('Terminal spawned successfully')) {
      // Don't try to switch to the session - it's running in a terminal window
      this.showSuccess('Terminal window opened successfully');
      return;
    }

    // Wait for session to appear in the list and then switch to it
    await this.waitForSessionAndSwitch(sessionId);
  }

  private async waitForSessionAndSwitch(sessionId: string) {
    const maxAttempts = 10;
    const delay = TIMING.SESSION_SEARCH_DELAY; // Configured delay between attempts

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await this.loadSessions();

      // Try to find by exact ID match
      const session = this.sessions.find((s) => s.id === sessionId);

      if (session) {
        // Session found, navigate to it using the proper navigation method
        await this.handleNavigateToSession(
          new CustomEvent('navigate-to-session', {
            detail: { sessionId: session.id },
          })
        );
        return;
      }

      // Wait before next attempt
      await new Promise((resolve) => window.setTimeout(resolve, delay));
    }

    // If we get here, session creation might have failed
    logger.log('session not found after all attempts');
    this.showError('Session created but could not be found. Please refresh.');
  }

  private handleSessionKilled(e: CustomEvent) {
    logger.log(`session ${e.detail} killed`);
    this.loadSessions(); // Refresh the list
  }

  private handleRefresh() {
    this.loadSessions();
  }

  private handleError(e: CustomEvent) {
    this.showError(e.detail);
  }

  private async handleHideExitedChange(e: CustomEvent) {
    console.log('handleHideExitedChange', {
      currentHideExited: this.hideExited,
      newHideExited: e.detail,
    });

    // Don't use View Transitions for hide/show exited toggle
    // as it causes the entire UI to fade. Use CSS animations instead.
    const wasHidingExited = this.hideExited;

    // Capture current scroll position and check if we're near the bottom
    const scrollTop = window.scrollY;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = window.innerHeight;
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100; // Within 100px of bottom

    // Add pre-animation class
    document.body.classList.add('sessions-animating');
    console.log('Added sessions-animating class');

    // Update state
    this.hideExited = e.detail;
    this.saveHideExitedState(this.hideExited);

    // Wait for render and trigger animations
    await this.updateComplete;
    console.log('Update complete, scheduling animation');

    requestAnimationFrame(() => {
      // Add specific animation direction
      const animationClass = wasHidingExited ? 'sessions-showing' : 'sessions-hiding';
      document.body.classList.add(animationClass);
      console.log('Added animation class:', animationClass);

      // Check what elements will be animated
      const cards = document.querySelectorAll('.session-flex-responsive > session-card');
      console.log('Found session cards to animate:', cards.length);

      // If we were near the bottom, maintain that position
      if (isNearBottom) {
        // Use a small delay to ensure DOM has updated
        requestAnimationFrame(() => {
          window.scrollTo({
            top: document.documentElement.scrollHeight - clientHeight,
            behavior: 'instant',
          });
        });
      }

      // Clean up after animation
      setTimeout(() => {
        document.body.classList.remove('sessions-animating', 'sessions-showing', 'sessions-hiding');
        console.log('Cleaned up animation classes');

        // Final scroll adjustment after animation completes
        if (isNearBottom) {
          window.scrollTo({
            top: document.documentElement.scrollHeight - clientHeight,
            behavior: 'instant',
          });
        }
      }, 300);
    });
  }

  private handleCreateSession() {
    // Check if View Transitions API is supported
    if ('startViewTransition' in document && typeof document.startViewTransition === 'function') {
      document.startViewTransition(() => {
        this.showCreateModal = true;
      });
    } else {
      this.showCreateModal = true;
    }
  }

  private handleCreateModalClose() {
    // Check if View Transitions API is supported
    if ('startViewTransition' in document && typeof document.startViewTransition === 'function') {
      // Add a class to prevent flicker during transition
      document.body.classList.add('modal-closing');

      const transition = document.startViewTransition(() => {
        this.showCreateModal = false;
      });

      // Clean up the class after transition
      transition.finished.finally(() => {
        document.body.classList.remove('modal-closing');
      });
    } else {
      this.showCreateModal = false;
    }
  }

  private cleanupSessionViewStream(): void {
    const sessionView = this.querySelector('session-view') as SessionViewElement;
    if (sessionView?.streamConnection) {
      logger.log('Cleaning up stream connection');
      sessionView.streamConnection.disconnect();
      sessionView.streamConnection = null;
    }
  }

  private async handleNavigateToSession(e: CustomEvent): Promise<void> {
    const { sessionId } = e.detail;

    // Clean up any existing session view stream before switching
    if (this.selectedSessionId !== sessionId) {
      this.cleanupSessionViewStream();
    }

    // Debug: Log current state before navigation
    logger.debug('Navigation to session:', {
      sessionId,
      windowWidth: window.innerWidth,
      mobileBreakpoint: BREAKPOINTS.MOBILE,
      isMobile: this.mediaState.isMobile,
      currentSidebarCollapsed: this.sidebarCollapsed,
      mediaStateIsMobile: this.mediaState.isMobile,
    });

    this.userInitiatedSessionChange = true;

    // Check if View Transitions API is supported
    if ('startViewTransition' in document && typeof document.startViewTransition === 'function') {
      // Debug: Check what elements have view-transition-name before transition
      logger.debug('before transition - elements with view-transition-name:');
      document.querySelectorAll('[style*="view-transition-name"]').forEach((el) => {
        logger.debug('element:', el, 'style:', el.getAttribute('style'));
      });

      // Use View Transitions API for smooth animation
      const transition = document.startViewTransition(async () => {
        // Update state which will trigger a re-render
        this.selectedSessionId = sessionId;
        this.currentView = 'session';
        this.updateUrl(sessionId);

        // Collapse sidebar on mobile after selecting a session
        if (this.mediaState.isMobile) {
          this.sidebarCollapsed = true;
          this.saveSidebarState(true);
        }

        // Wait for LitElement to complete its update
        await this.updateComplete;

        // Trigger terminal resize after session switch to ensure proper dimensions
        triggerTerminalResize(sessionId, this);

        // Debug: Check what elements have view-transition-name after transition
        logger.debug('after transition - elements with view-transition-name:');
        document.querySelectorAll('[style*="view-transition-name"]').forEach((el) => {
          logger.debug('element:', el, 'style:', el.getAttribute('style'));
        });
      });

      // Log if transition is ready
      transition.ready
        .then(() => {
          logger.debug('view transition ready');
        })
        .catch((err) => {
          logger.error('view transition failed:', err);
        });
    } else {
      // Fallback for browsers without View Transitions support
      this.selectedSessionId = sessionId;
      this.currentView = 'session';
      this.updateUrl(sessionId);

      // Collapse sidebar on mobile after selecting a session
      if (this.mediaState.isMobile) {
        this.sidebarCollapsed = true;
        this.saveSidebarState(true);
      }

      // Trigger terminal resize after session switch to ensure proper dimensions
      this.updateComplete.then(() => {
        triggerTerminalResize(sessionId, this);
      });
    }
  }

  private handleNavigateToList(): void {
    // Clean up the session view before navigating away
    this.cleanupSessionViewStream();

    // Check if View Transitions API is supported
    if ('startViewTransition' in document && typeof document.startViewTransition === 'function') {
      // Use View Transitions API for smooth animation
      document.startViewTransition(() => {
        // Update state which will trigger a re-render
        this.selectedSessionId = null;
        this.currentView = 'list';
        this.updateUrl();

        // Force update to ensure DOM changes happen within the transition
        return this.updateComplete;
      });
    } else {
      // Fallback for browsers without View Transitions support
      this.selectedSessionId = null;
      this.currentView = 'list';
      this.updateUrl();
    }
  }

  private async handleKillAll() {
    // Find all session cards and call their kill method
    const sessionCards = this.querySelectorAll<SessionCard>('session-card');
    const killPromises: Promise<boolean>[] = [];

    sessionCards.forEach((card: SessionCard) => {
      // Check if this session is running
      if (card.session && card.session.status === 'running') {
        // Call the public kill method which handles animation and API call
        killPromises.push(card.kill());
      }
    });

    if (killPromises.length === 0) {
      return;
    }

    // Wait for all kill operations to complete
    const results = await Promise.all(killPromises);
    const successCount = results.filter((r) => r).length;

    if (successCount === killPromises.length) {
      this.showSuccess(`All ${successCount} sessions killed successfully`);
    } else if (successCount > 0) {
      this.showError(`Killed ${successCount} of ${killPromises.length} sessions`);
    } else {
      this.showError('Failed to kill sessions');
    }

    // Refresh the session list after a short delay to allow animations to complete
    window.setTimeout(() => {
      this.loadSessions();
    }, TIMING.KILL_ALL_ANIMATION_DELAY);
  }

  private handleCleanExited() {
    // Find the session list and call its cleanup method directly
    const sessionList = this.querySelector('session-list') as HTMLElement & {
      handleCleanupExited?: () => void;
    };
    if (sessionList?.handleCleanupExited) {
      sessionList.handleCleanupExited();
    }
  }

  private handleToggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.saveSidebarState(this.sidebarCollapsed);
  }

  // State persistence methods
  private loadHideExitedState(): boolean {
    try {
      const saved = localStorage.getItem('hideExitedSessions');
      return saved !== null ? saved === 'true' : true; // Default to true if not set
    } catch (error) {
      logger.error('error loading hideExited state:', error);
      return true; // Default to true on error
    }
  }

  private saveHideExitedState(value: boolean): void {
    try {
      localStorage.setItem('hideExitedSessions', String(value));
    } catch (error) {
      logger.error('error saving hideExited state:', error);
    }
  }

  private loadSidebarState(): boolean {
    try {
      const saved = localStorage.getItem('sidebarCollapsed');
      // Default to false (expanded) on desktop, true (collapsed) on mobile
      // Use window.innerWidth for initial load since mediaState might not be initialized yet
      const isMobile = window.innerWidth < BREAKPOINTS.MOBILE;

      // Force expanded on desktop regardless of localStorage for better UX
      const result = isMobile ? (saved !== null ? saved === 'true' : true) : false;

      logger.debug('Loading sidebar state:', {
        savedValue: saved,
        windowWidth: window.innerWidth,
        mobileBreakpoint: BREAKPOINTS.MOBILE,
        isMobile,
        forcedDesktopExpanded: !isMobile,
        resultingState: result ? 'collapsed' : 'expanded',
      });

      return result;
    } catch (error) {
      logger.error('error loading sidebar state:', error);
      return window.innerWidth < BREAKPOINTS.MOBILE; // Default based on screen size on error
    }
  }

  private saveSidebarState(value: boolean): void {
    try {
      localStorage.setItem('sidebarCollapsed', String(value));
    } catch (error) {
      logger.error('error saving sidebar state:', error);
    }
  }

  private loadSidebarWidth(): number {
    try {
      const saved = localStorage.getItem('sidebarWidth');
      const width = saved !== null ? Number.parseInt(saved, 10) : SIDEBAR.DEFAULT_WIDTH;
      // Validate width is within bounds
      return Math.max(SIDEBAR.MIN_WIDTH, Math.min(SIDEBAR.MAX_WIDTH, width));
    } catch (error) {
      logger.error('error loading sidebar width:', error);
      return SIDEBAR.DEFAULT_WIDTH;
    }
  }

  private saveSidebarWidth(value: number): void {
    try {
      localStorage.setItem('sidebarWidth', String(value));
    } catch (error) {
      logger.error('error saving sidebar width:', error);
    }
  }

  private setupResponsiveObserver(): void {
    this.responsiveUnsubscribe = responsiveObserver.subscribe((state) => {
      const oldState = this.mediaState;
      this.mediaState = state;

      // Only trigger state changes after initial setup and render
      // This prevents the sidebar from flickering on page load
      if (this.responsiveObserverInitialized && this.initialRenderComplete) {
        // Auto-collapse sidebar when switching to mobile
        if (!oldState.isMobile && state.isMobile && !this.sidebarCollapsed) {
          this.sidebarCollapsed = true;
          this.saveSidebarState(true);
        }
      } else if (!this.responsiveObserverInitialized) {
        // Mark as initialized after first callback
        this.responsiveObserverInitialized = true;
      }
    });
  }

  private cleanupResizeListeners(): void {
    this.resizeCleanupFunctions.forEach((cleanup) => cleanup());
    this.resizeCleanupFunctions = [];

    // Reset any global styles that might have been applied
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }

  private handleResizeStart = (e: MouseEvent) => {
    e.preventDefault();
    this.isResizing = true;

    // Clean up any existing listeners first
    this.cleanupResizeListeners();

    document.addEventListener('mousemove', this.handleResize);
    document.addEventListener('mouseup', this.handleResizeEnd);

    // Store cleanup functions
    this.resizeCleanupFunctions.push(() => {
      document.removeEventListener('mousemove', this.handleResize);
      document.removeEventListener('mouseup', this.handleResizeEnd);
    });

    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  };

  private handleResize = (e: MouseEvent) => {
    if (!this.isResizing) return;

    const newWidth = Math.max(SIDEBAR.MIN_WIDTH, Math.min(SIDEBAR.MAX_WIDTH, e.clientX));
    this.sidebarWidth = newWidth;
    this.saveSidebarWidth(newWidth);
  };

  private handleResizeEnd = () => {
    this.isResizing = false;
    this.cleanupResizeListeners();
  };

  // URL Routing methods
  private setupRouting() {
    // Handle browser back/forward navigation
    window.addEventListener('popstate', this.handlePopState.bind(this));

    // Parse initial URL and set state
    this.parseUrlAndSetState().catch(console.error);
  }

  private handlePopState = (_event: PopStateEvent) => {
    // Handle browser back/forward navigation
    this.parseUrlAndSetState().catch(console.error);
  };

  private async parseUrlAndSetState() {
    const url = new URL(window.location.href);
    const sessionId = url.searchParams.get('session');

    // Check authentication status first (unless no-auth is enabled)
    try {
      const configResponse = await fetch('/api/auth/config');
      if (configResponse.ok) {
        const authConfig = await configResponse.json();
        if (authConfig.noAuth) {
          // Skip auth check for no-auth mode
        } else if (!authClient.isAuthenticated()) {
          this.currentView = 'auth';
          this.selectedSessionId = null;
          return;
        }
      } else if (!authClient.isAuthenticated()) {
        this.currentView = 'auth';
        this.selectedSessionId = null;
        return;
      }
    } catch (_error) {
      if (!authClient.isAuthenticated()) {
        this.currentView = 'auth';
        this.selectedSessionId = null;
        return;
      }
    }

    if (sessionId) {
      // Check if we have sessions loaded
      if (this.sessions.length === 0 && this.isAuthenticated) {
        // Sessions not loaded yet, load them first
        await this.loadSessions();
      }

      // Now check if the session exists
      const session = this.sessions.find((s) => s.id === sessionId);
      if (session) {
        this.selectedSessionId = sessionId;
        this.currentView = 'session';
      } else {
        // Session not found, go to list view
        console.warn(`Session ${sessionId} not found in sessions list`);
        this.selectedSessionId = null;
        this.currentView = 'list';
        // Clear the session param from URL
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('session');
        window.history.replaceState({}, '', newUrl.toString());
      }
    } else {
      this.selectedSessionId = null;
      this.currentView = 'list';
    }
  }

  private updateUrl(sessionId?: string) {
    const url = new URL(window.location.href);

    if (sessionId) {
      url.searchParams.set('session', sessionId);
    } else {
      url.searchParams.delete('session');
    }

    // Update browser URL without triggering page reload
    window.history.pushState(null, '', url.toString());
  }

  private setupHotReload(): void {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}?hotReload=true`;

        this.hotReloadWs = new WebSocket(wsUrl);
        this.hotReloadWs.onmessage = (event) => {
          const message = JSON.parse(event.data);
          if (message.type === 'reload') {
            window.location.reload();
          }
        };
      } catch (error) {
        logger.log('error setting up hot reload:', error);
      }
    }
  }

  private setupNotificationHandlers() {
    // Listen for notification settings events
  }

  private setupPreferences() {
    // Load preferences from localStorage
    try {
      const stored = localStorage.getItem('vibetunnel_app_preferences');
      if (stored) {
        const preferences = JSON.parse(stored);
        this.showLogLink = preferences.showLogLink || false;
      }
    } catch (error) {
      console.error('Failed to load app preferences', error);
    }

    // Listen for preference changes
    window.addEventListener('app-preferences-changed', (e: Event) => {
      const event = e as CustomEvent;
      this.showLogLink = event.detail.showLogLink;
    });
  }

  private handleOpenSettings = () => {
    console.log('🎯 handleOpenSettings called in app.ts');
    this.showSettings = true;
  };

  private handleCloseSettings = () => {
    this.showSettings = false;
  };

  private handleOpenFileBrowser = () => {
    this.showFileBrowser = true;
  };

  private handleNotificationEnabled = (e: CustomEvent) => {
    const { success, reason } = e.detail;
    if (success) {
      this.showSuccess('Notifications enabled successfully');
    } else {
      this.showError(`Failed to enable notifications: ${reason || 'Unknown error'}`);
    }
  };

  private get showSplitView(): boolean {
    return this.currentView === 'session' && this.selectedSessionId !== null;
  }

  private get selectedSession(): Session | undefined {
    return this.sessions.find((s) => s.id === this.selectedSessionId);
  }

  private get sidebarClasses(): string {
    if (!this.showSplitView) {
      // Main view - allow normal document flow and scrolling
      return 'w-full min-h-screen flex flex-col';
    }

    const baseClasses = 'bg-dark-bg-secondary border-r border-dark-border flex flex-col';
    const isMobile = this.mediaState.isMobile;
    const transitionClass =
      this.initialRenderComplete && !isMobile
        ? this.userInitiatedSessionChange
          ? 'sidebar-transition'
          : ''
        : '';
    const mobileClasses = isMobile ? 'absolute left-0 top-0 bottom-0 z-30 flex' : transitionClass;

    const collapsedClasses = this.sidebarCollapsed
      ? isMobile
        ? 'hidden mobile-sessions-sidebar collapsed'
        : 'sm:w-0 sm:overflow-hidden sm:translate-x-0 flex'
      : isMobile
        ? 'overflow-visible sm:translate-x-0 flex mobile-sessions-sidebar expanded'
        : 'overflow-visible sm:translate-x-0 flex';

    return `${baseClasses} ${this.showSplitView ? collapsedClasses : ''} ${this.showSplitView ? mobileClasses : ''}`;
  }

  private get sidebarStyles(): string {
    if (!this.showSplitView || this.sidebarCollapsed) {
      const isMobile = this.mediaState.isMobile;
      return this.showSplitView && this.sidebarCollapsed && !isMobile ? 'width: 0px;' : '';
    }

    const isMobile = this.mediaState.isMobile;
    if (isMobile) {
      return `width: calc(100vw - ${SIDEBAR.MOBILE_RIGHT_MARGIN}px);`;
    }

    return `width: ${this.sidebarWidth}px;`;
  }

  private get shouldShowMobileOverlay(): boolean {
    return this.showSplitView && !this.sidebarCollapsed && this.mediaState.isMobile;
  }

  private get shouldShowResizeHandle(): boolean {
    return this.showSplitView && !this.sidebarCollapsed && !this.mediaState.isMobile;
  }

  private get mainContainerClasses(): string {
    // In split view, we need strict height control and overflow hidden
    // In main view, we need normal document flow for scrolling
    if (this.showSplitView) {
      // Add iOS-specific class to prevent rubber band scrolling
      const iosClass = this.isIOS() ? 'ios-split-view' : '';
      return `flex h-screen overflow-hidden relative ${iosClass}`;
    }
    return 'min-h-screen';
  }

  private isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
  }

  render() {
    const showSplitView = this.showSplitView;
    const selectedSession = this.selectedSession;

    return html`
      <!-- Error notification overlay -->
      ${
        this.errorMessage
          ? html`
            <div class="fixed top-4 right-4 z-50">
              <div
                class="bg-status-error text-dark-bg px-4 py-2 rounded shadow-lg font-mono text-sm"
              >
                ${this.errorMessage}
                <button
                  @click=${() => {
                    if (this.errorTimeoutId !== null) {
                      clearTimeout(this.errorTimeoutId);
                      this.errorTimeoutId = null;
                    }
                    this.errorMessage = '';
                  }}
                  class="ml-2 text-dark-bg hover:text-dark-text"
                >
                  ✕
                </button>
              </div>
            </div>
          `
          : ''
      }
      ${
        this.successMessage
          ? html`
            <div class="fixed top-4 right-4 z-50">
              <div
                class="bg-status-success text-dark-bg px-4 py-2 rounded shadow-lg font-mono text-sm"
              >
                ${this.successMessage}
                <button
                  @click=${() => {
                    if (this.successTimeoutId !== null) {
                      clearTimeout(this.successTimeoutId);
                      this.successTimeoutId = null;
                    }
                    this.successMessage = '';
                  }}
                  class="ml-2 text-dark-bg hover:text-dark-text"
                >
                  ✕
                </button>
              </div>
            </div>
          `
          : ''
      }

      <!-- Main content -->
      ${
        this.currentView === 'auth'
          ? html`
            <auth-login
              .authClient=${authClient}
              @auth-success=${this.handleAuthSuccess}
              @show-ssh-key-manager=${this.handleShowSSHKeyManager}
              @open-settings=${this.handleOpenSettings}
            ></auth-login>
          `
          : html`
      <!-- Main content with split view support -->
      <div class="${this.mainContainerClasses}">
        <!-- Mobile overlay when sidebar is open -->
        ${
          this.shouldShowMobileOverlay
            ? html`
              <!-- Translucent overlay over session content -->
              <div
                class="absolute inset-0 bg-black bg-opacity-10 sm:hidden transition-opacity"
                style="left: calc(100vw - ${SIDEBAR.MOBILE_RIGHT_MARGIN}px); transition-duration: ${TRANSITIONS.MOBILE_SLIDE}ms;"
                @click=${this.handleToggleSidebar}
              ></div>
              <!-- Clickable area behind sidebar -->
              <div
                class="absolute inset-0 bg-black bg-opacity-50 sm:hidden transition-opacity"
                style="right: ${SIDEBAR.MOBILE_RIGHT_MARGIN}px; transition-duration: ${TRANSITIONS.MOBILE_SLIDE}ms;"
                @click=${this.handleToggleSidebar}
              ></div>
            `
            : ''
        }

        <!-- Sidebar with session list - always visible on desktop -->
        <div class="${this.sidebarClasses}" style="${this.sidebarStyles}">
          <app-header
            .sessions=${this.sessions}
            .hideExited=${this.hideExited}
            .showSplitView=${showSplitView}
            .currentUser=${authClient.getCurrentUser()?.userId || null}
            .authMethod=${authClient.getCurrentUser()?.authMethod || null}
            @create-session=${this.handleCreateSession}
            @hide-exited-change=${this.handleHideExitedChange}
            @kill-all-sessions=${this.handleKillAll}
            @clean-exited-sessions=${this.handleCleanExited}
            @open-file-browser=${this.handleOpenFileBrowser}
            @open-settings=${this.handleOpenSettings}
            @logout=${this.handleLogout}
            @navigate-to-list=${this.handleNavigateToList}
          ></app-header>
          <div class="${this.showSplitView ? 'flex-1 overflow-y-auto' : 'flex-1'} bg-dark-bg-secondary">
            <session-list
              .sessions=${this.sessions}
              .loading=${this.loading}
              .hideExited=${this.hideExited}
              .showCreateModal=${this.showCreateModal}
              .selectedSessionId=${this.selectedSessionId}
              .compactMode=${showSplitView}
              .authClient=${authClient}
              @session-killed=${this.handleSessionKilled}
              @session-created=${this.handleSessionCreated}
              @create-modal-close=${this.handleCreateModalClose}
              @refresh=${this.handleRefresh}
              @error=${this.handleError}
              @hide-exited-change=${this.handleHideExitedChange}
              @kill-all-sessions=${this.handleKillAll}
              @navigate-to-session=${this.handleNavigateToSession}
              @open-file-browser=${() => {
                this.showFileBrowser = true;
              }}
            ></session-list>
          </div>
        </div>

        <!-- Resize handle for sidebar -->
        ${
          this.shouldShowResizeHandle
            ? html`
              <div
                class="w-1 bg-dark-border hover:bg-accent-green cursor-ew-resize transition-colors ${
                  this.isResizing ? 'bg-accent-green' : ''
                }"
                style="transition-duration: ${TRANSITIONS.RESIZE_HANDLE}ms;"
                @mousedown=${this.handleResizeStart}
                title="Drag to resize sidebar"
              ></div>
            `
            : ''
        }

        <!-- Main content area -->
        ${
          showSplitView
            ? html`
              <div class="flex-1 relative sm:static transition-none">
                ${keyed(
                  this.selectedSessionId,
                  html`
                    <session-view
                      .session=${selectedSession}
                      .showBackButton=${false}
                      .showSidebarToggle=${true}
                      .sidebarCollapsed=${this.sidebarCollapsed}
                      .disableFocusManagement=${this.hasActiveOverlay}
                      @navigate-to-list=${this.handleNavigateToList}
                      @toggle-sidebar=${this.handleToggleSidebar}
                    ></session-view>
                  `
                )}
              </div>
            `
            : ''
        }
      </div>
      `
      }

      <!-- File Browser Modal -->
      <file-browser
        .visible=${this.showFileBrowser}
        .mode=${'browse'}
        .session=${null}
        @browser-cancel=${() => {
          this.showFileBrowser = false;
        }}
      ></file-browser>

      <!-- Unified Settings Modal -->
      <unified-settings
        .visible=${this.showSettings}
        @close=${this.handleCloseSettings}
        @notifications-enabled=${() => this.showSuccess('Notifications enabled')}
        @notifications-disabled=${() => this.showSuccess('Notifications disabled')}
        @success=${(e: CustomEvent) => this.showSuccess(e.detail)}
        @error=${(e: CustomEvent) => this.showError(e.detail)}
      ></unified-settings>

      <!-- SSH Key Manager Modal -->
      <ssh-key-manager
        .visible=${this.showSSHKeyManager}
        .sshAgent=${authClient.getSSHAgent()}
        @close=${this.handleCloseSSHKeyManager}
      ></ssh-key-manager>

      <!-- Version and logs link in bottom right -->
      ${
        this.showLogLink
          ? html`
        <div class="fixed bottom-4 right-4 text-dark-text-muted text-xs font-mono z-20">
          <a href="/logs" class="hover:text-dark-text transition-colors">Logs</a>
          <span class="ml-2">v${VERSION}</span>
        </div>
      `
          : ''
      }
    `;
  }
}
