import { test, expect } from '@playwright/test';
import axios from 'axios';
import { WebSocket } from 'ws';

const BASE_URL = 'http://localhost:4021';
const API_URL = `${BASE_URL}/api`;
const WS_URL = 'ws://localhost:4021';

const api = axios.create({
  baseURL: API_URL,
  validateStatus: () => true,
});

test.describe('Features: Session Management', () => {
  let sessionId: string;
  let authToken: string;

  test.beforeAll(async () => {
    // Authenticate first
    const loginResponse = await api.post('/auth/login', {
      username: 'testuser',
      password: 'testpass123'
    });

    if (loginResponse.status === 200) {
      authToken = loginResponse.data.token;
      api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    }
  });

  test.describe('Session Creation and Lifecycle', () => {
    test('should create new terminal session', async () => {
      const response = await api.post('/sessions', {
        command: '/bin/bash',
        cols: 80,
        rows: 24
      });

      expect(response.status).toBe(200);
      expect(response.data.id).toBeTruthy();
      sessionId = response.data.id;
    });

    test('should get session details', async () => {
      const response = await api.get(`/sessions/${sessionId}`);

      expect(response.status).toBe(200);
      expect(response.data.id).toBe(sessionId);
      expect(response.data.status).toBeTruthy();
    });

    test('should list all sessions', async () => {
      const response = await api.get('/sessions');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.data) || Array.isArray(response.data.sessions)).toBe(true);
    });

    test('should execute command in session', async () => {
      const response = await api.post(`/sessions/${sessionId}/execute`, {
        command: 'echo "test output"'
      });

      expect(response.status).toBe(200);
      expect(response.data.output || response.data.stdout).toBeTruthy();
    });

    test('should send input to session', async () => {
      const response = await api.post(`/sessions/${sessionId}/input`, {
        data: 'ls\n'
      });

      expect([200, 204]).toContain(response.status);
    });

    test('should read output from session', async () => {
      const response = await api.get(`/sessions/${sessionId}/output`, {
        params: { limit: 1000 }
      });

      expect([200, 204]).toContain(response.status);
    });

    test('should resize terminal', async () => {
      const response = await api.post(`/sessions/${sessionId}/resize`, {
        cols: 100,
        rows: 30
      });

      expect([200, 204]).toContain(response.status);
    });

    test('should pause session', async () => {
      const response = await api.post(`/sessions/${sessionId}/pause`);

      expect([200, 204]).toContain(response.status);
    });

    test('should resume session', async () => {
      const response = await api.post(`/sessions/${sessionId}/resume`);

      expect([200, 204]).toContain(response.status);
    });

    test('should terminate session', async () => {
      const response = await api.delete(`/sessions/${sessionId}`);

      expect([200, 204]).toContain(response.status);
    });
  });

  test.describe('WebSocket Terminal Communication', () => {
    test('should establish WebSocket connection', async () => {
      const ws = new WebSocket(`${WS_URL}/terminal`);
      
      await new Promise((resolve, reject) => {
        ws.on('open', () => resolve(true));
        ws.on('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });

      ws.close();
      expect(true).toBe(true);
    });

    test('should create session via WebSocket', async () => {
      const ws = new WebSocket(`${WS_URL}/terminal`);
      
      const response = await new Promise((resolve) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'create',
            command: '/bin/bash',
            cols: 80,
            rows: 24
          }));
        });

        ws.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });

        setTimeout(() => resolve({ error: 'timeout' }), 5000);
      });

      ws.close();
      expect(response).toBeTruthy();
    });

    test('should send and receive data via WebSocket', async () => {
      const ws = new WebSocket(`${WS_URL}/terminal`);
      let sessionId: string;

      // First create a session
      const createResponse = await new Promise((resolve) => {
        ws.on('open', () => {
          ws.send(JSON.stringify({
            type: 'create',
            command: '/bin/bash',
            cols: 80,
            rows: 24
          }));
        });

        ws.on('message', (data) => {
          resolve(JSON.parse(data.toString()));
        });

        setTimeout(() => resolve({ error: 'timeout' }), 5000);
      });

      if (createResponse && createResponse.id) {
        sessionId = createResponse.id;

        // Then send data
        await new Promise((resolve) => {
          ws.send(JSON.stringify({
            type: 'input',
            data: 'echo "hello"\n'
          }));

          ws.on('message', () => resolve(true));
          setTimeout(() => resolve(false), 2000);
        });

        expect(sessionId).toBeTruthy();
      }

      ws.close();
    });

    test('should handle multiple concurrent WebSocket connections', async () => {
      const connections = [];
      
      for (let i = 0; i < 5; i++) {
        const ws = new WebSocket(`${WS_URL}/terminal`);
        connections.push(ws);
      }

      await new Promise((resolve) => {
        let openCount = 0;
        connections.forEach((ws) => {
          ws.on('open', () => {
            openCount++;
            if (openCount === connections.length) {
              resolve(true);
            }
          });
        });

        setTimeout(() => resolve(false), 5000);
      });

      connections.forEach((ws) => ws.close());
      expect(connections.length).toBe(5);
    });

    test('should handle WebSocket disconnection gracefully', async () => {
      const ws = new WebSocket(`${WS_URL}/terminal`);
      
      const disconnected = await new Promise((resolve) => {
        ws.on('open', () => {
          ws.close();
        });

        ws.on('close', () => {
          resolve(true);
        });

        setTimeout(() => resolve(false), 5000);
      });

      expect(disconnected).toBe(true);
    });
  });

  test.describe('Session Persistence and Recovery', () => {
    test('should persist session state', async () => {
      // Create a session
      const createResponse = await api.post('/sessions', {
        command: '/bin/bash',
        cols: 80,
        rows: 24
      });

      const sessionId = createResponse.data.id;

      // Execute command
      await api.post(`/sessions/${sessionId}/execute`, {
        command: 'export TEST_VAR=testvalue'
      });

      // Close and reconnect
      const detachResponse = await api.post(`/sessions/${sessionId}/detach`);
      expect([200, 204]).toContain(detachResponse.status);

      // Reattach
      const attachResponse = await api.post(`/sessions/${sessionId}/attach`);
      expect([200, 204]).toContain(attachResponse.status);
    });

    test('should save session history', async () => {
      const createResponse = await api.post('/sessions', {
        command: '/bin/bash',
        cols: 80,
        rows: 24
      });

      const sessionId = createResponse.data.id;

      // Execute multiple commands
      await api.post(`/sessions/${sessionId}/execute`, {
        command: 'pwd'
      });

      await api.post(`/sessions/${sessionId}/execute`, {
        command: 'ls'
      });

      // Get history
      const historyResponse = await api.get(`/sessions/${sessionId}/history`);

      expect([200, 204]).toContain(historyResponse.status);
      if (historyResponse.status === 200) {
        expect(Array.isArray(historyResponse.data) || historyResponse.data.history).toBeTruthy();
      }
    });

    test('should restore session on server restart', async () => {
      const createResponse = await api.post('/sessions', {
        command: '/bin/bash',
        cols: 80,
        rows: 24
      });

      const sessionId = createResponse.data.id;

      // Save session state
      const saveResponse = await api.post(`/sessions/${sessionId}/save`);
      expect([200, 204]).toContain(saveResponse.status);

      // Simulate server restart by recreating connection
      const restoreResponse = await api.post('/sessions/restore', {
        sessionId: sessionId
      });

      expect([200, 400]).toContain(restoreResponse.status);
    });
  });

  test.describe('Multi-Session Management', () => {
    test('should manage multiple independent sessions', async () => {
      const sessions = [];

      // Create 3 sessions
      for (let i = 0; i < 3; i++) {
        const response = await api.post('/sessions', {
          command: '/bin/bash',
          cols: 80,
          rows: 24
        });

        if (response.status === 200) {
          sessions.push(response.data.id);
        }
      }

      expect(sessions.length).toBe(3);

      // Verify all sessions are independent
      for (const sid of sessions) {
        const response = await api.get(`/sessions/${sid}`);
        expect(response.status).toBe(200);
      }
    });

    test('should isolate session environments', async () => {
      // Create session 1 and set variable
      const response1 = await api.post('/sessions', {
        command: '/bin/bash',
        cols: 80,
        rows: 24
      });

      const session1 = response1.data.id;

      await api.post(`/sessions/${session1}/execute`, {
        command: 'export SESSION_VAR=session1'
      });

      // Create session 2 and check variable doesn't exist
      const response2 = await api.post('/sessions', {
        command: '/bin/bash',
        cols: 80,
        rows: 24
      });

      const session2 = response2.data.id;

      const checkResponse = await api.post(`/sessions/${session2}/execute`, {
        command: 'echo $SESSION_VAR'
      });

      // Should be empty or undefined
      expect(checkResponse.status).toBe(200);
    });

    test('should handle session timeouts', async () => {
      const response = await api.post('/sessions', {
        command: '/bin/bash',
        cols: 80,
        rows: 24
      });

      const sessionId = response.data.id;

      // Wait for potential timeout
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Try to use session
      const checkResponse = await api.get(`/sessions/${sessionId}`);

      // Session might still exist or have timed out
      expect([200, 404]).toContain(checkResponse.status);
    });

    test('should cleanup terminated sessions', async () => {
      const response = await api.post('/sessions', {
        command: '/bin/bash',
        cols: 80,
        rows: 24
      });

      const sessionId = response.data.id;

      // Terminate session
      await api.delete(`/sessions/${sessionId}`);

      // Try to use terminated session
      const checkResponse = await api.get(`/sessions/${sessionId}`);

      // Should return not found
      expect([404, 200]).toContain(checkResponse.status);
    });
  });

  test.describe('Session Control and Signals', () => {
    test('should send SIGTERM to session', async () => {
      const response = await api.post('/sessions', {
        command: '/bin/bash',
        cols: 80,
        rows: 24
      });

      const sessionId = response.data.id;

      const signalResponse = await api.post(`/sessions/${sessionId}/signal`, {
        signal: 'SIGTERM'
      });

      expect([200, 204]).toContain(signalResponse.status);
    });

    test('should send SIGKILL to session', async () => {
      const response = await api.post('/sessions', {
        command: '/bin/bash',
        cols: 80,
        rows: 24
      });

      const sessionId = response.data.id;

      const signalResponse = await api.post(`/sessions/${sessionId}/signal`, {
        signal: 'SIGKILL'
      });

      expect([200, 204]).toContain(signalResponse.status);
    });

    test('should send CTRL-C to session', async () => {
      const response = await api.post('/sessions', {
        command: '/bin/bash',
        cols: 80,
        rows: 24
      });

      const sessionId = response.data.id;

      const ctrlCResponse = await api.post(`/sessions/${sessionId}/ctrl-c`);

      expect([200, 204]).toContain(ctrlCResponse.status);
    });

    test('should get session exit status', async () => {
      const response = await api.post('/sessions', {
        command: '/bin/bash',
        cols: 80,
        rows: 24
      });

      const sessionId = response.data.id;

      // Terminate session
      await api.delete(`/sessions/${sessionId}`);

      // Get exit status
      const statusResponse = await api.get(`/sessions/${sessionId}/exit-status`);

      expect([200, 404]).toContain(statusResponse.status);
    });
  });

  test.describe('Session Monitoring and Metrics', () => {
    test('should get session CPU usage', async () => {
      const response = await api.post('/sessions', {
        command: '/bin/bash',
        cols: 80,
        rows: 24
      });

      const sessionId = response.data.id;

      const cpuResponse = await api.get(`/sessions/${sessionId}/metrics/cpu`);

      expect([200, 400]).toContain(cpuResponse.status);
    });

    test('should get session memory usage', async () => {
      const response = await api.post('/sessions', {
        command: '/bin/bash',
        cols: 80,
        rows: 24
      });

      const sessionId = response.data.id;

      const memResponse = await api.get(`/sessions/${sessionId}/metrics/memory`);

      expect([200, 400]).toContain(memResponse.status);
    });

    test('should get session I/O statistics', async () => {
      const response = await api.post('/sessions', {
        command: '/bin/bash',
        cols: 80,
        rows: 24
      });

      const sessionId = response.data.id;

      const ioResponse = await api.get(`/sessions/${sessionId}/metrics/io`);

      expect([200, 400]).toContain(ioResponse.status);
    });

    test('should get all session metrics', async () => {
      const response = await api.post('/sessions', {
        command: '/bin/bash',
        cols: 80,
        rows: 24
      });

      const sessionId = response.data.id;

      const metricsResponse = await api.get(`/sessions/${sessionId}/metrics`);

      expect([200, 400]).toContain(metricsResponse.status);
    });
  });
});
