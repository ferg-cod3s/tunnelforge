/**
 * Unified control socket protocol definitions
 */

export type ControlMessageType = 'request' | 'response' | 'event';
export type ControlCategory = 'terminal' | 'git' | 'system';

export interface ControlMessage {
  id: string;
  type: ControlMessageType;
  category: ControlCategory;
  action: string;
  payload?: unknown;
  sessionId?: string;
  userId?: string;
  error?: string;
}

// Terminal control actions
export interface TerminalSpawnRequest {
  sessionId: string;
  workingDirectory?: string;
  command?: string;
  terminalPreference?: string;
}

export interface TerminalSpawnResponse {
  success: boolean;
  pid?: number;
  error?: string;
}

// System control payloads
export interface SystemReadyEvent {
  timestamp: number;
  version?: string;
}

export interface SystemPingRequest {
  timestamp: number;
}

export interface SystemPingResponse {
  status: string;
  timestamp: number;
}

// Helper to create control messages
export function createControlMessage(
  category: ControlCategory,
  action: string,
  payload?: unknown,
  sessionId?: string
): ControlMessage {
  return {
    id: crypto.randomUUID(),
    type: 'request',
    category,
    action,
    payload,
    sessionId,
  };
}

export function createControlResponse(
  request: ControlMessage,
  payload?: unknown,
  error?: string
): ControlMessage {
  return {
    id: request.id,
    type: 'response',
    category: request.category,
    action: request.action,
    payload,
    sessionId: request.sessionId,
    error,
  };
}

export function createControlEvent(
  category: ControlCategory,
  action: string,
  payload?: unknown,
  sessionId?: string
): ControlMessage {
  return {
    id: crypto.randomUUID(),
    type: 'event',
    category,
    action,
    payload,
    sessionId,
  };
}
