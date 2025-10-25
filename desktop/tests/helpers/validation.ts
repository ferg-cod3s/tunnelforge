/**
 * Validation utilities for Tauri test helpers
 */

import { ValidationResult, ValidationRule, SystemInfo, ConfigInfo, WindowInfo } from './types';
import { Page } from '@playwright/test';
import { isValidPort, isValidURL } from './utils';

/**
 * Validation engine for Tauri tests
 */
export class ValidationEngine {
  private rules: ValidationRule[] = [];

  /**
   * Add a validation rule
   */
  addRule(rule: ValidationRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove a validation rule
   */
  removeRule(name: string): void {
    this.rules = this.rules.filter(rule => rule.name !== name);
  }

  /**
   * Run all validation rules
   */
  async validateAll(context: any): Promise<ValidationResult> {
    const results: ValidationResult[] = [];
    
    for (const rule of this.rules) {
      try {
        const result = await rule.validate(context);
        results.push(result);
      } catch (error) {
        results.push({
          isValid: false,
          errors: [`Rule '${rule.name}' failed: ${(error as Error).message}`],
          warnings: [],
          details: { error }
        });
      }
    }
    
    return this.combineResults(results);
  }

  /**
   * Run a specific validation rule
   */
  async validateRule(name: string, context: any): Promise<ValidationResult> {
    const rule = this.rules.find(r => r.name === name);
    
    if (!rule) {
      return {
        isValid: false,
        errors: [`Validation rule '${name}' not found`],
        warnings: [],
        details: {}
      };
    }
    
    try {
      return await rule.validate(context);
    } catch (error) {
      return {
        isValid: false,
        errors: [`Rule '${name}' failed: ${(error as Error).message}`],
        warnings: [],
        details: { error }
      };
    }
  }

  /**
   * Combine multiple validation results
   */
  private combineResults(results: ValidationResult[]): ValidationResult {
    const combined: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      details: { results }
    };
    
    for (const result of results) {
      if (!result.isValid) {
        combined.isValid = false;
      }
      
      combined.errors.push(...result.errors);
      combined.warnings.push(...result.warnings);
    }
    
    return combined;
  }

  /**
   * Get all rules
   */
  getRules(): ValidationRule[] {
    return [...this.rules];
  }

  /**
   * Clear all rules
   */
  clearRules(): void {
    this.rules = [];
  }
}

/**
 * System information validator
 */
export class SystemValidator {
  /**
   * Validate system information
   */
  static validateSystemInfo(systemInfo: SystemInfo): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check required fields
    if (!systemInfo.platform) {
      errors.push('Platform information is missing');
    }
    
    if (!systemInfo.arch) {
      errors.push('Architecture information is missing');
    }
    
    if (!systemInfo.tauriVersion) {
      warnings.push('Tauri version information is missing');
    }
    
    // Check platform validity
    const validPlatforms = ['win32', 'darwin', 'linux'];
    if (systemInfo.platform && !validPlatforms.includes(systemInfo.platform)) {
      warnings.push(`Unknown platform: ${systemInfo.platform}`);
    }
    
    // Check architecture validity
    const validArchs = ['x64', 'arm64', 'ia32'];
    if (systemInfo.arch && !validArchs.includes(systemInfo.arch)) {
      warnings.push(`Unknown architecture: ${systemInfo.arch}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      details: { systemInfo }
    };
  }

  /**
   * Validate network connectivity
   */
  static validateNetworkConnectivity(isOnline: boolean): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!isOnline) {
      warnings.push('System appears to be offline');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      details: { isOnline }
    };
  }

  /**
   * Validate display configuration (for Linux/WSL)
   */
  static validateDisplayConfig(display?: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (process.platform === 'linux' && !display) {
      warnings.push('DISPLAY environment variable not set (may affect UI tests)');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      details: { display, platform: process.platform }
    };
  }
}

/**
 * Configuration validator
 */
export class ConfigValidator {
  /**
   * Validate configuration information
   */
  static validateConfig(config: ConfigInfo): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate server port
    if (!isValidPort(config.serverPort)) {
      errors.push(`Invalid server port: ${config.serverPort}`);
    }
    
    // Validate log level
    const validLogLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLogLevels.includes(config.logLevel)) {
      errors.push(`Invalid log level: ${config.logLevel}`);
    }
    
    // Validate theme
    const validThemes = ['light', 'dark', 'system'];
    if (!validThemes.includes(config.theme)) {
      errors.push(`Invalid theme: ${config.theme}`);
    }
    
    // Check for potentially problematic configurations
    if (config.serverPort < 1024) {
      warnings.push('Server port is below 1024 (may require admin privileges)');
    }
    
    if (config.serverPort === 80 || config.serverPort === 443) {
      warnings.push('Using standard HTTP/HTTPS ports may conflict with other services');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      details: { config }
    };
  }

  /**
   * Validate configuration consistency
   */
  static validateConfigConsistency(config: ConfigInfo): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check for logical inconsistencies
    if (config.autoStart && !config.startOnLogin) {
      warnings.push('Auto-start is enabled but start-on-login is disabled');
    }
    
    if (config.minimizeToTray && !config.showNotifications) {
      warnings.push('Minimize to tray is enabled but notifications are disabled (user may not see app state)');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      details: { config }
    };
  }
}

/**
 * Window validator
 */
export class WindowValidator {
  /**
   * Validate window information
   */
  static validateWindowInfo(windowInfo: WindowInfo): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check required fields
    if (!windowInfo.id) {
      errors.push('Window ID is missing');
    }
    
    if (!windowInfo.title) {
      errors.push('Window title is missing');
    }
    
    // Validate dimensions
    if (windowInfo.width <= 0 || windowInfo.height <= 0) {
      errors.push(`Invalid window dimensions: ${windowInfo.width}x${windowInfo.height}`);
    }
    
    if (windowInfo.width < 100 || windowInfo.height < 100) {
      warnings.push(`Window is very small: ${windowInfo.width}x${windowInfo.height}`);
    }
    
    // Validate position
    if (windowInfo.x < 0 || windowInfo.y < 0) {
      warnings.push(`Window position is off-screen: (${windowInfo.x}, ${windowInfo.y})`);
    }
    
    // Check for reasonable maximum dimensions
    if (windowInfo.width > 10000 || windowInfo.height > 10000) {
      warnings.push(`Window dimensions are unusually large: ${windowInfo.width}x${windowInfo.height}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      details: { windowInfo }
    };
  }

  /**
   * Validate window state consistency
   */
  static validateWindowState(windowInfo: WindowInfo): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Check for contradictory states
    if (windowInfo.isMaximized && windowInfo.isMinimized) {
      errors.push('Window cannot be both maximized and minimized');
    }
    
    if (windowInfo.isFullscreen && (windowInfo.isMaximized || windowInfo.isMinimized)) {
      warnings.push('Window is fullscreen but also has other state flags set');
    }
    
    if (!windowInfo.isVisible && !windowInfo.isMinimized) {
      warnings.push('Window is not visible but not minimized');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      details: { windowInfo }
    };
  }
}

/**
 * Network validator
 */
export class NetworkValidator {
  /**
   * Validate URL
   */
  static validateURL(url: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!url) {
      errors.push('URL is empty');
      return { isValid: false, errors, warnings, details: { url } };
    }
    
    if (!isValidURL(url)) {
      errors.push(`Invalid URL format: ${url}`);
    }
    
    // Check for potentially problematic URLs
    if (url.startsWith('http://') && !url.includes('localhost')) {
      warnings.push('Using HTTP instead of HTTPS for non-local URL');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      details: { url }
    };
  }

  /**
   * Validate tunnel configuration
   */
  static validateTunnelConfig(tunnelType: string, localPort: number, publicUrl?: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Validate tunnel type
    const validTypes = ['ngrok', 'cloudflare', 'tailscale', 'custom'];
    if (!validTypes.includes(tunnelType)) {
      errors.push(`Invalid tunnel type: ${tunnelType}`);
    }
    
    // Validate local port
    if (!isValidPort(localPort)) {
      errors.push(`Invalid local port: ${localPort}`);
    }
    
    // Validate public URL if provided
    if (publicUrl) {
      const urlValidation = this.validateURL(publicUrl);
      errors.push(...urlValidation.errors);
      warnings.push(...urlValidation.warnings);
    }
    
    // Check for common issues
    if (localPort < 1024) {
      warnings.push('Local port is below 1024 (may require admin privileges)');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      details: { tunnelType, localPort, publicUrl }
    };
  }
}

/**
 * Performance validator
 */
export class PerformanceValidator {
  /**
   * Validate response time
   */
  static validateResponseTime(responseTime: number, threshold: number = 5000): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (responseTime < 0) {
      errors.push('Response time cannot be negative');
    }
    
    if (responseTime > threshold) {
      warnings.push(`Response time (${responseTime}ms) exceeds threshold (${threshold}ms)`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      details: { responseTime, threshold }
    };
  }

  /**
   * Validate memory usage
   */
  static validateMemoryUsage(memoryUsage: number, threshold: number = 500 * 1024 * 1024): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (memoryUsage < 0) {
      errors.push('Memory usage cannot be negative');
    }
    
    if (memoryUsage > threshold) {
      warnings.push(`Memory usage (${memoryUsage} bytes) exceeds threshold (${threshold} bytes)`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      details: { memoryUsage, threshold }
    };
  }

  /**
   * Validate success rate
   */
  static validateSuccessRate(successCount: number, totalCount: number, threshold: number = 0.95): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (totalCount < 0) {
      errors.push('Total count cannot be negative');
    }
    
    if (successCount < 0) {
      errors.push('Success count cannot be negative');
    }
    
    if (successCount > totalCount) {
      errors.push('Success count cannot exceed total count');
    }
    
    if (totalCount > 0) {
      const successRate = successCount / totalCount;
      if (successRate < threshold) {
        warnings.push(`Success rate (${(successRate * 100).toFixed(1)}%) is below threshold (${(threshold * 100).toFixed(1)}%)`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      details: { successCount, totalCount, threshold }
    };
  }
}

/**
 * Page validator
 */
export class PageValidator {
  /**
   * Validate page state
   */
  static async validatePageState(page: Page): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // Check if page is still active
      const isClosed = page.isClosed();
      if (isClosed) {
        errors.push('Page is closed');
      }
      
      // Check page URL
      const url = page.url();
      if (!url || url === 'about:blank') {
        warnings.push('Page URL is empty or about:blank');
      }
      
      // Check page title
      const title = await page.title().catch(() => '');
      if (!title) {
        warnings.push('Page has no title');
      }
      
      // Check for JavaScript errors
      const hasJSErrors = await page.evaluate(() => {
        return (window as any).__tauri_test_errors && (window as any).__tauri_test_errors.length > 0;
      }).catch(() => false);
      
      if (hasJSErrors) {
        warnings.push('JavaScript errors detected on page');
      }
      
    } catch (error) {
      errors.push(`Failed to validate page state: ${(error as Error).message}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      details: {}
    };
  }

  /**
   * Validate Tauri API availability
   */
  static async validateTauriAPI(page: Page): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      const tauriAvailable = await page.evaluate(() => {
        return !!(window.__TAURI__ && 
                  window.__TAURI__.invoke && 
                  window.__TAURI__.app && 
                  window.__TAURI__.window);
      });
      
      if (!tauriAvailable) {
        errors.push('Tauri API is not available');
      }
      
      // Check specific Tauri modules
      const modules = ['app', 'window', 'fs', 'path', 'notification'];
      for (const module of modules) {
        const moduleAvailable = await page.evaluate((mod) => {
          return !!(window.__TAURI__ && window.__TAURI__[mod]);
        }, module);
        
        if (!moduleAvailable) {
          warnings.push(`Tauri module '${module}' is not available`);
        }
      }
      
    } catch (error) {
      errors.push(`Failed to validate Tauri API: ${(error as Error).message}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      details: {}
    };
  }
}

/**
 * Create validation engine with common rules
 */
export function createValidationEngine(): ValidationEngine {
  const engine = new ValidationEngine();
  
  // Add common validation rules
  engine.addRule({
    name: 'system-info',
    description: 'Validate system information',
    validate: async (context: { systemInfo?: SystemInfo }) => {
      if (!context.systemInfo) {
        return {
          isValid: false,
          errors: ['System information not provided'],
          warnings: [],
          details: {}
        };
      }
      return SystemValidator.validateSystemInfo(context.systemInfo);
    }
  });
  
  engine.addRule({
    name: 'config',
    description: 'Validate configuration',
    validate: async (context: { config?: ConfigInfo }) => {
      if (!context.config) {
        return {
          isValid: false,
          errors: ['Configuration not provided'],
          warnings: [],
          details: {}
        };
      }
      return ConfigValidator.validateConfig(context.config);
    }
  });
  
  engine.addRule({
    name: 'page-state',
    description: 'Validate page state',
    validate: async (context: { page?: Page }) => {
      if (!context.page) {
        return {
          isValid: false,
          errors: ['Page not provided'],
          warnings: [],
          details: {}
        };
      }
      return PageValidator.validatePageState(context.page);
    }
  });
  
  engine.addRule({
    name: 'tauri-api',
    description: 'Validate Tauri API availability',
    validate: async (context: { page?: Page }) => {
      if (!context.page) {
        return {
          isValid: false,
          errors: ['Page not provided'],
          warnings: [],
          details: {}
        };
      }
      return PageValidator.validateTauriAPI(context.page);
    }
  });
  
  return engine;
}