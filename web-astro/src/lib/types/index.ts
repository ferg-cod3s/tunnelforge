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
  workingDir?: string;
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

export type FileType = 'file' | 'directory';
export type GitStatus = 'modified' | 'added' | 'deleted' | 'untracked' | 'unchanged';

export interface FileInfo {
  name: string;
  path: string;
  type: FileType;
  size: number;
  modified: string;
  permissions?: string;
  isGitTracked?: boolean;
  gitStatus?: GitStatus;
  isSymlink?: boolean;
}

export interface DirectoryListing {
  path: string;
  fullPath?: string;
  gitStatus?: GitRepoStatus | null;
  files: FileInfo[];
  directories?: FileInfo[];
  parent?: string;
}

export interface GitRepoStatus {
  isGitRepo: boolean;
  branch?: string;
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
}

export interface FilePreview {
  type: 'image' | 'text' | 'binary';
  content?: string;
  language?: string;
  url?: string;
  mimeType?: string;
  size: number;
  humanSize?: string;
}

export interface FileDiff {
  path: string;
  diff: string;
  hasDiff: boolean;
}

export interface FileDiffContent {
  path: string;
  originalContent: string;
  modifiedContent: string;
  language?: string;
}

export interface FileBrowserEventDetail {
  path: string;
  type: FileType;
}

export interface DirectorySelectedEventDetail {
  path: string;
}