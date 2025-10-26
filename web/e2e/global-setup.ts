/**
 * Global setup for Playwright tests
 * Runs once before all tests
 */

import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let backendServer: ChildProcess | null = null;

async function isPortInUse(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export default async function globalSetup() {
  console.log('🚀 Starting global test setup...');

  // Check if backend is already running
  const backendRunning = await isPortInUse(4021);
  
  if (backendRunning) {
    console.log('✅ Backend server already running on port 4021');
    process.env.BACKEND_ALREADY_RUNNING = 'true';
  } else {
    console.log('🔧 Starting Go backend server on port 4021...');
    
    const serverPath = path.resolve(__dirname, '../../server');
    
    backendServer = spawn('go', ['run', 'cmd/server/main.go'], {
      cwd: serverPath,
      stdio: 'pipe',
      env: { ...process.env },
    });

    // Wait for server to start
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Backend server failed to start within 10 seconds'));
      }, 10000);

      backendServer!.stdout?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Server running on') || output.includes('Listening on') || output.includes('Starting HTTP server')) {
          clearTimeout(timeout);
          resolve(true);
        }
      });

      backendServer!.stderr?.on('data', (data) => {
        const output = data.toString();
        if (output.includes('address already in use')) {
          clearTimeout(timeout);
          console.log('✅ Backend server already running on port 4021');
          process.env.BACKEND_ALREADY_RUNNING = 'true';
          resolve(true);
        }
      });

      backendServer!.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      // Give it 3 seconds minimum
      setTimeout(() => {
        clearTimeout(timeout);
        resolve(true);
      }, 3000);
    });

    // Store the process PID for cleanup
    if (backendServer && backendServer.pid) {
      process.env.BACKEND_SERVER_PID = backendServer.pid.toString();
    }

    // Wait for server to be fully ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ Backend server started on port 4021');
  }

  console.log('✅ Global test setup completed');
}
