/**
 * ProcessUtils - Cross-platform process management utilities
 *
 * Provides reliable process existence checking across Windows, macOS, and Linux.
 */

import { spawnSync } from 'child_process';
import { createLogger } from '../utils/logger.js';
import chalk from 'chalk';
import * as os from 'os';
import * as path from 'path';

const logger = createLogger('process-utils');

export class ProcessUtils {
  /**
   * Check if a process is currently running by PID
   * Uses platform-appropriate methods for reliable detection
   */
  static isProcessRunning(pid: number): boolean {
    if (!pid || pid <= 0) {
      return false;
    }

    try {
      if (process.platform === 'win32') {
        // Windows: Use tasklist command
        return ProcessUtils.isProcessRunningWindows(pid);
      } else {
        // Unix/Linux/macOS: Use kill with signal 0
        return ProcessUtils.isProcessRunningUnix(pid);
      }
    } catch (error) {
      logger.warn(`error checking if process ${pid} is running:`, error);
      return false;
    }
  }

  /**
   * Windows-specific process check using tasklist
   */
  private static isProcessRunningWindows(pid: number): boolean {
    try {
      logger.debug(`checking windows process ${pid} with tasklist`);
      const result = spawnSync('tasklist', ['/FI', `PID eq ${pid}`, '/NH', '/FO', 'CSV'], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 5000, // 5 second timeout
      });

      // Check if the command succeeded and PID appears in output
      if (result.status === 0 && result.stdout) {
        // tasklist outputs CSV format with PID in quotes
        const exists = result.stdout.includes(`"${pid}"`);
        logger.debug(`process ${pid} exists: ${exists}`);
        return exists;
      }

      logger.debug(`tasklist command failed with status ${result.status}`);
      return false;
    } catch (error) {
      logger.warn(`windows process check failed for PID ${pid}:`, error);
      return false;
    }
  }

  /**
   * Unix-like systems process check using kill signal 0
   */
  private static isProcessRunningUnix(pid: number): boolean {
    try {
      // Send signal 0 to check if process exists
      // This doesn't actually kill the process, just checks existence
      process.kill(pid, 0);
      return true;
    } catch (error) {
      // If we get ESRCH, the process doesn't exist
      // If we get EPERM, the process exists but we don't have permission
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'EPERM') {
        // Process exists but we don't have permission to signal it
        return true;
      }
      // ESRCH or other errors mean process doesn't exist
      return false;
    }
  }

  /**
   * Get basic process information if available
   * Returns null if process is not running or info cannot be retrieved
   */
  static getProcessInfo(pid: number): { pid: number; exists: boolean } | null {
    if (!ProcessUtils.isProcessRunning(pid)) {
      return null;
    }

    return {
      pid,
      exists: true,
    };
  }

  /**
   * Kill a process with platform-appropriate method
   * Returns true if the kill signal was sent successfully
   */
  static killProcess(pid: number, signal: NodeJS.Signals | number = 'SIGTERM'): boolean {
    if (!pid || pid <= 0) {
      return false;
    }

    logger.debug(`attempting to kill process ${pid} with signal ${signal}`);

    try {
      if (process.platform === 'win32') {
        // Windows: Use taskkill command for more reliable termination
        const result = spawnSync('taskkill', ['/PID', pid.toString(), '/F'], {
          windowsHide: true,
          timeout: 5000,
        });
        if (result.status === 0) {
          logger.log(chalk.green(`process ${pid} killed successfully`));
          return true;
        } else {
          logger.debug(`taskkill failed with status ${result.status}`);
          return false;
        }
      } else {
        // Unix-like: Use built-in process.kill
        process.kill(pid, signal);
        logger.log(chalk.green(`signal ${signal} sent to process ${pid}`));
        return true;
      }
    } catch (error) {
      logger.warn(`error killing process ${pid}:`, error);
      return false;
    }
  }

  /**
   * Wait for a process to exit with timeout
   * Returns true if process exited within timeout, false otherwise
   */
  static async waitForProcessExit(pid: number, timeoutMs: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 100; // Check every 100ms

    logger.debug(`waiting for process ${pid} to exit (timeout: ${timeoutMs}ms)`);

    while (Date.now() - startTime < timeoutMs) {
      if (!ProcessUtils.isProcessRunning(pid)) {
        const elapsed = Date.now() - startTime;
        logger.log(chalk.green(`process ${pid} exited after ${elapsed}ms`));
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    logger.log(chalk.yellow(`process ${pid} did not exit within ${timeoutMs}ms timeout`));
    return false;
  }

  /**
   * Determine how to spawn a command, checking if it exists in PATH or needs shell execution
   * Returns the actual command and args to use for spawning
   */
  static resolveCommand(command: string[]): { command: string; args: string[]; useShell: boolean } {
    if (command.length === 0) {
      throw new Error('No command provided');
    }

    const cmdName = command[0];
    const cmdArgs = command.slice(1);

    // Check if command exists in PATH using 'which' (Unix) or 'where' (Windows)
    const whichCommand = process.platform === 'win32' ? 'where' : 'which';

    try {
      const result = spawnSync(whichCommand, [cmdName], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 2000, // 2 second timeout
      });

      if (result.status === 0 && result.stdout && result.stdout.trim()) {
        // Command found in PATH
        logger.debug(`Command '${cmdName}' found at: ${result.stdout.trim()}`);
        return {
          command: cmdName,
          args: cmdArgs,
          useShell: false,
        };
      }
    } catch (error) {
      logger.debug(`Failed to check command existence for '${cmdName}':`, error);
    }

    // Command not found in PATH, likely an alias or shell builtin
    // Need to run through shell
    logger.debug(`Command '${cmdName}' not found in PATH, will use shell`);

    // Determine user's shell
    const userShell = ProcessUtils.getUserShell();

    // Use interactive shell to execute the command
    // This ensures aliases and shell functions are available
    if (process.platform === 'win32') {
      // Windows shells have different syntax
      if (userShell.includes('bash')) {
        // Git Bash on Windows: Use Unix-style syntax
        return {
          command: userShell,
          args: ['-i', '-c', command.join(' ')],
          useShell: true,
        };
      } else if (userShell.includes('pwsh') || userShell.includes('powershell')) {
        // PowerShell: Use -Command for execution
        // Note: PowerShell aliases work differently than Unix aliases
        return {
          command: userShell,
          args: ['-NoLogo', '-Command', command.join(' ')],
          useShell: true,
        };
      } else {
        // cmd.exe: Use /C to execute and exit
        // Note: cmd.exe uses 'doskey' for aliases, not traditional aliases
        return {
          command: userShell,
          args: ['/C', command.join(' ')],
          useShell: true,
        };
      }
    } else {
      // Unix shells: Use -i -c for interactive execution
      return {
        command: userShell,
        args: ['-i', '-c', command.join(' ')],
        useShell: true,
      };
    }
  }

  /**
   * Get the user's preferred shell
   * Falls back to sensible defaults if SHELL env var is not set
   */
  static getUserShell(): string {
    // First try SHELL environment variable (most reliable on Unix)
    if (process.env.SHELL) {
      return process.env.SHELL;
    }

    // Platform-specific defaults
    if (process.platform === 'win32') {
      // Check for modern shells first

      // 1. Check for PowerShell Core (pwsh) - cross-platform version
      try {
        const result = spawnSync('pwsh', ['-Command', 'echo test'], {
          encoding: 'utf8',
          windowsHide: true,
          timeout: 1000,
        });
        if (result.status === 0) {
          return 'pwsh';
        }
      } catch (_) {
        // PowerShell Core not available
      }

      // 2. Check for Windows PowerShell (older, Windows-only)
      const powershellPath = path.join(
        process.env.SystemRoot || 'C:\\Windows',
        'System32',
        'WindowsPowerShell',
        'v1.0',
        'powershell.exe'
      );
      try {
        const result = spawnSync(powershellPath, ['-Command', 'echo test'], {
          encoding: 'utf8',
          windowsHide: true,
          timeout: 1000,
        });
        if (result.status === 0) {
          return powershellPath;
        }
      } catch (_) {
        // PowerShell not available
      }

      // 3. Check for Git Bash if available
      const gitBashPaths = [
        'C:\\Program Files\\Git\\bin\\bash.exe',
        'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
        path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
      ];
      for (const gitBashPath of gitBashPaths) {
        try {
          const result = spawnSync(gitBashPath, ['-c', 'echo test'], {
            encoding: 'utf8',
            windowsHide: true,
            timeout: 1000,
          });
          if (result.status === 0) {
            return gitBashPath;
          }
        } catch (_) {
          // Git Bash not at this location
        }
      }

      // 4. Fall back to cmd.exe
      return process.env.ComSpec || 'cmd.exe';
    } else {
      // Unix-like systems
      // Node.js os.userInfo() includes shell on some platforms
      try {
        const userInfo = os.userInfo();
        if ('shell' in userInfo && userInfo.shell) {
          return userInfo.shell as string;
        }
      } catch (_) {
        // userInfo might fail in some environments
      }

      // Check common shell paths in order of preference
      const commonShells = ['/bin/zsh', '/bin/bash', '/usr/bin/zsh', '/usr/bin/bash', '/bin/sh'];
      for (const shell of commonShells) {
        try {
          // Just check if the shell exists and is executable
          const result = spawnSync('test', ['-x', shell], {
            encoding: 'utf8',
            timeout: 500,
          });
          if (result.status === 0) {
            return shell;
          }
        } catch (_) {
          // test command failed, try next shell
        }
      }

      // Final fallback - /bin/sh should always exist on Unix
      return '/bin/sh';
    }
  }
}
