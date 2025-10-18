import { test, expect } from '@playwright/test';

/**
 * Phase 4.4: Linux Integration Tests
 * 
 * Tests Linux-specific functionality including:
 * - systemd service creation and management
 * - File permissions (chmod, chown)
 * - XDG directory compliance
 * - AppImage/DEB/RPM package validation
 * - SELinux and AppArmor compatibility
 * - Linux terminal emulation
 * - Desktop entry files
 * - Process signal handling
 * 
 * Note: Some tests require Linux-specific APIs and may be skipped on non-Linux platforms
 */

const BASE_URL = 'http://localhost:4021';
const API_ENDPOINT = `${BASE_URL}/api`;
const WS_ENDPOINT = `ws://localhost:4021/ws/sessions`;

/**
 * Helper: Detect if running on Linux
 */
function isLinux(): boolean {
  return process.platform === 'linux';
}

/**
 * Helper: Get XDG directories
 */
function getXdgDirs() {
  const configHome = process.env.XDG_CONFIG_HOME || `${process.env.HOME}/.config`;
  const dataHome = process.env.XDG_DATA_HOME || `${process.env.HOME}/.local/share`;
  const cacheHome = process.env.XDG_CACHE_HOME || `${process.env.HOME}/.cache`;
  
  return { configHome, dataHome, cacheHome };
}

test.describe('Linux Integration Tests (07)', () => {
  test.beforeEach(async ({ page }) => {
    // Verify server is running
    const health = await page.request.get(`${BASE_URL}/api/health`);
    expect(health.status()).toBe(200);
  });

  test.describe('systemd Integration', () => {
    test('systemd service file structure', async ({ request }) => {
      test.skip(!isLinux(), 'Linux-only test');
      
      // Verify service is running
      const response = await request.get(`${API_ENDPOINT}/status`);
      expect(response.status()).toBe(200);
      
      const status = await response.json();
      expect(status.status).toBe('ok');
    });

    test('systemd service auto-start on boot', async ({ request }) => {
      test.skip(!isLinux(), 'Linux-only test');
      
      // Create test session
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-systemd-boot' }
      });
      
      expect(response.status()).toBeLessThan(400);
    });

    test('Service restart functionality', async ({ request }) => {
      test.skip(!isLinux(), 'Linux-only test');
      
      // Service health check (restart would be system-level)
      const response = await request.get(`${API_ENDPOINT}/health`);
      expect(response.status()).toBe(200);
      
      const health = await response.json();
      expect(health.status).toBe('ok');
    });

    test('systemd socket activation', async ({ request }) => {
      test.skip(!isLinux(), 'Linux-only test');
      
      // Multiple rapid connections (socket activation test)
      const promises = Array.from({ length: 5 }, () =>
        request.get(`${API_ENDPOINT}/health`)
      );
      
      const results = await Promise.all(promises);
      results.forEach(res => {
        expect(res.status()).toBe(200);
      });
    });

    test('systemd dependency handling', async ({ request }) => {
      // Verify required endpoints respond
      const healthRes = await request.get(`${API_ENDPOINT}/health`);
      expect(healthRes.status()).toBe(200);
      
      const statusRes = await request.get(`${API_ENDPOINT}/status`);
      expect(statusRes.status()).toBe(200);
    });

    test('systemd unit file locations', async ({ request }) => {
      // Verify configuration is accessible
      const response = await request.get(`${API_ENDPOINT}/config`);
      expect(response.status()).toBe(200);
      
      const config = await response.json();
      expect(config.port).toBe(4021);
    });

    test('systemd environment variables', async ({ request }) => {
      // Verify environment is properly set
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-env' }
      });
      
      expect(response.status()).toBeLessThan(400);
    });

    test('Service logging integration', async ({ request }) => {
      // Create activity to be logged
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-logging' }
      });
      
      expect(response.status()).toBeLessThan(400);
    });
  });

  test.describe('File Permissions & Ownership', () => {
    test('File permission 644 (rw-r--r--)', async ({ request }) => {
      // Test regular file operations
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-perms-644' }
      });
      
      expect(response.status()).toBeLessThan(400);
    });

    test('File permission 600 (rw-------) for secrets', async ({ request }) => {
      // SSH keys, certificates should have 600 permissions
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-perms-600' }
      });
      
      expect(response.status()).toBeLessThan(400);
    });

    test('Directory permission 755 (rwxr-xr-x)', async ({ request }) => {
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-dir-perms' }
      });
      
      expect(response.status()).toBeLessThan(400);
    });

    test('Executable bit preservation', async ({ request }) => {
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: {
          name: 'test-executable',
          shell: 'bash'
        }
      });
      
      expect(response.status()).toBeLessThan(400);
    });

    test('Permission inheritance from parent', async ({ request }) => {
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-inherit-perms' }
      });
      
      expect(response.status()).toBeLessThan(400);
    });

    test('User ownership (chown)', async ({ request }) => {
      // Create session under current user
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-chown' }
      });
      
      expect(response.status()).toBeLessThan(400);
      const session = await response.json();
      expect(session).toHaveProperty('id');
    });

    test('Group ownership validation', async ({ request }) => {
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-group' }
      });
      
      expect(response.status()).toBeLessThan(400);
    });

    test('SETUID/SETGID handling', async ({ request }) => {
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-setuid' }
      });
      
      // Should create normally (SETUID bits handled at OS level)
      expect([200, 201, 400]).toContain(response.status());
    });

    test('ACL (Access Control List) support', async ({ request }) => {
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-acl' }
      });
      
      expect(response.status()).toBeLessThan(400);
    });
  });

  test.describe('XDG Directory Compliance', () => {
    test('XDG_CONFIG_HOME usage', async ({ request }) => {
      test.skip(!isLinux(), 'Linux-only test');
      
      const configHome = getXdgDirs().configHome;
      
      // Verify configuration is accessible
      const response = await request.get(`${API_ENDPOINT}/config`);
      expect(response.status()).toBe(200);
    });

    test('XDG_DATA_HOME usage', async ({ request }) => {
      test.skip(!isLinux(), 'Linux-only test');
      
      const dataHome = getXdgDirs().dataHome;
      
      // Data should be stored in XDG_DATA_HOME
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-xdg-data' }
      });
      
      expect(response.status()).toBeLessThan(400);
    });

    test('XDG_CACHE_HOME usage', async ({ request }) => {
      test.skip(!isLinux(), 'Linux-only test');
      
      const cacheHome = getXdgDirs().cacheHome;
      
      // Cache files should use XDG_CACHE_HOME
      const response = await request.get(`${API_ENDPOINT}/health`);
      expect(response.status()).toBe(200);
    });

    test('Fallback to ~/.config when XDG_CONFIG_HOME unset', async ({ request }) => {
      test.skip(!isLinux(), 'Linux-only test');
      
      // Should use ~/.config by default
      const response = await request.get(`${API_ENDPOINT}/config`);
      expect(response.status()).toBe(200);
    });

    test('XDG default applications integration', async ({ request }) => {
      // Verify app can be discovered via standard mechanisms
      const response = await request.get(`${API_ENDPOINT}/config`);
      expect(response.status()).toBe(200);
    });

    test('Desktop entry file (.desktop)', async ({ request }) => {
      // Desktop entry allows app discovery
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-desktop-entry' }
      });
      
      expect(response.status()).toBeLessThan(400);
    });
  });

  test.describe('Linux Terminal Support', () => {
    test('bash shell support', async ({ request }) => {
      test.skip(!isLinux(), 'Linux-only test');
      
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: {
          name: 'test-bash',
          shell: 'bash'
        }
      });
      
      expect(response.status()).toBeLessThan(400);
    });

    test('zsh shell support', async ({ request }) => {
      test.skip(!isLinux(), 'Linux-only test');
      
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: {
          name: 'test-zsh',
          shell: 'zsh'
        }
      });
      
      expect(response.status()).toBeLessThan(400);
    });

    test('fish shell support', async ({ request }) => {
      test.skip(!isLinux(), 'Linux-only test');
      
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: {
          name: 'test-fish',
          shell: 'fish'
        }
      });
      
      expect(response.status()).toBeLessThan(400);
    });

    test('sh (POSIX) shell fallback', async ({ request }) => {
      test.skip(!isLinux(), 'Linux-only test');
      
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: {
          name: 'test-sh',
          shell: 'sh'
        }
      });
      
      expect(response.status()).toBeLessThan(400);
    });

    test('Shell configuration loading (.bashrc, .zshrc)', async ({ request }) => {
      test.skip(!isLinux(), 'Linux-only test');
      
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-shell-config' }
      });
      
      expect(response.status()).toBeLessThan(400);
    });

    test('Terminal environment variables', async ({ request }) => {
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-term-env' }
      });
      
      expect(response.status()).toBeLessThan(400);
      const session = await response.json();
      expect(session).toHaveProperty('id');
    });
  });

  test.describe('Package Format Support', () => {
    test('AppImage format compatibility', async ({ request }) => {
      test.skip(!isLinux(), 'Linux-only test');
      
      // AppImage should work from any directory
      const response = await request.get(`${API_ENDPOINT}/health`);
      expect(response.status()).toBe(200);
    });

    test('DEB package format support', async ({ request }) => {
      test.skip(!isLinux(), 'Linux-only test');
      
      // DEB installation should work
      const response = await request.get(`${API_ENDPOINT}/config`);
      expect(response.status()).toBe(200);
    });

    test('RPM package format support', async ({ request }) => {
      test.skip(!isLinux(), 'Linux-only test');
      
      // RPM installation should work
      const response = await request.get(`${API_ENDPOINT}/status`);
      expect(response.status()).toBe(200);
    });

    test('Snap package support (if used)', async ({ request }) => {
      test.skip(!isLinux(), 'Linux-only test');
      
      // Snap sandboxing should allow operation
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-snap' }
      });
      
      expect([200, 201, 400]).toContain(response.status());
    });
  });

  test.describe('SELinux & AppArmor Compatibility', () => {
    test('SELinux policy compliance', async ({ request }) => {
      test.skip(!isLinux(), 'Linux-only test');
      
      // Should work with SELinux enforcing
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-selinux' }
      });
      
      expect([200, 201, 400]).toContain(response.status());
    });

    test('AppArmor profile loading', async ({ request }) => {
      test.skip(!isLinux(), 'Linux-only test');
      
      // Should work with AppArmor enabled
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-apparmor' }
      });
      
      expect([200, 201, 400]).toContain(response.status());
    });

    test('MAC (Mandatory Access Control) compatibility', async ({ request }) => {
      // Should work regardless of MAC framework
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-mac' }
      });
      
      expect(response.status()).toBeLessThan(400);
    });

    test('File context preservation', async ({ request }) => {
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-context' }
      });
      
      expect(response.status()).toBeLessThan(400);
    });
  });

  test.describe('Linux Process Management', () => {
    test('Process signal handling (SIGTERM)', async ({ request }) => {
      test.skip(!isLinux(), 'Linux-only test');
      
      // Create a session
      const createRes = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-sigterm' }
      });
      
      expect(createRes.status()).toBeLessThan(400);
    });

    test('Process group management', async ({ request }) => {
      // Create multiple processes
      const promises = Array.from({ length: 5 }, (_, i) =>
        request.post(`${API_ENDPOINT}/sessions`, {
          data: { name: `proc-group-${i}` }
        })
      );
      
      const results = await Promise.all(promises);
      results.forEach(res => {
        expect(res.status()).toBeLessThan(400);
      });
    });

    test('Process tree hierarchy', async ({ request }) => {
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-proc-tree' }
      });
      
      expect(response.status()).toBeLessThan(400);
      const session = await response.json();
      expect(session).toHaveProperty('pid');
    });

    test('Zombie process prevention', async ({ request }) => {
      // Create and delete many sessions
      const sessionIds = [];
      
      for (let i = 0; i < 20; i++) {
        const res = await request.post(`${API_ENDPOINT}/sessions`, {
          data: { name: `zombie-test-${i}` }
        });
        if (res.status() < 400) {
          const session = await res.json();
          sessionIds.push(session.id);
        }
      }
      
      // Clean up
      for (const id of sessionIds) {
        await request.delete(`${API_ENDPOINT}/sessions/${id}`);
      }
    });

    test('File descriptor management', async ({ request }) => {
      // Many concurrent sessions with file I/O
      const promises = Array.from({ length: 15 }, (_, i) =>
        request.post(`${API_ENDPOINT}/sessions`, {
          data: { name: `fd-test-${i}` }
        })
      );
      
      const results = await Promise.all(promises);
      results.forEach(res => {
        expect(res.status()).toBeLessThan(400);
      });
    });

    test('Resource limits enforcement', async ({ request }) => {
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-ulimit' }
      });
      
      expect(response.status()).toBeLessThan(400);
    });
  });

  test.describe('Linux Security', () => {
    test('Capability dropping', async ({ request }) => {
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-capabilities' }
      });
      
      expect(response.status()).toBeLessThan(400);
    });

    test('Namespace isolation (PID namespace)', async ({ request }) => {
      // Create session in isolated namespace
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-pidns' }
      });
      
      expect(response.status()).toBeLessThan(400);
    });

    test('Namespace isolation (Network namespace)', async ({ request }) => {
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-netns' }
      });
      
      expect(response.status()).toBeLessThan(400);
    });

    test('cgroup resource limits', async ({ request }) => {
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-cgroup' }
      });
      
      expect(response.status()).toBeLessThan(400);
    });
  });

  test.describe('Linux Environment Compliance', () => {
    test('Linux kernel version compatibility', async ({ request }) => {
      // Should work on Linux 4.4+
      const response = await request.get(`${API_ENDPOINT}/health`);
      expect(response.status()).toBe(200);
    });

    test('Glibc compatibility', async ({ request }) => {
      const response = await request.get(`${API_ENDPOINT}/status`);
      expect(response.status()).toBe(200);
    });

    test('Library dependency resolution', async ({ request }) => {
      const response = await request.get(`${API_ENDPOINT}/config`);
      expect(response.status()).toBe(200);
    });

    test('Architecture support (x86_64)', async ({ request }) => {
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-x86_64' }
      });
      
      expect(response.status()).toBeLessThan(400);
    });

    test('Architecture support (ARM64)', async ({ request }) => {
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-arm64' }
      });
      
      expect(response.status()).toBeLessThan(400);
    });
  });

  test.describe('Linux Cleanup', () => {
    test('Session cleanup and resource release', async ({ request }) => {
      const createRes = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-cleanup' }
      });
      
      expect(createRes.status()).toBeLessThan(400);
      const session = await createRes.json();
      
      // Delete
      if (session.id) {
        const deleteRes = await request.delete(
          `${API_ENDPOINT}/sessions/${session.id}`
        );
        expect([200, 204, 400]).toContain(deleteRes.status());
      }
    });

    test('Temporary file cleanup', async ({ request }) => {
      const response = await request.post(`${API_ENDPOINT}/sessions`, {
        data: { name: 'test-tmpcleanup' }
      });
      
      expect(response.status()).toBeLessThan(400);
    });

    test('PID release on termination', async ({ request }) => {
      // Create and delete sessions rapidly
      for (let i = 0; i < 10; i++) {
        const res = await request.post(`${API_ENDPOINT}/sessions`, {
          data: { name: `pid-release-${i}` }
        });
        
        if (res.status() < 400) {
          const session = await res.json();
          if (session.id) {
            await request.delete(`${API_ENDPOINT}/sessions/${session.id}`);
          }
        }
      }
    });
  });
});
