/**
 * Tests for path-utils.ts
 */
import { expect, describe, it, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { copyToClipboard, formatPathForDisplay } from './path-utils';

describe('formatPathForDisplay', () => {
  describe('macOS paths', () => {
    it('should replace /Users/username with ~', () => {
      expect(formatPathForDisplay('/Users/john/Documents/project')).toBe('~/Documents/project');
      expect(formatPathForDisplay('/Users/alice/Downloads')).toBe('~/Downloads');
      expect(formatPathForDisplay('/Users/bob')).toBe('~');
    });

    it('should handle usernames with special characters', () => {
      expect(formatPathForDisplay('/Users/john.doe/Documents')).toBe('~/Documents');
      expect(formatPathForDisplay('/Users/alice-smith/Projects')).toBe('~/Projects');
      expect(formatPathForDisplay('/Users/user123/Desktop')).toBe('~/Desktop');
      expect(formatPathForDisplay('/Users/user_name/Files')).toBe('~/Files');
      expect(formatPathForDisplay('/Users/user@company/Work')).toBe('~/Work');
    });

    it('should handle usernames with regex special characters safely', () => {
      // Test usernames that contain regex special characters
      expect(formatPathForDisplay('/Users/user[test]/Documents')).toBe('~/Documents');
      expect(formatPathForDisplay('/Users/user(group)/Projects')).toBe('~/Projects');
      expect(formatPathForDisplay('/Users/user+plus/Desktop')).toBe('~/Desktop');
      expect(formatPathForDisplay('/Users/user$money/Files')).toBe('~/Files');
      expect(formatPathForDisplay('/Users/user.com/Work')).toBe('~/Work');
      expect(formatPathForDisplay('/Users/user*star/Downloads')).toBe('~/Downloads');
      expect(formatPathForDisplay('/Users/user?question/Apps')).toBe('~/Apps');
    });

    it('should not replace if not at the beginning', () => {
      expect(formatPathForDisplay('/some/path/Users/john/Documents')).toBe(
        '/some/path/Users/john/Documents'
      );
      expect(formatPathForDisplay('/home/other/Users/alice')).toBe('/home/other/Users/alice');
    });
  });

  describe('Linux paths', () => {
    it('should replace /home/username with ~', () => {
      expect(formatPathForDisplay('/home/john/Documents')).toBe('~/Documents');
      expect(formatPathForDisplay('/home/alice/Downloads')).toBe('~/Downloads');
    });

    it('should handle usernames with special characters', () => {
      expect(formatPathForDisplay('/home/john.doe/Documents')).toBe('~/Documents');
      expect(formatPathForDisplay('/home/alice-smith/Projects')).toBe('~/Projects');
      expect(formatPathForDisplay('/home/user123/Desktop')).toBe('~/Desktop');
      expect(formatPathForDisplay('/home/user_name/Files')).toBe('~/Files');
      expect(formatPathForDisplay('/home/user@company/Work')).toBe('~/Work');
    });

    it('should handle usernames with regex special characters safely', () => {
      expect(formatPathForDisplay('/home/user[test]/Documents')).toBe('~/Documents');
      expect(formatPathForDisplay('/home/user(group)/Projects')).toBe('~/Projects');
      expect(formatPathForDisplay('/home/user+plus/Desktop')).toBe('~/Desktop');
      expect(formatPathForDisplay('/home/user$money/Files')).toBe('~/Files');
      expect(formatPathForDisplay('/home/user.com/Work')).toBe('~/Work');
      expect(formatPathForDisplay('/home/user*star/Downloads')).toBe('~/Downloads');
      expect(formatPathForDisplay('/home/user?question/Apps')).toBe('~/Apps');
    });

    it('should not replace if not at the beginning', () => {
      expect(formatPathForDisplay('/some/path/home/john/Documents')).toBe(
        '/some/path/home/john/Documents'
      );
      expect(formatPathForDisplay('/usr/local/home/alice')).toBe('/usr/local/home/alice');
    });
  });

  describe('Windows paths', () => {
    it('should replace C:\\Users\\username with ~ (backslashes)', () => {
      expect(formatPathForDisplay('C:\\Users\\john\\Documents')).toBe('~/Documents');
      expect(formatPathForDisplay('C:\\Users\\alice\\Downloads')).toBe('~/Downloads');
    });

    it('should replace C:/Users/username with ~ (forward slashes)', () => {
      expect(formatPathForDisplay('C:/Users/john/Documents')).toBe('~/Documents');
      expect(formatPathForDisplay('C:/Users/alice/Downloads')).toBe('~/Downloads');
    });

    it('should handle case-insensitive drive letters', () => {
      expect(formatPathForDisplay('c:/Users/john/Documents')).toBe('~/Documents');
      expect(formatPathForDisplay('D:/Users/alice/Projects')).toBe('~/Projects');
      expect(formatPathForDisplay('c:\\Users\\john\\Documents')).toBe('~/Documents');
      expect(formatPathForDisplay('d:\\Users\\alice\\Projects')).toBe('~/Projects');
    });

    it('should handle mixed path separators', () => {
      expect(formatPathForDisplay('C:/Users/john\\Documents')).toBe('~/Documents');
      expect(formatPathForDisplay('C:\\Users\\alice/Documents')).toBe('~/Documents');
    });

    it('should handle usernames with special characters', () => {
      expect(formatPathForDisplay('C:/Users/john.doe/Documents')).toBe('~/Documents');
      expect(formatPathForDisplay('C:/Users/alice-smith/Projects')).toBe('~/Projects');
      expect(formatPathForDisplay('C:/Users/user123/Desktop')).toBe('~/Desktop');
      expect(formatPathForDisplay('C:/Users/user_name/Files')).toBe('~/Files');
      expect(formatPathForDisplay('C:/Users/user@company/Work')).toBe('~/Work');
    });

    it('should handle usernames with regex special characters safely', () => {
      expect(formatPathForDisplay('C:/Users/user[test]/Documents')).toBe('~/Documents');
      expect(formatPathForDisplay('C:/Users/user(group)/Projects')).toBe('~/Projects');
      expect(formatPathForDisplay('C:/Users/user+plus/Desktop')).toBe('~/Desktop');
      expect(formatPathForDisplay('C:/Users/user$money/Files')).toBe('~/Files');
      expect(formatPathForDisplay('C:/Users/user.com/Work')).toBe('~/Work');
      expect(formatPathForDisplay('C:/Users/user*star/Downloads')).toBe('~/Downloads');
      expect(formatPathForDisplay('C:/Users/user?question/Apps')).toBe('~/Apps');
    });

    it('should replace home directory for any Windows drive letter', () => {
      expect(formatPathForDisplay('D:/Users/john/Documents')).toBe('~/Documents');
      expect(formatPathForDisplay('E:/Users/alice/Projects')).toBe('~/Projects');
      expect(formatPathForDisplay('F:/Users/bob/Desktop')).toBe('~/Desktop');
    });

    it('should not replace if Users is not after drive', () => {
      expect(formatPathForDisplay('C:/some/path/Users/john/Documents')).toBe(
        'C:/some/path/Users/john/Documents'
      );
      expect(formatPathForDisplay('C:/Users-backup/alice')).toBe('C:/Users-backup/alice');
    });
  });

  describe('Root user paths', () => {
    it('should replace /root with ~', () => {
      expect(formatPathForDisplay('/root/Documents')).toBe('~/Documents');
      expect(formatPathForDisplay('/root/Downloads')).toBe('~/Downloads');
    });

    it('should not replace if not at the beginning', () => {
      expect(formatPathForDisplay('/home/root/Documents')).toBe('/home/root/Documents');
      expect(formatPathForDisplay('/usr/root')).toBe('/usr/root');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      expect(formatPathForDisplay('')).toBe('');
    });

    it('should handle null/undefined gracefully', () => {
      expect(formatPathForDisplay(null as any)).toBe('');
      expect(formatPathForDisplay(undefined as any)).toBe('');
    });

    it('should handle paths that do not match any pattern', () => {
      expect(formatPathForDisplay('/some/random/path')).toBe('/some/random/path');
      expect(formatPathForDisplay('relative/path')).toBe('relative/path');
      expect(formatPathForDisplay('C:/Program Files/App')).toBe('C:/Program Files/App');
    });

    it('should handle already formatted paths', () => {
      expect(formatPathForDisplay('~/Documents')).toBe('~/Documents');
      expect(formatPathForDisplay('~/Projects/file.txt')).toBe('~/Projects/file.txt');
    });

    it('should apply only the first matching pattern', () => {
      expect(formatPathForDisplay('/Users/john/home/alice')).toBe('~/home/alice');
      expect(formatPathForDisplay('/home/john/Users/alice')).toBe('/home/john/Users/alice');
    });

    it('should handle multiple home directory patterns in path', () => {
      expect(formatPathForDisplay('/Users/john/Projects/Users/alice')).toBe(
        '~/Projects/Users/alice'
      );
      expect(formatPathForDisplay('/home/john/Work/home/alice')).toBe('~/Work/home/alice');
    });
  });
});

describe('copyToClipboard', () => {
  let writeTextSpy: ReturnType<typeof mock>;
  let execCommandSpy: ReturnType<typeof mock>;

  beforeEach(() => {
    // Reset mocks
    writeTextSpy = mock(() => Promise.resolve(undefined));
    execCommandSpy = mock(() => true);

    // Mock navigator.clipboard
    (globalThis.navigator as any).clipboard = {
      writeText: writeTextSpy,
    };

    // Mock document.execCommand
    Object.defineProperty(document, 'execCommand', {
      value: execCommandSpy,
      configurable: true,
    });
  });

  afterEach(() => {
    // Clean up mocks
    writeTextSpy = mock(() => Promise.resolve(undefined));
    execCommandSpy = mock(() => true);
  });

  it('should use navigator.clipboard when available', async () => {
    const result = await copyToClipboard('test text');
    expect(result).toBe(true);
    expect(writeTextSpy).toHaveBeenCalledWith('test text');
    expect(execCommandSpy).not.toHaveBeenCalled();
  });

  it('should fallback to execCommand when clipboard API fails', async () => {
    // Make clipboard API fail
    writeTextSpy = mock(() => Promise.reject(new Error('Clipboard API not available')));

    const result = await copyToClipboard('test text');
    expect(result).toBe(true);
    expect(execCommandSpy).toHaveBeenCalledWith('copy');
  });

  it('should fallback to execCommand when clipboard API is not available', async () => {
    // Remove clipboard API
    delete (globalThis.navigator as any).clipboard;

    const result = await copyToClipboard('test text');
    expect(result).toBe(true);
    expect(execCommandSpy).toHaveBeenCalledWith('copy');
  });

  it('should return false when both methods fail', async () => {
    // Make both methods fail
    writeTextSpy = mock(() => Promise.reject(new Error('Clipboard API failed')));
    execCommandSpy = mock(() => false);

    const result = await copyToClipboard('test text');
    expect(result).toBe(false);
  });

  it('should return false when execCommand throws', async () => {
    // Remove clipboard API and make execCommand throw
    delete (globalThis.navigator as any).clipboard;
    execCommandSpy = mock(() => {
      throw new Error('execCommand failed');
    });

    const result = await copyToClipboard('test text');
    expect(result).toBe(false);
  });

  it('should clean up textarea element after copy', async () => {
    // Remove clipboard API to trigger execCommand path
    delete (globalThis.navigator as any).clipboard;

    const result = await copyToClipboard('test text');
    expect(result).toBe(true);
    // The textarea should be cleaned up automatically by the function
  });

  it('should clean up textarea even when execCommand fails', async () => {
    // Remove clipboard API and make execCommand fail
    delete (globalThis.navigator as any).clipboard;
    execCommandSpy = mock(() => {
      throw new Error('execCommand failed');
    });

    const result = await copyToClipboard('test text');
    expect(result).toBe(false);
    // The textarea should still be cleaned up even on failure
  });
});
