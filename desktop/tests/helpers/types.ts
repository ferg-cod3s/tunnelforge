/**
 * Performance metrics for monitoring test execution
 */
export interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryUsage?: number;
  commandCount?: number;
  successRate?: number;
  averageResponseTime?: number;
}

/**
 * TunnelForge-specific test configuration
 */
export interface TunnelForgeTestConfig {
  timeouts: {
    default: number;
    network: number;
    command: number;
    ui: number;
  };
  retries: {
    default: number;
    network: number;
    command: number;
  };
  performance: {
    enableMetrics: boolean;
    screenshotOnFailure: boolean;
    videoRecording?: boolean;
  };
  network: {
    baseUrl: string;
    apiEndpoint: string;
    timeout: number;
  };
  platform: {
    isWindows: boolean;
    isMacOS: boolean;
    isLinux: boolean;
    isWSL: boolean;
    isCI: boolean;
    arch: string;
  };
  wsl: {
    enabled: boolean;
    displayServer?: string;
    audioSupport?: boolean;
  };
}

/**
 * Network test result for connectivity testing
 */
export interface NetworkTestResult {
  success: boolean;
  connected: boolean;
  responseTime?: number;
  error?: string;
  data?: any;
}

export interface CommandResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  executionTime: number;
  attempt: number;
}

// App information types
export interface TauriAppInfo {
  version: string;
  name: string;
  platform: string;
  arch: string;
  tauriVersion?: string;
  buildDate?: string;
}

export interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  tauriVersion: string;
  isWSL: boolean;
  isCI: boolean;
  display?: string;
  locale?: string;
  timezone?: string;
}

// Test environment types
export interface TestEnvironment {
  screenshotPath: string;
  videoPath: string;
  tracePath: string;
  logPath: string;
  tempDir: string;
  timestamp: string;
}

// Window management types
export interface WindowInfo {
  id: string;
  title: string;
  width: number;
  height: number;
  x: number;
  y: number;
  isVisible: boolean;
  isMaximized: boolean;
  isMinimized: boolean;
  isFullscreen: boolean;
}

export interface WindowOptions {
  title?: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  resizable?: boolean;
  decorations?: boolean;
  transparent?: boolean;
  alwaysOnTop?: boolean;
}

// System integration types
export interface SystemTrayInfo {
  isVisible: boolean;
  items: TrayItem[];
  tooltip?: string;
}

export interface TrayItem {
  id: string;
  label: string;
  enabled: boolean;
  checked?: boolean;
  icon?: string;
}

export interface NotificationInfo {
  title: string;
  body: string;
  icon?: string;
  sound?: string;
  timeout?: number;
}

export interface FileSystemInfo {
  appDir: string;
  documentsDir: string;
  downloadDir: string;
  desktopDir: string;
  tempDir: string;
}

// Network and connectivity types
export interface NetworkStatus {
  isConnected: boolean;
  connectionType: string;
  serverStatus: 'online' | 'offline' | 'unknown';
  tunnelStatus: 'active' | 'inactive' | 'error';
  lastChecked: Date;
}

export interface TunnelInfo {
  id: string;
  type: 'ngrok' | 'cloudflare' | 'tailscale' | 'custom';
  localPort: number;
  publicUrl?: string;
  status: 'active' | 'inactive' | 'error';
  protocol: 'http' | 'tcp' | 'tls';
}

export interface ServerInfo {
  pid: number;
  port: number;
  status: 'running' | 'stopped' | 'error';
  uptime: number;
  version: string;
  memoryUsage?: number;
}

// Configuration management types
export interface ConfigInfo {
  autoStart: boolean;
  startOnLogin: boolean;
  minimizeToTray: boolean;
  showNotifications: boolean;
  serverPort: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  theme: 'light' | 'dark' | 'system';
}

export interface ConfigSection {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  default?: any;
}

// Error handling types
export interface TestError extends Error {
  code?: string;
  command?: string;
  context?: any;
  screenshot?: string;
  timestamp: Date;
}

export interface FailureReport {
  timestamp: string;
  test: string;
  reason: string;
  url: string;
  systemInfo: SystemInfo;
  consoleMessages: string[];
  pageContent: string;
  screenshot: string;
  error?: TestError;
}

// Logging types
export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: any;
  source: string;
}

export interface TestMetrics {
  startTime: Date;
  endTime?: Date;
  duration?: number;
  commandsExecuted: number;
  commandsFailed: number;
  screenshotsTaken: number;
  errors: TestError[];
}

// Validation types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  details: any;
}

export interface ValidationRule {
  name: string;
  description: string;
  validate: (context: any) => ValidationResult;
}

// Helper configuration types
export interface HelperConfig {
  debugPort: number;
  timeout: number;
  retries: number;
  screenshotOnFailure: boolean;
  videoRecording: boolean;
  traceRecording: boolean;
  logLevel: string;
  tempDir: string;
}

export interface PlatformConfig {
  isWindows: boolean;
  isMacOS: boolean;
  isLinux: boolean;
  isWSL: boolean;
  isCI: boolean;
  arch: string;
  display?: string;
}

// Event types
export interface TauriEvent {
  type: string;
  payload?: any;
  timestamp: Date;
}

export interface WindowEvent extends TauriEvent {
  windowId: string;
}

export interface SystemEvent extends TauriEvent {
  category: 'tray' | 'notification' | 'filesystem' | 'network';
}

// Performance monitoring types
export interface PerformanceMetrics {
  commandExecutionTimes: Record<string, number[]>;
  memoryUsage: number[];
  cpuUsage: number[];
  networkRequests: number;
  errors: number;
}

export interface BenchmarkResult {
  name: string;
  duration: number;
  operations: number;
  operationsPerSecond: number;
  memoryUsage: number;
  success: boolean;
}

// Security testing types
export interface SecurityTest {
  name: string;
  description: string;
  test: () => Promise<ValidationResult>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityReport {
  timestamp: string;
  tests: SecurityTest[];
  passed: number;
  failed: number;
  warnings: number;
  overallScore: number;
}

// Export all types for easy importing
export type {
  Page,
  BrowserContext,
  TestInfo
} from '@playwright/test';