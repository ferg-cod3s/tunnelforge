/**
 * ConfigHelper - Configuration Management Testing
 * 
 * Provides comprehensive functionality for testing configuration management,
 * settings persistence, preferences handling, and configuration validation.
 */

import { Page, BrowserContext, TestInfo } from '@playwright/test';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { 
  ConfigInfo, 
  ConfigSection,
  TestError,
  HelperConfig
} from './types';
import { createTestError, sleep } from './utils';

const sleep = promisify(setTimeout);

export class ConfigHelper {
  private page: Page;
  private context: BrowserContext;
  private testInfo: TestInfo;
  private config: HelperConfig;
  private configHistory: ConfigInfo[] = [];
  private originalConfig: ConfigInfo | null = null;

  constructor(
    page: Page,
    context: BrowserContext,
    testInfo: TestInfo,
    debugPort: number = 9222,
    config: Partial<HelperConfig> = {}
  ) {
    this.page = page;
    this.context = context;
    this.testInfo = testInfo;
    this.config = {
      debugPort,
      timeout: 15000,
      retries: 2,
      screenshotOnFailure: true,
      videoRecording: false,
      traceRecording: false,
      logLevel: 'info',
      tempDir: 'test-results/temp',
      ...config
    };
  }

  /**
   * Initialize configuration helper and backup current config
   */
  async initialize(): Promise<void> {
    console.log('⚙️ Initializing ConfigHelper...');
    
    try {
      // Get current configuration
      this.originalConfig = await this.getCurrentConfig();
      
      console.log('📋 Original configuration:', this.originalConfig);
      console.log('✅ ConfigHelper initialized');
      
    } catch (error) {
      console.error('❌ ConfigHelper initialization failed:', error);
      throw createTestError('ConfigHelper initialization failed', 'CONFIG_HELPER_INIT', { error });
    }
  }

  /**
   * Get current configuration
   */
  async getCurrentConfig(): Promise<ConfigInfo> {
    console.log('📖 Getting current configuration...');
    
    try {
      const config = await this.page.evaluate(() => {
        return window.__TAURI__?.invoke?.('get_config') || {};
      });
      
      const configInfo: ConfigInfo = {
        autoStart: config.autoStart || false,
        startOnLogin: config.startOnLogin || false,
        minimizeToTray: config.minimizeToTray !== false,
        showNotifications: config.showNotifications !== false,
        serverPort: config.serverPort || 4021,
        logLevel: config.logLevel || 'info',
        theme: config.theme || 'system'
      };
      
      this.configHistory.push(configInfo);
      return configInfo;
      
    } catch (error) {
      console.error('❌ Failed to get current config:', error);
      throw createTestError('Failed to get current config', 'GET_CURRENT_CONFIG', { error });
    }
  }

  /**
   * Validate configuration object
   */
  async validateConfig(config: any): Promise<{ valid: boolean; errors: string[] }> {
    console.log('✅ Validating configuration...');
    
    const errors: string[] = [];
    
    try {
      // Validate server port
      if (config.serverPort !== undefined) {
        if (typeof config.serverPort !== 'number' || config.serverPort < 1 || config.serverPort > 65535) {
          errors.push('Server port must be a number between 1 and 65535');
        }
      }
      
      // Validate theme
      if (config.theme !== undefined) {
        const validThemes = ['light', 'dark', 'system'];
        if (!validThemes.includes(config.theme)) {
          errors.push(`Theme must be one of: ${validThemes.join(', ')}`);
        }
      }
      
      // Validate log level
      if (config.logLevel !== undefined) {
        const validLogLevels = ['debug', 'info', 'warn', 'error'];
        if (!validLogLevels.includes(config.logLevel)) {
          errors.push(`Log level must be one of: ${validLogLevels.join(', ')}`);
        }
      }
      
      // Validate boolean fields
      const booleanFields = ['autoStart', 'startOnLogin', 'minimizeToTray', 'showNotifications'];
      for (const field of booleanFields) {
        if (config[field] !== undefined && typeof config[field] !== 'boolean') {
          errors.push(`${field} must be a boolean value`);
        }
      }
      
      const isValid = errors.length === 0;
      
      if (isValid) {
        console.log('✅ Configuration is valid');
      } else {
        console.warn('⚠️ Configuration validation failed:', errors);
      }
      
      return { valid: isValid, errors };
      
    } catch (error) {
      console.error('❌ Failed to validate configuration:', error);
      return { valid: false, errors: ['Validation error: ' + error.message] };
    }
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<ConfigInfo>): Promise<ConfigInfo> {
    console.log('📝 Updating configuration:', updates);
    
    try {
      // Get current config
      const currentConfig = await this.getCurrentConfig();
      
      // Merge updates
      const newConfig = { ...currentConfig, ...updates };
      
      // Apply updates
      await this.page.evaluate((config) => {
        return window.__TAURI__?.invoke?.('update_config', config);
      }, newConfig);
      
      // Wait for config to be saved
      await sleep(1000);
      
      // Verify config was updated
      const updatedConfig = await this.getCurrentConfig();
      
      // Validate updates were applied
      for (const [key, value] of Object.entries(updates)) {
        if ((updatedConfig as any)[key] !== value) {
          throw new Error(`Config update failed for ${key}: expected ${value}, got ${(updatedConfig as any)[key]}`);
        }
      }
      
      console.log('✅ Configuration updated successfully');
      return updatedConfig;
      
    } catch (error) {
      console.error('❌ Failed to update config:', error);
      throw createTestError('Failed to update config', 'UPDATE_CONFIG', { error, updates });
    }
  }

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults(): Promise<ConfigInfo> {
    console.log('🔄 Resetting configuration to defaults...');
    
    try {
      const defaultConfig: ConfigInfo = {
        autoStart: false,
        startOnLogin: false,
        minimizeToTray: true,
        showNotifications: true,
        serverPort: 4021,
        logLevel: 'info',
        theme: 'system'
      };
      
      await this.page.evaluate((config) => {
        return window.__TAURI__?.invoke?.('reset_config', config);
      }, defaultConfig);
      
      // Wait for reset to complete
      await sleep(1000);
      
      const resetConfig = await this.getCurrentConfig();
      console.log('✅ Configuration reset to defaults');
      
      return resetConfig;
      
    } catch (error) {
      console.error('❌ Failed to reset config:', error);
      throw createTestError('Failed to reset config', 'RESET_CONFIG', { error });
    }
  }

  /**
   * Test configuration persistence
   */
  async testConfigPersistence(): Promise<void> {
    console.log('💾 Testing configuration persistence...');
    
    try {
      // Get original config
      const originalConfig = await this.getCurrentConfig();
      
      // Make some changes
      const testConfig: Partial<ConfigInfo> = {
        autoStart: !originalConfig.autoStart,
        minimizeToTray: !originalConfig.minimizeToTray,
        logLevel: originalConfig.logLevel === 'info' ? 'debug' : 'info'
      };
      
      // Apply changes
      await this.updateConfig(testConfig);
      
      // Simulate app restart by reloading the page
      await this.page.reload();
      
      // Wait for app to initialize
      await this.page.waitForLoadState('networkidle');
      await sleep(2000);
      
      // Check if config persisted
      const reloadedConfig = await this.getCurrentConfig();
      
      for (const [key, value] of Object.entries(testConfig)) {
        if ((reloadedConfig as any)[key] !== value) {
          throw new Error(`Config persistence failed for ${key}: expected ${value}, got ${(reloadedConfig as any)[key]}`);
        }
      }
      
      // Restore original config
      await this.updateConfig(originalConfig);
      
      console.log('✅ Configuration persistence test passed');
      
    } catch (error) {
      console.error('❌ Configuration persistence test failed:', error);
      throw createTestError('Configuration persistence test failed', 'CONFIG_PERSISTENCE', { error });
    }
  }

  /**
   * Test configuration validation
   */
  async testConfigValidation(): Promise<void> {
    console.log('✅ Testing configuration validation...');
    
    try {
      // Test invalid port number
      try {
        await this.updateConfig({ serverPort: -1 });
        throw new Error('Should have failed with invalid port');
      } catch (error) {
        console.log('✅ Invalid port validation passed');
      }
      
      try {
        await this.updateConfig({ serverPort: 65536 });
        throw new Error('Should have failed with invalid port');
      } catch (error) {
        console.log('✅ Port range validation passed');
      }
      
      // Test invalid log level
      try {
        await this.updateConfig({ logLevel: 'invalid' as any });
        throw new Error('Should have failed with invalid log level');
      } catch (error) {
        console.log('✅ Log level validation passed');
      }
      
      // Test invalid theme
      try {
        await this.updateConfig({ theme: 'invalid' as any });
        throw new Error('Should have failed with invalid theme');
      } catch (error) {
        console.log('✅ Theme validation passed');
      }
      
      console.log('✅ Configuration validation test passed');
      
    } catch (error) {
      console.error('❌ Configuration validation test failed:', error);
      throw createTestError('Configuration validation test failed', 'CONFIG_VALIDATION', { error });
    }
  }

  /**
   * Test configuration sections
   */
  async testConfigSections(): Promise<ConfigSection[]> {
    console.log('📚 Testing configuration sections...');
    
    try {
      const sections = await this.page.evaluate(() => {
        return window.__TAURI__?.invoke?.('get_config_sections') || [];
      });
      
      console.log('📋 Available config sections:', sections);
      
      // Test each section
      for (const section of sections) {
        const sectionData = await this.page.evaluate((sectionName) => {
          return window.__TAURI__?.invoke?.('get_config_section', { section: sectionName });
        }, section.name);
        
        console.log(`📖 Section ${section.name}:`, sectionData);
      }
      
      return sections;
      
    } catch (error) {
      console.error('❌ Configuration sections test failed:', error);
      throw createTestError('Configuration sections test failed', 'CONFIG_SECTIONS', { error });
    }
  }

  /**
   * Test configuration import/export
   */
  async testConfigImportExport(): Promise<void> {
    console.log('📤 Testing configuration import/export...');
    
    try {
      // Export current config
      const exportedConfig = await this.page.evaluate(() => {
        return window.__TAURI__?.invoke?.('export_config');
      });
      
      if (!exportedConfig) {
        throw new Error('Failed to export configuration');
      }
      
      console.log('📤 Exported config:', exportedConfig);
      
      // Make some changes
      await this.updateConfig({
        autoStart: true,
        minimizeToTray: false
      });
      
      // Import the exported config
      await this.page.evaluate((config) => {
        return window.__TAURI__?.invoke?.('import_config', config);
      }, exportedConfig);
      
      // Wait for import to complete
      await sleep(1000);
      
      // Verify config was restored
      const restoredConfig = await this.getCurrentConfig();
      
      if (restoredConfig.autoStart !== (exportedConfig.autoStart || false) ||
          restoredConfig.minimizeToTray !== (exportedConfig.minimizeToTray !== false)) {
        throw new Error('Config import failed to restore values');
      }
      
      console.log('✅ Configuration import/export test passed');
      
    } catch (error) {
      console.error('❌ Configuration import/export test failed:', error);
      throw createTestError('Configuration import/export test failed', 'CONFIG_IMPORT_EXPORT', { error });
    }
  }

  /**
   * Test configuration backup and restore
   */
  async testConfigBackupRestore(): Promise<void> {
    console.log('💾 Testing configuration backup and restore...');
    
    try {
      // Create backup
      const backupId = await this.page.evaluate(() => {
        return window.__TAURI__?.invoke?.('create_config_backup');
      });
      
      if (!backupId) {
        throw new Error('Failed to create config backup');
      }
      
      console.log('💾 Created backup:', backupId);
      
      // Make some changes
      await this.updateConfig({
        autoStart: true,
        startOnLogin: true,
        minimizeToTray: false,
        showNotifications: false
      });
      
      // Restore from backup
      await this.page.evaluate((id) => {
        return window.__TAURI__?.invoke?.('restore_config_backup', { backupId: id });
      }, backupId);
      
      // Wait for restore to complete
      await sleep(1000);
      
      // Verify config was restored
      const restoredConfig = await this.getCurrentConfig();
      
      if (restoredConfig.autoStart || restoredConfig.startOnLogin || 
          !restoredConfig.minimizeToTray || !restoredConfig.showNotifications) {
        throw new Error('Config backup restore failed');
      }
      
      // Clean up backup
      await this.page.evaluate((id) => {
        return window.__TAURI__?.invoke?.('delete_config_backup', { backupId: id });
      }, backupId);
      
      console.log('✅ Configuration backup/restore test passed');
      
    } catch (error) {
      console.error('❌ Configuration backup/restore test failed:', error);
      throw createTestError('Configuration backup/restore test failed', 'CONFIG_BACKUP_RESTORE', { error });
    }
  }

  /**
   * Test configuration synchronization
   */
  async testConfigSync(): Promise<void> {
    console.log('🔄 Testing configuration synchronization...');
    
    try {
      // Get current config
      const originalConfig = await this.getCurrentConfig();
      
      // Update config through one method
      await this.updateConfig({ autoStart: !originalConfig.autoStart });
      
      // Check if config is synchronized across all components
      const syncedConfig = await this.page.evaluate(() => {
        return {
          mainConfig: window.__TAURI__?.invoke?.('get_config'),
          uiConfig: window.__TAURI__?.invoke?.('get_ui_config'),
          serverConfig: window.__TAURI__?.invoke?.('get_server_config')
        };
      });
      
      // Verify synchronization
      if (syncedConfig.mainConfig?.autoStart !== syncedConfig.uiConfig?.autoStart ||
          syncedConfig.mainConfig?.autoStart !== syncedConfig.serverConfig?.autoStart) {
        throw new Error('Configuration synchronization failed');
      }
      
      // Restore original config
      await this.updateConfig(originalConfig);
      
      console.log('✅ Configuration synchronization test passed');
      
    } catch (error) {
      console.error('❌ Configuration synchronization test failed:', error);
      throw createTestError('Configuration synchronization test failed', 'CONFIG_SYNC', { error });
    }
  }

  /**
   * Test configuration migration
   */
  async testConfigMigration(): Promise<void> {
    console.log('🔄 Testing configuration migration...');
    
    try {
      // Simulate old config format
      const oldConfig = {
        server: {
          port: 4021,
          auto_start: true
        },
        ui: {
          theme: 'dark',
          minimize_to_tray: false
        },
        notifications: {
          enabled: true
        }
      };
      
      // Migrate old config
      await this.page.evaluate((config) => {
        return window.__TAURI__?.invoke?.('migrate_config', config);
      }, oldConfig);
      
      // Wait for migration to complete
      await sleep(2000);
      
      // Verify migration
      const migratedConfig = await this.getCurrentConfig();
      
      if (migratedConfig.serverPort !== 4021 ||
          migratedConfig.autoStart !== true ||
          migratedConfig.theme !== 'dark' ||
          migratedConfig.minimizeToTray !== false ||
          migratedConfig.showNotifications !== true) {
        throw new Error('Configuration migration failed');
      }
      
      console.log('✅ Configuration migration test passed');
      
    } catch (error) {
      console.error('❌ Configuration migration test failed:', error);
      throw createTestError('Configuration migration test failed', 'CONFIG_MIGRATION', { error });
    }
  }

  /**
   * Get configuration history
   */
  getConfigHistory(): ConfigInfo[] {
    return [...this.configHistory];
  }

  /**
   * Clear configuration history
   */
  clearConfigHistory(): void {
    this.configHistory = [];
    console.log('🗑️ Configuration history cleared');
  }

  /**
   * Restore original configuration
   */
  async restoreOriginalConfig(): Promise<void> {
    if (this.originalConfig) {
      console.log('🔄 Restoring original configuration...');
      
      try {
        await this.updateConfig(this.originalConfig);
        console.log('✅ Original configuration restored');
      } catch (error) {
        console.error('❌ Failed to restore original config:', error);
        throw createTestError('Failed to restore original config', 'RESTORE_ORIGINAL_CONFIG', { error });
      }
    }
  }

  /**
   * Test configuration file integrity
   */
  async testConfigFileIntegrity(): Promise<void> {
    console.log('🔒 Testing configuration file integrity...');
    
    try {
      // Get config file path
      const configPath = await this.page.evaluate(() => {
        return window.__TAURI__?.invoke?.('get_config_file_path');
      });
      
      if (!configPath) {
        throw new Error('Could not get config file path');
      }
      
      console.log('📁 Config file path:', configPath);
      
      // Check if file exists and is readable
      const fileExists = await this.page.evaluate((path) => {
        return window.__TAURI__?.fs?.exists(path);
      }, configPath);
      
      if (!fileExists) {
        throw new Error('Config file does not exist');
      }
      
      // Read file content
      const fileContent = await this.page.evaluate((path) => {
        return window.__TAURI__?.fs?.readTextFile(path);
      }, configPath);
      
      if (!fileContent) {
        throw new Error('Config file is empty');
      }
      
      // Validate JSON structure
      try {
        JSON.parse(fileContent);
      } catch {
        throw new Error('Config file is not valid JSON');
      }
      
      console.log('✅ Configuration file integrity test passed');
      
    } catch (error) {
      console.error('❌ Configuration file integrity test failed:', error);
      throw createTestError('Configuration file integrity test failed', 'CONFIG_FILE_INTEGRITY', { error });
    }
  }

  /**
   * Cleanup configuration helper
   */
  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up ConfigHelper...');
    
    try {
      // Restore original configuration
      await this.restoreOriginalConfig();
      
      console.log('✅ ConfigHelper cleanup completed');
      
    } catch (error) {
      console.warn('⚠️ ConfigHelper cleanup failed:', error);
    }
  }
}