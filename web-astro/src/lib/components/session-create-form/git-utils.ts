import type { AuthClient } from '$lib/types';

export interface FollowModeResult {
  followMode: boolean;
  followBranch: string | null;
}

export async function checkFollowMode(
  repoPath: string,
  authClient: AuthClient
): Promise<FollowModeResult> {
  try {
    const response = await fetch(`/api/worktrees/follow?${new URLSearchParams({ repoPath })}`, {
      headers: authClient.getAuthHeader(),
    });

    if (!response.ok) throw new Error('Failed to check follow mode');
    return response.json();
  } catch (error) {
    console.error('Failed to check follow mode:', error);
    return { followMode: false, followBranch: null };
  }
}

export async function enableFollowMode(
  repoPath: string,
  branch: string,
  authClient: AuthClient
): Promise<boolean> {
  try {
    const response = await fetch('/api/worktrees/follow', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authClient.getAuthHeader(),
      },
      body: JSON.stringify({
        repoPath,
        branch,
        enable: true,
      }),
    });

    if (!response.ok) throw new Error('Failed to enable follow mode');
    return true;
  } catch (error) {
    console.error('Failed to enable follow mode:', error);
    return false;
  }
}

export function generateWorktreePath(repoPath: string, branchName: string): string {
  // Generate a safe worktree path
  const safeBranchName = branchName.replace(/[^a-zA-Z0-9-_]/g, '-');
  return `${repoPath}-${safeBranchName}`;
}

export async function loadBranches(
  repoPath: string,
  authClient: AuthClient
): Promise<{ branches: string[]; currentBranch: string | null }> {
  try {
    const response = await fetch(`/api/git/branches?${new URLSearchParams({ repoPath })}`, {
      headers: authClient.getAuthHeader(),
    });

    if (!response.ok) throw new Error('Failed to load branches');
    return response.json();
  } catch (error) {
    console.error('Failed to load branches:', error);
    return { branches: [], currentBranch: null };
  }
}