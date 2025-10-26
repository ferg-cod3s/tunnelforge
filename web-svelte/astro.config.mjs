import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';

// https://astro.build/config
export default defineConfig({
  integrations: [
    svelte({
      // Enable Svelte 5 runes mode
      compilerOptions: {
        runes: true,
      },
    }),
  ],

  // Development server
  server: {
    port: 3000,
    host: true,
  },

  // Build configuration
  build: {
    // Enable client-side JavaScript
    inlineStylesheets: 'auto',
    // Generate 404 page for client-side routing
    format: 'directory',
  },

  // Output: static files - web UI is a SPA connecting to Go server
  output: 'static',

  // Trailing slash for cleaner URLs
  trailingSlash: 'always',

  vite: {
    // Optimize dependencies
    optimizeDeps: {
      include: ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-canvas'],
    },
    // Exclude xterm from SSR
    ssr: {
      noExternal: [],
      external: ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-canvas', '@xterm/addon-webgl'],
    },
  },
});
