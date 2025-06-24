import { Router } from 'express';
import { PtyManager, PtyError } from '../pty/index.js';
import type { Session, SessionActivity } from '../../shared/types.js';
import { TerminalManager } from '../services/terminal-manager.js';
import { StreamWatcher } from '../services/stream-watcher.js';
import { RemoteRegistry } from '../services/remote-registry.js';
import { ActivityMonitor } from '../services/activity-monitor.js';
import { cellsToText } from '../../shared/terminal-text-formatter.js';
import { createLogger } from '../utils/logger.js';
import { generateSessionName } from '../utils/session-naming.js';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';

const logger = createLogger('sessions');

interface SessionRoutesConfig {
  ptyManager: PtyManager;
  terminalManager: TerminalManager;
  streamWatcher: StreamWatcher;
  remoteRegistry: RemoteRegistry | null;
  isHQMode: boolean;
  activityMonitor: ActivityMonitor;
}

// Helper function to resolve path (handles ~)
function resolvePath(inputPath: string, defaultPath: string): string {
  if (!inputPath || inputPath.trim() === '') {
    return defaultPath;
  }

  if (inputPath.startsWith('~/')) {
    return path.join(os.homedir(), inputPath.slice(2));
  }

  if (!path.isAbsolute(inputPath)) {
    return path.join(defaultPath, inputPath);
  }

  return inputPath;
}

export function createSessionRoutes(config: SessionRoutesConfig): Router {
  const router = Router();
  const { ptyManager, terminalManager, streamWatcher, remoteRegistry, isHQMode, activityMonitor } =
    config;

  // List all sessions (aggregate local + remote in HQ mode)
  router.get('/sessions', async (req, res) => {
    logger.debug('listing all sessions');
    try {
      let allSessions = [];

      // Get local sessions
      const localSessions = ptyManager.listSessions();
      logger.debug(`found ${localSessions.length} local sessions`);

      // Add source info to local sessions
      const localSessionsWithSource = localSessions.map((session) => ({
        ...session,
        source: 'local' as const,
      }));

      allSessions = [...localSessionsWithSource];

      // If in HQ mode, aggregate sessions from all remotes
      if (isHQMode && remoteRegistry) {
        const remotes = remoteRegistry.getRemotes();
        logger.debug(`checking ${remotes.length} remote servers for sessions`);

        // Fetch sessions from each remote in parallel
        const remotePromises = remotes.map(async (remote) => {
          try {
            const response = await fetch(`${remote.url}/api/sessions`, {
              headers: {
                Authorization: `Bearer ${remote.token}`,
              },
              signal: AbortSignal.timeout(5000), // 5 second timeout
            });

            if (response.ok) {
              const remoteSessions = (await response.json()) as Session[];
              logger.debug(`got ${remoteSessions.length} sessions from remote ${remote.name}`);

              // Track session IDs for this remote
              const sessionIds = remoteSessions.map((s: Session) => s.id);
              remoteRegistry.updateRemoteSessions(remote.id, sessionIds);

              // Add remote info to each session
              return remoteSessions.map((session: Session) => ({
                ...session,
                source: 'remote',
                remoteId: remote.id,
                remoteName: remote.name,
                remoteUrl: remote.url,
              }));
            } else {
              logger.warn(
                `failed to get sessions from remote ${remote.name}: HTTP ${response.status}`
              );
              return [];
            }
          } catch (error) {
            logger.error(`failed to get sessions from remote ${remote.name}:`, error);
            return [];
          }
        });

        const remoteResults = await Promise.all(remotePromises);
        const remoteSessions = remoteResults.flat();
        logger.debug(`total remote sessions: ${remoteSessions.length}`);

        allSessions = [...allSessions, ...remoteSessions];
      }

      logger.debug(`returning ${allSessions.length} total sessions`);
      res.json(allSessions);
    } catch (error) {
      logger.error('error listing sessions:', error);
      res.status(500).json({ error: 'Failed to list sessions' });
    }
  });

  // Create new session (local or on remote)
  router.post('/sessions', async (req, res) => {
    const { command, workingDir, name, remoteId, spawn_terminal } = req.body;
    logger.debug(
      `creating new session: command=${JSON.stringify(command)}, remoteId=${remoteId || 'local'}`
    );

    if (!command || !Array.isArray(command) || command.length === 0) {
      logger.warn('session creation failed: invalid command array');
      return res.status(400).json({ error: 'Command array is required' });
    }

    try {
      // If remoteId is specified and we're in HQ mode, forward to remote
      if (remoteId && isHQMode && remoteRegistry) {
        const remote = remoteRegistry.getRemote(remoteId);
        if (!remote) {
          logger.warn(`session creation failed: remote ${remoteId} not found`);
          return res.status(404).json({ error: 'Remote server not found' });
        }

        logger.log(chalk.blue(`forwarding session creation to remote ${remote.name}`));

        // Forward the request to the remote server
        const startTime = Date.now();
        const response = await fetch(`${remote.url}/api/sessions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${remote.token}`,
          },
          body: JSON.stringify({
            command,
            workingDir,
            name,
            spawn_terminal,
            // Don't forward remoteId to avoid recursion
          }),
          signal: AbortSignal.timeout(10000), // 10 second timeout
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Unknown error' }));
          return res.status(response.status).json(error);
        }

        const result = (await response.json()) as { sessionId: string };
        logger.debug(`remote session creation took ${Date.now() - startTime}ms`);

        // Track the session in the remote's sessionIds
        if (result.sessionId) {
          remoteRegistry.addSessionToRemote(remote.id, result.sessionId);
        }

        res.json(result); // Return sessionId as-is, no namespacing
        return;
      }

      // If spawn_terminal is true and socket exists, use the spawn-terminal logic
      const socketPath = '/tmp/vibetunnel-terminal.sock';
      if (spawn_terminal && fs.existsSync(socketPath)) {
        try {
          // Generate session ID
          const sessionId = generateSessionId();
          const sessionName =
            name || generateSessionName(command, resolvePath(workingDir, process.cwd()));

          // Request Mac app to spawn terminal
          logger.log(
            chalk.blue(`requesting terminal spawn with command: ${JSON.stringify(command)}`)
          );
          const spawnResult = await requestTerminalSpawn({
            sessionId,
            sessionName,
            command,
            workingDir: resolvePath(workingDir, process.cwd()),
          });

          if (!spawnResult.success) {
            if (spawnResult.error?.includes('ECONNREFUSED')) {
              logger.debug('terminal spawn socket not available, falling back to normal spawn');
            } else {
              throw new Error(spawnResult.error || 'Failed to spawn terminal');
            }
          } else {
            // Wait a bit for the session to be created
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Return the session ID - client will poll for the session to appear
            logger.log(chalk.green(`terminal spawn requested for session ${sessionId}`));
            res.json({ sessionId, message: 'Terminal spawn requested' });
            return;
          }
        } catch (error) {
          logger.error('error spawning terminal:', error);
          res.status(500).json({
            error: 'Failed to spawn terminal',
            details: error instanceof Error ? error.message : 'Unknown error',
          });
          return;
        }
      } else if (spawn_terminal && !fs.existsSync(socketPath)) {
        logger.debug('terminal spawn socket not available, falling back to normal spawn');
      }

      // Create local session
      const cwd = resolvePath(workingDir, process.cwd());
      const sessionName = name || generateSessionName(command, cwd);

      logger.log(chalk.blue(`creating session: ${command.join(' ')} in ${cwd}`));

      const result = await ptyManager.createSession(command, {
        name: sessionName,
        workingDir: cwd,
      });

      const { sessionId, sessionInfo } = result;
      logger.log(chalk.green(`session ${sessionId} created (PID: ${sessionInfo.pid})`));

      // Stream watcher is set up when clients connect to the stream endpoint

      res.json({ sessionId });
    } catch (error) {
      logger.error('error creating session:', error);
      if (error instanceof PtyError) {
        res.status(500).json({ error: 'Failed to create session', details: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create session' });
      }
    }
  });

  // Get activity status for all sessions
  router.get('/sessions/activity', async (req, res) => {
    logger.debug('getting activity status for all sessions');
    try {
      const activityStatus: Record<string, SessionActivity> = {};

      // Get local sessions activity
      const localActivity = activityMonitor.getActivityStatus();
      Object.assign(activityStatus, localActivity);

      // If in HQ mode, get activity from remote servers
      if (isHQMode && remoteRegistry) {
        const remotes = remoteRegistry.getRemotes();

        // Fetch activity from each remote in parallel
        const remotePromises = remotes.map(async (remote) => {
          try {
            const response = await fetch(`${remote.url}/api/sessions/activity`, {
              headers: {
                Authorization: `Bearer ${remote.token}`,
              },
              signal: AbortSignal.timeout(5000),
            });

            if (response.ok) {
              const remoteActivity = await response.json();
              return {
                remote: {
                  id: remote.id,
                  name: remote.name,
                  url: remote.url,
                },
                activity: remoteActivity,
              };
            }
          } catch (error) {
            logger.error(`failed to get activity from remote ${remote.name}:`, error);
          }
          return null;
        });

        const remoteResults = await Promise.all(remotePromises);

        // Merge remote activity data
        for (const result of remoteResults) {
          if (result && result.activity) {
            // Merge remote activity data
            Object.assign(activityStatus, result.activity);
          }
        }
      }

      res.json(activityStatus);
    } catch (error) {
      logger.error('error getting activity status:', error);
      res.status(500).json({ error: 'Failed to get activity status' });
    }
  });

  // Get activity status for a specific session
  router.get('/sessions/:sessionId/activity', async (req, res) => {
    const sessionId = req.params.sessionId;

    try {
      // If in HQ mode, check if this is a remote session
      if (isHQMode && remoteRegistry) {
        const remote = remoteRegistry.getRemoteBySessionId(sessionId);
        if (remote) {
          // Forward to remote server
          try {
            const response = await fetch(`${remote.url}/api/sessions/${sessionId}/activity`, {
              headers: {
                Authorization: `Bearer ${remote.token}`,
              },
              signal: AbortSignal.timeout(5000),
            });

            if (!response.ok) {
              return res.status(response.status).json(await response.json());
            }

            return res.json(await response.json());
          } catch (error) {
            logger.error(`failed to get activity from remote ${remote.name}:`, error);
            return res.status(503).json({ error: 'Failed to reach remote server' });
          }
        }
      }

      // Local session handling
      const activityStatus = activityMonitor.getSessionActivityStatus(sessionId);
      if (!activityStatus) {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.json(activityStatus);
    } catch (error) {
      logger.error(`error getting activity status for session ${sessionId}:`, error);
      res.status(500).json({ error: 'Failed to get activity status' });
    }
  });

  // Get single session info
  router.get('/sessions/:sessionId', async (req, res) => {
    const sessionId = req.params.sessionId;
    logger.debug(`getting info for session ${sessionId}`);

    try {
      // If in HQ mode, check if this is a remote session
      if (isHQMode && remoteRegistry) {
        const remote = remoteRegistry.getRemoteBySessionId(sessionId);
        if (remote) {
          // Forward to remote server
          try {
            const response = await fetch(`${remote.url}/api/sessions/${sessionId}`, {
              headers: {
                Authorization: `Bearer ${remote.token}`,
              },
              signal: AbortSignal.timeout(5000),
            });

            if (!response.ok) {
              return res.status(response.status).json(await response.json());
            }

            return res.json(await response.json());
          } catch (error) {
            logger.error(`failed to get session info from remote ${remote.name}:`, error);
            return res.status(503).json({ error: 'Failed to reach remote server' });
          }
        }
      }

      // Local session handling
      const session = ptyManager.getSession(sessionId);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.json(session);
    } catch (error) {
      logger.error('error getting session info:', error);
      res.status(500).json({ error: 'Failed to get session info' });
    }
  });

  // Kill session (just kill the process)
  router.delete('/sessions/:sessionId', async (req, res) => {
    const sessionId = req.params.sessionId;
    logger.debug(`killing session ${sessionId}`);

    try {
      // If in HQ mode, check if this is a remote session
      if (isHQMode && remoteRegistry) {
        const remote = remoteRegistry.getRemoteBySessionId(sessionId);
        if (remote) {
          // Forward kill request to remote server
          try {
            const response = await fetch(`${remote.url}/api/sessions/${sessionId}`, {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${remote.token}`,
              },
              signal: AbortSignal.timeout(10000),
            });

            if (!response.ok) {
              return res.status(response.status).json(await response.json());
            }

            // Remote killed the session, now update our registry
            remoteRegistry.removeSessionFromRemote(sessionId);
            logger.log(chalk.yellow(`remote session ${sessionId} killed on ${remote.name}`));

            return res.json(await response.json());
          } catch (error) {
            logger.error(`failed to kill session on remote ${remote.name}:`, error);
            return res.status(503).json({ error: 'Failed to reach remote server' });
          }
        }
      }

      // Local session handling - just kill it, no registry updates needed
      const session = ptyManager.getSession(sessionId);

      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      await ptyManager.killSession(sessionId, 'SIGTERM');
      logger.log(chalk.yellow(`local session ${sessionId} killed`));

      res.json({ success: true, message: 'Session killed' });
    } catch (error) {
      logger.error('error killing session:', error);
      if (error instanceof PtyError) {
        res.status(500).json({ error: 'Failed to kill session', details: error.message });
      } else {
        res.status(500).json({ error: 'Failed to kill session' });
      }
    }
  });

  // Cleanup session files
  router.delete('/sessions/:sessionId/cleanup', async (req, res) => {
    const sessionId = req.params.sessionId;
    logger.debug(`cleaning up session ${sessionId} files`);

    try {
      // If in HQ mode, check if this is a remote session
      if (isHQMode && remoteRegistry) {
        const remote = remoteRegistry.getRemoteBySessionId(sessionId);
        if (remote) {
          // Forward cleanup request to remote server
          try {
            const response = await fetch(`${remote.url}/api/sessions/${sessionId}/cleanup`, {
              method: 'DELETE',
              headers: {
                Authorization: `Bearer ${remote.token}`,
              },
              signal: AbortSignal.timeout(10000),
            });

            if (!response.ok) {
              return res.status(response.status).json(await response.json());
            }

            // Remote cleaned up the session, now update our registry
            remoteRegistry.removeSessionFromRemote(sessionId);
            logger.log(chalk.yellow(`remote session ${sessionId} cleaned up on ${remote.name}`));

            return res.json(await response.json());
          } catch (error) {
            logger.error(`failed to cleanup session on remote ${remote.name}:`, error);
            return res.status(503).json({ error: 'Failed to reach remote server' });
          }
        }
      }

      // Local session handling - just cleanup, no registry updates needed
      ptyManager.cleanupSession(sessionId);
      logger.log(chalk.yellow(`local session ${sessionId} cleaned up`));

      res.json({ success: true, message: 'Session cleaned up' });
    } catch (error) {
      logger.error('error cleaning up session:', error);
      if (error instanceof PtyError) {
        res.status(500).json({ error: 'Failed to cleanup session', details: error.message });
      } else {
        res.status(500).json({ error: 'Failed to cleanup session' });
      }
    }
  });

  // Cleanup all exited sessions (local and remote)
  router.post('/cleanup-exited', async (req, res) => {
    logger.log(chalk.blue('cleaning up all exited sessions'));
    try {
      // Clean up local sessions
      const localCleanedSessions = ptyManager.cleanupExitedSessions();
      logger.log(chalk.green(`cleaned up ${localCleanedSessions.length} local exited sessions`));

      // Remove cleaned local sessions from remote registry if in HQ mode
      if (isHQMode && remoteRegistry) {
        for (const sessionId of localCleanedSessions) {
          remoteRegistry.removeSessionFromRemote(sessionId);
        }
      }

      let totalCleaned = localCleanedSessions.length;
      const remoteResults: Array<{ remoteName: string; cleaned: number; error?: string }> = [];

      // If in HQ mode, clean up sessions on all remotes
      if (isHQMode && remoteRegistry) {
        const allRemotes = remoteRegistry.getRemotes();

        // Clean up on each remote in parallel
        const remoteCleanupPromises = allRemotes.map(async (remote) => {
          try {
            const response = await fetch(`${remote.url}/api/cleanup-exited`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${remote.token}`,
              },
              signal: AbortSignal.timeout(10000), // 10 second timeout
            });

            if (response.ok) {
              const result = (await response.json()) as { cleanedSessions: string[] };
              const cleanedSessionIds = result.cleanedSessions || [];
              const cleanedCount = cleanedSessionIds.length;
              totalCleaned += cleanedCount;

              // Remove cleaned remote sessions from registry
              for (const sessionId of cleanedSessionIds) {
                remoteRegistry.removeSessionFromRemote(sessionId);
              }

              remoteResults.push({ remoteName: remote.name, cleaned: cleanedCount });
            } else {
              throw new Error(`HTTP ${response.status}`);
            }
          } catch (error) {
            logger.error(`failed to cleanup sessions on remote ${remote.name}:`, error);
            remoteResults.push({
              remoteName: remote.name,
              cleaned: 0,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

        await Promise.all(remoteCleanupPromises);
      }

      res.json({
        success: true,
        message: `${totalCleaned} exited sessions cleaned up across all servers`,
        localCleaned: localCleanedSessions.length,
        remoteResults,
      });
    } catch (error) {
      logger.error('error cleaning up exited sessions:', error);
      if (error instanceof PtyError) {
        res
          .status(500)
          .json({ error: 'Failed to cleanup exited sessions', details: error.message });
      } else {
        res.status(500).json({ error: 'Failed to cleanup exited sessions' });
      }
    }
  });

  // Get session plain text
  router.get('/sessions/:sessionId/text', async (req, res) => {
    const sessionId = req.params.sessionId;
    const includeStyles = req.query.styles !== undefined;
    logger.debug(`getting plain text for session ${sessionId}, styles=${includeStyles}`);

    try {
      // If in HQ mode, check if this is a remote session
      if (isHQMode && remoteRegistry) {
        const remote = remoteRegistry.getRemoteBySessionId(sessionId);
        if (remote) {
          // Forward text request to remote server
          try {
            const url = new URL(`${remote.url}/api/sessions/${sessionId}/text`);
            if (includeStyles) {
              url.searchParams.set('styles', '');
            }

            const response = await fetch(url.toString(), {
              headers: {
                Authorization: `Bearer ${remote.token}`,
              },
              signal: AbortSignal.timeout(5000),
            });

            if (!response.ok) {
              return res.status(response.status).json(await response.json());
            }

            // Forward the text response
            const text = await response.text();
            res.setHeader('Content-Type', 'text/plain');
            return res.send(text);
          } catch (error) {
            logger.error(`failed to get text from remote ${remote.name}:`, error);
            return res.status(503).json({ error: 'Failed to reach remote server' });
          }
        }
      }

      // Local session handling
      const session = ptyManager.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Get terminal buffer snapshot
      const snapshot = await terminalManager.getBufferSnapshot(sessionId);

      // Use shared formatter to convert cells to text
      const plainText = cellsToText(snapshot.cells, includeStyles);

      // Send as plain text
      res.setHeader('Content-Type', 'text/plain');
      res.send(plainText);
    } catch (error) {
      logger.error('error getting plain text:', error);
      res.status(500).json({ error: 'Failed to get terminal text' });
    }
  });

  // Get session buffer
  router.get('/sessions/:sessionId/buffer', async (req, res) => {
    const sessionId = req.params.sessionId;

    logger.debug(`client requesting buffer for session ${sessionId}`);

    try {
      // If in HQ mode, check if this is a remote session
      if (isHQMode && remoteRegistry) {
        const remote = remoteRegistry.getRemoteBySessionId(sessionId);
        if (remote) {
          // Forward buffer request to remote server
          try {
            const response = await fetch(`${remote.url}/api/sessions/${sessionId}/buffer`, {
              headers: {
                Authorization: `Bearer ${remote.token}`,
              },
              signal: AbortSignal.timeout(5000),
            });

            if (!response.ok) {
              return res.status(response.status).json(await response.json());
            }

            // Forward the binary buffer
            const buffer = await response.arrayBuffer();
            res.setHeader('Content-Type', 'application/octet-stream');
            return res.send(Buffer.from(buffer));
          } catch (error) {
            logger.error(`failed to get buffer from remote ${remote.name}:`, error);
            return res.status(503).json({ error: 'Failed to reach remote server' });
          }
        }
      }

      // Local session handling
      const session = ptyManager.getSession(sessionId);
      if (!session) {
        logger.error(`session ${sessionId} not found`);
        return res.status(404).json({ error: 'Session not found' });
      }

      // Get terminal buffer snapshot
      const snapshot = await terminalManager.getBufferSnapshot(sessionId);

      // Encode as binary buffer
      const buffer = terminalManager.encodeSnapshot(snapshot);

      logger.debug(
        `sending buffer for session ${sessionId}: ${buffer.length} bytes, ` +
          `dimensions: ${snapshot.cols}x${snapshot.rows}, cursor: (${snapshot.cursorX},${snapshot.cursorY})`
      );

      // Send as binary data
      res.setHeader('Content-Type', 'application/octet-stream');
      res.send(buffer);
    } catch (error) {
      logger.error('error getting buffer:', error);
      res.status(500).json({ error: 'Failed to get terminal buffer' });
    }
  });

  // Stream session output
  router.get('/sessions/:sessionId/stream', async (req, res) => {
    const sessionId = req.params.sessionId;
    const startTime = Date.now();

    logger.log(
      chalk.blue(
        `new SSE client connected to session ${sessionId} from ${req.get('User-Agent')?.substring(0, 50) || 'unknown'}`
      )
    );

    // If in HQ mode, check if this is a remote session
    if (isHQMode && remoteRegistry) {
      const remote = remoteRegistry.getRemoteBySessionId(sessionId);
      if (remote) {
        // Proxy SSE stream from remote server
        try {
          const controller = new AbortController();
          const response = await fetch(`${remote.url}/api/sessions/${sessionId}/stream`, {
            headers: {
              Authorization: `Bearer ${remote.token}`,
              Accept: 'text/event-stream',
            },
            signal: controller.signal,
          });

          if (!response.ok) {
            return res.status(response.status).json(await response.json());
          }

          // Set up SSE headers
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control',
            'X-Accel-Buffering': 'no',
          });

          // Proxy the stream
          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('No response body');
          }

          const decoder = new TextDecoder();
          const bytesProxied = { count: 0 };
          const pump = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                bytesProxied.count += value.length;
                const chunk = decoder.decode(value, { stream: true });
                res.write(chunk);
              }
            } catch (error) {
              logger.error(`stream proxy error for remote ${remote.name}:`, error);
            }
          };

          pump();

          // Clean up on disconnect
          req.on('close', () => {
            logger.log(
              chalk.yellow(
                `SSE client disconnected from remote session ${sessionId} (proxied ${bytesProxied.count} bytes)`
              )
            );
            controller.abort();
          });

          return;
        } catch (error) {
          logger.error(`failed to stream from remote ${remote.name}:`, error);
          return res.status(503).json({ error: 'Failed to reach remote server' });
        }
      }
    }

    // Local session handling
    const session = ptyManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const sessionPaths = ptyManager.getSessionPaths(sessionId);
    if (!sessionPaths) {
      return res.status(404).json({ error: 'Session paths not found' });
    }

    const streamPath = sessionPaths.stdoutPath;
    if (!streamPath || !fs.existsSync(streamPath)) {
      logger.warn(`stream path not found for session ${sessionId}`);
      return res.status(404).json({ error: 'Session stream not found' });
    }

    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
      'Content-Encoding': 'identity', // Prevent compression
    });

    // Force headers to be sent immediately
    res.flushHeaders();

    // Send initial connection event
    res.write(':ok\n\n');
    // @ts-expect-error - flush exists but not in types
    if (res.flush) res.flush();

    // Add client to stream watcher
    streamWatcher.addClient(sessionId, streamPath, res);
    logger.debug(`SSE stream setup completed in ${Date.now() - startTime}ms`);

    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(':heartbeat\n\n');
      // @ts-expect-error - flush exists but not in types
      if (res.flush) res.flush();
    }, 30000);

    // Track if cleanup has been called to avoid duplicate calls
    let cleanedUp = false;
    const cleanup = () => {
      if (!cleanedUp) {
        cleanedUp = true;
        logger.log(chalk.yellow(`SSE client disconnected from session ${sessionId}`));
        streamWatcher.removeClient(sessionId, res);
        clearInterval(heartbeat);
      }
    };

    // Clean up on disconnect - listen to all possible events
    req.on('close', cleanup);
    req.on('error', (err) => {
      logger.error(`SSE client error for session ${sessionId}:`, err);
      cleanup();
    });
    res.on('close', cleanup);
    res.on('finish', cleanup);
  });

  // Send input to session
  router.post('/sessions/:sessionId/input', async (req, res) => {
    const sessionId = req.params.sessionId;
    const { text, key } = req.body;

    // Validate that only one of text or key is provided
    if ((text === undefined && key === undefined) || (text !== undefined && key !== undefined)) {
      logger.warn(
        `invalid input request for session ${sessionId}: both or neither text/key provided`
      );
      return res.status(400).json({ error: 'Either text or key must be provided, but not both' });
    }

    if (text !== undefined && typeof text !== 'string') {
      logger.warn(`invalid input request for session ${sessionId}: text is not a string`);
      return res.status(400).json({ error: 'Text must be a string' });
    }

    if (key !== undefined && typeof key !== 'string') {
      logger.warn(`invalid input request for session ${sessionId}: key is not a string`);
      return res.status(400).json({ error: 'Key must be a string' });
    }

    try {
      // If in HQ mode, check if this is a remote session
      if (isHQMode && remoteRegistry) {
        const remote = remoteRegistry.getRemoteBySessionId(sessionId);
        if (remote) {
          // Forward input to remote server
          try {
            const response = await fetch(`${remote.url}/api/sessions/${sessionId}/input`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${remote.token}`,
              },
              body: JSON.stringify(req.body),
              signal: AbortSignal.timeout(5000),
            });

            if (!response.ok) {
              return res.status(response.status).json(await response.json());
            }

            return res.json(await response.json());
          } catch (error) {
            logger.error(`failed to send input to remote ${remote.name}:`, error);
            return res.status(503).json({ error: 'Failed to reach remote server' });
          }
        }
      }

      // Local session handling
      const session = ptyManager.getSession(sessionId);
      if (!session) {
        logger.error(`session ${sessionId} not found for input`);
        return res.status(404).json({ error: 'Session not found' });
      }

      if (session.status !== 'running') {
        logger.error(`session ${sessionId} is not running (status: ${session.status})`);
        return res.status(400).json({ error: 'Session is not running' });
      }

      const inputData = text !== undefined ? { text } : { key };
      logger.debug(`sending input to session ${sessionId}: ${JSON.stringify(inputData)}`);

      ptyManager.sendInput(sessionId, inputData);
      res.json({ success: true });
    } catch (error) {
      logger.error('error sending input:', error);
      if (error instanceof PtyError) {
        res.status(500).json({ error: 'Failed to send input', details: error.message });
      } else {
        res.status(500).json({ error: 'Failed to send input' });
      }
    }
  });

  // Resize session
  router.post('/sessions/:sessionId/resize', async (req, res) => {
    const sessionId = req.params.sessionId;
    const { cols, rows } = req.body;

    if (typeof cols !== 'number' || typeof rows !== 'number') {
      logger.warn(`invalid resize request for session ${sessionId}: cols/rows not numbers`);
      return res.status(400).json({ error: 'Cols and rows must be numbers' });
    }

    if (cols < 1 || rows < 1 || cols > 1000 || rows > 1000) {
      logger.warn(
        `invalid resize request for session ${sessionId}: cols=${cols}, rows=${rows} out of range`
      );
      return res.status(400).json({ error: 'Cols and rows must be between 1 and 1000' });
    }

    logger.log(chalk.blue(`resizing session ${sessionId} to ${cols}x${rows}`));

    try {
      // If in HQ mode, check if this is a remote session
      if (isHQMode && remoteRegistry) {
        const remote = remoteRegistry.getRemoteBySessionId(sessionId);
        if (remote) {
          // Forward resize to remote server
          try {
            const response = await fetch(`${remote.url}/api/sessions/${sessionId}/resize`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${remote.token}`,
              },
              body: JSON.stringify({ cols, rows }),
              signal: AbortSignal.timeout(5000),
            });

            if (!response.ok) {
              return res.status(response.status).json(await response.json());
            }

            return res.json(await response.json());
          } catch (error) {
            logger.error(`failed to resize session on remote ${remote.name}:`, error);
            return res.status(503).json({ error: 'Failed to reach remote server' });
          }
        }
      }

      // Local session handling
      const session = ptyManager.getSession(sessionId);
      if (!session) {
        logger.warn(`session ${sessionId} not found for resize`);
        return res.status(404).json({ error: 'Session not found' });
      }

      if (session.status !== 'running') {
        logger.warn(`session ${sessionId} is not running (status: ${session.status})`);
        return res.status(400).json({ error: 'Session is not running' });
      }

      // Resize the session
      ptyManager.resizeSession(sessionId, cols, rows);
      logger.log(chalk.green(`session ${sessionId} resized to ${cols}x${rows}`));

      res.json({ success: true, cols, rows });
    } catch (error) {
      logger.error('error resizing session via PTY service:', error);
      if (error instanceof PtyError) {
        res.status(500).json({ error: 'Failed to resize session', details: error.message });
      } else {
        res.status(500).json({ error: 'Failed to resize session' });
      }
    }
  });

  // Reset terminal size (for external terminals)
  router.post('/sessions/:sessionId/reset-size', async (req, res) => {
    const { sessionId } = req.params;

    try {
      // In HQ mode, forward to remote if session belongs to one
      if (remoteRegistry) {
        const remote = remoteRegistry.getRemoteBySessionId(sessionId);
        if (remote) {
          logger.debug(`forwarding reset-size to remote ${remote.id}`);
          const response = await fetch(`${remote.url}/api/sessions/${sessionId}/reset-size`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${remote.token}`,
            },
          });

          if (!response.ok) {
            const error = await response.json();
            return res.status(response.status).json(error);
          }

          const result = await response.json();
          return res.json(result);
        }
      }

      logger.log(chalk.cyan(`resetting terminal size for session ${sessionId}`));

      // Check if session exists
      const session = ptyManager.getSession(sessionId);
      if (!session) {
        logger.error(`session ${sessionId} not found for reset-size`);
        return res.status(404).json({ error: 'Session not found' });
      }

      // Check if session is running
      if (session.status !== 'running') {
        logger.error(`session ${sessionId} is not running (status: ${session.status})`);
        return res.status(400).json({ error: 'Session is not running' });
      }

      // Reset the session size
      ptyManager.resetSessionSize(sessionId);
      logger.log(chalk.green(`session ${sessionId} size reset to terminal size`));

      res.json({ success: true });
    } catch (error) {
      logger.error('error resetting session size via PTY service:', error);
      if (error instanceof PtyError) {
        res.status(500).json({ error: 'Failed to reset session size', details: error.message });
      } else {
        res.status(500).json({ error: 'Failed to reset session size' });
      }
    }
  });

  return router;
}

// Generate a unique session ID
function generateSessionId(): string {
  // Generate UUID v4
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }

  // Set version (4) and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  // Convert to hex string with dashes
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

// Request terminal spawn from Mac app
async function requestTerminalSpawn(params: {
  sessionId: string;
  sessionName: string;
  command: string[];
  workingDir: string;
}): Promise<{ success: boolean; error?: string }> {
  const socketPath = '/tmp/vibetunnel-terminal.sock';

  // Check if socket exists
  if (!fs.existsSync(socketPath)) {
    return {
      success: false,
      error: 'Terminal spawn service not available. Is the Mac app running?',
    };
  }

  const spawnRequest = {
    workingDir: params.workingDir,
    sessionId: params.sessionId,
    command: params.command.join(' '),
    terminal: null, // Let Mac app use default terminal
  };

  return new Promise((resolve) => {
    const client = net.createConnection(socketPath, () => {
      logger.debug(`connected to terminal spawn service for session ${params.sessionId}`);
      client.write(JSON.stringify(spawnRequest));
    });

    client.on('data', (data) => {
      try {
        const response = JSON.parse(data.toString());
        logger.debug('terminal spawn response:', response);
        resolve({ success: response.success, error: response.error });
      } catch (error) {
        logger.error('failed to parse terminal spawn response:', error);
        resolve({ success: false, error: 'Invalid response from terminal spawn service' });
      }
      client.end();
    });

    client.on('error', (error) => {
      logger.error('failed to connect to terminal spawn service:', error);
      resolve({
        success: false,
        error: `Connection failed: ${error.message}`,
      });
    });

    client.on('timeout', () => {
      client.destroy();
      resolve({ success: false, error: 'Terminal spawn request timed out' });
    });

    client.setTimeout(10000); // 10 second timeout
    logger.debug(`requesting terminal spawn from Mac app for session ${params.sessionId}`);
  });
}
