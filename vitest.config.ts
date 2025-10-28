import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      $lib: path.resolve(__dirname, './src/lib'),
      '@': path.resolve(__dirname, './src'),
      'src-electron': path.resolve(__dirname, './src-electron'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup/test-setup.ts'],
    // Only run unit and integration tests under Vitest. E2E Playwright tests are executed by Playwright.
    include: ['tests/{unit,integration}/**/*.{test,spec}.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
    retry: Number(process.env.CI) ? 2 : 0,
    reporters: ['default', ['junit', { outputFile: 'test-results/vitest-junit.xml' }]],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/lib/**/*.ts', 'src-electron/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/main.ts',
        'src/app.css',
        'src/routes/**',
        'src/lib/components/**',
        'dist/**',
        'dist-electron/**',
        'tests/**',
        'vite.config.ts',
        'vitest.config.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
