/**
 * Session Type Definitions
 *
 * TypeScript interfaces for terminal sessions and related data structures.
 * These types match the server API responses and internal session management.
 */

export interface Session {
  id: string;
  name: string;
  command: string[];
  workingDir: string;
  status: 'running' | 'exited';
  exitCode?: number;
  startedAt: string;
  pid?: number;
  initialCols?: number;
  initialRows?: number;
  lastClearOffset?: number;
  version?: string;
  gitRepoPath?: string;
  gitBranch?: string;
  gitAheadCount?: number;
  gitBehindCount?: number;
  gitHasChanges?: boolean;
  gitIsWorktree?: boolean;
  gitMainRepoPath?: string;
  lastModified: string;
  active?: boolean;
  activityStatus?: ActivityStatus;
  source?: string;
  remoteId?: string;
  remoteName?: string;
  remoteUrl?: string;
  attachedViaVT?: boolean;
}

export interface ActivityStatus {
  isActive: boolean;
  specificStatus?: SpecificStatus;
}

export interface SpecificStatus {
  app: string;
  status: string;
}

export interface CreateSessionRequest {
  name?: string;
  command?: string[];
  workingDir?: string;
  cols?: number;
  rows?: number;
}

export interface CreateSessionResponse {
  id: string;
  message?: string;
}
