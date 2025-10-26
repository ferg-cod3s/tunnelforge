// Svelte stores for session management - replaces EventBus pattern
import { writable, derived } from 'svelte/store';
import type { Session } from '../types/index';

// Session store - central state for all sessions
export const sessions = writable<Session[]>([]);

// Selected session ID
export const selectedSessionId = writable<string | null>(null);

// Active sessions (filtered from all sessions)
export const activeSessions = derived(
  sessions,
  $sessions => $sessions.filter(s => s.status === 'running')
);

// Session count
export const sessionCount = derived(
  sessions,
  $sessions => $sessions.length
);

// Active session count
export const activeSessionCount = derived(
  activeSessions,
  $activeSessions => $activeSessions.length
);

// Current session (derived from selectedSessionId)
export const currentSession = derived(
  [sessions, selectedSessionId],
  ([$sessions, $selectedSessionId]) => {
    if (!$selectedSessionId) return null;
    return $sessions.find(s => s.id === $selectedSessionId) || null;
  }
);

// Session service functions
export const sessionService = {
  // Load all sessions from API
  async loadSessions(): Promise<void> {
    try {
      const response = await fetch('/api/sessions');
      if (!response.ok) throw new Error('Failed to load sessions');

      const sessionList = await response.json();
      sessions.set(sessionList);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      // Keep existing sessions on error
    }
  },

  // Create a new session
  async createSession(sessionData: Partial<Session>): Promise<Session | null> {
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionData),
      });

      if (!response.ok) throw new Error('Failed to create session');

      const newSession = await response.json();
      sessions.update(current => [...current, newSession]);
      return newSession;
    } catch (error) {
      console.error('Failed to create session:', error);
      return null;
    }
  },

  // Update an existing session
  async updateSession(sessionId: string, updates: Partial<Session>): Promise<boolean> {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) throw new Error('Failed to update session');

      const updatedSession = await response.json();
      sessions.update(current =>
        current.map(s => s.id === sessionId ? { ...s, ...updatedSession } : s)
      );
      return true;
    } catch (error) {
      console.error('Failed to update session:', error);
      return false;
    }
  },

  // Delete a session
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete session');

      sessions.update(current => current.filter(s => s.id !== sessionId));

      // Clear selection if deleted session was selected
      selectedSessionId.update(id => id === sessionId ? null : id);

      return true;
    } catch (error) {
      console.error('Failed to delete session:', error);
      return false;
    }
  },

  // Select a session
  selectSession(sessionId: string | null): void {
    selectedSessionId.set(sessionId);
  },

  // Get session by ID
  getSession(sessionId: string): Session | undefined {
    let result: Session | undefined;
    sessions.subscribe(current => {
      result = current.find(s => s.id === sessionId);
    })();
    return result;
  }
};