import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { logFromModule } from '../utils/logger.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('logs');

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface LogRoutesConfig {
  // Add any config if needed
}

interface ClientLogRequest {
  level: 'log' | 'warn' | 'error' | 'debug';
  module: string;
  args: unknown[];
}

export function createLogRoutes(_config?: LogRoutesConfig): Router {
  const router = Router();

  // Client-side logging endpoint
  router.post('/logs/client', (req: Request, res: Response) => {
    try {
      const { level, module, args } = req.body as ClientLogRequest;

      // Validate input
      if (!level || !module || !Array.isArray(args)) {
        return res.status(400).json({
          error: 'Invalid log request. Required: level, module, args[]',
        });
      }

      // Validate level
      if (!['log', 'warn', 'error', 'debug'].includes(level)) {
        return res.status(400).json({
          error: 'Invalid log level. Must be: log, warn, error, or debug',
        });
      }

      // Add [CLIENT] prefix to module name to distinguish from server logs
      const clientModule = `CLIENT:${module}`;

      // Map client levels to server levels (uppercase)
      const serverLevel = level.toUpperCase();

      // Log to server log file via logFromModule
      logFromModule(serverLevel === 'LOG' ? 'LOG' : serverLevel, clientModule, args);

      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to process client log:', error);
      res.status(500).json({ error: 'Failed to process log' });
    }
  });

  // Get raw log file
  router.get('/logs/raw', (req: Request, res: Response) => {
    try {
      const logPath = path.join(os.homedir(), '.vibetunnel', 'log.txt');

      // Check if log file exists
      if (!fs.existsSync(logPath)) {
        return res.status(404).json({ error: 'Log file not found' });
      }

      // Stream the log file
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      const stream = fs.createReadStream(logPath);
      stream.pipe(res);
    } catch (error) {
      logger.error('Failed to read log file:', error);
      res.status(500).json({ error: 'Failed to read log file' });
    }
  });

  // Get log stats/info
  router.get('/logs/info', (req: Request, res: Response) => {
    try {
      const logPath = path.join(os.homedir(), '.vibetunnel', 'log.txt');

      if (!fs.existsSync(logPath)) {
        return res.json({
          exists: false,
          size: 0,
          path: logPath,
        });
      }

      const stats = fs.statSync(logPath);

      res.json({
        exists: true,
        size: stats.size,
        sizeHuman: formatBytes(stats.size),
        modified: stats.mtime,
        path: logPath,
      });
    } catch (error) {
      logger.error('Failed to get log info:', error);
      res.status(500).json({ error: 'Failed to get log info' });
    }
  });

  // Clear log file (for development/debugging)
  router.delete('/logs/clear', (req: Request, res: Response) => {
    try {
      const logPath = path.join(os.homedir(), '.vibetunnel', 'log.txt');

      if (fs.existsSync(logPath)) {
        fs.truncateSync(logPath, 0);
        logger.log('Log file cleared');
      }

      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to clear log file:', error);
      res.status(500).json({ error: 'Failed to clear log file' });
    }
  });

  return router;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
