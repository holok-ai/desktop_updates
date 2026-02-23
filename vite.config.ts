import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), svelte()],
  base: './',
  server: {
    port: 5177,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks: {
          highlight: ['highlight.js'],
        },
      },
    },
  },
  resolve: {
    alias: {
      $lib: path.resolve(__dirname, './src/lib'),
      $shared: path.resolve(__dirname, './src-shared'),
    },
  },
});
