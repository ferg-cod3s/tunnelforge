/**
 * TypeScript interfaces and types for PTY management
 *
 * These types match the tty-fwd format to ensure compatibility
 */

import type { SessionInfo } from '../../shared/types.js';
import type { IPty } from '@homebridge/node-pty-prebuilt-multiarch';
import type { AsciinemaWriter } from './asciinema-writer.js';

export interface AsciinemaHeader {
  version: number;
  width: number;
  height: number;
  timestamp?: number;
  duration?: number;
  command?: string;
  title?: string;
  env?: Record<string, string>;
  theme?: AsciinemaTheme;
}

export interface AsciinemaTheme {
  fg?: string;
  bg?: string;
  palette?: string;
}

export interface ControlMessage {
  cmd: string;
  [key: string]: unknown;
}

export interface ResizeControlMessage extends ControlMessage {
  cmd: 'resize';
  cols: number;
  rows: number;
}

export interface KillControlMessage extends ControlMessage {
  cmd: 'kill';
  signal?: string | number;
}

export type AsciinemaEvent = {
  time: number;
  type: 'o' | 'i' | 'r' | 'm';
  data: string;
};

// Internal session state for PtyManager
export interface PtySession {
  id: string;
  sessionInfo: SessionInfo;
  ptyProcess?: IPty;
  asciinemaWriter?: AsciinemaWriter;
  controlDir: string;
  stdoutPath: string;
  stdinPath: string;
  controlPipePath: string;
  sessionJsonPath: string;
  startTime: Date;
}

export class PtyError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly sessionId?: string
  ) {
    super(message);
    this.name = 'PtyError';
  }
}

// Utility type for session creation result
export interface SessionCreationResult {
  sessionId: string;
  sessionInfo: SessionInfo;
}
