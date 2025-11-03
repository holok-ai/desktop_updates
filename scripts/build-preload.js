import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  await esbuild.build({
    entryPoints: [path.resolve(__dirname, '../src-electron/preload.ts')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs', // Preload must be CommonJS for sandboxed environment
    outfile: path.resolve(__dirname, '../dist-electron/src-electron/preload.js'),
    external: ['electron'],
    sourcemap: true,
    minify: false,
  });
  console.log('Preload script bundled successfully');
} catch (error) {
  console.error('Failed to bundle preload script:', error);
  process.exit(1);
}
