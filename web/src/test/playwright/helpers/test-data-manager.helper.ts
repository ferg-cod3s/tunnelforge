import type { Page } from '@playwright/test';
import { SessionListPage } from '../pages/session-list.page';

/**
 * Manages test sessions and ensures cleanup
 */
export class TestSessionManager {
  private sessions: Map<string, { id: string; spawnWindow: boolean }> = new Map();
  private page: Page;
  private sessionPrefix: string;

  constructor(page: Page, sessionPrefix = 'test') {
    this.page = page;
    this.sessionPrefix = sessionPrefix;
  }

  /**
   * Creates a session and tracks it for cleanup
   */
  async createTrackedSession(
    sessionName?: string,
    spawnWindow = false,
    command?: string
  ): Promise<{ sessionName: string; sessionId: string }> {
    const sessionListPage = new SessionListPage(this.page);

    // Generate name if not provided
    const name = sessionName || this.generateSessionName();

    // Navigate to list if needed
    if (!this.page.url().endsWith('/')) {
      await sessionListPage.navigate();
    }

    try {
      // Create session - use zsh by default to match the form's default
      await sessionListPage.createNewSession(name, spawnWindow, command || 'zsh');

      // Get session ID from URL for web sessions
      let sessionId = '';
      if (!spawnWindow) {
        console.log(`Web session created, waiting for navigation to session view...`);
        await this.page.waitForURL(/\?session=/, { timeout: 10000 });
        const url = this.page.url();

        if (!url.includes('?session=')) {
          throw new Error(`Failed to navigate to session after creation. Current URL: ${url}`);
        }

        sessionId = new URL(url).searchParams.get('session') || '';
        if (!sessionId) {
          throw new Error(`No session ID found in URL: ${url}`);
        }

        // Wait for the terminal to be ready before navigating away
        // This ensures the session is fully created
        await this.page
          .waitForSelector('.xterm-screen', {
            state: 'visible',
            timeout: 5000,
          })
          .catch(() => {
            console.warn('Terminal screen not visible, session might not be fully initialized');
          });

        // Additional wait to ensure session is saved to backend
        await this.page
          .waitForResponse(
            (response) => response.url().includes('/api/sessions') && response.status() === 200,
            { timeout: 5000 }
          )
          .catch(() => {
            console.warn('No session list refresh detected, session might not be fully saved');
          });

        // Extra wait for file system to flush - critical for CI environments
        await this.page.waitForTimeout(1000);
      }

      // Track the session
      this.sessions.set(name, { id: sessionId, spawnWindow });
      console.log(`Tracked session: ${name} with ID: ${sessionId}, spawnWindow: ${spawnWindow}`);
      if (spawnWindow) {
        console.warn(
          'WARNING: Created a native terminal session which will not appear in the web session list!'
        );
      } else {
        console.log('Created web session which should appear in the session list');
      }

      return { sessionName: name, sessionId };
    } catch (error) {
      console.error(`Failed to create tracked session "${name}":`, error);
      // Still track it for cleanup attempt
      this.sessions.set(name, { id: '', spawnWindow });
      throw error;
    }
  }

  /**
   * Generates a unique session name with test context
   */
  generateSessionName(prefix?: string): string {
    const actualPrefix = prefix || this.sessionPrefix;
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${actualPrefix}-${timestamp}-${random}`;
  }

  /**
   * Cleans up a specific session
   */
  async cleanupSession(sessionName: string): Promise<void> {
    if (!this.sessions.has(sessionName)) return;

    const sessionListPage = new SessionListPage(this.page);

    // Navigate to list
    if (!this.page.url().endsWith('/')) {
      await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    }

    try {
      // Wait for page to be ready - either session cards or "no sessions" message
      await this.page.waitForFunction(
        () => {
          const cards = document.querySelectorAll('session-card');
          const noSessionsMsg = document.querySelector('.text-dark-text-muted');
          return cards.length > 0 || noSessionsMsg?.textContent?.includes('No terminal sessions');
        },
        { timeout: 5000 }
      );

      // Check if session exists
      const sessionCard = this.page.locator(`session-card:has-text("${sessionName}")`);
      if (await sessionCard.isVisible({ timeout: 1000 })) {
        await sessionListPage.killSession(sessionName);
      }

      // Remove from tracking
      this.sessions.delete(sessionName);
    } catch (error) {
      // Log the error but don't throw - cleanup should be best effort
      console.log(`Failed to cleanup session ${sessionName}:`, (error as Error).message);
      // Still remove from tracking even if cleanup failed
      this.sessions.delete(sessionName);
    }
  }

  /**
   * Cleans up all tracked sessions
   */
  async cleanupAllSessions(): Promise<void> {
    if (this.sessions.size === 0) return;

    console.log(`Cleaning up ${this.sessions.size} tracked sessions`);

    // Navigate to list
    if (!this.page.url().endsWith('/')) {
      await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    }

    // For parallel tests, only use individual cleanup to avoid interference
    // Kill All affects all sessions globally and can interfere with other parallel tests
    const isParallelMode = process.env.TEST_WORKER_INDEX !== undefined;

    if (!isParallelMode) {
      // Try bulk cleanup with Kill All button only in non-parallel mode
      try {
        const killAllButton = this.page.locator('button:has-text("Kill All")');
        if (await killAllButton.isVisible({ timeout: 1000 })) {
          const [dialog] = await Promise.all([
            this.page.waitForEvent('dialog', { timeout: 5000 }).catch(() => null),
            killAllButton.click(),
          ]);
          if (dialog) {
            await dialog.accept();
          }

          // Wait for sessions to be marked as exited
          await this.page.waitForFunction(
            () => {
              const cards = document.querySelectorAll('session-card');
              return Array.from(cards).every(
                (card) =>
                  card.textContent?.toLowerCase().includes('exited') ||
                  card.textContent?.toLowerCase().includes('exit')
              );
            },
            { timeout: 10000 }
          );

          this.sessions.clear();
          return;
        }
      } catch (error) {
        console.log('Bulk cleanup failed, trying individual cleanup:', error);
      }
    }

    // Use individual cleanup for parallel tests or as fallback
    const sessionNames = Array.from(this.sessions.keys());
    for (const sessionName of sessionNames) {
      await this.cleanupSession(sessionName);
    }
  }

  /**
   * Gets list of tracked sessions
   */
  getTrackedSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Checks if a session is being tracked
   */
  isTracking(sessionName: string): boolean {
    return this.sessions.has(sessionName);
  }

  /**
   * Clears tracking without cleanup (use when sessions are already cleaned)
   */
  clearTracking(): void {
    this.sessions.clear();
  }

  /**
   * Manually track a session that was created outside of createTrackedSession
   */
  trackSession(sessionName: string, sessionId: string, spawnWindow = false): void {
    this.sessions.set(sessionName, { id: sessionId, spawnWindow });
  }

  /**
   * Wait for session count to be updated in the UI
   */
  async waitForSessionCountUpdate(expectedCount: number, timeout = 5000): Promise<void> {
    await this.page.waitForFunction(
      (expected) => {
        const headerElement = document.querySelector('full-header');
        if (!headerElement) return false;
        const countElement = headerElement.querySelector('p.text-xs');
        if (!countElement) return false;
        const countText = countElement.textContent || '';
        const match = countText.match(/\d+/);
        if (!match) return false;
        const actualCount = Number.parseInt(match[0]);
        return actualCount === expected;
      },
      expectedCount,
      { timeout }
    );
  }
}

/**
 * Creates test data factory for consistent test data generation
 */
export namespace TestDataFactory {
  const counters: Map<string, number> = new Map();

  /**
   * Generates sequential IDs for a given prefix
   */
  export function sequentialId(prefix: string): string {
    const current = counters.get(prefix) || 0;
    counters.set(prefix, current + 1);
    return `${prefix}-${current + 1}`;
  }

  /**
   * Generates session name with optional prefix
   */
  export function sessionName(prefix = 'session'): string {
    const timestamp = new Date().toISOString().slice(11, 19).replace(/:/g, '');
    const counter = sequentialId(prefix);
    return `${counter}-${timestamp}`;
  }

  /**
   * Generates command for testing
   */
  export function command(type: 'echo' | 'sleep' | 'env' | 'file' = 'echo'): string {
    switch (type) {
      case 'echo':
        return `echo "Test output ${Date.now()}"`;
      case 'sleep':
        return `sleep ${Math.floor(Math.random() * 3) + 1}`;
      case 'env':
        return `export TEST_VAR_${Date.now()}="test_value"`;
      case 'file':
        return `touch test-file-${Date.now()}.tmp`;
    }
  }

  /**
   * Reset all counters
   */
  export function reset(): void {
    counters.clear();
  }
}

/**
 * Fixture data for common test scenarios
 */
export const TestFixtures = {
  // Common shell outputs
  prompts: {
    bash: '$ ',
    zsh: '% ',
    fish: '> ',
    generic: /[$>#%❯]\s*$/,
  },

  // Common error messages
  errors: {
    commandNotFound: 'command not found',
    permissionDenied: 'Permission denied',
    noSuchFile: 'No such file or directory',
  },

  // ANSI color codes for testing
  ansiCodes: {
    red: '\\033[31m',
    green: '\\033[32m',
    bold: '\\033[1m',
    reset: '\\033[0m',
  },

  // Common test timeouts
  timeouts: {
    quick: 1000,
    normal: 5000,
    slow: 10000,
    veryLong: 30000,
  },
};
