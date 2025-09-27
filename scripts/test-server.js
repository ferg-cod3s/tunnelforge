#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const noAuth = args.includes('--no-auth');
const portIndex = args.findIndex(arg => arg === '--port');
const port = portIndex !== -1 ? args[portIndex + 1] : '4022';

console.log(`Starting TunnelForge server for testing on port ${port}...`);

// Start the Go server
const serverPath = path.join(__dirname, '..', 'server', 'bin', 'tunnelforge-server');
const serverArgs = ['--port', port];

if (noAuth) {
  serverArgs.push('--no-auth');
}

const server = spawn(serverPath, serverArgs, {
  cwd: path.join(__dirname, '..'),
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
    TUNNELFORGE_DISABLE_PUSH_NOTIFICATIONS: 'true',
  }
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  console.log(`Server exited with code ${code}`);
  process.exit(code);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Stopping test server...');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('Stopping test server...');
  server.kill('SIGTERM');
});
