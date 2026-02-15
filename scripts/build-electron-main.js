import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  await esbuild.build({
    entryPoints: [path.resolve(__dirname, '../src-electron/main.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    outfile: path.resolve(__dirname, '../dist-electron/src-electron/main.js'),
    external: ['electron'],
    banner: {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
    sourcemap: true,
    minify: false,
  });
  console.log('Main process bundled successfully');
} catch (error) {
  console.error('Failed to bundle main process:', error);
  process.exit(1);
}
