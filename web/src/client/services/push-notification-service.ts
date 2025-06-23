import { createLogger } from '../utils/logger.js';
import { PushSubscription, PushNotificationPreferences } from '../../shared/types.js';

// Re-export types for components
export { PushSubscription, PushNotificationPreferences };
export type NotificationPreferences = PushNotificationPreferences;

const logger = createLogger('push-notification-service');

// VAPID public key will be fetched from server
let _VAPID_PUBLIC_KEY: string | null = null;

type NotificationPermissionChangeCallback = (permission: NotificationPermission) => void;
type SubscriptionChangeCallback = (subscription: PushSubscription | null) => void;

export class PushNotificationService {
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  private pushSubscription: globalThis.PushSubscription | null = null;
  private permissionChangeCallbacks: Set<NotificationPermissionChangeCallback> = new Set();
  private subscriptionChangeCallbacks: Set<SubscriptionChangeCallback> = new Set();
  private initialized = false;
  private vapidPublicKey: string | null = null;
  private pushNotificationsAvailable = false;

  constructor() {
    this.initialize().catch((error) => {
      logger.error('failed to initialize push notification service:', error);
    });
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Check if service workers are supported
      if (!('serviceWorker' in navigator)) {
        logger.warn('service workers not supported');
        return;
      }

      // Check if push messaging is supported
      if (!('PushManager' in window)) {
        logger.warn('push messaging not supported');
        return;
      }

      // Fetch VAPID public key from server
      await this.fetchVapidPublicKey();

      // Register service worker
      this.serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      logger.log('service worker registered');

      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;

      // Get existing subscription if any
      this.pushSubscription = await this.serviceWorkerRegistration.pushManager.getSubscription();

      // Listen for service worker messages
      navigator.serviceWorker.addEventListener(
        'message',
        this.handleServiceWorkerMessage.bind(this)
      );

      // Monitor permission changes
      this.monitorPermissionChanges();

      this.initialized = true;
      logger.log('push notification service initialized');
    } catch (error) {
      logger.error('failed to initialize service worker:', error);
      throw error;
    }
  }

  private handleServiceWorkerMessage(event: MessageEvent): void {
    const { data } = event;

    switch (data.type) {
      case 'notification-action': {
        // Handle notification action from service worker
        this.handleNotificationAction(data.action, data.data);
        break;
      }
    }
  }

  private handleNotificationAction(action: string, data: unknown): void {
    // Dispatch custom event for app to handle
    window.dispatchEvent(
      new CustomEvent('notification-action', {
        detail: { action, data },
      })
    );
  }

  private monitorPermissionChanges(): void {
    // Modern browsers support permission change events
    if ('permissions' in navigator) {
      navigator.permissions
        .query({ name: 'notifications' as PermissionName })
        .then((permissionStatus) => {
          permissionStatus.addEventListener('change', () => {
            this.notifyPermissionChange(permissionStatus.state as NotificationPermission);
          });
        })
        .catch((error) => {
          logger.warn('failed to monitor permission changes:', error);
        });
    }
  }

  private notifyPermissionChange(permission: NotificationPermission): void {
    this.permissionChangeCallbacks.forEach((callback) => {
      try {
        callback(permission);
      } catch (error) {
        logger.error('error in permission change callback:', error);
      }
    });
  }

  private notifySubscriptionChange(subscription: PushSubscription | null): void {
    this.subscriptionChangeCallbacks.forEach((callback) => {
      try {
        callback(subscription);
      } catch (error) {
        logger.error('error in subscription change callback:', error);
      }
    });
  }

  /**
   * Request notification permission from user
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      throw new Error('Notifications not supported');
    }

    let permission = Notification.permission;

    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }

    this.notifyPermissionChange(permission);
    return permission;
  }

  /**
   * Get current notification permission status
   */
  getPermission(): NotificationPermission {
    if (!('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }

  /**
   * Subscribe to push notifications
   */
  async subscribe(): Promise<PushSubscription | null> {
    if (!this.serviceWorkerRegistration) {
      throw new Error('Service worker not initialized');
    }

    try {
      // Request permission first
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Check if VAPID key is available
      if (!this.vapidPublicKey) {
        throw new Error('VAPID public key not available');
      }

      // Convert VAPID key to Uint8Array
      const vapidKey = this.urlBase64ToUint8Array(this.vapidPublicKey);

      // Subscribe to push notifications
      this.pushSubscription = await this.serviceWorkerRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });

      // Convert to our interface format
      const subscription = this.pushSubscriptionToInterface(this.pushSubscription);

      // Send subscription to server
      await this.sendSubscriptionToServer(subscription);

      this.notifySubscriptionChange(subscription);
      logger.log('successfully subscribed to push notifications');

      return subscription;
    } catch (error) {
      logger.error('failed to subscribe to push notifications:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<void> {
    if (!this.pushSubscription) {
      return;
    }

    try {
      // Unsubscribe from push manager
      await this.pushSubscription.unsubscribe();

      // Remove subscription from server
      await this.removeSubscriptionFromServer();

      this.pushSubscription = null;
      this.notifySubscriptionChange(null);
      logger.log('successfully unsubscribed from push notifications');
    } catch (error) {
      logger.error('failed to unsubscribe from push notifications:', error);
      throw error;
    }
  }

  /**
   * Get current push subscription
   */
  getSubscription(): PushSubscription | null {
    if (!this.pushSubscription) {
      return null;
    }
    return this.pushSubscriptionToInterface(this.pushSubscription);
  }

  /**
   * Check if push notifications are supported
   */
  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  /**
   * Check if currently subscribed
   */
  isSubscribed(): boolean {
    return this.pushSubscription !== null;
  }

  /**
   * Test notification functionality
   */
  async testNotification(): Promise<void> {
    if (!this.serviceWorkerRegistration) {
      throw new Error('Service worker not initialized');
    }

    const permission = this.getPermission();
    if (permission !== 'granted') {
      throw new Error('Notification permission not granted');
    }

    try {
      await this.serviceWorkerRegistration.showNotification('VibeTunnel Test', {
        body: 'Push notifications are working correctly!',
        icon: '/apple-touch-icon.png',
        badge: '/favicon-32.png',
        tag: 'vibetunnel-test',
        requireInteraction: false,
        // Remove actions property as it's not standard in all browsers
        // actions: [
        //   {
        //     action: 'dismiss',
        //     title: 'Dismiss',
        //   },
        // ],
      });

      logger.log('test notification sent');
    } catch (error) {
      logger.error('failed to send test notification:', error);
      throw error;
    }
  }

  /**
   * Clear all VibeTunnel notifications
   */
  async clearAllNotifications(): Promise<void> {
    if (!this.serviceWorkerRegistration) {
      return;
    }

    try {
      const notifications = await this.serviceWorkerRegistration.getNotifications();

      for (const notification of notifications) {
        if (notification.tag && notification.tag.startsWith('vibetunnel-')) {
          notification.close();
        }
      }

      logger.log('cleared all notifications');
    } catch (error) {
      logger.error('failed to clear notifications:', error);
    }
  }

  /**
   * Save notification preferences
   */
  savePreferences(preferences: PushNotificationPreferences): void {
    try {
      localStorage.setItem('vibetunnel-notification-preferences', JSON.stringify(preferences));
      logger.debug('saved notification preferences');
    } catch (error) {
      logger.error('failed to save notification preferences:', error);
    }
  }

  /**
   * Load notification preferences
   */
  loadPreferences(): PushNotificationPreferences {
    try {
      const saved = localStorage.getItem('vibetunnel-notification-preferences');
      if (saved) {
        return { ...this.getDefaultPreferences(), ...JSON.parse(saved) };
      }
    } catch (error) {
      logger.error('failed to load notification preferences:', error);
    }
    return this.getDefaultPreferences();
  }

  /**
   * Get default notification preferences
   */
  private getDefaultPreferences(): PushNotificationPreferences {
    return {
      enabled: false,
      sessionExit: true,
      sessionStart: false,
      sessionError: true,
      systemAlerts: true,
      soundEnabled: true,
      vibrationEnabled: true,
    };
  }

  /**
   * Register callback for permission changes
   */
  onPermissionChange(callback: NotificationPermissionChangeCallback): () => void {
    this.permissionChangeCallbacks.add(callback);
    return () => this.permissionChangeCallbacks.delete(callback);
  }

  /**
   * Register callback for subscription changes
   */
  onSubscriptionChange(callback: SubscriptionChangeCallback): () => void {
    this.subscriptionChangeCallbacks.add(callback);
    return () => this.subscriptionChangeCallbacks.delete(callback);
  }

  private pushSubscriptionToInterface(subscription: globalThis.PushSubscription): PushSubscription {
    const keys = subscription.getKey('p256dh');
    const auth = subscription.getKey('auth');

    if (!keys || !auth) {
      throw new Error('Failed to get subscription keys');
    }

    return {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: this.arrayBufferToBase64(keys),
        auth: this.arrayBufferToBase64(auth),
      },
    };
  }

  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(subscription),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

      logger.log('subscription sent to server');
    } catch (error) {
      logger.error('failed to send subscription to server:', error);
      throw error;
    }
  }

  private async removeSubscriptionFromServer(): Promise<void> {
    try {
      const response = await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

      logger.log('subscription removed from server');
    } catch (error) {
      logger.error('failed to remove subscription from server:', error);
      // Don't throw here - local unsubscribe should still work
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  /**
   * Fetch VAPID public key from server
   */
  private async fetchVapidPublicKey(): Promise<void> {
    try {
      const response = await fetch('/api/push/vapid-public-key');

      if (!response.ok) {
        if (response.status === 503) {
          logger.warn('Push notifications not configured on server');
          this.pushNotificationsAvailable = false;
          return;
        }
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.publicKey || !data.enabled) {
        logger.warn('Push notifications disabled on server');
        this.pushNotificationsAvailable = false;
        return;
      }

      this.vapidPublicKey = data.publicKey;
      this.pushNotificationsAvailable = true;
      _VAPID_PUBLIC_KEY = data.publicKey; // For backward compatibility

      logger.log('VAPID public key fetched from server');
      logger.debug(`Public key: ${data.publicKey.substring(0, 20)}...`);
    } catch (error) {
      logger.error('Failed to fetch VAPID public key:', error);
      this.pushNotificationsAvailable = false;
      throw error;
    }
  }

  /**
   * Get server push notification status
   */
  async getServerStatus(): Promise<{
    enabled: boolean;
    configured: boolean;
    subscriptions: number;
    errors?: string[];
  }> {
    try {
      const response = await fetch('/api/push/status');

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('Failed to get server push status:', error);
      throw error;
    }
  }

  /**
   * Send test notification via server
   */
  async sendTestNotification(message?: string): Promise<void> {
    try {
      const response = await fetch('/api/push/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      logger.log('Test notification sent via server:', result);
    } catch (error) {
      logger.error('Failed to send test notification via server:', error);
      throw error;
    }
  }

  /**
   * Check if VAPID key is available
   */
  hasVapidKey(): boolean {
    return !!this.vapidPublicKey;
  }

  /**
   * Get current VAPID public key
   */
  getVapidPublicKey(): string | null {
    return this.vapidPublicKey;
  }

  /**
   * Refresh VAPID configuration from server
   */
  async refreshVapidConfig(): Promise<void> {
    await this.fetchVapidPublicKey();
  }

  /**
   * Clean up service
   */
  dispose(): void {
    this.permissionChangeCallbacks.clear();
    this.subscriptionChangeCallbacks.clear();
    this.initialized = false;
    this.vapidPublicKey = null;
    this.pushNotificationsAvailable = false;
  }
}

// Create singleton instance
export const pushNotificationService = new PushNotificationService();
