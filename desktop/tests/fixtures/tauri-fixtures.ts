import { test as base, Page, BrowserContext, TestInfo } from '@playwright/test';
import { TauriTestHelper, createTauriHelper } from '../e2e-tauri/helpers/tauri-helpers.js';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const sleep = promisify(setTimeout);

// Test fixture types
export interface TauriFixtures {
  tauriHelper: TauriTestHelper;
  tauriApp: TauriAppFixture;
  tunnelForgeServer: TunnelForgeServerFixture;
}

export interface TauriAppFixture {
  isRunning: boolean;
  pid?: number;
  debugPort: number;
  appUrl: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;
  waitForReady(): Promise<void>;
}

export interface TunnelForgeServerFixture {
  isRunning: boolean;
  port: number;
  apiUrl: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  waitForReady(): Promise<void>;
  healthCheck(): Promise<boolean>;
}

/**
 * Extended test fixture with Tauri-specific functionality
 */
export const test = base.extend<TauriFixtures>({
  // Tauri helper fixture
  tauriHelper: async ({ page, context, testInfo }, use) => {
    const debugPort = 9222;
    const helper = createTauriHelper(page, context, testInfo, debugPort);
    
    // Setup console logging
    await helper.logConsoleMessages();
    
    // Wait for Tauri app to be ready
    await helper.waitForTauriApp();
    
    await use(helper);
  },

  // Tauri app fixture
  tauriApp: async ({}, use) => {
    const app: TauriAppFixture = {
      isRunning: false,
      debugPort: 9222,
      appUrl: 'http://localhost:1420',
      process: undefined as ChildProcessWithoutNullStreams | undefined,
      
      async start() {
        if (this.isRunning) {
          console.log('📱 Tauri app is already running');
          return;
        }

        console.log('🚀 Starting Tauri app...');
        
        // Start Tauri dev server
        this.process = spawn('bun', ['run', 'tauri', 'dev'], {
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            TAURI_DEBUG: '1',
            RUST_LOG: 'debug',
            TUNNELFORGE_TEST_MODE: 'true',
          },
        });

        // Handle process output
        this.process.stdout?.on('data', (data) => {
          console.log(`📱 Tauri: ${data.toString()}`);
        });

        this.process.stderr?.on('data', (data) => {
          console.error(`❌ Tauri Error: ${data.toString()}`);
        });

        this.process.on('close', (code) => {
          console.log(`📱 Tauri process exited with code ${code}`);
          this.isRunning = false;
        });

        // Wait for app to be ready
        await this.waitForReady();
        this.isRunning = true;
        console.log('✅ Tauri app started successfully');
      },

      async stop() {
        if (!this.isRunning || !this.process) {
          console.log('📱 Tauri app is not running');
          return;
        }

        console.log('🛑 Stopping Tauri app...');
        
        // Try graceful shutdown first
        this.process.kill('SIGTERM');
        
        // Wait a bit for graceful shutdown
        await sleep(5000);
        
        // Force kill if still running
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
        
        this.isRunning = false;
        console.log('✅ Tauri app stopped');
      },

      async restart() {
        await this.stop();
        await sleep(2000);
        await this.start();
      },

      async waitForReady() {
        const maxWaitTime = 60000; // 60 seconds
        const checkInterval = 1000; // 1 second
        let attempts = 0;
        const maxAttempts = maxWaitTime / checkInterval;

        while (attempts < maxAttempts) {
          try {
            const response = await fetch(this.appUrl, {
              method: 'GET',
              timeout: 5000,
            });

            if (response.ok) {
              const content = await response.text();
              if (content.includes('__TAURI__') || content.includes('TunnelForge')) {
                console.log('✅ Tauri app is ready');
                return;
              }
            }
          } catch (error) {
            // App not ready yet
          }

          attempts++;
          await sleep(checkInterval);

          if (attempts % 10 === 0) {
            console.log(`⏳ Waiting for Tauri app... (${attempts}/${maxAttempts})`);
          }
        }

        throw new Error(`Tauri app failed to start within ${maxWaitTime}ms`);
      },
    };

    // Start the app
    await app.start();

    // Use the fixture
    await use(app);

    // Cleanup
    await app.stop();
  },

  // TunnelForge server fixture
  tunnelForgeServer: async ({}, use) => {
    const server: TunnelForgeServerFixture = {
      isRunning: false,
      port: 4021,
      apiUrl: 'http://localhost:4021',
      process: undefined as ChildProcessWithoutNullStreams | undefined,
      
      async start() {
        if (this.isRunning) {
          console.log('🔧 TunnelForge server is already running');
          return;
        }

        console.log('🚀 Starting TunnelForge server...');
        
        // Check if server is already running
        const isAlreadyRunning = await this.healthCheck();
        if (isAlreadyRunning) {
          console.log('✅ TunnelForge server is already running');
          this.isRunning = true;
          return;
        }

        // Start server process
        const serverPath = path.join(process.cwd(), '../server');
        this.process = spawn('go', ['run', './cmd/server'], {
          cwd: serverPath,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            PORT: this.port.toString(),
            TUNNELFORGE_TEST_MODE: 'true',
            RUST_LOG: 'debug',
          },
        });

        // Handle process output
        this.process.stdout?.on('data', (data) => {
          console.log(`🔧 Server: ${data.toString()}`);
        });

        this.process.stderr?.on('data', (data) => {
          console.error(`❌ Server Error: ${data.toString()}`);
        });

        this.process.on('close', (code) => {
          console.log(`🔧 Server process exited with code ${code}`);
          this.isRunning = false;
        });

        // Wait for server to be ready
        await this.waitForReady();
        this.isRunning = true;
        console.log('✅ TunnelForge server started successfully');
      },

      async stop() {
        if (!this.isRunning || !this.process) {
          console.log('🔧 TunnelForge server is not running');
          return;
        }

        console.log('🛑 Stopping TunnelForge server...');
        
        // Try graceful shutdown first
        this.process.kill('SIGTERM');
        
        // Wait a bit for graceful shutdown
        await sleep(5000);
        
        // Force kill if still running
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
        
        this.isRunning = false;
        console.log('✅ TunnelForge server stopped');
      },

      async waitForReady() {
        const maxWaitTime = 30000; // 30 seconds
        const checkInterval = 1000; // 1 second
        let attempts = 0;
        const maxAttempts = maxWaitTime / checkInterval;

        while (attempts < maxAttempts) {
          if (await this.healthCheck()) {
            console.log('✅ TunnelForge server is ready');
            return;
          }

          attempts++;
          await sleep(checkInterval);

          if (attempts % 5 === 0) {
            console.log(`⏳ Waiting for TunnelForge server... (${attempts}/${maxAttempts})`);
          }
        }

        throw new Error(`TunnelForge server failed to start within ${maxWaitTime}ms`);
      },

      async healthCheck(): Promise<boolean> {
        try {
          const response = await fetch(`${this.apiUrl}/health`, {
            method: 'GET',
            timeout: 5000,
          });

          if (response.ok) {
            const data = await response.json();
            return data.status === 'ok' || data.status === 'healthy';
          }
        } catch (error) {
          // Server not ready yet
        }

        return false;
      },
    };

    // Start the server
    await server.start();

    // Use the fixture
    await use(server);

    // Cleanup
    await server.stop();
  },
});

// Export the extended test
export { expect } from '@playwright/test';

// Custom test decorators
export const tauriTest = test.extend({
  // Automatically start Tauri app for these tests
  tauriApp: async ({ tauriApp }, use) => {
    await use(tauriApp);
  },
});

export const fullStackTest = test.extend({
  // Start both Tauri app and TunnelForge server
  tauriApp: async ({ tauriApp }, use) => {
    await use(tauriApp);
  },
  tunnelForgeServer: async ({ tunnelForgeServer }, use) => {
    await use(tunnelForgeServer);
  },
});

// Test annotations
export const annotations = {
  desktop: { tag: ['@desktop', '@tauri'] },
  webview: { tag: ['@webview', '@tauri'] },
  integration: { tag: ['@integration', '@e2e'] },
  wsl: { tag: ['@wsl', '@linux'] },
  ci: { tag: ['@ci'] },
  debug: { tag: ['@debug'] },
};

// Helper functions
export async function createTestDirectories(): Promise<void> {
  const testDirs = [
    'test-results/tauri-output',
    'test-results/tauri-screenshots',
    'test-results/tauri-videos',
    'test-results/tauri-traces',
    'test-results/tauri-logs',
  ];

  for (const dir of testDirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }
}

export async function cleanupTestArtifacts(): Promise<void> {
  const cleanupPatterns = [
    '/tmp/tauri-*.json',
    '/tmp/tunnelforge-*.log',
    '/tmp/playwright-*.log',
    'test-results/tauri-*.tmp',
  ];

  for (const pattern of cleanupPatterns) {
    try {
      const { exec } = require('child_process');
      await promisify(exec)(`rm -f ${pattern}`);
    } catch (error) {
      // Files might not exist
    }
  }
}

export function getPlatformInfo() {
  return {
    platform: process.platform,
    arch: process.arch,
    isWSL: process.platform === 'linux' && !!process.env.WSL_DISTRO_NAME,
    isWSL2: process.platform === 'linux' && !!process.env.WSL_INTEROP,
    isCI: !!process.env.CI,
    isHeadless: process.env.HEADED !== 'true',
    isDebug: process.env.DEBUG === 'true',
  };
}