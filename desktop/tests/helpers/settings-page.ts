/**
 * Page Object Model for TunnelForge Desktop Settings
 *
 * This class provides a reusable abstraction for the settings UI,
 * matching the actual HTML structure in dist/index.html
 */

import { Page, Locator } from '@playwright/test';

export class SettingsPage {
  readonly page: Page;

  // Navigation tabs (using data-tab attribute from actual HTML)
  readonly generalTab: Locator;
  readonly notificationsTab: Locator;
  readonly powerTab: Locator;
  readonly integrationsTab: Locator;
  readonly serverTab: Locator;

  // General settings (matching actual IDs in HTML)
  readonly autoStartCheckbox: Locator;
  readonly showInDockCheckbox: Locator;
  readonly serverPortInput: Locator;
  readonly accessModeSelect: Locator;

  // Notification settings
  readonly notificationsEnabledCheckbox: Locator;
  readonly notificationSoundCheckbox: Locator;
  readonly sessionStartNotificationCheckbox: Locator;
  readonly sessionEndNotificationCheckbox: Locator;
  readonly errorNotificationCheckbox: Locator;
  readonly testNotificationButton: Locator;

  // Power management
  readonly preventSleepCheckbox: Locator;
  readonly powerMonitoringCheckbox: Locator;

  // Integrations
  readonly tailscaleEnabledCheckbox: Locator;
  readonly cloudflareEnabledCheckbox: Locator;
  readonly ngrokEnabledCheckbox: Locator;
  readonly ngrokAuthTokenInput: Locator;

  // Server management
  readonly startServerButton: Locator;
  readonly stopServerButton: Locator;
  readonly restartServerButton: Locator;
  readonly serverStatusText: Locator;

  // Actions
  readonly saveButton: Locator;
  readonly openWebUILink: Locator;
  readonly viewLogsLink: Locator;

  // Notifications and overlays
  readonly loadingOverlay: Locator;
  readonly notification: Locator;
  readonly notificationMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // Navigation tabs (using data-tab attribute from actual HTML)
    this.generalTab = page.locator('[data-tab="general"]');
    this.notificationsTab = page.locator('[data-tab="notifications"]');
    this.powerTab = page.locator('[data-tab="power"]');
    this.integrationsTab = page.locator('[data-tab="integrations"]');
    this.serverTab = page.locator('[data-tab="server"]');

    // General settings (matching actual IDs in HTML)
    this.autoStartCheckbox = page.locator('#autoStart');
    this.showInDockCheckbox = page.locator('#showInDock');
    this.serverPortInput = page.locator('#serverPort');
    this.accessModeSelect = page.locator('#accessMode');

    // Notification settings
    this.notificationsEnabledCheckbox = page.locator('#notificationsEnabled');
    this.notificationSoundCheckbox = page.locator('#notificationSound');
    this.sessionStartNotificationCheckbox = page.locator('#sessionStartNotification');
    this.sessionEndNotificationCheckbox = page.locator('#sessionEndNotification');
    this.errorNotificationCheckbox = page.locator('#errorNotification');
    this.testNotificationButton = page.locator('#testNotification');

    // Power management
    this.preventSleepCheckbox = page.locator('#preventSleep');
    this.powerMonitoringCheckbox = page.locator('#powerMonitoring');

    // Integrations
    this.tailscaleEnabledCheckbox = page.locator('#tailscaleEnabled');
    this.cloudflareEnabledCheckbox = page.locator('#cloudflareEnabled');
    this.ngrokEnabledCheckbox = page.locator('#ngrokEnabled');
    this.ngrokAuthTokenInput = page.locator('#ngrokAuthToken');

    // Server management
    this.startServerButton = page.locator('#startServer');
    this.stopServerButton = page.locator('#stopServer');
    this.restartServerButton = page.locator('#restartServer');
    this.serverStatusText = page.locator('#serverStatusText');

    // Actions
    this.saveButton = page.locator('#saveSettings');
    this.openWebUILink = page.locator('#openWebUI');
    this.viewLogsLink = page.locator('#viewLogs');

    // Notifications and overlays
    this.loadingOverlay = page.locator('#loadingOverlay');
    this.notification = page.locator('#notification');
    this.notificationMessage = page.locator('.notification-message');
  }

  /**
   * Navigate to a specific settings tab
   */
  async navigateToTab(tab: 'general' | 'notifications' | 'power' | 'integrations' | 'server') {
    const tabs = {
      general: this.generalTab,
      notifications: this.notificationsTab,
      power: this.powerTab,
      integrations: this.integrationsTab,
      server: this.serverTab,
    };

    const targetTab = tabs[tab];
    await targetTab.click();
    await this.page.waitForTimeout(300); // Wait for tab transition
  }

  /**
   * Get the active settings panel
   */
  async getActivePanel() {
    return this.page.locator('.settings-panel.active');
  }

  /**
   * Toggle a checkbox to a specific state
   */
  async toggleCheckbox(checkbox: Locator, checked: boolean) {
    const isChecked = await checkbox.isChecked();
    if (isChecked !== checked) {
      await checkbox.click();
    }
  }

  /**
   * Set server port value
   */
  async setServerPort(port: number) {
    await this.serverPortInput.fill(port.toString());
  }

  /**
   * Set access mode
   */
  async setAccessMode(mode: 'localhost' | 'network' | 'public') {
    await this.accessModeSelect.selectOption(mode);
  }

  /**
   * Save settings
   */
  async save() {
    await this.saveButton.click();
  }

  /**
   * Wait for loading overlay to disappear
   */
  async waitForLoading() {
    await this.loadingOverlay.waitFor({ state: 'hidden', timeout: 5000 });
  }

  /**
   * Get notification message text
   */
  async getNotificationText() {
    await this.notification.waitFor({ state: 'visible', timeout: 3000 });
    return await this.notificationMessage.textContent();
  }

  /**
   * Check if a specific tab is active
   */
  async isTabActive(tab: 'general' | 'notifications' | 'power' | 'integrations' | 'server') {
    const tabs = {
      general: this.generalTab,
      notifications: this.notificationsTab,
      power: this.powerTab,
      integrations: this.integrationsTab,
      server: this.serverTab,
    };

    const targetTab = tabs[tab];
    const classList = await targetTab.getAttribute('class');
    return classList?.includes('active') || false;
  }

  /**
   * Get current server port value
   */
  async getServerPort() {
    return await this.serverPortInput.inputValue();
  }

  /**
   * Get current access mode value
   */
  async getAccessMode() {
    return await this.accessModeSelect.inputValue();
  }

  /**
   * Verify settings panel structure
   */
  async verifyPanelStructure(panelId: string) {
    const panel = this.page.locator(`#${panelId}`);
    await panel.waitFor({ state: 'visible' });

    // Check for heading
    const heading = panel.locator('h2').first();
    await heading.waitFor({ state: 'visible' });

    return {
      isVisible: await panel.isVisible(),
      hasHeading: await heading.isVisible(),
      headingText: await heading.textContent(),
    };
  }
}
