/**
 * Terminal title management utilities
 *
 * Generates and injects terminal title sequences based on working directory
 * and running command.
 */

import * as os from 'os';
import * as path from 'path';
import type { ActivityState } from './activity-detector.js';
import { PromptDetector } from './prompt-patterns.js';

// Pre-compiled regex patterns for performance
// Match cd command with optional arguments, handling newlines
// The argument capture group excludes command separators
const CD_REGEX = /^\s*cd(?:\s+([^;&|\n]+?))?(?:\s*[;&|\n]|$)/;

/**
 * Generate a terminal title sequence (OSC 2)
 *
 * @param cwd Current working directory
 * @param command Command being run
 * @param sessionName Optional session name
 * @returns Terminal title escape sequence
 */
export function generateTitleSequence(
  cwd: string,
  command: string[],
  sessionName?: string
): string {
  const homeDir = os.homedir();
  const displayPath = cwd.startsWith(homeDir) ? cwd.replace(homeDir, '~') : cwd;
  const fullCmd = command[0] || 'shell';
  const cmdName = path.basename(fullCmd);

  // Build title parts
  const parts = [displayPath, cmdName];

  // Check if session name should be included
  if (sessionName?.trim()) {
    const trimmedName = sessionName.trim();

    // Skip redundant session names
    if (trimmedName === `${cmdName} · ${cmdName}`) {
      // Don't add redundant "claude · claude"
    } else if (trimmedName === cmdName) {
      // Don't add if session name is just the command name
    } else if (trimmedName.match(new RegExp(`^${cmdName}\\s*\\(.*\\)$`))) {
      // Skip auto-generated names like "python3 (~/projects)"
    } else {
      // Add non-redundant session names
      parts.push(trimmedName);
    }
  }

  const title = parts.join(' · ');

  // OSC 2 sequence: ESC ] 2 ; <title> BEL
  return `\x1B]2;${title}\x07`;
}

/**
 * Extract directory change from cd command
 *
 * @param input The input command string
 * @param currentDir Current working directory
 * @returns New directory if cd command detected, null otherwise
 */
export function extractCdDirectory(input: string, currentDir: string): string | null {
  const match = input.match(CD_REGEX);

  if (!match) {
    return null;
  }

  // Handle cd without arguments (goes to home directory)
  if (!match[1]) {
    return os.homedir();
  }

  let targetDir = match[1].trim();

  // Remove quotes if present
  if (
    (targetDir.startsWith('"') && targetDir.endsWith('"')) ||
    (targetDir.startsWith("'") && targetDir.endsWith("'"))
  ) {
    targetDir = targetDir.slice(1, -1);
  }

  // Handle special cases
  if (targetDir === '-') {
    // cd - (return to previous directory) - we can't track this accurately
    return null;
  }

  if (!targetDir || targetDir === '~') {
    return os.homedir();
  }

  if (targetDir.startsWith('~/')) {
    return path.join(os.homedir(), targetDir.slice(2));
  }

  // Resolve relative paths
  if (!path.isAbsolute(targetDir)) {
    return path.resolve(currentDir, targetDir);
  }

  return targetDir;
}

/**
 * Check if we should inject a title update
 *
 * @param data The terminal output data
 * @returns True if this looks like a good time to inject a title
 */
export function shouldInjectTitle(data: string): boolean {
  // Use unified prompt detector for consistency and performance
  return PromptDetector.endsWithPrompt(data);
}

/**
 * Inject title sequence into terminal output if appropriate
 *
 * @param data The terminal output data
 * @param title The title sequence to inject
 * @returns Data with title sequence injected if appropriate
 */
export function injectTitleIfNeeded(data: string, title: string): string {
  if (shouldInjectTitle(data)) {
    // Simply prepend the title sequence
    return title + data;
  }

  return data;
}

/**
 * Generate a dynamic terminal title with activity indicators
 *
 * @param cwd Current working directory
 * @param command Command being run
 * @param activity Current activity state
 * @param sessionName Optional session name
 * @returns Terminal title escape sequence
 */
export function generateDynamicTitle(
  cwd: string,
  command: string[],
  activity: ActivityState,
  sessionName?: string
): string {
  const homeDir = os.homedir();
  const displayPath = cwd.startsWith(homeDir) ? cwd.replace(homeDir, '~') : cwd;
  const fullCmd = command[0] || 'shell';
  const cmdName = path.basename(fullCmd);

  // Build base parts
  const baseParts = [displayPath, cmdName];

  // Add session name if provided
  if (sessionName?.trim()) {
    baseParts.push(sessionName);
  }

  // If we have specific status, put it first
  if (activity.specificStatus) {
    // Format: status · path · command · session name
    const title = `${activity.specificStatus.status} · ${baseParts.join(' · ')}`;
    return `\x1B]2;${title}\x07`;
  }

  // Otherwise use generic activity indicator (only when active)
  if (activity.isActive) {
    // Format: ● path · command · session name
    const title = `● ${baseParts.join(' · ')}`;
    return `\x1B]2;${title}\x07`;
  }

  // When idle, no indicator - just path · command · session name
  const title = baseParts.join(' · ');

  // OSC 2 sequence: ESC ] 2 ; <title> BEL
  return `\x1B]2;${title}\x07`;
}
