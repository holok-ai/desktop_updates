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
        manualChunks(id) {
          const normalizedId = id.split(path.sep).join('/');

          // Keep syntax highlighting isolated from general page code.
          if (normalizedId.includes('/highlight.js/')) return 'highlight';

          // Group all route/page modules into one shared chunk.
          if (
            normalizedId.includes('/src/routes/') ||
            normalizedId.includes('/src/lib/pages/') ||
            normalizedId.includes('/src/lib/components/thread/')
          ) {
            return 'pages';
          }

          return undefined;
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
