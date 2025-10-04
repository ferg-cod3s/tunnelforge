// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';

// https://astro.build/config
export default defineConfig({
  integrations: [svelte()],
  output: 'static',
  server: {
    host: '127.0.0.1',
    port: 3000
  },
  vite: {
    define: {
      global: 'globalThis',
    },
    resolve: {
      alias: {
        '@': '/src',
        '~': '/src',
        '$lib': '/src/lib'
      }
    },
    build: {
      outDir: './dist/client'
    },
    server: {
      proxy: {
        '/api': 'http://localhost:4021',
        '/ws': {
          target: 'ws://localhost:4021',
          ws: true
        }
      }
    }
  }
});
