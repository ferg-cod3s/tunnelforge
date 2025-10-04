// Shared types for TunnelForge Astro/Svelte application

export type SessionStatus = 'starting' | 'running' | 'exited';

export interface SessionInfo {
  id: string;
  sessionId?: string; // Alias for id (from Go server)
  name: string;
  command: string[];
  workingDir: string;
  status: SessionStatus;
  exitCode?: number;
  startedAt: string;
  pid?: number;
  initialCols?: number;
  initialRows?: number;
  lastClearOffset?: number;
  version?: string; // TunnelForge version that created this session
  gitRepoPath?: string; // Repository root path
  gitBranch?: string; // Current branch name
  gitAheadCount?: number; // Commits ahead of upstream
  gitBehindCount?: number; // Commits behind upstream
  gitHasChanges?: boolean; // Has uncommitted changes
  gitIsWorktree?: boolean; // Is a worktree (not main repo)
  gitMainRepoPath?: string; // Main repository path (same as gitRepoPath if not worktree)
  gitModifiedCount?: number; // Number of modified files
  gitUntrackedCount?: number; // Number of untracked files
  gitStagedCount?: number; // Number of staged files
  gitAddedCount?: number; // Number of added files
  gitDeletedCount?: number; // Number of deleted files
  attachedViaVT?: boolean;
}

export interface Session extends SessionInfo {
  lastModified: string;
  active?: boolean;
  activityStatus?: {
    isActive: boolean;
    specificStatus?: {
      app: string;
      status: string;
    };
  };
  source?: 'local' | 'remote';
  remoteId?: string;
  remoteName?: string;
  remoteUrl?: string;
}

export interface Worktree {
  path: string;
  branch: string;
  HEAD: string;
  detached: boolean;
  prunable?: boolean;
  locked?: boolean;
  lockedReason?: string;
  commitsAhead?: number;
  filesChanged?: number;
  insertions?: number;
  deletions?: number;
  hasUncommittedChanges?: boolean;
  isMainWorktree?: boolean;
  isCurrentWorktree?: boolean;
}

export interface WorktreeListResponse {
  worktrees: Worktree[];
  baseBranch: string;
  followBranch?: string;
}

export interface AuthClient {
  getAuthHeader(): Record<string, string>;
  fetch(url: string, options?: RequestInit): Promise<Response>;
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