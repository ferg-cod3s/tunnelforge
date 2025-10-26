import type { GitRepoInfo, WorktreeListResponse } from '$lib/types';

export interface GitService {
  checkGitRepo(path: string): Promise<GitRepoInfo>;
  listWorktrees(repoPath: string): Promise<WorktreeListResponse>;
  createWorktree(repoPath: string, branchName: string, worktreePath: string, baseBranch?: string): Promise<void>;
  deleteWorktree(repoPath: string, branch: string, force?: boolean): Promise<void>;
  setFollowMode(repoPath: string, branch: string, enable: boolean): Promise<void>;
}

export class GitServiceImpl implements GitService {
  constructor(private authClient: { getAuthHeader(): Record<string, string> }) {}

  async checkGitRepo(path: string): Promise<GitRepoInfo> {
    try {
      const response = await fetch(`/api/git/check?${new URLSearchParams({ path })}`, {
        headers: this.authClient.getAuthHeader(),
      });

      if (!response.ok) throw new Error('Failed to check git repo');
      return response.json();
    } catch (error) {
      console.error('Failed to check git repo:', error);
      return { isGitRepo: false };
    }
  }

  async listWorktrees(repoPath: string): Promise<WorktreeListResponse> {
    try {
      const response = await fetch(`/api/worktrees?${new URLSearchParams({ repoPath })}`, {
        headers: this.authClient.getAuthHeader(),
      });

      if (!response.ok) throw new Error('Failed to list worktrees');
      return response.json();
    } catch (error) {
      console.error('Failed to list worktrees:', error);
      return { worktrees: [], baseBranch: 'main' };
    }
  }

  async createWorktree(repoPath: string, branchName: string, worktreePath: string, baseBranch?: string): Promise<void> {
    try {
      const response = await fetch('/api/worktrees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.authClient.getAuthHeader(),
        },
        body: JSON.stringify({
          repoPath,
          branchName,
          worktreePath,
          baseBranch,
        }),
      });

      if (!response.ok) throw new Error('Failed to create worktree');
    } catch (error) {
      console.error('Failed to create worktree:', error);
      throw error;
    }
  }

  async deleteWorktree(repoPath: string, branch: string, force = false): Promise<void> {
    try {
      const params = new URLSearchParams({ repoPath });
      if (force) params.append('force', 'true');

      const response = await fetch(`/api/worktrees/${encodeURIComponent(branch)}?${params}`, {
        method: 'DELETE',
        headers: this.authClient.getAuthHeader(),
      });

      if (!response.ok) throw new Error('Failed to delete worktree');
    } catch (error) {
      console.error('Failed to delete worktree:', error);
      throw error;
    }
  }

  async setFollowMode(repoPath: string, branch: string, enable: boolean): Promise<void> {
    try {
      const response = await fetch('/api/worktrees/follow', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.authClient.getAuthHeader(),
        },
        body: JSON.stringify({ repoPath, branch, enable }),
      });

      if (!response.ok) throw new Error('Failed to set follow mode');
    } catch (error) {
      console.error('Failed to set follow mode:', error);
      throw error;
    }
  }
}