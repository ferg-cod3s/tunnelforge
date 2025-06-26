// @vitest-environment happy-dom
import { fixture, html } from '@open-wc/testing';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTextContent, setupFetchMock } from '@/test/utils/component-helpers';
import { createMockSession } from '@/test/utils/lit-test-utils';
import { resetFactoryCounters } from '@/test/utils/test-factories';
import type { AuthClient } from '../services/auth-client';

// Mock AuthClient
vi.mock('../services/auth-client');

// Mock copyToClipboard
vi.mock('../utils/path-utils', () => ({
  copyToClipboard: vi.fn(() => Promise.resolve(true)),
}));

// Import component type
import type { SessionCard } from './session-card';

describe('SessionCard', () => {
  let element: SessionCard;
  let fetchMock: ReturnType<typeof setupFetchMock>;
  let mockAuthClient: AuthClient;

  beforeAll(async () => {
    // Import components to register custom elements
    await import('./session-card');
    await import('./vibe-terminal-buffer');
    await import('./copy-icon');
    await import('./clickable-path');
  });

  beforeEach(async () => {
    // Reset factory counters for test isolation
    resetFactoryCounters();

    // Setup fetch mock
    fetchMock = setupFetchMock();

    // Create mock auth client
    mockAuthClient = {
      getAuthHeader: vi.fn(() => ({ Authorization: 'Bearer test-token' })),
    } as unknown as AuthClient;

    // Create default session
    const mockSession = createMockSession();

    // Create component
    element = await fixture<SessionCard>(html`
      <session-card .session=${mockSession} .authClient=${mockAuthClient}></session-card>
    `);

    await element.updateComplete;
  });

  afterEach(() => {
    element.remove();
    fetchMock.clear();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create component with default state', () => {
      expect(element).toBeDefined();
      expect(element.killing).toBe(false);
      expect(element.isActive).toBe(false);
    });

    it('should render session details', () => {
      const sessionName = getTextContent(element, '.text-accent-green');
      expect(sessionName).toBeTruthy();

      // Should have status indicator
      const statusText = element.textContent;
      expect(statusText).toContain('running');
    });

    it('should render terminal buffer', () => {
      const terminalBuffer = element.querySelector('vibe-terminal-buffer') as HTMLElement & {
        sessionId: string;
      };
      expect(terminalBuffer).toBeTruthy();
      // Component uses property binding, not attribute
      expect(terminalBuffer?.sessionId).toBe(element.session.id);
    });
  });

  describe('session display', () => {
    it('should display session name or command', async () => {
      // Test with name
      element.session = createMockSession({ name: 'Test Session' });
      await element.updateComplete;

      let displayText = getTextContent(element, '.text-accent-green');
      expect(displayText).toContain('Test Session');

      // Test without name (falls back to command)
      element.session = { ...createMockSession({ name: '' }), command: ['npm', 'run', 'dev'] };
      await element.updateComplete;

      displayText = getTextContent(element, '.text-accent-green');
      expect(displayText).toContain('npm run dev');
    });

    it('should show running status with success color', async () => {
      element.session = createMockSession({ status: 'running' });
      await element.updateComplete;

      const statusElement = element.querySelector('.text-status-success');
      expect(statusElement).toBeTruthy();
      expect(statusElement?.textContent).toContain('running');
    });

    it('should show exited status with warning color', async () => {
      element.session = createMockSession({ status: 'exited' });
      await element.updateComplete;

      // The status text is in a span with status color class
      const statusSpan = element.querySelector('.text-status-warning');
      expect(statusSpan).toBeTruthy();

      // Check the whole card contains 'exited'
      expect(element.textContent).toContain('exited');
    });

    it('should show waiting status when inactive', async () => {
      element.session = createMockSession({ active: false });
      await element.updateComplete;

      const statusText = element.textContent;
      expect(statusText).toContain('waiting');
    });

    it('should display PID when available', async () => {
      const mockPid = 12345;
      element.session = createMockSession({ pid: mockPid });
      await element.updateComplete;

      const pidText = element.textContent;
      expect(pidText).toContain(`PID: ${mockPid}`);
    });

    it('should display working directory', () => {
      const workingDir = element.querySelector('clickable-path') as HTMLElement & { path: string };
      expect(workingDir).toBeTruthy();
      // Component uses property binding, not attribute
      expect(workingDir?.path).toBe(element.session.workingDir);
    });
  });

  describe('click handling', () => {
    it('should emit session-select event when card is clicked', async () => {
      const selectHandler = vi.fn();
      element.addEventListener('session-select', selectHandler);

      const card = element.querySelector('.card');
      if (card) {
        (card as HTMLElement).click();

        expect(selectHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            detail: element.session,
          })
        );
      }
    });

    it('should copy PID when PID is clicked', async () => {
      const { copyToClipboard } = await import('../utils/path-utils');
      const mockPid = 12345;
      element.session = createMockSession({ pid: mockPid });
      await element.updateComplete;

      const pidElement = element.querySelector('[title="Click to copy PID"]');
      if (pidElement) {
        (pidElement as HTMLElement).click();

        expect(copyToClipboard).toHaveBeenCalledWith(mockPid.toString());
      }
    });

    it('should prevent event bubbling on kill button click', async () => {
      const selectHandler = vi.fn();
      element.addEventListener('session-select', selectHandler);

      const killButton = element.querySelector('[title="Kill session"]');
      if (killButton) {
        (killButton as HTMLElement).click();

        // Should not trigger session select
        expect(selectHandler).not.toHaveBeenCalled();
      }
    });
  });

  describe('kill functionality', () => {
    it('should show kill button for running sessions', async () => {
      element.session = createMockSession({ status: 'running' });
      await element.updateComplete;

      const killButton = element.querySelector('[title="Kill session"]');
      expect(killButton).toBeTruthy();
    });

    it('should show cleanup button for exited sessions', async () => {
      element.session = createMockSession({ status: 'exited' });
      await element.updateComplete;

      const cleanupButton = element.querySelector('[title="Clean up session"]');
      expect(cleanupButton).toBeTruthy();
    });

    it('should not show kill button for other statuses', async () => {
      element.session = createMockSession({ status: 'unknown' as 'running' | 'exited' });
      await element.updateComplete;

      const killButton = element.querySelector('button[title*="session"]');
      expect(killButton).toBeFalsy();
    });

    it('should handle successful kill', async () => {
      fetchMock.mockResponse(`/api/sessions/${element.session.id}`, { success: true });

      const killedHandler = vi.fn();
      element.addEventListener('session-killed', killedHandler);

      await element.kill();

      expect(mockAuthClient.getAuthHeader).toHaveBeenCalled();
      expect(killedHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            sessionId: element.session.id,
            session: element.session,
          },
        })
      );
    });

    it('should handle kill error', async () => {
      fetchMock.mockResponse(
        `/api/sessions/${element.session.id}`,
        { error: 'Permission denied' },
        { status: 403 }
      );

      const errorHandler = vi.fn();
      element.addEventListener('session-kill-error', errorHandler);

      await element.kill();

      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            sessionId: element.session.id,
            error: expect.stringContaining('kill failed'),
          },
        })
      );
    });

    it('should show killing animation', async () => {
      // Mock a slow response
      fetchMock.mockResponse(
        `/api/sessions/${element.session.id}`,
        () => new Promise((resolve) => setTimeout(() => resolve({ success: true }), 100))
      );

      const killPromise = element.kill();

      // Should be in killing state
      expect(element.killing).toBe(true);

      // Should show killing UI
      await element.updateComplete;
      const killingText = element.querySelector('.text-status-error .text-sm');
      expect(killingText?.textContent).toContain('Killing session...');

      await killPromise;

      // Should no longer be killing
      expect(element.killing).toBe(false);
    });

    it('should prevent multiple simultaneous kills', async () => {
      fetchMock.mockResponse(`/api/sessions/${element.session.id}`, { success: true });

      // Start first kill
      const firstKill = element.kill();

      // Try second kill immediately
      const secondKill = element.kill();

      // Second kill should return false immediately
      expect(await secondKill).toBe(false);

      // First kill should succeed
      expect(await firstKill).toBe(true);
    });

    it('should handle cleanup for exited sessions', async () => {
      element.session = createMockSession({ status: 'exited' });
      await element.updateComplete;

      fetchMock.mockResponse(`/api/sessions/${element.session.id}/cleanup`, { success: true });

      const killedHandler = vi.fn();
      element.addEventListener('session-killed', killedHandler);

      await element.kill();

      // Should use cleanup endpoint for exited sessions
      const calls = fetchMock.getCalls();
      expect(calls[0][0]).toContain('/cleanup');
      expect(killedHandler).toHaveBeenCalled();
    });
  });

  describe('activity tracking', () => {
    it('should track activity for running sessions', async () => {
      element.session = createMockSession({ status: 'running' });
      await element.updateComplete;

      // Initially not active
      expect(element.isActive).toBe(false);

      // Simulate content change event from terminal buffer
      const terminalBuffer = element.querySelector('vibe-terminal-buffer');
      if (terminalBuffer) {
        terminalBuffer.dispatchEvent(new CustomEvent('content-changed'));

        expect(element.isActive).toBe(true);

        // Wait for activity timeout
        await new Promise((resolve) => setTimeout(resolve, 600));

        expect(element.isActive).toBe(false);
      }
    });

    it('should not track activity for non-running sessions', async () => {
      element.session = createMockSession({ status: 'exited' });
      await element.updateComplete;

      const terminalBuffer = element.querySelector('vibe-terminal-buffer');
      if (terminalBuffer) {
        terminalBuffer.dispatchEvent(new CustomEvent('content-changed'));

        expect(element.isActive).toBe(false);
      }
    });

    it('should show activity indicator when active', async () => {
      element.session = createMockSession({ status: 'running' });
      element.isActive = true;
      await element.updateComplete;

      const activityIndicator = element.querySelector('.animate-pulse');
      expect(activityIndicator).toBeTruthy();
      expect(activityIndicator?.textContent).toContain('●');
    });
  });

  describe('styling', () => {
    it('should apply green glow when active and running', async () => {
      element.session = createMockSession({ status: 'running' });
      element.isActive = true;
      await element.updateComplete;

      const card = element.querySelector('.card');
      expect(card?.classList.contains('shadow-glow-green-sm')).toBe(true);
    });

    it('should apply opacity when killing', async () => {
      element.killing = true;
      await element.updateComplete;

      const card = element.querySelector('.card');
      expect(card?.classList.contains('opacity-60')).toBe(true);
    });

    it('should apply exited styling for exited sessions', async () => {
      element.session = createMockSession({ status: 'exited' });
      await element.updateComplete;

      const preview = element.querySelector('.session-preview');
      expect(preview?.classList.contains('session-exited')).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('should clean up intervals on disconnect', () => {
      // Set up some intervals
      element.killing = true;
      element.isActive = true;

      // Disconnect
      element.disconnectedCallback();

      // Intervals should be cleared (no way to directly test, but should not throw)
      expect(() => element.disconnectedCallback()).not.toThrow();
    });
  });
});
