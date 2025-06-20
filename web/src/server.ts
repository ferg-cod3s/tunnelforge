import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { PtyService, PtyError } from './pty/index.js';
import { TerminalManager } from './terminal-manager.js';
import { StreamWatcher } from './stream-watcher.js';

type BufferSnapshot = Awaited<ReturnType<TerminalManager['getBufferSnapshot']>>;

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// tty-fwd binary path - check multiple possible locations
const possibleTtyFwdPaths = [
  path.resolve(__dirname, '..', '..', 'tty-fwd', 'target', 'release', 'tty-fwd'),
  path.resolve(__dirname, '..', '..', '..', 'tty-fwd', 'target', 'release', 'tty-fwd'),
  'tty-fwd', // System PATH
];

let TTY_FWD_PATH = '';
for (const pathToCheck of possibleTtyFwdPaths) {
  if (fs.existsSync(pathToCheck)) {
    TTY_FWD_PATH = pathToCheck;
    break;
  }
}

if (!TTY_FWD_PATH) {
  console.error('tty-fwd binary not found. Please ensure it is built and available.');
  process.exit(1);
}

const TTY_FWD_CONTROL_DIR =
  process.env.TTY_FWD_CONTROL_DIR || path.join(os.homedir(), '.vibetunnel/control');

// Initialize PTY service with configuration
const ptyService = new PtyService({
  implementation: (process.env.PTY_IMPLEMENTATION as 'node-pty' | 'tty-fwd' | 'auto') || 'auto',
  controlPath: TTY_FWD_CONTROL_DIR,
  fallbackToTtyFwd: process.env.PTY_FALLBACK_TTY_FWD !== 'false',
  ttyFwdPath: TTY_FWD_PATH || undefined,
});

// Initialize Terminal Manager for server-side terminal state
const terminalManager = new TerminalManager(TTY_FWD_CONTROL_DIR);

// Initialize Stream Watcher for efficient file streaming
const streamWatcher = new StreamWatcher();

// Ensure control directory exists
if (!fs.existsSync(TTY_FWD_CONTROL_DIR)) {
  fs.mkdirSync(TTY_FWD_CONTROL_DIR, { recursive: true });
  console.log(`Created control directory: ${TTY_FWD_CONTROL_DIR}`);
} else {
  console.log(`Using existing control directory: ${TTY_FWD_CONTROL_DIR}`);
}

console.log(`PTY Service: Using ${ptyService.getCurrentImplementation()} implementation`);
if (ptyService.isUsingTtyFwd()) {
  console.log(`Using tty-fwd at: ${TTY_FWD_PATH}`);
}
console.log(`Control directory: ${TTY_FWD_CONTROL_DIR}`);

// Helper function to resolve paths with ~ expansion
function resolvePath(inputPath: string, fallback?: string): string {
  if (!inputPath) {
    return fallback || process.cwd();
  }

  if (inputPath.startsWith('~')) {
    return path.join(os.homedir(), inputPath.slice(1));
  }

  return path.resolve(inputPath);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Hot reload functionality for development
const hotReloadClients = new Set<WebSocket>();

// === SESSION MANAGEMENT ===

// List all sessions
app.get('/api/sessions', async (req, res) => {
  try {
    const sessions = ptyService.listSessions();

    const sessionData = sessions.map((sessionInfo) => {
      // Get actual last modified time from stream-out file
      let lastModified = sessionInfo.started_at || new Date().toISOString();
      try {
        if (fs.existsSync(sessionInfo['stream-out'])) {
          const stats = fs.statSync(sessionInfo['stream-out']);
          lastModified = stats.mtime.toISOString();
        }
      } catch (_e) {
        // Use started_at as fallback
      }

      return {
        id: sessionInfo.session_id,
        command: Array.isArray(sessionInfo.cmdline)
          ? sessionInfo.cmdline.join(' ')
          : sessionInfo.cmdline || '',
        workingDir: sessionInfo.cwd,
        name: sessionInfo.name,
        status: sessionInfo.status,
        exitCode: sessionInfo.exit_code,
        startedAt: sessionInfo.started_at,
        lastModified: lastModified,
        pid: sessionInfo.pid,
        waiting: sessionInfo.waiting,
      };
    });

    // Sort by lastModified, most recent first
    sessionData.sort(
      (a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
    );
    res.json(sessionData);
  } catch (error) {
    console.error('Failed to list sessions:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// Create new session
app.post('/api/sessions', async (req, res) => {
  try {
    const { command, workingDir, name } = req.body;

    if (!command || !Array.isArray(command) || command.length === 0) {
      return res.status(400).json({ error: 'Command array is required and cannot be empty' });
    }

    const sessionName = name || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const cwd = resolvePath(workingDir, process.cwd());

    console.log(`Creating session with PTY service: ${command.join(' ')} in ${cwd}`);

    const result = await ptyService.createSession(command, {
      sessionName,
      workingDir: cwd,
      term: 'xterm-256color',
      cols: 80,
      rows: 24,
    });

    console.log(`Session created with ID: ${result.sessionId}`);
    res.json({ sessionId: result.sessionId });
  } catch (error) {
    console.error('Error creating session:', error);
    if (error instanceof PtyError) {
      res.status(500).json({ error: 'Failed to create session', details: error.message });
    } else {
      res.status(500).json({ error: 'Failed to create session' });
    }
  }
});

// Kill session (just kill the process)
app.delete('/api/sessions/:sessionId', async (req, res) => {
  const sessionId = req.params.sessionId;

  try {
    const session = ptyService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await ptyService.killSession(sessionId, 'SIGTERM');
    console.log(`Session ${sessionId} killed`);

    res.json({ success: true, message: 'Session killed' });
  } catch (error) {
    console.error('Error killing session:', error);
    if (error instanceof PtyError) {
      res.status(500).json({ error: 'Failed to kill session', details: error.message });
    } else {
      res.status(500).json({ error: 'Failed to kill session' });
    }
  }
});

// Cleanup session files
app.delete('/api/sessions/:sessionId/cleanup', async (req, res) => {
  const sessionId = req.params.sessionId;

  try {
    ptyService.cleanupSession(sessionId);
    console.log(`Session ${sessionId} cleaned up`);

    res.json({ success: true, message: 'Session cleaned up' });
  } catch (error) {
    console.error('Error cleaning up session:', error);
    if (error instanceof PtyError) {
      res.status(500).json({ error: 'Failed to cleanup session', details: error.message });
    } else {
      res.status(500).json({ error: 'Failed to cleanup session' });
    }
  }
});

// Cleanup all exited sessions
app.post('/api/cleanup-exited', async (req, res) => {
  try {
    const cleanedSessions = ptyService.cleanupExitedSessions();
    console.log(`Cleaned up ${cleanedSessions.length} exited sessions`);

    res.json({
      success: true,
      message: `${cleanedSessions.length} exited sessions cleaned up`,
      cleanedSessions,
    });
  } catch (error) {
    console.error('Error cleaning up exited sessions:', error);
    if (error instanceof PtyError) {
      res.status(500).json({ error: 'Failed to cleanup exited sessions', details: error.message });
    } else {
      res.status(500).json({ error: 'Failed to cleanup exited sessions' });
    }
  }
});

// === TERMINAL I/O ===

// Live streaming cast file for XTerm renderer
app.get('/api/sessions/:sessionId/stream', async (req, res) => {
  const sessionId = req.params.sessionId;
  const streamOutPath = path.join(TTY_FWD_CONTROL_DIR, sessionId, 'stream-out');

  if (!fs.existsSync(streamOutPath)) {
    return res.status(404).json({ error: 'Session not found' });
  }

  console.log(
    `[STREAM] New SSE client connected to session ${sessionId} from ${req.get('User-Agent')?.substring(0, 50) || 'unknown'}`
  );

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  // Add client to stream watcher
  streamWatcher.addClient(sessionId, streamOutPath, res);

  // Cleanup when client disconnects
  const cleanup = () => {
    streamWatcher.removeClient(sessionId, res);
  };

  req.on('close', cleanup);
  req.on('aborted', cleanup);
  req.on('error', cleanup);
  res.on('close', cleanup);
  res.on('finish', cleanup);
});

// Get session snapshot (optimized cast with only content after last clear)
app.get('/api/sessions/:sessionId/snapshot', (req, res) => {
  const sessionId = req.params.sessionId;
  const streamOutPath = path.join(TTY_FWD_CONTROL_DIR, sessionId, 'stream-out');

  if (!fs.existsSync(streamOutPath)) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    const content = fs.readFileSync(streamOutPath, 'utf8');
    const lines = content.trim().split('\n');

    let header = null;
    const allEvents = [];

    // Parse all lines first
    for (const line of lines) {
      if (line.trim()) {
        try {
          const parsed = JSON.parse(line);

          // Header line
          if (parsed.version && parsed.width && parsed.height) {
            header = parsed;
          }
          // Event line [timestamp, type, data]
          else if (Array.isArray(parsed) && parsed.length >= 3) {
            allEvents.push(parsed);
          }
        } catch (_e) {
          // Skip invalid lines
        }
      }
    }

    // Find the last clear command (usually "\x1b[2J\x1b[3J\x1b[H" or similar)
    let lastClearIndex = -1;
    let lastResizeBeforeClear = null;

    for (let i = allEvents.length - 1; i >= 0; i--) {
      const event = allEvents[i];
      if (event[1] === 'o' && event[2]) {
        // Look for clear screen escape sequences
        const data = event[2];
        if (
          data.includes('\x1b[2J') || // Clear entire screen
          data.includes('\x1b[H\x1b[2J') || // Home cursor + clear screen
          data.includes('\x1b[3J') || // Clear scrollback
          data.includes('\x1bc') // Full reset
        ) {
          lastClearIndex = i;
          break;
        }
      }
    }

    // Find the last resize event before the clear (if any)
    if (lastClearIndex > 0) {
      for (let i = lastClearIndex - 1; i >= 0; i--) {
        const event = allEvents[i];
        if (event[1] === 'r') {
          lastResizeBeforeClear = event;
          break;
        }
      }
    }

    // Build optimized event list
    const optimizedEvents = [];

    // Include last resize before clear if found
    if (lastResizeBeforeClear) {
      optimizedEvents.push([0, lastResizeBeforeClear[1], lastResizeBeforeClear[2]]);
    }

    // Include events after the last clear (or all events if no clear found)
    const startIndex = lastClearIndex >= 0 ? lastClearIndex : 0;
    for (let i = startIndex; i < allEvents.length; i++) {
      const event = allEvents[i];
      optimizedEvents.push([0, event[1], event[2]]);
    }

    // Build the complete cast
    const cast = [];

    // Add header if found, otherwise use default
    if (header) {
      cast.push(JSON.stringify(header));
    } else {
      cast.push(
        JSON.stringify({
          version: 2,
          width: 80,
          height: 24,
          timestamp: Math.floor(Date.now() / 1000),
          env: { TERM: 'xterm-256color' },
        })
      );
    }

    // Add optimized events
    optimizedEvents.forEach((event) => {
      cast.push(JSON.stringify(event));
    });

    const originalSize = allEvents.length;
    const optimizedSize = optimizedEvents.length;
    const reduction =
      originalSize > 0 ? (((originalSize - optimizedSize) / originalSize) * 100).toFixed(1) : '0';

    console.log(
      `Snapshot for ${sessionId}: ${originalSize} events → ${optimizedSize} events (${reduction}% reduction)`
    );

    res.setHeader('Content-Type', 'text/plain');
    res.send(cast.join('\n'));
  } catch (_error) {
    console.error('Error reading session snapshot:', _error);
    res.status(500).json({ error: 'Failed to read session snapshot' });
  }
});

// Get session buffer stats
app.get('/api/sessions/:sessionId/buffer/stats', async (req, res) => {
  const sessionId = req.params.sessionId;

  try {
    // Validate session exists
    const session = ptyService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if stream file exists
    const streamOutPath = path.join(TTY_FWD_CONTROL_DIR, sessionId, 'stream-out');
    if (!fs.existsSync(streamOutPath)) {
      return res.status(404).json({ error: 'Session stream not found' });
    }

    // Get terminal stats
    const stats = await terminalManager.getBufferStats(sessionId);

    // Add last modified time from stream file
    const fileStats = fs.statSync(streamOutPath);
    stats.lastModified = fileStats.mtime.toISOString();

    res.json(stats);
  } catch (error) {
    console.error('Error getting session buffer stats:', error);
    res.status(500).json({ error: 'Failed to get session buffer stats' });
  }
});

// Get session buffer in binary or JSON format
app.get('/api/sessions/:sessionId/buffer', async (req, res) => {
  const sessionId = req.params.sessionId;
  const format = (req.query.format as string) || 'binary';

  try {
    // Validate session exists
    const session = ptyService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if stream file exists
    const streamOutPath = path.join(TTY_FWD_CONTROL_DIR, sessionId, 'stream-out');
    if (!fs.existsSync(streamOutPath)) {
      return res.status(404).json({ error: 'Session stream not found' });
    }

    // Get full buffer snapshot
    const snapshot = await terminalManager.getBufferSnapshot(sessionId);

    if (format === 'json') {
      // Send JSON response
      res.json(snapshot);
    } else {
      // Encode to binary format
      const binaryData = terminalManager.encodeSnapshot(snapshot);

      // Send binary response
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', binaryData.length.toString());
      res.send(binaryData);
    }
  } catch (error) {
    console.error('Error getting session buffer:', error);
    res.status(500).json({ error: 'Failed to get session buffer' });
  }
});

// Send input to session
app.post('/api/sessions/:sessionId/input', async (req, res) => {
  const sessionId = req.params.sessionId;
  const { text } = req.body;

  if (text === undefined || text === null) {
    return res.status(400).json({ error: 'Text is required' });
  }

  try {
    // Validate session exists
    const session = ptyService.getSession(sessionId);
    if (!session) {
      console.error(`Session ${sessionId} not found in active sessions`);
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'running') {
      console.error(`Session ${sessionId} is not running (status: ${session.status})`);
      return res.status(400).json({ error: 'Session is not running' });
    }

    // Check if this is a special key
    const specialKeys = [
      'arrow_up',
      'arrow_down',
      'arrow_left',
      'arrow_right',
      'escape',
      'enter',
      'ctrl_enter',
      'shift_enter',
    ];
    const isSpecialKey = specialKeys.includes(text);

    if (isSpecialKey) {
      ptyService.sendInput(sessionId, {
        key: text as
          | 'arrow_up'
          | 'arrow_down'
          | 'arrow_left'
          | 'arrow_right'
          | 'escape'
          | 'enter'
          | 'ctrl_enter'
          | 'shift_enter',
      });
    } else {
      ptyService.sendInput(sessionId, { text });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error sending input via PTY service:', error);
    if (error instanceof PtyError) {
      res.status(500).json({ error: 'Failed to send input', details: error.message });
    } else {
      res.status(500).json({ error: 'Failed to send input' });
    }
  }
});

// Resize session terminal
app.post('/api/sessions/:sessionId/resize', async (req, res) => {
  const sessionId = req.params.sessionId;
  const { cols, rows } = req.body;

  if (typeof cols !== 'number' || typeof rows !== 'number') {
    return res.status(400).json({ error: 'Cols and rows must be numbers' });
  }

  if (cols < 1 || rows < 1 || cols > 1000 || rows > 1000) {
    return res.status(400).json({ error: 'Cols and rows must be between 1 and 1000' });
  }

  console.log(`Resizing session ${sessionId} to ${cols}x${rows}`);

  try {
    // Validate session exists
    const session = ptyService.getSession(sessionId);
    if (!session) {
      console.error(`Session ${sessionId} not found for resize`);
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.status !== 'running') {
      console.error(`Session ${sessionId} is not running (status: ${session.status})`);
      return res.status(400).json({ error: 'Session is not running' });
    }

    // Resize the session
    ptyService.resizeSession(sessionId, cols, rows);
    console.log(`Successfully resized session ${sessionId} to ${cols}x${rows}`);

    res.json({ success: true, cols, rows });
  } catch (error) {
    console.error('Error resizing session via PTY service:', error);
    if (error instanceof PtyError) {
      res.status(500).json({ error: 'Failed to resize session', details: error.message });
    } else {
      res.status(500).json({ error: 'Failed to resize session' });
    }
  }
});

// PTY service status endpoint
app.get('/api/pty/status', (req, res) => {
  try {
    const status = {
      implementation: ptyService.getCurrentImplementation(),
      usingNodePty: ptyService.isUsingNodePty(),
      usingTtyFwd: ptyService.isUsingTtyFwd(),
      activeSessionCount: ptyService.getActiveSessionCount(),
      controlPath: ptyService.getControlPath(),
      config: ptyService.getConfig(),
    };
    res.json(status);
  } catch (error) {
    console.error('Error getting PTY service status:', error);
    res.status(500).json({ error: 'Failed to get PTY service status' });
  }
});

// === CAST FILE SERVING ===

// Serve test cast file
app.get('/api/test-cast', (req, res) => {
  const testCastPath = path.join(__dirname, '..', 'public', 'stream-out');

  try {
    if (fs.existsSync(testCastPath)) {
      res.setHeader('Content-Type', 'text/plain');
      const content = fs.readFileSync(testCastPath, 'utf8');
      res.send(content);
    } else {
      res.status(404).json({ error: 'Test cast file not found' });
    }
  } catch (_error) {
    console.error('Error serving test cast file:', _error);
    res.status(500).json({ error: 'Failed to serve test cast file' });
  }
});

// === FILE SYSTEM ===

// Directory listing for file browser
app.get('/api/fs/browse', (req, res) => {
  const dirPath = (req.query.path as string) || '~';

  try {
    const expandedPath = resolvePath(dirPath, '~');

    if (!fs.existsSync(expandedPath)) {
      return res.status(404).json({ error: 'Directory not found' });
    }

    const stats = fs.statSync(expandedPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory' });
    }

    const files = fs.readdirSync(expandedPath).map((name) => {
      const filePath = path.join(expandedPath, name);
      const fileStats = fs.statSync(filePath);

      return {
        name,
        created: fileStats.birthtime.toISOString(),
        lastModified: fileStats.mtime.toISOString(),
        size: fileStats.size,
        isDir: fileStats.isDirectory(),
      };
    });

    res.json({
      absolutePath: expandedPath,
      files: files.sort((a, b) => {
        // Directories first, then files
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        return a.name.localeCompare(b.name);
      }),
    });
  } catch (_error) {
    console.error('Error listing directory:', _error);
    res.status(500).json({ error: 'Failed to list directory' });
  }
});

// Create directory
app.post('/api/mkdir', (req, res) => {
  try {
    const { path: dirPath, name } = req.body;

    if (!dirPath || !name) {
      return res.status(400).json({ error: 'Missing path or name parameter' });
    }

    // Validate directory name (no path separators, no hidden files starting with .)
    if (name.includes('/') || name.includes('\\') || name.startsWith('.')) {
      return res.status(400).json({ error: 'Invalid directory name' });
    }

    // Expand tilde in path
    const expandedPath = dirPath.startsWith('~')
      ? path.join(os.homedir(), dirPath.slice(1))
      : path.resolve(dirPath);

    // Security check: ensure we're not trying to access outside allowed areas
    const allowedBasePaths = [os.homedir(), process.cwd(), os.tmpdir()];
    const isAllowed = allowedBasePaths.some((basePath) =>
      expandedPath.startsWith(path.resolve(basePath))
    );

    if (!isAllowed) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if parent directory exists
    if (!fs.existsSync(expandedPath)) {
      return res.status(404).json({ error: 'Parent directory not found' });
    }

    const stats = fs.statSync(expandedPath);
    if (!stats.isDirectory()) {
      return res.status(400).json({ error: 'Parent path is not a directory' });
    }

    const newDirPath = path.join(expandedPath, name);

    // Check if directory already exists
    if (fs.existsSync(newDirPath)) {
      return res.status(409).json({ error: 'Directory already exists' });
    }

    // Create the directory
    fs.mkdirSync(newDirPath, { recursive: false });

    res.json({
      success: true,
      path: newDirPath,
      message: `Directory '${name}' created successfully`,
    });
  } catch (_error) {
    console.error('Error creating directory:', _error);
    res.status(500).json({ error: 'Failed to create directory' });
  }
});

// === WEBSOCKETS ===

// Buffer magic byte
const BUFFER_MAGIC_BYTE = 0xbf;

// Handle buffer WebSocket connections
function handleBufferWebSocket(ws: WebSocket) {
  const subscriptions = new Map<string, () => void>();
  let pingInterval: NodeJS.Timeout | null = null;
  let lastPong = Date.now();

  console.log('[BUFFER WS] New client connected');

  // Start ping/pong heartbeat
  pingInterval = setInterval(() => {
    if (Date.now() - lastPong > 30000) {
      // No pong received for 30 seconds, close connection
      console.log('[BUFFER WS] Client timed out, closing connection');
      ws.close();
      return;
    }

    ws.send(JSON.stringify({ type: 'ping' }));
  }, 10000); // Ping every 10 seconds

  // Handle incoming messages
  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'subscribe': {
          const { sessionId } = message;
          if (!sessionId) {
            ws.send(JSON.stringify({ type: 'error', message: 'sessionId required' }));
            return;
          }

          // Check if already subscribed
          if (subscriptions.has(sessionId)) {
            console.log(`[BUFFER WS] Already subscribed to ${sessionId}`);
            return;
          }

          console.log(`[BUFFER WS] Subscribing to session ${sessionId}`);

          try {
            // Subscribe to buffer changes
            const unsubscribe = await terminalManager.subscribeToBufferChanges(
              sessionId,
              (sessionId: string, snapshot: BufferSnapshot) => {
                // Send binary buffer update
                sendBinaryBuffer(ws, sessionId, snapshot);
              }
            );

            subscriptions.set(sessionId, unsubscribe);

            // Send initial buffer state
            const initialSnapshot = await terminalManager.getBufferSnapshot(sessionId);
            sendBinaryBuffer(ws, sessionId, initialSnapshot);
          } catch (error) {
            console.error(`[BUFFER WS] Error subscribing to ${sessionId}:`, error);
            ws.send(JSON.stringify({ type: 'error', message: 'Failed to subscribe to session' }));
          }
          break;
        }

        case 'unsubscribe': {
          const { sessionId } = message;
          if (!sessionId) {
            ws.send(JSON.stringify({ type: 'error', message: 'sessionId required' }));
            return;
          }

          const unsubscribe = subscriptions.get(sessionId);
          if (unsubscribe) {
            console.log(`[BUFFER WS] Unsubscribing from session ${sessionId}`);
            unsubscribe();
            subscriptions.delete(sessionId);
          }
          break;
        }

        case 'pong': {
          lastPong = Date.now();
          break;
        }

        default:
          ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
      }
    } catch (error) {
      console.error('[BUFFER WS] Error handling message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  // Clean up on disconnect
  ws.on('close', () => {
    console.log('[BUFFER WS] Client disconnected');

    // Unsubscribe from all sessions
    subscriptions.forEach((unsubscribe) => unsubscribe());
    subscriptions.clear();

    // Clear ping interval
    if (pingInterval) {
      clearInterval(pingInterval);
    }
  });

  ws.on('error', (error) => {
    console.error('[BUFFER WS] WebSocket error:', error);
  });
}

// Send binary buffer to WebSocket client
function sendBinaryBuffer(ws: WebSocket, sessionId: string, snapshot: BufferSnapshot) {
  try {
    // Encode buffer
    const bufferData = terminalManager.encodeSnapshot(snapshot);

    // Create binary message: [magic byte][4 bytes: session ID length][session ID][buffer data]
    const sessionIdBuffer = Buffer.from(sessionId, 'utf8');
    const message = Buffer.allocUnsafe(1 + 4 + sessionIdBuffer.length + bufferData.length);

    let offset = 0;

    // Magic byte
    message.writeUInt8(BUFFER_MAGIC_BYTE, offset);
    offset += 1;

    // Session ID length (4 bytes, little-endian)
    message.writeUInt32LE(sessionIdBuffer.length, offset);
    offset += 4;

    // Session ID
    sessionIdBuffer.copy(message, offset);
    offset += sessionIdBuffer.length;

    // Buffer data
    bufferData.copy(message, offset);

    // Send binary message
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  } catch (error) {
    console.error(`[BUFFER WS] Error sending buffer for ${sessionId}:`, error);
  }
}

// WebSocket connections
wss.on('connection', (ws, req) => {
  const url = new URL(req.url ?? '', `http://${req.headers.host}`);
  const isHotReload = url.searchParams.get('hotReload') === 'true';

  if (isHotReload) {
    hotReloadClients.add(ws);
    ws.on('close', () => {
      hotReloadClients.delete(ws);
    });
    return;
  }

  // Check if this is a buffer subscription connection
  if (url.pathname === '/buffers') {
    handleBufferWebSocket(ws);
    return;
  }

  ws.close(1008, 'Unknown WebSocket endpoint');
});

// Hot reload file watching in development
if (process.env.NODE_ENV !== 'production') {
  const chokidar = require('chokidar');
  const watcher = chokidar.watch(['public/**/*', 'src/**/*'], {
    ignored: /node_modules/,
    persistent: true,
  });

  watcher.on('change', (path: string) => {
    console.log(`File changed: ${path}`);
    hotReloadClients.forEach((ws: WebSocket) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: 'reload' }));
      }
    });
  });
}

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`VibeTunnel New Server running on http://localhost:${PORT}`);
    console.log(`Using tty-fwd: ${TTY_FWD_PATH}`);
  });

  // Cleanup old terminals every 5 minutes
  setInterval(
    () => {
      terminalManager.cleanup(30 * 60 * 1000); // 30 minutes
    },
    5 * 60 * 1000
  );
}

// Export for testing
export { app, server, wss };
