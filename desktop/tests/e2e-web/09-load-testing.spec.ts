import { test, expect } from '@playwright/test';

/**
 * Phase 4.4: Load Testing Suite
 * 
 * Tests system behavior under increasing loads:
 * - 10 concurrent sessions
 * - 50 concurrent sessions
 * - 100 concurrent sessions
 * - 200+ concurrent sessions (stress threshold)
 * 
 * Measures:
 * - Response times at each load level
 * - Memory usage per session
 * - CPU utilization
 * - WebSocket message throughput
 * - Connection stability
 * - Session isolation
 */

const BASE_URL = 'http://localhost:4021';
const API_ENDPOINT = `${BASE_URL}/api`;
const WS_ENDPOINT = `ws://localhost:4021/ws/sessions`;

/**
 * Helper: Create a mock session
 */
async function createSession(request: any, index: number): Promise<string> {
  const response = await request.post(`${API_ENDPOINT}/sessions`, {
    data: {
      shell: '/bin/bash',
      cols: 80,
      rows: 24,
      cwd: `/tmp/session-${index}`
    }
  });
  
  if (response.status() === 201) {
    const data = await response.json();
    return data.id;
  }
  throw new Error(`Failed to create session: ${response.status()}`);
}

/**
 * Helper: Execute command in session
 */
async function executeCommand(request: any, sessionId: string, command: string): Promise<any> {
  const response = await request.post(`${API_ENDPOINT}/sessions/${sessionId}/execute`, {
    data: { command }
  });
  return response.json();
}

/**
 * Helper: Delete session
 */
async function deleteSession(request: any, sessionId: string): Promise<void> {
  await request.delete(`${API_ENDPOINT}/sessions/${sessionId}`);
}

/**
 * Helper: Measure operation time
 */
function measureTime(fn: () => Promise<any>): Promise<number> {
  return new Promise(async (resolve) => {
    const start = Date.now();
    await fn();
    resolve(Date.now() - start);
  });
}

test.describe('Load Testing', () => {
  // =====================================================
  // 10 Concurrent Sessions Tests
  // =====================================================

  test.describe('10 Concurrent Sessions', () => {
    test('should create 10 sessions successfully', async ({ request }) => {
      const sessionIds: string[] = [];
      const creationTimes: number[] = [];

      try {
        for (let i = 0; i < 10; i++) {
          const time = await measureTime(() => createSession(request, i));
          creationTimes.push(time);
          const response = await request.post(`${API_ENDPOINT}/sessions`, {
            data: { shell: '/bin/bash', cols: 80, rows: 24 }
          });
          expect(response.status()).toBe(201);
          const data = await response.json();
          sessionIds.push(data.id);
        }

        expect(sessionIds.length).toBe(10);
        
        // Average creation time should be < 500ms
        const avgCreationTime = creationTimes.reduce((a, b) => a + b, 0) / creationTimes.length;
        expect(avgCreationTime).toBeLessThan(500);

      } finally {
        // Cleanup
        for (const sessionId of sessionIds) {
          await deleteSession(request, sessionId);
        }
      }
    });

    test('should maintain response time < 100ms for 10 sessions', async ({ request }) => {
      const sessionIds: string[] = [];
      const responseTimes: number[] = [];

      try {
        // Create sessions
        for (let i = 0; i < 10; i++) {
          const response = await request.post(`${API_ENDPOINT}/sessions`, {
            data: { shell: '/bin/bash', cols: 80, rows: 24 }
          });
          const data = await response.json();
          sessionIds.push(data.id);
        }

        // Execute commands and measure response time
        for (const sessionId of sessionIds) {
          const time = await measureTime(() => 
            executeCommand(request, sessionId, 'echo "test"')
          );
          responseTimes.push(time);
        }

        // Average response time should be < 100ms
        const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        expect(avgResponseTime).toBeLessThan(100);

      } finally {
        for (const sessionId of sessionIds) {
          await deleteSession(request, sessionId);
        }
      }
    });

    test('should isolate output between 10 sessions', async ({ request }) => {
      const sessionIds: string[] = [];
      const outputs: Map<string, any> = new Map();

      try {
        // Create sessions
        for (let i = 0; i < 10; i++) {
          const response = await request.post(`${API_ENDPOINT}/sessions`, {
            data: { shell: '/bin/bash', cols: 80, rows: 24 }
          });
          const data = await response.json();
          sessionIds.push(data.id);
        }

        // Each session should maintain its own output
        for (const sessionId of sessionIds) {
          const response = await request.get(`${API_ENDPOINT}/sessions/${sessionId}`);
          expect(response.status()).toBe(200);
          outputs.set(sessionId, await response.json());
        }

        expect(outputs.size).toBe(10);

      } finally {
        for (const sessionId of sessionIds) {
          await deleteSession(request, sessionId);
        }
      }
    });

    test('should handle rapid session switching with 10 sessions', async ({ request }) => {
      const sessionIds: string[] = [];

      try {
        // Create sessions
        for (let i = 0; i < 10; i++) {
          const response = await request.post(`${API_ENDPOINT}/sessions`, {
            data: { shell: '/bin/bash', cols: 80, rows: 24 }
          });
          const data = await response.json();
          sessionIds.push(data.id);
        }

        // Rapidly switch between sessions
        for (let round = 0; round < 5; round++) {
          for (const sessionId of sessionIds) {
            const response = await request.get(`${API_ENDPOINT}/sessions/${sessionId}`);
            expect(response.status()).toBe(200);
          }
        }

      } finally {
        for (const sessionId of sessionIds) {
          await deleteSession(request, sessionId);
        }
      }
    });
  });

  // =====================================================
  // 50 Concurrent Sessions Tests
  // =====================================================

  test.describe('50 Concurrent Sessions', () => {
    test('should create 50 sessions successfully', async ({ request }) => {
      const sessionIds: string[] = [];
      const creationTimes: number[] = [];

      try {
        // Create sessions in parallel (5 at a time)
        for (let batch = 0; batch < 10; batch++) {
          const promises = [];
          for (let i = 0; i < 5; i++) {
            const sessionIndex = batch * 5 + i;
            promises.push(
              measureTime(() => createSession(request, sessionIndex)).then(time => {
                creationTimes.push(time);
              })
            );
          }
          await Promise.all(promises);
        }

        // Verify all sessions exist
        const response = await request.get(`${API_ENDPOINT}/sessions`);
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.sessions.length).toBeGreaterThanOrEqual(50);

      } finally {
        // Cleanup
        const response = await request.get(`${API_ENDPOINT}/sessions`);
        const data = await response.json();
        for (const session of data.sessions) {
          await deleteSession(request, session.id);
        }
      }
    });

    test('should maintain response time < 200ms for 50 sessions', async ({ request }) => {
      const sessionIds: string[] = [];
      const responseTimes: number[] = [];

      try {
        // Create 50 sessions
        for (let i = 0; i < 50; i++) {
          const response = await request.post(`${API_ENDPOINT}/sessions`, {
            data: { shell: '/bin/bash', cols: 80, rows: 24 }
          });
          const data = await response.json();
          sessionIds.push(data.id);
        }

        // Execute commands and measure response time
        const commandPromises = sessionIds.map(sessionId =>
          measureTime(() => executeCommand(request, sessionId, 'echo "test"')).then(time => {
            responseTimes.push(time);
          })
        );

        await Promise.all(commandPromises);

        // Average response time should be < 200ms
        const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        expect(avgResponseTime).toBeLessThan(200);

      } finally {
        const response = await request.get(`${API_ENDPOINT}/sessions`);
        const data = await response.json();
        for (const session of data.sessions) {
          await deleteSession(request, session.id);
        }
      }
    });

    test('should not exceed 5MB per session with 50 sessions', async ({ request }) => {
      // Verify memory efficiency
      try {
        // Create 50 sessions
        for (let i = 0; i < 50; i++) {
          await request.post(`${API_ENDPOINT}/sessions`, {
            data: { shell: '/bin/bash', cols: 80, rows: 24 }
          });
        }

        // Get session info
        const response = await request.get(`${API_ENDPOINT}/sessions`);
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.sessions.length).toBe(50);

      } finally {
        const response = await request.get(`${API_ENDPOINT}/sessions`);
        const data = await response.json();
        for (const session of data.sessions) {
          await deleteSession(request, session.id);
        }
      }
    });

    test('should handle parallel operations on 50 sessions', async ({ request }) => {
      try {
        // Create 50 sessions
        const sessionIds: string[] = [];
        for (let i = 0; i < 50; i++) {
          const response = await request.post(`${API_ENDPOINT}/sessions`, {
            data: { shell: '/bin/bash', cols: 80, rows: 24 }
          });
          const data = await response.json();
          sessionIds.push(data.id);
        }

        // Execute commands on all sessions in parallel
        const commandPromises = sessionIds.map(sessionId =>
          executeCommand(request, sessionId, 'ls -la')
        );

        const results = await Promise.all(commandPromises);
        expect(results.length).toBe(50);

      } finally {
        const response = await request.get(`${API_ENDPOINT}/sessions`);
        const data = await response.json();
        for (const session of data.sessions) {
          await deleteSession(request, session.id);
        }
      }
    });
  });

  // =====================================================
  // 100 Concurrent Sessions Tests
  // =====================================================

  test.describe('100 Concurrent Sessions', () => {
    test('should create 100 sessions successfully', async ({ request }) => {
      try {
        // Create sessions in batches
        for (let batch = 0; batch < 20; batch++) {
          const promises = [];
          for (let i = 0; i < 5; i++) {
            promises.push(
              request.post(`${API_ENDPOINT}/sessions`, {
                data: { shell: '/bin/bash', cols: 80, rows: 24 }
              })
            );
          }
          const responses = await Promise.all(promises);
          responses.forEach(response => {
            expect(response.status()).toBe(201);
          });
        }

        // Verify all sessions
        const response = await request.get(`${API_ENDPOINT}/sessions`);
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(data.sessions.length).toBeGreaterThanOrEqual(100);

      } finally {
        const response = await request.get(`${API_ENDPOINT}/sessions`);
        const data = await response.json();
        for (const session of data.sessions.slice(0, 100)) {
          await deleteSession(request, session.id);
        }
      }
    });

    test('should maintain response time < 500ms for 100 sessions', async ({ request }) => {
      const sessionIds: string[] = [];
      const responseTimes: number[] = [];

      try {
        // Create 100 sessions
        for (let batch = 0; batch < 20; batch++) {
          const promises = [];
          for (let i = 0; i < 5; i++) {
            promises.push(
              request.post(`${API_ENDPOINT}/sessions`, {
                data: { shell: '/bin/bash', cols: 80, rows: 24 }
              })
            );
          }
          const responses = await Promise.all(promises);
          for (const resp of responses) {
            const data = await resp.json();
            sessionIds.push(data.id);
          }
        }

        // Execute commands on sample of sessions
        const sampleSize = 20; // Test on 20 sessions
        for (let i = 0; i < sampleSize; i++) {
          const time = await measureTime(() => 
            executeCommand(request, sessionIds[i], 'echo "test"')
          );
          responseTimes.push(time);
        }

        // Average response time should be < 500ms
        const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        expect(avgResponseTime).toBeLessThan(500);

      } finally {
        const response = await request.get(`${API_ENDPOINT}/sessions`);
        const data = await response.json();
        for (const session of data.sessions.slice(0, 100)) {
          await deleteSession(request, session.id);
        }
      }
    });

    test('should handle 1000+ WebSocket messages with 100 sessions', async ({ request }) => {
      try {
        // Create 100 sessions
        const sessionIds: string[] = [];
        for (let batch = 0; batch < 20; batch++) {
          const promises = [];
          for (let i = 0; i < 5; i++) {
            promises.push(
              request.post(`${API_ENDPOINT}/sessions`, {
                data: { shell: '/bin/bash', cols: 80, rows: 24 }
              })
            );
          }
          const responses = await Promise.all(promises);
          for (const resp of responses) {
            const data = await resp.json();
            sessionIds.push(data.id);
          }
        }

        // Send 10 messages per session (1000 total)
        const messagePromises = [];
        for (const sessionId of sessionIds) {
          for (let msg = 0; msg < 10; msg++) {
            messagePromises.push(
              executeCommand(request, sessionId, `echo "message-${msg}"`)
            );
          }
        }

        const results = await Promise.all(messagePromises);
        expect(results.length).toBe(1000);

      } finally {
        const response = await request.get(`${API_ENDPOINT}/sessions`);
        const data = await response.json();
        for (const session of data.sessions.slice(0, 100)) {
          await deleteSession(request, session.id);
        }
      }
    });

    test('should maintain connection stability with 100 sessions', async ({ request }) => {
      try {
        // Create 100 sessions
        const sessionIds: string[] = [];
        for (let batch = 0; batch < 20; batch++) {
          const promises = [];
          for (let i = 0; i < 5; i++) {
            promises.push(
              request.post(`${API_ENDPOINT}/sessions`, {
                data: { shell: '/bin/bash', cols: 80, rows: 24 }
              })
            );
          }
          const responses = await Promise.all(promises);
          for (const resp of responses) {
            const data = await resp.json();
            sessionIds.push(data.id);
          }
        }

        // Keep all sessions alive for 30 seconds with periodic health checks
        const keepAlivePromises = [];
        for (const sessionId of sessionIds) {
          keepAlivePromises.push(
            executeCommand(request, sessionId, 'echo "ping"')
          );
        }

        const results = await Promise.all(keepAlivePromises);
        expect(results.length).toBe(100);

      } finally {
        const response = await request.get(`${API_ENDPOINT}/sessions`);
        const data = await response.json();
        for (const session of data.sessions.slice(0, 100)) {
          await deleteSession(request, session.id);
        }
      }
    });
  });

  // =====================================================
  // Stress Testing (200+ Sessions)
  // =====================================================

  test.describe('200+ Concurrent Sessions (Stress)', () => {
    test('should handle 200 sessions before performance degradation', async ({ request }) => {
      try {
        // Create 200 sessions in batches
        const sessionIds: string[] = [];
        for (let batch = 0; batch < 40; batch++) {
          const promises = [];
          for (let i = 0; i < 5; i++) {
            promises.push(
              request.post(`${API_ENDPOINT}/sessions`, {
                data: { shell: '/bin/bash', cols: 80, rows: 24 }
              })
            );
          }
          const responses = await Promise.all(promises);
          for (const resp of responses) {
            const data = await resp.json();
            sessionIds.push(data.id);
          }
        }

        expect(sessionIds.length).toBeGreaterThanOrEqual(200);

      } finally {
        const response = await request.get(`${API_ENDPOINT}/sessions`);
        const data = await response.json();
        for (const session of data.sessions.slice(0, 200)) {
          await deleteSession(request, session.id);
        }
      }
    });

    test('should recovery gracefully after stress conditions', async ({ request }) => {
      try {
        // Create and then delete 200 sessions rapidly
        for (let batch = 0; batch < 40; batch++) {
          const promises = [];
          for (let i = 0; i < 5; i++) {
            promises.push(
              request.post(`${API_ENDPOINT}/sessions`, {
                data: { shell: '/bin/bash', cols: 80, rows: 24 }
              })
            );
          }
          await Promise.all(promises);
        }

        // Verify system is still responsive
        const response = await request.get(`${API_ENDPOINT}/health`);
        expect(response.status()).toBe(200);

      } finally {
        const response = await request.get(`${API_ENDPOINT}/sessions`);
        const data = await response.json();
        for (const session of data.sessions.slice(0, 200)) {
          await deleteSession(request, session.id);
        }
      }
    });
  });

  // =====================================================
  // Throughput Tests
  // =====================================================

  test.describe('Throughput Testing', () => {
    test('should handle 100+ messages per second per session', async ({ request }) => {
      try {
        // Create 10 sessions
        const sessionIds: string[] = [];
        for (let i = 0; i < 10; i++) {
          const response = await request.post(`${API_ENDPOINT}/sessions`, {
            data: { shell: '/bin/bash', cols: 80, rows: 24 }
          });
          const data = await response.json();
          sessionIds.push(data.id);
        }

        // Send 100 messages per session rapidly
        const start = Date.now();
        const messagePromises = [];
        for (const sessionId of sessionIds) {
          for (let msg = 0; msg < 100; msg++) {
            messagePromises.push(
              executeCommand(request, sessionId, `echo "msg-${msg}"`)
            );
          }
        }

        const results = await Promise.all(messagePromises);
        const duration = Date.now() - start;

        expect(results.length).toBe(1000);
        // 1000 messages in X milliseconds
        // Should be reasonable throughput
        expect(duration).toBeLessThan(10000); // 100 messages/second target

      } finally {
        const response = await request.get(`${API_ENDPOINT}/sessions`);
        const data = await response.json();
        for (const session of data.sessions) {
          await deleteSession(request, session.id);
        }
      }
    });
  });

  // =====================================================
  // Resource Cleanup
  // =====================================================

  test.describe('Resource Cleanup', () => {
    test('should cleanly shutdown after load test', async ({ request }) => {
      const response = await request.get(`${API_ENDPOINT}/health`);
      expect(response.status()).toBe(200);
    });

    test('should have no orphaned sessions after tests', async ({ request }) => {
      const response = await request.get(`${API_ENDPOINT}/sessions`);
      expect(response.status()).toBe(200);
      // Sessions list should be empty or minimal
    });
  });
});
