/**
 * Connection Manager for Session View
 *
 * Handles WebSocket connections, reconnection logic, and error handling
 * for terminal sessions.
 */

import type { Session } from '../../../shared/types.js';
import { authClient } from '../../services/auth-client.js';
import { CastConverter } from '../../utils/cast-converter.js';
import { createLogger } from '../../utils/logger.js';
import type { Terminal } from '../terminal.js';

const logger = createLogger('connection-manager');

export interface StreamConnection {
  ws: WebSocket;
  disconnect: () => void;
  errorHandler?: () => void;
  sessionExitHandler?: EventListener;
}

export class ConnectionManager {
  private streamConnection: StreamConnection | null = null;
  private reconnectCount = 0;
  private terminal: Terminal | null = null;
  private session: Session | null = null;
  private isConnected = false;

  constructor(
    private onSessionExit: (sessionId: string) => void,
    private onSessionUpdate: (session: Session) => void
  ) {}

  setTerminal(terminal: Terminal | null): void {
    this.terminal = terminal;
  }

  setSession(session: Session | null): void {
    this.session = session;
  }

  setConnected(connected: boolean): void {
    this.isConnected = connected;
  }

  async connectToStream(): Promise<void> {
    console.log('[ConnectionManager] connectToStream called', {
      hasTerminal: !!this.terminal,
      hasSession: !!this.session,
      sessionId: this.session?.id,
      isConnected: this.isConnected,
    });

    if (!this.terminal || !this.session) {
      logger.warn(`Cannot connect to stream - missing terminal or session`);
      console.error('[ConnectionManager] Missing terminal or session!', {
        terminal: this.terminal,
        session: this.session,
      });
      return;
    }

    // Don't connect if we're already disconnected
    if (!this.isConnected) {
      logger.warn(`Component already disconnected, not connecting to stream`);
      console.warn('[ConnectionManager] Already disconnected');
      return;
    }

    logger.log(`Connecting to WebSocket for session ${this.session.id}`);
    console.log('[ConnectionManager] Starting WebSocket connection');

    // Clean up existing connection
    this.cleanupStreamConnection();

    // Get auth token
    const user = authClient.getCurrentUser();

    // Get WebSocket URL from config (which points to Go server on port 4021)
    try {
      const config = await fetch('/api/config').then((r) => r.json());
      console.log('[ConnectionManager] Config fetched:', config);

      let wsUrl = config.websocketUrl;
      wsUrl = `${wsUrl}/ws?sessionId=${this.session.id}`;
      if (user?.token) {
        wsUrl += `&token=${encodeURIComponent(user.token)}`;
      }

      logger.log(`Connecting to: ${wsUrl}`);
      console.log('[ConnectionManager] WebSocket URL:', wsUrl);

      // Create WebSocket connection
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      console.log('[ConnectionManager] WebSocket created, adding handlers');

      // Listen for session-exit events from the terminal
      const handleSessionExit = (event: Event) => {
        const customEvent = event as CustomEvent;
        const sessionId = customEvent.detail?.sessionId || this.session?.id;

        logger.log(`Received session-exit event for session ${sessionId}`);

        if (sessionId) {
          this.onSessionExit(sessionId);
        }
      };

      this.terminal.addEventListener('session-exit', handleSessionExit);

      let lastErrorTime = 0;
      const reconnectThreshold = 3; // Max reconnects before giving up
      const reconnectWindow = 5000; // 5 second window

      const handleError = () => {
        const now = Date.now();

        // Reset counter if enough time has passed since last error
        if (now - lastErrorTime > reconnectWindow) {
          this.reconnectCount = 0;
        }

        this.reconnectCount++;
        lastErrorTime = now;

        logger.log(`WebSocket error #${this.reconnectCount} for session ${this.session?.id}`);
        console.error('[ConnectionManager] WebSocket error, reconnect count:', this.reconnectCount);

        // If we've had too many reconnects, mark session as exited
        if (this.reconnectCount >= reconnectThreshold) {
          logger.warn(
            `session ${this.session?.id} marked as exited due to excessive reconnections`
          );

          if (this.session && this.session.status !== 'exited') {
            const exitedSession = { ...this.session, status: 'exited' as const };
            this.session = exitedSession;
            this.onSessionUpdate(exitedSession);

            // Disconnect and load final snapshot
            this.cleanupStreamConnection();
            requestAnimationFrame(() => {
              this.loadSessionSnapshot();
            });
          }
        }
      };

      ws.onopen = () => {
        logger.log(`WebSocket connected for session ${this.session?.id}`);
        console.log('[ConnectionManager] WebSocket CONNECTED successfully!');
        this.reconnectCount = 0;
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          // JSON messages (control messages)
          try {
            const message = JSON.parse(event.data);
            console.log('[ConnectionManager] Received JSON message:', message);

            if (message.type === 'session-exit') {
              logger.log('Session exit message received');
              this.terminal?.dispatchEvent(
                new CustomEvent('session-exit', {
                  detail: {
                    exitCode: message.exitCode,
                    sessionId: this.session?.id,
                  },
                  bubbles: true,
                })
              );
            }
          } catch (error) {
            logger.error('Failed to parse WebSocket message:', error);
          }
        } else {
          // Binary data (terminal output)
          const text = new TextDecoder().decode(event.data);
          console.log('[ConnectionManager] Received terminal output, length:', text.length);
          this.terminal?.write(text);
        }
      };

      ws.onerror = (error) => {
        logger.error('WebSocket error:', error);
        console.error('[ConnectionManager] WebSocket onerror triggered:', error);
        handleError();
      };

      ws.onclose = () => {
        logger.log(`WebSocket closed for session ${this.session?.id}`);
        console.warn('[ConnectionManager] WebSocket onclose triggered');
        handleError();
      };

      // Store the connection
      this.streamConnection = {
        ws,
        disconnect: () => {
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
          }
        },
        errorHandler: handleError,
        sessionExitHandler: handleSessionExit as EventListener,
      };

      console.log('[ConnectionManager] WebSocket connection setup complete');
    } catch (error) {
      console.error('[ConnectionManager] Error setting up WebSocket:', error);
      logger.error('Failed to setup WebSocket connection:', error);
    }
  }

  cleanupStreamConnection(): void {
    if (this.streamConnection) {
      logger.log('Cleaning up WebSocket connection');

      // Remove session-exit event listener if it exists
      if (this.streamConnection.sessionExitHandler && this.terminal) {
        this.terminal.removeEventListener('session-exit', this.streamConnection.sessionExitHandler);
      }

      this.streamConnection.disconnect();
      this.streamConnection = null;
    }
  }

  getReconnectCount(): number {
    return this.reconnectCount;
  }

  private async loadSessionSnapshot(): Promise<void> {
    if (!this.terminal || !this.session) return;

    try {
      const url = `/api/sessions/${this.session.id}/snapshot`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch snapshot: ${response.status}`);

      const castContent = await response.text();

      // Clear terminal and load snapshot
      this.terminal.clear();
      await CastConverter.dumpToTerminal(this.terminal, castContent);

      // Scroll to bottom after loading
      this.terminal.queueCallback(() => {
        if (this.terminal) {
          this.terminal.scrollToBottom();
        }
      });
    } catch (error) {
      logger.error('failed to load session snapshot', error);
    }
  }
}
