import { writable } from 'svelte/store';
import type { Session } from '$lib/types';
import { createLogger } from '$lib/utils/logger';
import { authToken } from './auth';

const logger = createLogger('connection-store');

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ConnectionState {
  status: ConnectionStatus;
  error: string | null;
  lastMessage: Date | null;
}

export interface ConnectionStore {
  subscribe: (callback: (value: ConnectionState) => void) => () => void;
  connect: (sessionId: string) => Promise<void>;
  disconnect: () => void;
  sendInput: (data: string | Uint8Array) => void;
  sendResize: (cols: number, rows: number) => void;
  state: ConnectionState;
}

interface WebSocketMessage {
  type: string;
  data?: any;
  sessionId?: string;
  exitCode?: number;
  timestamp?: string;
}

// SSE Event types for session updates
interface SSEEvent {
  type: 'session-update' | 'session-exit';
  session: Session;
}

// CastConverter functionality for loading session snapshots
class CastConverter {
  static async dumpToTerminal(terminal: any, castContent: string): Promise<void> {
    // Parse cast content and write to terminal
    // This is a simplified implementation - you may need to adapt based on your cast format
    const lines = castContent.split('\n');
    for (const line of lines) {
      if (line.trim()) {
        terminal.write(line + '\n');
      }
    }
  }
}

/**
 * Creates a WebSocket connection store for a specific session
 * Handles connection lifecycle, reconnection, and message routing
 */
export function createConnectionStore(
  onSessionExit: (sessionId: string) => void,
  onSessionUpdate: (session: Session) => void,
  terminal?: any // Terminal interface - adapt based on your terminal component
): ConnectionStore {
  const store = writable<ConnectionState>({
    status: 'disconnected',
    error: null,
    lastMessage: null,
  });

  let ws: WebSocket | null = null;
  let sse: EventSource | null = null;
  let reconnectCount = 0;
  let reconnectTimeout: number | null = null;
  let sessionId: string | null = null;
  let isDestroyed = false;

  const updateState = (updates: Partial<ConnectionState>) => {
    store.update(state => ({ ...state, ...updates }));
  };

  const getReconnectDelay = (attempt: number): number => {
    // Exponential backoff: 1s, 2s, 4s, 8s, max 10s
    return Math.min(1000 * Math.pow(2, attempt - 1), 10000);
  };

  const cleanup = () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    if (ws) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      ws = null;
    }

    if (sse) {
      sse.close();
      sse = null;
    }
  };

  const connectSSE = (sessionId: string) => {
    if (sse) {
      sse.close();
    }

    const sseUrl = `/api/sessions/${sessionId}/stream`;
    sse = new EventSource(sseUrl);

    sse.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);
        logger.log('SSE message received:', data);

        if (data.type === 'session-update') {
          onSessionUpdate(data.session);
        } else if (data.type === 'session-exit') {
          onSessionExit(data.session.id);
        }
      } catch (error) {
        logger.error('Failed to parse SSE message:', error);
      }
    };

    sse.onerror = (error) => {
      logger.error('SSE connection error:', error);
      // SSE will automatically reconnect, but we can log the error
    };

    logger.log('SSE connection established for session:', sessionId);
  };

  const connectWebSocket = async (sessionId: string) => {
    if (isDestroyed) return;

    updateState({ status: 'connecting', error: null });

    try {
      // Get WebSocket configuration
      const configResponse = await fetch('/api/config');
      if (!configResponse.ok) {
        throw new Error('Failed to fetch WebSocket config');
      }
      const config = await configResponse.json();

      // Build WebSocket URL
      let wsUrl = `${config.websocketUrl}/ws/terminal/${sessionId}`;

      // Add auth token if available
      let token: string | null = null;
      authToken.subscribe(t => token = t);
      if (token) {
        wsUrl += `?token=${encodeURIComponent(token)}`;
      }

      logger.log('Connecting to WebSocket:', wsUrl);

      ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';

      ws.onopen = () => {
        logger.log('WebSocket connected for session:', sessionId);
        updateState({ status: 'connected', error: null });
        reconnectCount = 0;
      };

      ws.onmessage = (event) => {
        updateState({ lastMessage: new Date() });

        if (typeof event.data === 'string') {
          // JSON control messages
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            logger.log('Received JSON message:', message);

            if (message.type === 'session-exit') {
              logger.log('Session exit message received');
              onSessionExit(sessionId);

              // Load final snapshot if terminal is available
              if (terminal) {
                loadSessionSnapshot(sessionId);
              }
            } else if (message.type === 'output') {
              // Handle output messages if needed
              logger.debug('Output message received');
            }
          } catch (error) {
            logger.error('Failed to parse WebSocket message:', error);
          }
        } else {
          // Binary terminal output
          if (terminal) {
            const text = new TextDecoder().decode(event.data);
            logger.debug('Received terminal output, length:', text.length);
            terminal.write(text);
          }
        }
      };

      ws.onerror = (error) => {
        logger.error('WebSocket error:', error);
        updateState({
          status: 'error',
          error: 'WebSocket connection failed'
        });
      };

      ws.onclose = () => {
        logger.log('WebSocket closed for session:', sessionId);
        ws = null;

        if (!isDestroyed) {
          // Attempt reconnection
          reconnectCount++;
          const delay = getReconnectDelay(reconnectCount);

          logger.log(`Attempting reconnection ${reconnectCount} in ${delay}ms`);

          reconnectTimeout = window.setTimeout(() => {
            if (!isDestroyed && sessionId) {
              connectWebSocket(sessionId);
            }
          }, delay);
        }
      };

    } catch (error) {
      logger.error('Failed to setup WebSocket connection:', error);
      updateState({
        status: 'error',
        error: error instanceof Error ? error.message : 'Connection setup failed'
      });
    }
  };

  const loadSessionSnapshot = async (sessionId: string) => {
    if (!terminal) return;

    try {
      const url = `/api/sessions/${sessionId}/snapshot`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch snapshot: ${response.status}`);
      }

      const castContent = await response.text();

      // Clear terminal and load snapshot
      terminal.clear();
      await CastConverter.dumpToTerminal(terminal, castContent);

      // Scroll to bottom after loading
      requestAnimationFrame(() => {
        if (terminal && typeof terminal.scrollToBottom === 'function') {
          terminal.scrollToBottom();
        }
      });

      logger.log('Session snapshot loaded for:', sessionId);
    } catch (error) {
      logger.error('Failed to load session snapshot:', error);
    }
  };

  const connectionStore: ConnectionStore = {
    subscribe: store.subscribe,

    async connect(sessionIdToConnect: string) {
      if (isDestroyed) return;

      sessionId = sessionIdToConnect;

      // Cleanup existing connections
      cleanup();

      // Connect both WebSocket and SSE
      await connectWebSocket(sessionIdToConnect);
      connectSSE(sessionIdToConnect);
    },

    disconnect() {
      logger.log('Disconnecting connection store');
      cleanup();
      updateState({ status: 'disconnected', error: null });
      sessionId = null;
    },

    sendInput(data: string | Uint8Array) {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        logger.warn('Cannot send input: WebSocket not connected');
        return;
      }

      try {
        if (typeof data === 'string') {
          ws.send(data);
        } else {
          ws.send(data);
        }
        logger.debug('Input sent, length:', typeof data === 'string' ? data.length : data.byteLength);
      } catch (error) {
        logger.error('Failed to send input:', error);
      }
    },

    sendResize(cols: number, rows: number) {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        logger.warn('Cannot send resize: WebSocket not connected');
        return;
      }

      try {
        const resizeMessage: WebSocketMessage = {
          type: 'resize',
          data: { cols, rows },
          sessionId: sessionId || undefined,
        };
        ws.send(JSON.stringify(resizeMessage));
        logger.debug('Resize sent:', { cols, rows });
      } catch (error) {
        logger.error('Failed to send resize:', error);
      }
    },

    get state() {
      let currentState: ConnectionState;
      store.subscribe(state => currentState = state)();
      return currentState!;
    }
  };

  // Cleanup on store destruction (when component unmounts)
  const unsubscribe = store.subscribe(() => {});
  const originalSubscribe = store.subscribe;
  store.subscribe = (callback) => {
    const unsub = originalSubscribe(callback);
    return () => {
      unsub();
      if (!isDestroyed) {
        isDestroyed = true;
        cleanup();
      }
    };
  };

  return connectionStore;
}