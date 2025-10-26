import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: '../dist-settings',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        settings: resolve(__dirname, 'index.html'),
      },
    },
  },
  clearScreen: false,
  server: {
    port: 5174,
    strictPort: true,
  },
});
