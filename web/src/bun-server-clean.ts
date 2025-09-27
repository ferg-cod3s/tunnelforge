// Clean Bun Server for TunnelForge
const server = Bun.serve({
  port: Number(process.env.PORT) || 3001,
  hostname: process.env.HOST || '0.0.0.0',
  
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const GO_SERVER_URL = process.env.GO_SERVER_URL || 'http://localhost:4021'\;
    
    // Serve static files
    if (url.pathname.startsWith('/bundle/') || 
        url.pathname.startsWith('/assets/') || 
        url.pathname === '/favicon.ico' ||
        url.pathname === '/sw.js' ||
        url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.js')) {
      const filePath = `./public${url.pathname}`;
      const file = Bun.file(filePath);
      if (await file.exists()) {
        return new Response(file);
      }
    }
    
    // Proxy API requests
    if (url.pathname.startsWith('/api/')) {
      const proxyUrl = `${GO_SERVER_URL}${url.pathname}${url.search}`;
      const response = await fetch(proxyUrl, {
        method: req.method,
        headers: req.headers,
        body: req.body
      });
      return new Response(await response.text(), {
        status: response.status,
        headers: response.headers
      });
    }
    
    // Serve index.html for all other routes
    const indexFile = Bun.file('./public/index.html');
    if (await indexFile.exists()) {
      return new Response(indexFile, {
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    return new Response('Not Found', { status: 404 });
  }
});

console.log(`🚇 TunnelForge running at http://localhost:${server.port}`);
