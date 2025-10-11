#!/usr/bin/env bun
/**
 * Simple HTTP server to serve the dist/ directory for testing
 * Allows testing the settings UI from external devices
 */

import { serve } from 'bun';

const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || '0.0.0.0';

const server = serve({
  port: PORT,
  hostname: HOST,

  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;

    // Default to index.html
    if (path === '/') {
      path = '/index.html';
    }

    // Serve files from dist directory
    const filePath = `./dist${path}`;

    try {
      const file = Bun.file(filePath);

      // Check if file exists
      const exists = await file.exists();
      if (!exists) {
        return new Response('Not Found', { status: 404 });
      }

      // Determine content type
      let contentType = 'text/plain';
      if (path.endsWith('.html')) contentType = 'text/html';
      else if (path.endsWith('.css')) contentType = 'text/css';
      else if (path.endsWith('.js')) contentType = 'application/javascript';
      else if (path.endsWith('.json')) contentType = 'application/json';
      else if (path.endsWith('.png')) contentType = 'image/png';
      else if (path.endsWith('.jpg') || path.endsWith('.jpeg')) contentType = 'image/jpeg';
      else if (path.endsWith('.svg')) contentType = 'image/svg+xml';

      return new Response(file, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    } catch (error) {
      console.error('Error serving file:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
});

console.log('🚀 TunnelForge Desktop Settings Server');
console.log(`📂 Serving: ./dist/`);
console.log(`🌐 Local:    http://localhost:${PORT}`);

// Get network addresses
const networkInterfaces = require('os').networkInterfaces();
const addresses = [];
for (const name of Object.keys(networkInterfaces)) {
  for (const net of networkInterfaces[name]) {
    if (net.family === 'IPv4' && !net.internal) {
      addresses.push(net.address);
    }
  }
}

if (addresses.length > 0) {
  console.log(`🌍 Network:  ${addresses.map(addr => `http://${addr}:${PORT}`).join(', ')}`);
} else {
  console.log(`🌍 Network:  No external addresses found`);
}

console.log('\nPress Ctrl+C to stop');
