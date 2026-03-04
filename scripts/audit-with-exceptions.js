/**
 * Run NPM Audit with Exceptions
 *
 * This script runs better-npm-audit with exceptions loaded from .audit-exceptions.json
 * Supports both ID-based exclusions (-x) and module-level ignores (--module-ignore)
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
  const config = JSON.parse(readFileSync(configPath, 'utf8'));

  // Collect all exception IDs from all exception groups
  const allIds = [];
  for (const [, packageConfig] of Object.entries(config.exceptions)) {
    if (packageConfig.ids && Array.isArray(packageConfig.ids)) {
      allIds.push(...packageConfig.ids);
    }
  }

  // Collect all module-ignore names from all module-ignore groups
  const allModules = [];
  if (config.moduleIgnore) {
    for (const [, groupConfig] of Object.entries(config.moduleIgnore)) {
      if (groupConfig.modules && Array.isArray(groupConfig.modules)) {
        allModules.push(...groupConfig.modules);
      }
    }
  }

  // Build audit command arguments.
  // --level high: block on high AND critical (both must be remediated or excepted).
  const args = ['audit', '--level', 'high'];

  if (allIds.length > 0) {
    args.push('-x', allIds.join(','));
    console.log(`Exception IDs: ${allIds.join(', ')}`);
  }

  if (allModules.length > 0) {
    args.push('--module-ignore', allModules.join(','));
    console.log(`Module ignores: ${allModules.join(', ')}`);
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
