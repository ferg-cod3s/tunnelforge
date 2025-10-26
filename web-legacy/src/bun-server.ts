// Bun Server for TunnelForge - Serves original frontend, proxies to Go backend
// This replaces the Node.js server but keeps all the frontend intact

// Initialize Sentry for backend error tracking
import { initServerSentry } from './server/sentry.js';

initServerSentry();

const server = Bun.serve({
  port: Number(process.env.WEB_PORT || process.env.PORT) || 3001,
  hostname: process.env.HOST || '0.0.0.0',
  idleTimeout: 120, // 120 seconds timeout to prevent request timeouts

  // WebSocket connections should connect directly to Go server
  // No WebSocket handler needed in Bun proxy

  async fetch(req: Request, _server): Promise<Response> {
    const url = new URL(req.url);
    const GO_SERVER_URL = process.env.GO_SERVER_URL || 'http://localhost:4021';

    console.log(`📡 ${req.method} ${url.pathname}`);

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Serve static files first
    if (
      url.pathname.startsWith('/bundle/') ||
      url.pathname.startsWith('/assets/') ||
      url.pathname.startsWith('/fonts/') ||
      url.pathname.startsWith('/monaco-editor/') ||
      url.pathname === '/favicon.ico' ||
      url.pathname === '/manifest.json' ||
      url.pathname === '/sw.js' ||
      url.pathname.includes('.png') ||
      url.pathname.includes('.jpg') ||
      url.pathname.includes('.ico') ||
      url.pathname.includes('.css') ||
      url.pathname.includes('.js') ||
      url.pathname.includes('.json') ||
      url.pathname.includes('.ttf') ||
      url.pathname.includes('.woff') ||
      url.pathname.includes('.woff2') ||
      url.pathname.includes('.html')
    ) {
      const filePath = `./public${url.pathname}`;
      const file = Bun.file(filePath);

      if (await file.exists()) {
        // Get proper MIME type based on extension
        const ext = url.pathname.split('.').pop()?.toLowerCase();
        const mimeTypes: Record<string, string> = {
          js: 'application/javascript',
          css: 'text/css',
          json: 'application/json',
          png: 'image/png',
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          ico: 'image/x-icon',
          ttf: 'font/ttf',
          woff: 'font/woff',
          woff2: 'font/woff2',
          html: 'text/html',
        };

        const headers: Record<string, string> = {};
        if (ext && mimeTypes[ext]) {
          headers['Content-Type'] = mimeTypes[ext];
        }

        // Add caching headers for static assets
        if (
          url.pathname.startsWith('/bundle/') ||
          url.pathname.includes('.ttf') ||
          url.pathname.includes('.woff')
        ) {
          headers['Cache-Control'] = 'public, max-age=31536000'; // 1 year
        }

        return new Response(file, { headers });
      }

      return new Response('Static file not found', { status: 404 });
    }

    // Handle client configuration requests
    if (url.pathname === '/api/config') {
      try {
        // Fetch config from Go server to get authRequired status
        const goConfigResponse = await fetch(`${GO_SERVER_URL}/api/config`);
        const goConfig = await goConfigResponse.json();

        // Get the host from the request to determine the correct WebSocket URL
        const requestHost = req.headers.get('host') || 'localhost:3001';
        const protocol = req.url.startsWith('https') ? 'wss' : 'ws';

        // For network access, point directly to Go server using the same host but Go server port
        const goServerPort = new URL(GO_SERVER_URL).port;
        // If request is from network (not localhost), use the same host for WebSocket
        const isLocalhost = requestHost.includes('localhost') || requestHost.includes('127.0.0.1');
        const wsHost = isLocalhost
          ? `localhost:${goServerPort}`
          : requestHost.replace(/:\d+$/, `:${goServerPort}`);

        // Merge Go server config with client-specific settings
        const config = {
          ...goConfig,
          websocketUrl: `${protocol}://${wsHost}`,
          features: {
            ...goConfig.features,
            directWebSocket: true, // Back to direct connection
            streamingEnabled: true,
          },
          // Include origin information for WebSocket connections
          origin: `${req.url.startsWith('https') ? 'https' : 'http'}://${requestHost}`,
        };

        return new Response(JSON.stringify(config), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache',
          },
        });
      } catch (error) {
        console.error('Failed to fetch Go server config:', error);
        // Fallback config if Go server is unavailable
        const requestHost = req.headers.get('host') || 'localhost:3001';
        const protocol = req.url.startsWith('https') ? 'wss' : 'ws';
        const goServerPort = new URL(GO_SERVER_URL).port;
        const isLocalhost = requestHost.includes('localhost') || requestHost.includes('127.0.0.1');
        const wsHost = isLocalhost
          ? `localhost:${goServerPort}`
          : requestHost.replace(/:\d+$/, `:${goServerPort}`);

        return new Response(
          JSON.stringify({
            authRequired: false,
            websocketUrl: `${protocol}://${wsHost}`,
            features: { directWebSocket: true, streamingEnabled: true },
            origin: `${req.url.startsWith('https') ? 'https' : 'http'}://${requestHost}`,
          }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-cache',
            },
          }
        );
      }
    }

    // Handle client-side console logs
    if (url.pathname === '/api/client-logs' && req.method === 'POST') {
      try {
        const body = await req.json();
        const logs = body.logs || [];

        // Write logs to console with [BROWSER] prefix
        for (const log of logs) {
          const timestamp = new Date(log.timestamp).toISOString();
          const prefix = `[BROWSER ${log.level.toUpperCase()}]`;
          const message = `${prefix} [${timestamp}] ${log.message}`;

          switch (log.level) {
            case 'error':
              console.error(message);
              break;
            case 'warn':
              console.warn(message);
              break;
            case 'debug':
              console.debug(message);
              break;
            default:
              console.log(message);
          }
        }

        return new Response(JSON.stringify({ success: true, count: logs.length }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } catch (error) {
        console.error('Failed to process client logs:', error);
        return new Response(JSON.stringify({ error: 'Failed to process logs' }), {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }




    if (url.pathname === '/api/files/upload') {
      return new Response(
        JSON.stringify({
          error: 'File upload not yet implemented via this endpoint',
          message: 'Use /api/filesystem/upload instead',
          suggestion: 'The Go server provides file upload at /api/filesystem/upload',
        }),
        {
          status: 501, // Not Implemented
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }

    // Handle SSE (Server-Sent Events) - Native implementation instead of proxy
    if (url.pathname === '/api/events') {
      console.log('🌊 Native SSE stream: /api/events');

      return new Response(
        new ReadableStream({
          start(controller) {
            let isClosed = false;

            // Send initial connection event
            const connectEvent = {
              type: 'connected',
              timestamp: new Date().toISOString(),
            };
            const sseData = `id: 1\nevent: connected\ndata: ${JSON.stringify(connectEvent)}\n\n`;
            controller.enqueue(new TextEncoder().encode(sseData));

            // Set up heartbeat
            const heartbeatInterval = setInterval(() => {
              if (isClosed) {
                clearInterval(heartbeatInterval);
                return;
              }
              try {
                const heartbeatData = `:heartbeat ${Date.now()}\n\n`;
                controller.enqueue(new TextEncoder().encode(heartbeatData));
              } catch (error) {
                console.log('SSE /api/events client disconnected during heartbeat:', error.message);
                isClosed = true;
                clearInterval(heartbeatInterval);
              }
            }, 30000); // 30 seconds

            // Handle cleanup when client disconnects
            const cleanup = () => {
              if (!isClosed) {
                isClosed = true;
                clearInterval(heartbeatInterval);
                try {
                  controller.close();
                } catch {}
              }
            };

            // Auto-cleanup after 5 minutes if no explicit disconnect
            setTimeout(
              () => {
                cleanup();
              },
              5 * 60 * 1000
            );
          },
        }),
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'X-Accel-Buffering': 'no',
          },
        }
      );
    }

    if (url.pathname === '/api/control/stream') {
      console.log('🌊 Native SSE stream: /api/control/stream');

      return new Response(
        new ReadableStream({
          start(controller) {
            let isClosed = false;

            // Send initial OK message
            const initialData = `:ok\n\n`;
            controller.enqueue(new TextEncoder().encode(initialData));

            // Set up heartbeat
            const heartbeatInterval = setInterval(() => {
              if (isClosed) {
                clearInterval(heartbeatInterval);
                return;
              }
              try {
                const heartbeatData = `:heartbeat\n\n`;
                controller.enqueue(new TextEncoder().encode(heartbeatData));
              } catch (error) {
                console.log(
                  'SSE /api/control/stream client disconnected during heartbeat:',
                  error.message
                );
                isClosed = true;
                clearInterval(heartbeatInterval);
              }
            }, 30000); // 30 seconds

            // Handle cleanup
            setTimeout(
              () => {
                if (!isClosed) {
                  isClosed = true;
                  clearInterval(heartbeatInterval);
                  try {
                    controller.close();
                  } catch {}
                }
              },
              5 * 60 * 1000
            );
          },
        }),
        {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'X-Accel-Buffering': 'no',
          },
        }
      );
    }

    // Proxy regular API requests to Go server
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/buffers')) {
      console.log(`🔗 Proxying to Go server: ${GO_SERVER_URL}${url.pathname}${url.search}`);

      try {
        // Handle WebSocket upgrade - redirect client to connect directly to Go server
        if (req.headers.get('upgrade') === 'websocket') {
          const goServerPort = new URL(GO_SERVER_URL).port;
          const requestHost = req.headers.get('host') || 'localhost:3001';
          const wsHost = requestHost.includes('192.168.68.53')
            ? `192.168.68.53:${goServerPort}`
            : `localhost:${goServerPort}`;
          const directUrl = `ws://${wsHost}${url.pathname}${url.search}`;
          console.log(`🔌 WebSocket should connect directly to: ${directUrl}`);

          return new Response(`WebSocket connections must connect directly to: ${directUrl}`, {
            status: 400,
            headers: {
              'X-WebSocket-Direct-URL': directUrl,
              'Access-Control-Allow-Origin': '*',
            },
          });
        }

        // Regular HTTP proxy
        const proxyPath = url.pathname;
        const proxyUrl = `${GO_SERVER_URL}${proxyPath}${url.search}`;

        // Create clean headers - don't copy Host, Connection, etc.
        const cleanHeaders: Record<string, string> = {};
        const skipHeaders = [
          'host',
          'accept-encoding',
          'connection',
          'upgrade',
          'sec-websocket-key',
          'sec-websocket-version',
          'sec-websocket-extensions',
        ];

        for (const [key, value] of req.headers.entries()) {
          if (!skipHeaders.includes(key.toLowerCase())) {
            cleanHeaders[key] = value;
          }
        }

        const proxyOptions: RequestInit = {
          method: req.method,
          headers: {
            ...cleanHeaders,
            Host: new URL(GO_SERVER_URL).host,
            'User-Agent': 'TunnelForge-Bun-Proxy/1.0',
          },
        };

        if (req.method !== 'GET' && req.method !== 'HEAD') {
          // Special handling for session creation to translate payload format
          if (req.method === 'POST' && url.pathname === '/api/sessions') {
            try {
              const originalBody = await req.text();
              const frontendPayload = JSON.parse(originalBody);

              // Transform frontend format to Go server format
              const goServerPayload = {
                command: Array.isArray(frontendPayload.command)
                  ? frontendPayload.command
                  : frontendPayload.command.split(/\s+/),
                cwd: frontendPayload.workingDir || frontendPayload.cwd || process.cwd(),
                title: frontendPayload.name || frontendPayload.title || 'Terminal',
                cols: frontendPayload.cols || 80,
                rows: frontendPayload.rows || 24,
              };

              console.log(`🔄 Translating session payload:`, {
                from: frontendPayload,
                to: goServerPayload,
              });

              proxyOptions.body = JSON.stringify(goServerPayload);
              proxyOptions.headers = {
                ...proxyOptions.headers,
                'Content-Type': 'application/json',
              };
            } catch (err) {
              console.error('❌ Failed to translate session payload:', err);
              proxyOptions.body = await req.arrayBuffer();
            }
          } else {
            proxyOptions.body = await req.arrayBuffer();
          }
        }

        console.log(`🔗 Making request to: ${proxyUrl}`);
        const response = await fetch(proxyUrl, proxyOptions);
        console.log(`🔗 Response status: ${response.status}`);

        // CRITICAL FIX: Only consume response body ONCE to avoid "Body already used" error
        // We must handle the body carefully and never call response.json(), response.text(),
        // or response.arrayBuffer() more than once
        let responseBody: BodyInit;
        const originalHeaders = new Headers(response.headers);
        const contentType = originalHeaders.get('content-type');

        // Step 1: Get the raw response body (ONLY ONCE!)
        const rawBody = await response.arrayBuffer();

        // Step 2: Try to decompress if gzipped (Bun.gunzipSync handles non-gzipped gracefully)
        let decompressedBody: Uint8Array;
        try {
          decompressedBody = Bun.gunzipSync(new Uint8Array(rawBody));
          console.log(`🔓 Decompressed gzipped response`);
        } catch (e) {
          decompressedBody = new Uint8Array(rawBody);
          console.log(`📄 Using raw response body`);
        }

        const headers = new Headers();

        // Add CORS headers
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        // Step 3: Handle JSON responses with transformation if needed
        if (contentType?.includes('application/json')) {
          // For JSON responses, parse and potentially transform the data
          try {
            // Decode the decompressed body to text, then parse JSON
            const text = new TextDecoder().decode(decompressedBody);
            let jsonData;

            // Parse JSON from the text (never call response.json()!)
            jsonData = JSON.parse(text);
            // Special handling for session creation response format translation
            if (
              req.method === 'POST' &&
              url.pathname === '/api/sessions' &&
              response.ok &&
              jsonData.id
            ) {
              // Transform Go server response format to frontend expected format
              const frontendResponse = {
                sessionId: jsonData.id,
                message: 'Session created successfully',
              };

              console.log(`🔄 Translating session response:`, {
                from: { id: jsonData.id },
                to: { sessionId: frontendResponse.sessionId },
              });

              responseBody = JSON.stringify(frontendResponse);
            }
            // Special handling for session list response format translation
            else if (
              req.method === 'GET' &&
              url.pathname === '/api/sessions' &&
              response.ok &&
              Array.isArray(jsonData)
            ) {
              // Transform Go server session format to frontend expected format
              const transformedSessions = jsonData.map((session: any) => ({
                // Keep all original fields for compatibility first
                ...session,

                // Map Go server fields to frontend expected fields (these will override)
                name: session.title, // title -> name
                command: [session.command], // string -> array
                workingDir: session.cwd, // cwd -> workingDir
                startedAt: session.createdAt,
                lastModified: session.updatedAt,
              }));

              console.log(`🔄 Translating session list response: ${jsonData.length} sessions`);
              console.log(`🔍 First session command transformation:`, {
                original: jsonData[0]?.command,
                transformed: transformedSessions[0]?.command,
              });
              responseBody = JSON.stringify(transformedSessions);
            } else {
              responseBody = JSON.stringify(jsonData);
            }

            headers.set('Content-Type', 'application/json');
          } catch (error) {
            console.error('Failed to parse JSON response:', error);
            // Fallback: use raw text if JSON parsing fails
            responseBody = new TextDecoder().decode(decompressedBody);
            headers.set('Content-Type', 'text/plain');
          }
        } else {
          // For non-JSON responses (images, HTML, etc.), use the decompressed body
          responseBody = decompressedBody;
          if (contentType) {
            headers.set('Content-Type', contentType);
          }
        }

        console.log(`✅ Go server responded: ${response.status} ${response.statusText}`);

        return new Response(responseBody, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
      } catch (error) {
        console.error('🚨 Proxy error:', error);
        return new Response(`Proxy Error: ${error}`, {
          status: 502,
          headers: {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    // Serve the main app for all other routes
    const indexFile = Bun.file('./public/index.html');
    if (await indexFile.exists()) {
      return new Response(indexFile, {
        headers: {
          'Content-Type': 'text/html',
        },
      });
    }

    // Fallback - serve the original TunnelForge index.html
    const originalIndex = Bun.file('./src/client/assets/index.html');
    if (await originalIndex.exists()) {
      return new Response(originalIndex, {
        headers: {
          'Content-Type': 'text/html',
        },
      });
    }

    return new Response('TunnelForge not found', { status: 404 });
  },
});

console.log(`🚇 TunnelForge Bun server starting on http://${server.hostname}:${server.port}`);
console.log(`🔗 Proxying API requests to: ${process.env.GO_SERVER_URL || 'http://localhost:4021'}`);
