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
  },

  // Output to static files
  output: 'static',

  vite: {
    // Optimize dependencies
    optimizeDeps: {
      include: ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-canvas'],
    },
  },
});
