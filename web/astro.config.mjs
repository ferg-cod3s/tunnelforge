import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [
    svelte(),
    tailwind({
      applyBaseStyles: false,
    })
  ],
  output: 'static',
  build: {
    outDir: './dist/client'
  },
  server: {
    host: '127.0.0.1',
    port: 4321
  },
  vite: {
    define: {
      global: 'globalThis',
    },
    resolve: {
      alias: {
        '@': '/src',
        '~': '/src'
      }
    }
  }
});
