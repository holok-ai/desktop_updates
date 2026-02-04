/**
 * Run NPM Audit with Exceptions
 *
 * This script runs better-npm-audit with exceptions loaded from .audit-exceptions.json
 * Cross-platform solution that works on Windows, macOS, and Linux
 */

import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const configPath = join(__dirname, '..', '.audit-exceptions.json');

try {
  // Read exceptions config
  const config = JSON.parse(readFileSync(configPath, 'utf8'));

  // Collect all exception IDs from all packages
  const allIds = [];
  for (const [packageName, packageConfig] of Object.entries(config.exceptions)) {
    if (packageConfig.ids && Array.isArray(packageConfig.ids)) {
      allIds.push(...packageConfig.ids);
    }
  }

  // Build audit command arguments
  const args = ['audit'];
  if (allIds.length > 0) {
    args.push('-x', allIds.join(','));
  }

  // Run better-npm-audit
  const audit = spawn('npx', ['better-npm-audit', ...args], {
    stdio: 'inherit',
    shell: true,
  });

  audit.on('close', (code) => {
    process.exit(code);
  });
} catch (error) {
  console.error('Error running audit with exceptions:', error.message);
  process.exit(1);
}
