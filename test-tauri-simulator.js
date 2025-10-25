// Tauri Simulator - Test server that simulates Tauri environment
// Injects mock Tauri APIs so desktop frontend works in browser

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const DIST_DIR = path.join(__dirname, 'desktop', 'dist-desktop');

// Mock Tauri API responses
const mockTauriResponses = {
    'get_server_status': {
        running: true,
        pid: 3176117,
        port: 4021,
        url: 'http://localhost:4021'
    },
    'start_server': {
        success: true,
        message: 'Server started successfully'
    },
    'stop_server': {
        success: true,
        message: 'Server stopped successfully'
    },
    'restart_server': {
        success: true,
        message: 'Server restarted successfully'
    },
    'write_diagnostics': {
        success: true,
        message: 'Diagnostics written'
    }
};

const server = http.createServer((req, res) => {
    let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url);

    // Security: prevent directory traversal
    if (!filePath.startsWith(DIST_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Internal server error');
            }
            return;
        }

        // Set content type based on file extension
        const ext = path.extname(filePath);
        const contentTypes = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'application/javascript',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml'
        };

        res.writeHead(200, {
            'Content-Type': contentTypes[ext] || 'text/plain',
            'Content-Security-Policy': "default-src 'self'; connect-src 'self' http://localhost:* ws://localhost:* https://*.tunnelforge.dev wss://*.tunnelforge.dev; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'"
        });

        let content = data.toString();

        // If this is the main HTML file, inject Tauri simulation
        if (filePath.endsWith('index.html')) {
            // Inject Tauri API simulation before the closing </head> tag
            const tauriScript = `
<script>
// Tauri API Simulation for Testing
console.log('🔧 Injecting Tauri API simulation...');

// Mock Tauri v2 API
window.__TAURI__ = {
    core: {
        invoke: async (command, args) => {
            console.log('🔧 Mock Tauri invoke:', command, args);

            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, 100));

            const response = ${JSON.stringify(mockTauriResponses, null, 4)}[command];
            if (response) {
                return response;
            } else {
                throw new Error(\`Unknown command: \${command}\`);
            }
        }
    }
};

// Mock Tauri v1 API (fallback)
window.__TAURI_INVOKE__ = window.__TAURI__.core.invoke;

console.log('✅ Tauri APIs simulated successfully');
</script>
`;

            content = content.replace('</head>', tauriScript + '</head>');
        }

        res.end(content);
    });
});

server.listen(PORT, () => {
    console.log(`🎭 Tauri Simulator running at http://localhost:${PORT}`);
    console.log(`📁 Serving files from: ${DIST_DIR}`);
    console.log(`🔗 Test the desktop UI at: http://localhost:${PORT}`);
    console.log(`\n✨ Features:`);
    console.log(`  - Simulates Tauri environment`);
    console.log(`  - Mock server status API calls`);
    console.log(`  - All server control buttons work`);
    console.log(`  - Real-time status updates`);
    console.log(`\nPress Ctrl+C to stop`);
});