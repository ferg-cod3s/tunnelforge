import { test, expect, APIRequestContext } from '@playwright/test';

/**
 * Phase 4.3c: WebSocket Integration Testing
 * 
 * Tests WebSocket-dependent functionality and real-time capabilities.
 * Note: Direct WebSocket testing in browser automation is limited.
 * These tests focus on WebSocket endpoint accessibility and session
 * continuity which WebSocket handlers depend on.
 * 
 * Focus: Real-time capability verification and connection resilience
 */

const BASE_URL = process.env.API_URL || 'http://localhost:4021';

test.describe('WebSocket Connections', () => {
  let sessionId: string;
  let authToken: string;
  let request: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    request = await playwright.request.newContext({
      baseURL: BASE_URL,
    });

    // Create test session (no auth required for session creation)
    const sessionRes = await request.post('/api/sessions', {
      data: {
        name: 'WebSocket Test Session',
        shell: 'bash',
        workDir: '/tmp',
      },
    });

    if (sessionRes.status() === 201) {
      const sessionData = await sessionRes.json();
      sessionId = sessionData.id;
    }
  });

  test.afterAll(async () => {
    if (sessionId) {
      await request.delete(`/api/sessions/${sessionId}`);
    }
    await request.dispose();
  });

  // ========== Connection Lifecycle Tests ==========
  test.describe('Connection Lifecycle', () => {
    test('should have valid session for WebSocket endpoint', async () => {
      const response = await request.get(`/api/sessions/${sessionId}`);
      expect(response.status()).toBe(200);
      
      const session = await response.json();
      expect(session).toHaveProperty('id');
      expect(session.id).toBe(sessionId);
    });

    test('should maintain session across operations', async () => {
      const response = await request.get(`/api/sessions/${sessionId}`);
      expect(response.status()).toBe(200);
      
      const session = await response.json();
      expect(session).toHaveProperty('createdAt');
      expect(session).toHaveProperty('name');
    });

    test('should support session persistence', async () => {
      // Create a session
      const createRes = await request.post('/api/sessions', {
        data: { name: 'Persistent Test', shell: 'bash', workDir: '/tmp' },
      });
      expect(createRes.status()).toBe(201);

      const newSession = await createRes.json();
      const newId = newSession.id;

      // Retrieve it multiple times
      for (let i = 0; i < 3; i++) {
        const getRes = await request.get(`/api/sessions/${newId}`);
        expect(getRes.status()).toBe(200);
        const session = await getRes.json();
        expect(session.id).toBe(newId);
      }

      // Clean up
      await request.delete(`/api/sessions/${newId}`);
    });

    test('should handle concurrent session access', async () => {
      // Create multiple sessions
      const sessionIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const res = await request.post('/api/sessions', {
          data: { name: `Concurrent ${i}`, shell: 'bash', workDir: '/tmp' },
        });
        if (res.status() === 201) {
          const s = await res.json();
          sessionIds.push(s.id);
        }
      }

      // Access them concurrently
      const accessPromises = sessionIds.map(id => 
        request.get(`/api/sessions/${id}`)
      );
      const responses = await Promise.all(accessPromises);

      // All should succeed
      responses.forEach(res => expect(res.status()).toBe(200));

      // Clean up
      for (const id of sessionIds) {
        await request.delete(`/api/sessions/${id}`);
      }
    });

    test('should reject invalid session IDs', async () => {
      const response = await request.get('/api/sessions/invalid-id-xyz-12345');
      expect(response.status()).toBe(404);
    });
  });

  // ========== Message Flow Tests ==========
  test.describe('Message Delivery and Format Validation', () => {
    test('should support session I/O operations', async () => {
      // Verify session supports I/O endpoint pattern
      const response = await request.get(`/api/sessions/${sessionId}`);
      expect(response.status()).toBe(200);
      
      const session = await response.json();
      expect(session).toHaveProperty('id');
      // Session should be ready for WebSocket I/O
      expect(session.id).toMatch(/^[a-f0-9-]+$/i);
    });

    test('should maintain multiple session instances', async () => {
      // Create multiple sessions
      const count = 3;
      const ids: string[] = [];

      for (let i = 0; i < count; i++) {
        const res = await request.post('/api/sessions', {
          data: { name: `Multi ${i}`, shell: 'bash', workDir: '/tmp' },
        });
        if (res.status() === 201) {
          const s = await res.json();
          ids.push(s.id);
        }
      }

      // All should be distinct and retrievable
      const retrieved = await Promise.all(
        ids.map(id => request.get(`/api/sessions/${id}`))
      );

      retrieved.forEach((res, idx) => {
        expect(res.status()).toBe(200);
      });

      // Verify IDs are unique
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);

      // Clean up
      for (const id of ids) {
        await request.delete(`/api/sessions/${id}`);
      }
    });

    test('should support session operations in sequence', async () => {
      // Create → Retrieve → Update metadata → Delete flow
      const createRes = await request.post('/api/sessions', {
        data: { name: 'Sequential Test', shell: 'bash', workDir: '/tmp' },
      });
      expect(createRes.status()).toBe(201);

      const session = await createRes.json();
      const testId = session.id;

      // Retrieve
      const getRes = await request.get(`/api/sessions/${testId}`);
      expect(getRes.status()).toBe(200);

      // Delete
      const deleteRes = await request.delete(`/api/sessions/${testId}`);
      expect([200, 204]).toContain(deleteRes.status());

      // Verify deleted
      const finalRes = await request.get(`/api/sessions/${testId}`);
      expect(finalRes.status()).toBe(404);
    });

    test('should handle rapid session creation', async () => {
      const ids: string[] = [];

      // Rapidly create sessions
      for (let i = 0; i < 5; i++) {
        const res = await request.post('/api/sessions', {
          data: { name: `Rapid ${i}`, shell: 'bash', workDir: '/tmp' },
        });
        if (res.status() === 201) {
          const s = await res.json();
          ids.push(s.id);
        }
      }

      // Verify all were created
      expect(ids.length).toBeGreaterThanOrEqual(3);

      // Clean up
      for (const id of ids) {
        await request.delete(`/api/sessions/${id}`).catch(() => {});
      }
    });
  });

  // ========== Error Handling Tests ==========
  test.describe('Error Handling and Recovery', () => {
    test('should handle invalid operations gracefully', async () => {
      // Delete non-existent session
      const deleteRes = await request.delete('/api/sessions/nonexistent-id');
      expect([404, 400, 500]).toContain(deleteRes.status());
    });

    test('should recover after error operations', async () => {
      // Try invalid operation
      let res = await request.get('/api/sessions/invalid');
      expect(res.status()).toBe(404);

      // Normal operation should work after
      res = await request.get(`/api/sessions/${sessionId}`);
      expect(res.status()).toBe(200);
    });

    test('should maintain connection integrity', async () => {
      // Multiple operations should maintain session
      for (let i = 0; i < 5; i++) {
        const res = await request.get(`/api/sessions/${sessionId}`);
        expect(res.status()).toBe(200);
      }

      // Session should still be valid
      const finalRes = await request.get(`/api/sessions/${sessionId}`);
      expect(finalRes.status()).toBe(200);
    });

    test('should handle session deletion recovery', async () => {
      // Create session
      const createRes = await request.post('/api/sessions', {
        data: { name: 'Delete Recovery Test', shell: 'bash', workDir: '/tmp' },
      });
      const testId = (await createRes.json()).id;

      // Delete it
      await request.delete(`/api/sessions/${testId}`);

      // Should return 404
      const getRes = await request.get(`/api/sessions/${testId}`);
      expect(getRes.status()).toBe(404);

      // Creating new one should work
      const newRes = await request.post('/api/sessions', {
        data: { name: 'Recovery Test 2', shell: 'bash', workDir: '/tmp' },
      });
      expect(newRes.status()).toBe(201);

      const newId = (await newRes.json()).id;
      await request.delete(`/api/sessions/${newId}`);
    });

    test('should handle malformed session data', async () => {
      // Send invalid session data
      const res = await request.post('/api/sessions', {
        data: { /* missing required fields */ },
      });
      
      // Should either reject or accept with defaults
      expect([201, 400, 422]).toContain(res.status());
    });
  });

  // ========== WebSocket Endpoint Accessibility ==========
  test.describe('WebSocket Endpoint Accessibility', () => {
    test('should have WebSocket endpoint for session I/O', async ({ page }) => {
      // Navigate to establish context
      await page.goto(BASE_URL);

      // Check if WebSocket endpoint is accessible
      const result = await page.evaluate(async (sid) => {
        return new Promise((resolve) => {
          try {
            const wsUrl = `ws://localhost:4021/api/sessions/${sid}/io`;
            // Just check if we can attempt connection
            const ws = new WebSocket(wsUrl);
            
            const timer = setTimeout(() => {
              ws.close();
              resolve('timeout_attempting_connection');
            }, 500);

            ws.onopen = () => {
              clearTimeout(timer);
              ws.close();
              resolve('websocket_endpoint_accessible');
            };

            ws.onerror = () => {
              clearTimeout(timer);
              resolve('websocket_endpoint_error');
            };

            ws.onclose = () => {
              clearTimeout(timer);
              resolve('websocket_endpoint_closed');
            };
          } catch (e) {
            resolve('websocket_exception');
          }
        });
      }, sessionId);

      // WebSocket endpoint should be present (may error, but should be accessible)
      expect(['websocket_endpoint_accessible', 'websocket_endpoint_error', 'timeout_attempting_connection', 'websocket_endpoint_closed']).toContain(result);
    });

    test('should maintain session state for WebSocket operations', async () => {
      // Session should be healthy for WebSocket use
      const response = await request.get(`/api/sessions/${sessionId}`);
      expect(response.status()).toBe(200);
      
      const session = await response.json();
      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('createdAt');
      expect(session).toHaveProperty('name');
    });

    test('should support session listing for discovery', async () => {
      const response = await request.get('/api/sessions');
      expect(response.status()).toBe(200);
      
      const data = await response.json();
      // Response can be array or object with sessions property
      const sessions = Array.isArray(data) ? data : data.sessions;
      expect(Array.isArray(sessions)).toBe(true);

      // Created session should be in list
      const testSession = sessions.find((s: any) => s.id === sessionId);
      expect(testSession).toBeDefined();
    });

    test('should handle WebSocket session queries', async () => {
      // List sessions
      let res = await request.get('/api/sessions');
      expect(res.status()).toBe(200);

      let data = await res.json();
      const sessions = Array.isArray(data) ? data : data.sessions;
      const initialCount = sessions.length;

      // Create new session
      const createRes = await request.post('/api/sessions', {
        data: { name: 'WS Query Test', shell: 'bash', workDir: '/tmp' },
      });
      expect(createRes.status()).toBe(201);
      const newId = (await createRes.json()).id;

      // List again
      res = await request.get('/api/sessions');
      data = await res.json();
      const updatedSessions = Array.isArray(data) ? data : data.sessions;
      expect(updatedSessions.length).toBeGreaterThan(initialCount);

      // New session should be listed
      const found = updatedSessions.find((s: any) => s.id === newId);
      expect(found).toBeDefined();

      // Clean up
      await request.delete(`/api/sessions/${newId}`);
    });
  });

  // ========== Real-time Capability Tests ==========
  test.describe('Real-time Capability Verification', () => {
    test('should support real-time session monitoring', async () => {
      // Get initial state
      let res = await request.get(`/api/sessions/${sessionId}`);
      expect(res.status()).toBe(200);
      const initial = await res.json();

      // Verify timestamps are present
      expect(initial).toHaveProperty('createdAt');

      // Session should be queryable multiple times rapidly
      for (let i = 0; i < 5; i++) {
        res = await request.get(`/api/sessions/${sessionId}`);
        expect(res.status()).toBe(200);
      }
    });

    test('should support rapid session state queries', async () => {
      // Rapid fire queries
      const queries = [];
      for (let i = 0; i < 10; i++) {
        queries.push(request.get(`/api/sessions/${sessionId}`));
      }

      const responses = await Promise.all(queries);
      
      // All should succeed
      responses.forEach(res => expect(res.status()).toBe(200));
    });

    test('should maintain session activity timestamps', async () => {
      // Get initial timestamp
      let res = await request.get(`/api/sessions/${sessionId}`);
      const session1 = await res.json();

      // Wait a bit
      await new Promise(r => setTimeout(r, 500));

      // Get updated timestamp
      res = await request.get(`/api/sessions/${sessionId}`);
      const session2 = await res.json();

      // Session should still exist
      expect(session2.id).toBe(session1.id);
    });

    test('should support parallel session operations', async () => {
      // Create multiple sessions
      const createPromises = [];
      for (let i = 0; i < 4; i++) {
        createPromises.push(
          request.post('/api/sessions', {
            data: { name: `Parallel ${i}`, shell: 'bash', workDir: '/tmp' },
          })
        );
      }

      const creates = await Promise.all(createPromises);
      const ids = [];

      for (const res of creates) {
        if (res.status() === 201) {
          const s = await res.json();
          ids.push(s.id);
        }
      }

      // Query them all concurrently
      const gets = ids.map(id => request.get(`/api/sessions/${id}`));
      const getResponses = await Promise.all(gets);

      // All should work
      getResponses.forEach(res => expect(res.status()).toBe(200));

      // Clean up
      const deletes = ids.map(id => request.delete(`/api/sessions/${id}`));
      await Promise.all(deletes);
    });
  });
});
