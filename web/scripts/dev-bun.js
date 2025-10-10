const { spawn } = require('child_process');
const path = require('path');

console.log('Starting Bun development mode...');

// Load environment variables from .env.development if it exists
const envFile = path.join(process.cwd(), '..', '.env.development');
const fs = require('fs');
if (fs.existsSync(envFile)) {
  require('dotenv').config({ path: envFile });
  console.log('📝 Loaded environment from .env.development');
}
// Validate Sentry DSN
if (!process.env.SENTRY_SERVER_DSN) {
  console.warn("⚠️  Warning: SENTRY_SERVER_DSN not set - Sentry error reporting disabled for Bun server");
  console.warn("   Set SENTRY_SERVER_DSN in .env.development for error tracking");
}

// Validate version sync first
require('child_process').execSync('bun run scripts/validate-version-sync.js', { stdio: 'inherit' });

// Parse command line arguments using Node's built-in parseArgs
const { parseArgs } = require('util');

const { values } = parseArgs({
  options: {
    port: {
      type: 'string',
    },
    bind: {
      type: 'string',
    },
    'go-server-url': {
      type: 'string',
    },
  },
  allowPositionals: true,
  strict: false,
});

// Set up environment variables
const env = { ...process.env };

if (values.port) {
  env.WEB_PORT = values.port;
} else if (!env.WEB_PORT) {
  env.WEB_PORT = '3001'; // Default port for Bun server
}

if (values.bind) {
  env.HOST = values.bind;
} else if (!env.HOST) {
  env.HOST = '0.0.0.0'; // Default bind
}

if (values['go-server-url']) {
  env.GO_SERVER_URL = values['go-server-url'];
} else if (!env.GO_SERVER_URL) {
  env.GO_SERVER_URL = 'http://localhost:4021'; // FIXED: Default Go server URL (was 4022)
}

console.log(`🚇 Bun server will start on http://${env.HOST}:${env.WEB_PORT}`);
console.log(`🔗 Proxying API requests to: ${env.GO_SERVER_URL}`);

// Start the Bun server with hot reload
const bunProcess = spawn('bun', ['run', '--hot', 'src/bun-server.ts'], {
  stdio: 'inherit',
  env,
  cwd: process.cwd(),
});

bunProcess.on('error', (error) => {
  console.error('Failed to start Bun server:', error);
  process.exit(1);
});

bunProcess.on('close', (code) => {
  console.log(`Bun server process exited with code ${code}`);
  process.exit(code);
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\nShutting down Bun server...');
  bunProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\nShutting down Bun server...');
  bunProcess.kill('SIGTERM');
});
