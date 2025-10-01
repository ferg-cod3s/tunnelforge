/**
 * Settings Page Object Model
 * Provides abstractions for interacting with TunnelForge settings
 */

import { type Page, type Locator } from '@playwright/test';

export class SettingsPage {
  readonly page: Page;

  // Settings button/menu
  readonly settingsButton: Locator;
  readonly settingsModal: Locator;

  // Tab navigation
  readonly generalTab: Locator;
  readonly serverTab: Locator;
  readonly remoteTab: Locator;
  readonly advancedTab: Locator;

  // General settings
  readonly autoStartCheckbox: Locator;
  readonly notificationsCheckbox: Locator;

  // Server settings
  readonly serverPortInput: Locator;
  readonly serverHostInput: Locator;

  // Remote access settings
  readonly enableTailscaleCheckbox: Locator;
  readonly enableCloudflareCheckbox: Locator;
  readonly enableNgrokCheckbox: Locator;

  // Action buttons
  readonly saveButton: Locator;
  readonly cancelButton: Locator;
  readonly resetButton: Locator;

  constructor(page: Page) {
    this.page = page;

    // Main settings selectors - using flexible locators
    this.settingsButton = page.getByRole('button', { name: /settings/i });
    this.settingsModal = page.locator('[data-testid="settings-modal"], [role="dialog"]').first();

    // Tab selectors
    this.generalTab = page.getByRole('tab', { name: /general/i });
    this.serverTab = page.getByRole('tab', { name: /server/i });
    this.remoteTab = page.getByRole('tab', { name: /remote/i });
    this.advancedTab = page.getByRole('tab', { name: /advanced/i });

    // General settings selectors
    this.autoStartCheckbox = page.getByRole('checkbox', { name: /auto.?start|launch.?at.?login/i });
    this.notificationsCheckbox = page.getByRole('checkbox', { name: /notifications/i });

    // Server settings selectors
    this.serverPortInput = page.getByLabel(/port/i);
    this.serverHostInput = page.getByLabel(/host/i);

    // Remote access selectors
    this.enableTailscaleCheckbox = page.getByRole('checkbox', { name: /tailscale/i });
    this.enableCloudflareCheckbox = page.getByRole('checkbox', { name: /cloudflare/i });
    this.enableNgrokCheckbox = page.getByRole('checkbox', { name: /ngrok/i });

    // Action buttons
    this.saveButton = page.getByRole('button', { name: /save/i });
    this.cancelButton = page.getByRole('button', { name: /cancel/i });
    this.resetButton = page.getByRole('button', { name: /reset/i });
  }

  async open() {
    await this.settingsButton.click();
    await this.settingsModal.waitFor({ state: 'visible' });
  }

  async close() {
    await this.cancelButton.click();
    await this.settingsModal.waitFor({ state: 'hidden' });
  }

  async navigateToTab(tab: 'general' | 'server' | 'remote' | 'advanced') {
    const tabs = {
      general: this.generalTab,
      server: this.serverTab,
      remote: this.remoteTab,
      advanced: this.advancedTab,
    };

    await tabs[tab].click();
  }

  async save() {
    await this.saveButton.click();
    // Wait for save to complete
    await this.page.waitForTimeout(500);
  }

  async toggleCheckbox(checkbox: Locator, enabled: boolean) {
    const isChecked = await checkbox.isChecked();
    if (isChecked !== enabled) {
      await checkbox.click();
    }
  }
}
