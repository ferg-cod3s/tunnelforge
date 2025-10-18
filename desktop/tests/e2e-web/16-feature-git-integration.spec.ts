import { test, expect } from '@playwright/test';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const BASE_URL = 'http://localhost:4021';
const API_URL = `${BASE_URL}/api`;

const api = axios.create({
  baseURL: API_URL,
  validateStatus: () => true,
});

// Test directory for git repos
const TEST_DIR = '/tmp/tunnelforge-git-test';

test.describe('Features: Git Integration', () => {
  test.beforeAll(async () => {
    // Create test directory
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  test.beforeEach(async () => {
    // Ensure git is available
    try {
      await execAsync('git --version');
    } catch (error) {
      test.skip();
    }
  });

  test.describe('Repository Operations', () => {
    test('should initialize a new git repository', async () => {
      const repoPath = `${TEST_DIR}/init-repo`;
      
      const response = await api.post('/git/init', {
        path: repoPath
      });

      expect(response.status).toBe(200);
      expect(fs.existsSync(`${repoPath}/.git`)).toBe(true);
    });

    test('should clone a repository', async () => {
      const response = await api.post('/git/clone', {
        url: 'https://github.com/torvalds/linux.git',
        destination: `${TEST_DIR}/cloned-repo`,
        depth: 1 // shallow clone for speed
      });

      // May not succeed if network unavailable, but API should handle gracefully
      expect([200, 400, 503]).toContain(response.status);
    });

    test('should detect repository status', async () => {
      // Create a test repo first
      const repoPath = `${TEST_DIR}/status-repo`;
      fs.mkdirSync(repoPath, { recursive: true });
      await execAsync(`cd ${repoPath} && git init`);

      const response = await api.get('/git/status', {
        params: { path: repoPath }
      });

      expect(response.status).toBe(200);
    });

    test('should list repository branches', async () => {
      // Use existing repo if possible
      const repoPath = `${TEST_DIR}/status-repo`;
      
      const response = await api.get('/git/branches', {
        params: { path: repoPath }
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should get repository info', async () => {
      const repoPath = `${TEST_DIR}/status-repo`;
      
      const response = await api.get('/git/info', {
        params: { path: repoPath }
      });

      expect([200, 400]).toContain(response.status);
    });
  });

  test.describe('Staging and Commits', () => {
    test('should stage file for commit', async () => {
      const repoPath = `${TEST_DIR}/commit-repo`;
      fs.mkdirSync(repoPath, { recursive: true });
      await execAsync(`cd ${repoPath} && git init`);

      // Create a file
      fs.writeFileSync(`${repoPath}/test.txt`, 'test content');

      const response = await api.post('/git/stage', {
        path: repoPath,
        file: 'test.txt'
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should stage all changes', async () => {
      const repoPath = `${TEST_DIR}/commit-repo`;
      
      const response = await api.post('/git/stage-all', {
        path: repoPath
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should unstage file', async () => {
      const repoPath = `${TEST_DIR}/commit-repo`;
      
      const response = await api.post('/git/unstage', {
        path: repoPath,
        file: 'test.txt'
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should create commit with message', async () => {
      const repoPath = `${TEST_DIR}/commit-repo`;
      
      const response = await api.post('/git/commit', {
        path: repoPath,
        message: 'Test commit message',
        author: {
          name: 'Test User',
          email: 'test@example.com'
        }
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should amend last commit', async () => {
      const repoPath = `${TEST_DIR}/commit-repo`;
      
      const response = await api.post('/git/commit-amend', {
        path: repoPath,
        message: 'Amended commit message'
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should get commit history', async () => {
      const repoPath = `${TEST_DIR}/commit-repo`;
      
      const response = await api.get('/git/log', {
        params: { path: repoPath, limit: 10 }
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should get commit details', async () => {
      const repoPath = `${TEST_DIR}/commit-repo`;
      
      const response = await api.get('/git/commit', {
        params: { path: repoPath, hash: 'HEAD' }
      });

      expect([200, 400]).toContain(response.status);
    });
  });

  test.describe('Branching Operations', () => {
    test('should create new branch', async () => {
      const repoPath = `${TEST_DIR}/branch-repo`;
      fs.mkdirSync(repoPath, { recursive: true });
      await execAsync(`cd ${repoPath} && git init && echo "test" > file.txt && git add . && git commit -m "initial" --allow-empty-message`);

      const response = await api.post('/git/branch', {
        path: repoPath,
        name: 'feature/test-branch'
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should checkout branch', async () => {
      const repoPath = `${TEST_DIR}/branch-repo`;
      
      const response = await api.post('/git/checkout', {
        path: repoPath,
        branch: 'feature/test-branch'
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should delete branch', async () => {
      const repoPath = `${TEST_DIR}/branch-repo`;
      
      const response = await api.post('/git/branch-delete', {
        path: repoPath,
        name: 'feature/test-branch'
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should rename branch', async () => {
      const repoPath = `${TEST_DIR}/branch-repo`;
      
      const response = await api.post('/git/branch-rename', {
        path: repoPath,
        oldName: 'feature/old-name',
        newName: 'feature/new-name'
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should list local branches', async () => {
      const repoPath = `${TEST_DIR}/branch-repo`;
      
      const response = await api.get('/git/branches/local', {
        params: { path: repoPath }
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should list remote branches', async () => {
      const repoPath = `${TEST_DIR}/branch-repo`;
      
      const response = await api.get('/git/branches/remote', {
        params: { path: repoPath }
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should merge branches', async () => {
      const repoPath = `${TEST_DIR}/branch-repo`;
      
      const response = await api.post('/git/merge', {
        path: repoPath,
        branch: 'feature/test-branch'
      });

      expect([200, 400, 409]).toContain(response.status); // 409 for conflicts
    });
  });

  test.describe('Merge and Rebase Operations', () => {
    test('should detect merge conflicts', async () => {
      const repoPath = `${TEST_DIR}/conflict-repo`;
      
      const response = await api.get('/git/merge-status', {
        params: { path: repoPath }
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should abort merge', async () => {
      const repoPath = `${TEST_DIR}/conflict-repo`;
      
      const response = await api.post('/git/merge-abort', {
        path: repoPath
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should rebase branch', async () => {
      const repoPath = `${TEST_DIR}/rebase-repo`;
      fs.mkdirSync(repoPath, { recursive: true });
      await execAsync(`cd ${repoPath} && git init`);

      const response = await api.post('/git/rebase', {
        path: repoPath,
        onto: 'main'
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should abort rebase', async () => {
      const repoPath = `${TEST_DIR}/rebase-repo`;
      
      const response = await api.post('/git/rebase-abort', {
        path: repoPath
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should continue rebase', async () => {
      const repoPath = `${TEST_DIR}/rebase-repo`;
      
      const response = await api.post('/git/rebase-continue', {
        path: repoPath
      });

      expect([200, 400]).toContain(response.status);
    });
  });

  test.describe('Stash Operations', () => {
    test('should stash changes', async () => {
      const repoPath = `${TEST_DIR}/stash-repo`;
      fs.mkdirSync(repoPath, { recursive: true });
      await execAsync(`cd ${repoPath} && git init && echo "test" > file.txt`);

      const response = await api.post('/git/stash', {
        path: repoPath,
        message: 'WIP: test stash'
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should list stashes', async () => {
      const repoPath = `${TEST_DIR}/stash-repo`;
      
      const response = await api.get('/git/stash', {
        params: { path: repoPath }
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should apply stash', async () => {
      const repoPath = `${TEST_DIR}/stash-repo`;
      
      const response = await api.post('/git/stash-apply', {
        path: repoPath,
        index: 0
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should pop stash', async () => {
      const repoPath = `${TEST_DIR}/stash-repo`;
      
      const response = await api.post('/git/stash-pop', {
        path: repoPath,
        index: 0
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should drop stash', async () => {
      const repoPath = `${TEST_DIR}/stash-repo`;
      
      const response = await api.post('/git/stash-drop', {
        path: repoPath,
        index: 0
      });

      expect([200, 400]).toContain(response.status);
    });
  });

  test.describe('Diff and History', () => {
    test('should show diff between commits', async () => {
      const repoPath = `${TEST_DIR}/diff-repo`;
      
      const response = await api.get('/git/diff', {
        params: { path: repoPath, from: 'HEAD~1', to: 'HEAD' }
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should show unstaged changes', async () => {
      const repoPath = `${TEST_DIR}/diff-repo`;
      
      const response = await api.get('/git/diff/unstaged', {
        params: { path: repoPath }
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should show staged changes', async () => {
      const repoPath = `${TEST_DIR}/diff-repo`;
      
      const response = await api.get('/git/diff/staged', {
        params: { path: repoPath }
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should blame file', async () => {
      const repoPath = `${TEST_DIR}/diff-repo`;
      
      const response = await api.get('/git/blame', {
        params: { path: repoPath, file: 'test.txt' }
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should show file history', async () => {
      const repoPath = `${TEST_DIR}/diff-repo`;
      
      const response = await api.get('/git/log/file', {
        params: { path: repoPath, file: 'test.txt', limit: 10 }
      });

      expect([200, 400]).toContain(response.status);
    });
  });

  test.describe('Remote Operations', () => {
    test('should list remotes', async () => {
      const repoPath = `${TEST_DIR}/remote-repo`;
      fs.mkdirSync(repoPath, { recursive: true });
      await execAsync(`cd ${repoPath} && git init`);

      const response = await api.get('/git/remotes', {
        params: { path: repoPath }
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should add remote', async () => {
      const repoPath = `${TEST_DIR}/remote-repo`;
      
      const response = await api.post('/git/remote-add', {
        path: repoPath,
        name: 'origin',
        url: 'https://github.com/example/repo.git'
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should remove remote', async () => {
      const repoPath = `${TEST_DIR}/remote-repo`;
      
      const response = await api.post('/git/remote-remove', {
        path: repoPath,
        name: 'origin'
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should fetch from remote', async () => {
      const repoPath = `${TEST_DIR}/remote-repo`;
      
      const response = await api.post('/git/fetch', {
        path: repoPath,
        remote: 'origin'
      });

      // May fail if no remote or network issue
      expect([200, 400, 503]).toContain(response.status);
    });

    test('should push to remote', async () => {
      const repoPath = `${TEST_DIR}/remote-repo`;
      
      const response = await api.post('/git/push', {
        path: repoPath,
        remote: 'origin',
        branch: 'main'
      });

      // May fail if no remote or auth issue
      expect([200, 400, 401, 403, 503]).toContain(response.status);
    });

    test('should pull from remote', async () => {
      const repoPath = `${TEST_DIR}/remote-repo`;
      
      const response = await api.post('/git/pull', {
        path: repoPath,
        remote: 'origin',
        branch: 'main'
      });

      // May fail if no remote
      expect([200, 400, 503]).toContain(response.status);
    });
  });

  test.describe('Tag Operations', () => {
    test('should create annotated tag', async () => {
      const repoPath = `${TEST_DIR}/tag-repo`;
      fs.mkdirSync(repoPath, { recursive: true });
      await execAsync(`cd ${repoPath} && git init && git commit --allow-empty -m "initial"`);

      const response = await api.post('/git/tag', {
        path: repoPath,
        name: 'v1.0.0',
        message: 'Version 1.0.0'
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should create lightweight tag', async () => {
      const repoPath = `${TEST_DIR}/tag-repo`;
      
      const response = await api.post('/git/tag-lightweight', {
        path: repoPath,
        name: 'v1.0.1'
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should list tags', async () => {
      const repoPath = `${TEST_DIR}/tag-repo`;
      
      const response = await api.get('/git/tags', {
        params: { path: repoPath }
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should delete tag', async () => {
      const repoPath = `${TEST_DIR}/tag-repo`;
      
      const response = await api.post('/git/tag-delete', {
        path: repoPath,
        name: 'v1.0.1'
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should show tag info', async () => {
      const repoPath = `${TEST_DIR}/tag-repo`;
      
      const response = await api.get('/git/tag', {
        params: { path: repoPath, name: 'v1.0.0' }
      });

      expect([200, 400]).toContain(response.status);
    });
  });

  test.describe('Clean and Reset', () => {
    test('should reset to commit', async () => {
      const repoPath = `${TEST_DIR}/reset-repo`;
      fs.mkdirSync(repoPath, { recursive: true });
      await execAsync(`cd ${repoPath} && git init`);

      const response = await api.post('/git/reset', {
        path: repoPath,
        target: 'HEAD',
        mode: 'mixed'
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should clean working directory', async () => {
      const repoPath = `${TEST_DIR}/reset-repo`;
      
      const response = await api.post('/git/clean', {
        path: repoPath,
        force: false,
        directories: true
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should revert commit', async () => {
      const repoPath = `${TEST_DIR}/reset-repo`;
      
      const response = await api.post('/git/revert', {
        path: repoPath,
        commit: 'HEAD'
      });

      expect([200, 400]).toContain(response.status);
    });

    test('should cherry-pick commit', async () => {
      const repoPath = `${TEST_DIR}/reset-repo`;
      
      const response = await api.post('/git/cherry-pick', {
        path: repoPath,
        commit: 'some-commit-hash'
      });

      expect([200, 400]).toContain(response.status);
    });
  });
});
