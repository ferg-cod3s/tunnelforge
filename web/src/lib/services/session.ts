import type { Session, WorktreeListResponse } from '$lib/types';

export interface SessionService {
  loadSessions(): Promise<Session[]>;
  createSession(sessionData: Partial<Session>): Promise<Session | null>;
  updateSession(sessionId: string, updates: Partial<Session>): Promise<boolean>;
  deleteSession(sessionId: string): Promise<boolean>;
  selectSession(sessionId: string | null): void;
  getSession(sessionId: string): Session | undefined;
  killSession(sessionId: string): Promise<boolean>;
  cleanupExitedSessions(): Promise<boolean>;
  loadWorktrees(repoPath: string): Promise<WorktreeListResponse>;
  updateFollowMode(repoPath: string, branch: string | undefined): Promise<boolean>;
}

export class SessionServiceImpl implements SessionService {
  constructor(private authClient: { getAuthHeader(): Record<string, string> }) {}

  async loadSessions(): Promise<Session[]> {
    try {
      const response = await fetch('/api/sessions', {
        headers: this.authClient.getAuthHeader(),
      });
      if (!response.ok) throw new Error('Failed to load sessions');
      return response.json();
    } catch (error) {
      console.error('Failed to load sessions:', error);
      return [];
    }
  }

  async createSession(sessionData: Partial<Session>): Promise<Session | null> {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.authClient.getAuthHeader(),
        },
        body: JSON.stringify(sessionData),
      });

      if (!response.ok) throw new Error('Failed to create session');
      return response.json();
    } catch (error) {
      console.error('Failed to create session:', error);
      return null;
    }
  }

  async updateSession(sessionId: string, updates: Partial<Session>): Promise<boolean> {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...this.authClient.getAuthHeader(),
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update session');
      return true;
    } catch (error) {
      console.error('Failed to update session:', error);
      return false;
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: this.authClient.getAuthHeader(),
      });

      if (!response.ok) throw new Error('Failed to delete session');
      return true;
    } catch (error) {
      console.error('Failed to delete session:', error);
      return false;
    }
  }

  async killSession(sessionId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/kill`, {
        method: 'POST',
        headers: this.authClient.getAuthHeader(),
      });

      if (!response.ok) throw new Error('Failed to kill session');
      return true;
    } catch (error) {
      console.error('Failed to kill session:', error);
      return false;
    }
  }

  async cleanupExitedSessions(): Promise<boolean> {
    try {
      const response = await fetch('/api/cleanup-exited', {
        method: 'POST',
        headers: this.authClient.getAuthHeader(),
      });

      if (!response.ok) throw new Error('Failed to cleanup exited sessions');
      return true;
    } catch (error) {
      console.error('Failed to cleanup exited sessions:', error);
      return false;
    }
  }

  async loadWorktrees(repoPath: string): Promise<WorktreeListResponse> {
    try {
      const response = await fetch(`/api/worktrees?${new URLSearchParams({ repoPath })}`, {
        headers: this.authClient.getAuthHeader(),
      });

      if (!response.ok) throw new Error('Failed to load worktrees');
      return response.json();
    } catch (error) {
      console.error('Failed to load worktrees:', error);
      return { worktrees: [], baseBranch: 'main' };
    }
  }

  async updateFollowMode(repoPath: string, branch: string | undefined): Promise<boolean> {
    try {
      const response = await fetch('/api/worktrees/follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.authClient.getAuthHeader(),
        },
        body: JSON.stringify({
          repoPath,
          branch,
          enable: !!branch,
        }),
      });

      if (!response.ok) throw new Error('Failed to update follow mode');
      return true;
    } catch (error) {
      console.error('Failed to update follow mode:', error);
      return false;
    }
  }

  selectSession(sessionId: string | null): void {
    // This will be handled by the session store
  }

  getSession(sessionId: string): Session | undefined {
    // This will be handled by the session store
    return undefined;
  }
}