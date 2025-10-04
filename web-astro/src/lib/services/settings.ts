// Settings service for TunnelForge Svelte application

export interface AppPreferences {
  useDirectKeyboard: boolean;
  useBinaryMode: boolean;
}

export interface NotificationPreferences {
  enabled: boolean;
  sessionExit: boolean;
  sessionStart: boolean;
  commandError: boolean;
  commandCompletion: boolean;
  bell: boolean;
  claudeTurn: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface TunnelStatus {
  running: boolean;
  url?: string;
}

export interface MediaQueryState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

const DEFAULT_APP_PREFERENCES: AppPreferences = {
  useDirectKeyboard: true,
  useBinaryMode: false,
};

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: false,
  sessionExit: true,
  sessionStart: false,
  commandError: true,
  commandCompletion: false,
  bell: false,
  claudeTurn: false,
  soundEnabled: true,
  vibrationEnabled: false,
};

const STORAGE_KEY = 'tunnelforge_app_preferences';

// App preferences
export function getAppPreferences(): AppPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_APP_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Failed to load app preferences:', error);
  }
  return DEFAULT_APP_PREFERENCES;
}

export function saveAppPreferences(preferences: AppPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    window.dispatchEvent(
      new CustomEvent('app-preferences-changed', {
        detail: preferences,
      })
    );
  } catch (error) {
    console.error('Failed to save app preferences:', error);
  }
}

// Notification preferences
export function getNotificationPreferences(): NotificationPreferences {
  try {
    const stored = localStorage.getItem('tunnelforge_notification_preferences');
    if (stored) {
      return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Failed to load notification preferences:', error);
  }
  return DEFAULT_NOTIFICATION_PREFERENCES;
}

export function saveNotificationPreferences(preferences: NotificationPreferences): void {
  try {
    localStorage.setItem('tunnelforge_notification_preferences', JSON.stringify(preferences));
  } catch (error) {
    console.error('Failed to save notification preferences:', error);
  }
}

// Push notification service functions
export async function initializeNotifications(): Promise<void> {
  // Check if notifications are supported
  if (!('Notification' in window)) {
    throw new Error('Notifications not supported');
  }

  // Request permission if not already granted
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

export function getNotificationPermission(): NotificationPermission {
  return Notification.permission;
}

export function isNotificationsSupported(): boolean {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export function getRecommendedPreferences(): NotificationPreferences {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    enabled: true,
    sessionExit: true,
    commandError: true,
    soundEnabled: true,
  };
}

// Repository service functions
export async function discoverRepositories(basePath: string): Promise<string[]> {
  try {
    const response = await fetch(`/api/fs/discover-repos?path=${encodeURIComponent(basePath)}`);
    if (response.ok) {
      const data = await response.json();
      return data.repositories || [];
    }
  } catch (error) {
    console.error('Failed to discover repositories:', error);
  }
  return [];
}

export async function getRepositoryBasePath(): Promise<string> {
  try {
    const response = await fetch('/api/config/repository-base-path');
    if (response.ok) {
      const data = await response.json();
      return data.basePath || '~/';
    }
  } catch (error) {
    console.error('Failed to get repository base path:', error);
  }
  return '~/';
}

export async function updateRepositoryBasePath(basePath: string): Promise<void> {
  const response = await fetch('/api/config/repository-base-path', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ basePath }),
  });

  if (!response.ok) {
    throw new Error('Failed to update repository base path');
  }
}

// Tunnel service functions
export async function listTunnelServices(): Promise<any[]> {
  try {
    const response = await fetch('/api/tunnels/services');
    if (response.ok) {
      const data = await response.json();
      return data.services || [];
    }
  } catch (error) {
    console.error('Failed to list tunnel services:', error);
  }
  return [];
}

export async function getCloudflareStatus(): Promise<TunnelStatus> {
  try {
    const response = await fetch('/api/tunnels/cloudflare/status');
    if (response.ok) {
      return response.json();
    }
  } catch (error) {
    console.error('Failed to get tunnel status:', error);
  }
  return { running: false };
}

export async function startTunnel(options: { port: number }): Promise<void> {
  const response = await fetch('/api/tunnels/cloudflare/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to start tunnel');
  }
}

export async function stopTunnel(): Promise<void> {
  const response = await fetch('/api/tunnels/cloudflare/stop', {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to stop tunnel');
  }
}

// Responsive observer (simplified)
class ResponsiveObserver {
  private listeners: ((state: MediaQueryState) => void)[] = [];
  private currentState: MediaQueryState = {
    isMobile: false,
    isTablet: false,
    isDesktop: true,
  };

  constructor() {
    this.updateState();
    window.addEventListener('resize', () => this.updateState());
  }

  private updateState(): void {
    const width = window.innerWidth;
    this.currentState = {
      isMobile: width < 768,
      isTablet: width >= 768 && width < 1024,
      isDesktop: width >= 1024,
    };

    this.listeners.forEach(listener => listener(this.currentState));
  }

  getCurrentState(): MediaQueryState {
    return this.currentState;
  }

  subscribe(listener: (state: MediaQueryState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }
}

export const responsiveObserver = new ResponsiveObserver();

// Version
export const VERSION = '0.0.1';