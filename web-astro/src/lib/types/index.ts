// Shared types for TunnelForge Astro/Svelte application

export interface Session {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
  type: 'terminal' | 'file-browser' | 'git' | 'custom';
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
  config?: {
    command?: string;
    workingDirectory?: string;
    environment?: Record<string, string>;
  };
}

export interface User {
  id: string;
  username: string;
  email?: string;
  avatar?: string;
  preferences?: {
    theme: 'light' | 'dark' | 'auto';
    fontSize: number;
    terminalSettings?: Record<string, any>;
  };
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actions?: Array<{
    label: string;
    action: string;
  }>;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  permissions?: string;
  children?: FileNode[];
}

export interface TerminalDimensions {
  cols: number;
  rows: number;
}

export interface WebSocketMessage {
  type: string;
  data?: any;
  sessionId?: string;
  timestamp?: string;
}

export interface UploadResponse {
  success: boolean;
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
  path: string;
  relativePath: string;
  error?: string;
}

export interface FileSelectedEvent {
  path: string;
  relativePath: string;
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
}

export interface AuthConfig {
  enableSSHKeys: boolean;
  disallowUserPassword: boolean;
  noAuth: boolean;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  userId?: string;
  authMethod?: 'ssh-key' | 'password' | 'no-auth';
  error?: string;
}