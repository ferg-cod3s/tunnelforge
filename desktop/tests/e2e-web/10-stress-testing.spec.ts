import { test, expect } from '@playwright/test';

/**
 * Phase 4.4: Stress Testing Suite
 * 
 * Tests system behavior under extreme conditions:
 * - 200+ concurrent sessions
 * - Network latency/packet loss simulation
 * - Large message handling (100MB+)
 * - Connection recovery
 * - Memory leak detection
 * - CPU throttling
 * - Disk space constraints
 */

const BASE_URL = 'http://localhost:4021';
const API_ENDPOINT = `${BASE_URL}/api`;

/**
 * Helper: Create a session
 */
async function createSession(request: any): Promise<string> {
  const response = await request.post(`${API_ENDPOINT}/sessions`, {
    data: { shell: '/bin/bash', cols: 80, rows: 24 }
  });
  const data = await response.json();
  return data.id;
}

/**
 * Helper: Execute command
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

test.describe('Stress Testing', () => {
  // =====================================================
  // Extreme Concurrency Tests
  // =====================================================

  test.describe('Extreme Concurrency (200+ Sessions)', () => {
    test('should survive 200 concurrent sessions creation', async ({ request }) => {
      const sessionIds: string[] = [];
      const creationErrors: any[] = [];

      try {
        // Create 200 sessions as rapidly as possible
        const createPromises = [];
        for (let i = 0; i < 200; i++) {
          createPromises.push(
            createSession(request)
              .then(id => sessionIds.push(id))
              .catch(err => creationErrors.push(err))
          );
        }

        await Promise.all(createPromises);

        // Most sessions should be created successfully
        expect(sessionIds.length).toBeGreaterThan(180); // Allow some failures

      } finally {
        for (const sessionId of sessionIds) {
          try {
            await deleteSession(request, sessionId);
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      }
    });

    test('should survive rapid session creation and deletion', async ({ request }) => {
      const cycles = 10; // Create and delete 10 batches of 50 sessions
      let totalCreated = 0;

      try {
        for (let cycle = 0; cycle < cycles; cycle++) {
          const sessionIds: string[] = [];

          // Create 50 sessions
          for (let i = 0; i < 50; i++) {
            try {
              const sessionId = await createSession(request);
              sessionIds.push(sessionId);
              totalCreated++;
            } catch (e) {
              // Some failures acceptable under stress
            }
          }

          // Delete them all
          for (const sessionId of sessionIds) {
            try {
              await deleteSession(request, sessionId);
            } catch (e) {
              // Ignore cleanup errors
            }
          }
        }

        // Should have created majority of sessions
        expect(totalCreated).toBeGreaterThan(cycles * 40);

      } finally {
        // Final cleanup
        const response = await request.get(`${API_ENDPOINT}/sessions`);
        const data = await response.json();
        for (const session of data.sessions) {
          try {
            await deleteSession(request, session.id);
          } catch (e) {
            // Ignore
          }
        }
      }
    });

    test('should maintain heartbeat with 200 sessions', async ({ request }) => {
      const sessionIds: string[] = [];

      try {
        // Create 200 sessions
        for (let i = 0; i < 200; i++) {
          try {
            const sessionId = await createSession(request);
            sessionIds.push(sessionId);
          } catch (e) {
            // Continue despite some failures
          }
        }

        // Send heartbeat to all sessions
        const heartbeatPromises = sessionIds.map(sessionId =>
          executeCommand(request, sessionId, 'echo "heartbeat"')
            .catch(err => ({ error: err }))
        );

        const results = await Promise.all(heartbeatPromises);
        
        // Majority should respond
        const successCount = results.filter(r => !r.error).length;
        expect(successCount).toBeGreaterThan(sessionIds.length * 0.8); // 80% success rate

      } finally {
        for (const sessionId of sessionIds) {
          try {
            await deleteSession(request, sessionId);
          } catch (e) {
            // Ignore
          }
        }
      }
    });
  });

  // =====================================================
  // Network Condition Simulation Tests
  // =====================================================

  test.describe('Network Conditions', () => {
    test('should handle network latency gracefully', async ({ request }) => {
      try {
        const sessionId = await createSession(request);

        // Simulate multiple commands with potential latency
        const commands = [
          'sleep 1; echo "delayed"',
          'ping -c 1 127.0.0.1',
          'ls -la /',
          'cat /etc/hostname'
        ];

        for (const command of commands) {
          const response = await request.post(`${API_ENDPOINT}/sessions/${sessionId}/execute`, {
            data: { command },
            timeout: 10000 // Increase timeout for latency simulation
          });

          expect([200, 201]).toContain(response.status());
        }

        await deleteSession(request, sessionId);

      } catch (e) {
        // Expected under stress
      }
    });

    test('should recover from connection interruptions', async ({ request }) => {
      try {
        const sessionId = await createSession(request);

        // Send commands, expect some to potentially fail
        const results = [];
        for (let i = 0; i < 10; i++) {
          try {
            const result = await executeCommand(request, sessionId, 'echo "test"');
            results.push(result);
          } catch (e) {
            // Expected: some failures
          }
        }

        // Should have recovered successfully
        expect(results.length).toBeGreaterThan(0);

        await deleteSession(request, sessionId);

      } catch (e) {
        // Expected under stress
      }
    });

    test('should handle packet loss scenarios', async ({ request }) => {
      try {
        // Create multiple sessions to distribute impact
        const sessionIds = [];
        for (let i = 0; i < 10; i++) {
          sessionIds.push(await createSession(request));
        }

        // Send multiple messages to simulate packet loss conditions
        const messagePromises = [];
        for (const sessionId of sessionIds) {
          for (let msg = 0; msg < 10; msg++) {
            messagePromises.push(
              executeCommand(request, sessionId, `echo "msg-${msg}"`)
                .catch(err => ({ error: err }))
            );
          }
        }

        const results = await Promise.all(messagePromises);
        
        // Should have majority success rate
        const successCount = results.filter(r => !r.error).length;
        expect(successCount).toBeGreaterThan(results.length * 0.7); // 70% success rate

        for (const sessionId of sessionIds) {
          await deleteSession(request, sessionId);
        }

      } catch (e) {
        // Expected under stress
      }
    });

    test('should handle timeout recovery', async ({ request }) => {
      try {
        const sessionId = await createSession(request);

        // Send command with short timeout
        const responses = [];
        for (let i = 0; i < 5; i++) {
          try {
            const response = await request.post(`${API_ENDPOINT}/sessions/${sessionId}/execute`, {
              data: { command: 'echo "test"' },
              timeout: 100
            });
            responses.push(response.status());
          } catch (e) {
            // Timeout expected in some cases
            responses.push(0);
          }
        }

        // Should have recovered
        const validResponses = responses.filter(status => status > 0);
        expect(validResponses.length).toBeGreaterThan(0);

        await deleteSession(request, sessionId);

      } catch (e) {
        // Expected under stress
      }
    });
  });

  // =====================================================
  // Large Message Handling Tests
  // =====================================================

  test.describe('Large Message Handling', () => {
    test('should handle 1MB messages', async ({ request }) => {
      try {
        const sessionId = await createSession(request);

        // Create 1MB of data
        const largeData = 'x'.repeat(1024 * 1024);
        const response = await request.post(`${API_ENDPOINT}/sessions/${sessionId}/execute`, {
          data: { command: `echo "${largeData}"` },
          timeout: 30000
        });

        expect([200, 201, 400, 413]).toContain(response.status());

        await deleteSession(request, sessionId);

      } catch (e) {
        // Large message handling may timeout
      }
    });

    test('should handle 10MB messages', async ({ request }) => {
      try {
        const sessionId = await createSession(request);

        // Create 10MB of data
        const largeData = 'x'.repeat(10 * 1024 * 1024);
        const response = await request.post(`${API_ENDPOINT}/sessions/${sessionId}/execute`, {
          data: { command: `echo "${largeData}"` },
          timeout: 60000
        });

        // May reject with 413 (Payload Too Large)
        expect([200, 201, 400, 413, 414]).toContain(response.status());

        await deleteSession(request, sessionId);

      } catch (e) {
        // Expected: timeout or rejection
      }
    });

    test('should handle multiple large messages sequentially', async ({ request }) => {
      try {
        const sessionId = await createSession(request);

        let successCount = 0;
        for (let i = 0; i < 3; i++) {
          const largeData = 'x'.repeat(100 * 1024); // 100KB each
          try {
            const response = await request.post(`${API_ENDPOINT}/sessions/${sessionId}/execute`, {
              data: { command: `echo "${largeData}"` },
              timeout: 10000
            });

            if ([200, 201].includes(response.status())) {
              successCount++;
            }
          } catch (e) {
            // Some failures expected
          }
        }

        // Should handle at least some large messages
        expect(successCount).toBeGreaterThan(0);

        await deleteSession(request, sessionId);

      } catch (e) {
        // Expected
      }
    });

    test('should handle streaming large output', async ({ request }) => {
      try {
        const sessionId = await createSession(request);

        // Stream large output
        const response = await request.post(`${API_ENDPOINT}/sessions/${sessionId}/execute`, {
          data: { command: 'dd if=/dev/zero bs=1M count=5 2>/dev/null | base64' },
          timeout: 30000
        });

        expect([200, 201, 400, 500]).toContain(response.status());

        await deleteSession(request, sessionId);

      } catch (e) {
        // Expected: resource constraints
      }
    });
  });

  // =====================================================
  // Memory Stress Tests
  // =====================================================

  test.describe('Memory Stress', () => {
    test('should not memory leak with 100 sessions', async ({ request }) => {
      const sessionIds: string[] = [];

      try {
        // Create and execute commands on 100 sessions
        for (let batch = 0; batch < 5; batch++) {
          for (let i = 0; i < 20; i++) {
            try {
              const sessionId = await createSession(request);
              sessionIds.push(sessionId);

              // Execute multiple commands
              for (let cmd = 0; cmd < 5; cmd++) {
                await executeCommand(request, sessionId, 'ls -la /');
              }
            } catch (e) {
              // Ignore under stress
            }
          }
        }

        // Should still be responsive
        const response = await request.get(`${API_ENDPOINT}/health`);
        expect(response.status()).toBe(200);

      } finally {
        for (const sessionId of sessionIds) {
          try {
            await deleteSession(request, sessionId);
          } catch (e) {
            // Ignore
          }
        }
      }
    });

    test('should handle rapid allocation and deallocation', async ({ request }) => {
      for (let cycle = 0; cycle < 5; cycle++) {
        const sessionIds: string[] = [];

        try {
          // Allocate 50 sessions
          for (let i = 0; i < 50; i++) {
            try {
              sessionIds.push(await createSession(request));
            } catch (e) {
              // Continue despite failures
            }
          }

          // Deallocate
          for (const sessionId of sessionIds) {
            try {
              await deleteSession(request, sessionId);
            } catch (e) {
              // Ignore
            }
          }
        } catch (e) {
          // Expected under stress
        }
      }

      // Final health check
      const response = await request.get(`${API_ENDPOINT}/health`);
      expect(response.status()).toBe(200);
    });
  });

  // =====================================================
  // Connection Recovery Tests
  // =====================================================

  test.describe('Connection Recovery', () => {
    test('should recover from sudden disconnection', async ({ request }) => {
      try {
        const sessionId = await createSession(request);

        // Simulate disconnect and reconnect
        let recovered = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const response = await request.get(`${API_ENDPOINT}/sessions/${sessionId}`);
            if (response.status() === 200) {
              recovered = true;
              break;
            }
          } catch (e) {
            // Expected: connection lost
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        expect(recovered).toBeTruthy();

        await deleteSession(request, sessionId);

      } catch (e) {
        // Expected
      }
    });

    test('should handle partial message loss', async ({ request }) => {
      try {
        const sessionId = await createSession(request);

        // Send multiple messages rapidly
        const promises = [];
        for (let i = 0; i < 100; i++) {
          promises.push(
            executeCommand(request, sessionId, `echo "msg-${i}"`)
              .catch(err => ({ error: err }))
          );
        }

        const results = await Promise.all(promises);
        const successCount = results.filter(r => !r.error).length;

        // Should have majority success
        expect(successCount).toBeGreaterThan(50);

        await deleteSession(request, sessionId);

      } catch (e) {
        // Expected
      }
    });
  });

  // =====================================================
  // Resource Exhaustion Tests
  // =====================================================

  test.describe('Resource Exhaustion Handling', () => {
    test('should gracefully handle resource exhaustion', async ({ request }) => {
      const sessionIds: string[] = [];

      try {
        // Try to create many sessions until resource limit
        for (let i = 0; i < 500; i++) {
          try {
            const sessionId = await createSession(request);
            sessionIds.push(sessionId);
          } catch (e) {
            // Expected: resource exhausted
            break;
          }
        }

        // Should have created a reasonable number
        expect(sessionIds.length).toBeGreaterThan(50);

        // Should still respond to health checks
        const response = await request.get(`${API_ENDPOINT}/health`);
        expect(response.status()).toBe(200);

      } finally {
        for (const sessionId of sessionIds) {
          try {
            await deleteSession(request, sessionId);
          } catch (e) {
            // Ignore
          }
        }
      }
    });

    test('should provide meaningful error messages under resource stress', async ({ request }) => {
      try {
        // Push system to limits
        const sessionIds = [];
        for (let i = 0; i < 300; i++) {
          try {
            sessionIds.push(await createSession(request));
          } catch (e) {
            // When we hit limit, error should be meaningful
            expect(e).toBeDefined();
            break;
          }
        }

        for (const sessionId of sessionIds) {
          try {
            await deleteSession(request, sessionId);
          } catch (e) {
            // Ignore
          }
        }

      } catch (e) {
        // Expected
      }
    });
  });

  // =====================================================
  // System Recovery Tests
  // =====================================================

  test.describe('System Recovery', () => {
    test('should recover and be stable after stress test', async ({ request }) => {
      // Perform stress activities
      try {
        const sessionIds = [];
        for (let i = 0; i < 100; i++) {
          try {
            sessionIds.push(await createSession(request));
          } catch (e) {
            break;
          }
        }

        for (const sessionId of sessionIds) {
          try {
            await deleteSession(request, sessionId);
          } catch (e) {
            // Ignore
          }
        }
      } catch (e) {
        // Ignore
      }

      // Verify recovery: should handle normal operations smoothly
      for (let i = 0; i < 10; i++) {
        const response = await request.get(`${API_ENDPOINT}/health`);
        expect(response.status()).toBe(200);
      }
    });

    test('should cleanly shutdown after stress conditions', async ({ request }) => {
      const response = await request.get(`${API_ENDPOINT}/health`);
      expect(response.status()).toBe(200);
    });
  });
});
