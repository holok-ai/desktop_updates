/**
 * Get Audit Exceptions
 *
 * Reads .audit-exceptions.json and returns the exception IDs
 * for use with better-npm-audit
 *
 * Usage:
 *   node scripts/get-audit-exceptions.js
 *   Output: 1108110,1108111
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const configPath = join(__dirname, '..', '.audit-exceptions.json');

try {
  const config = JSON.parse(readFileSync(configPath, 'utf8'));

  // Collect all exception IDs from all packages
  const allIds = [];

  for (const [packageName, packageConfig] of Object.entries(config.exceptions)) {
    if (packageConfig.ids && Array.isArray(packageConfig.ids)) {
      allIds.push(...packageConfig.ids);
    }
  }

  // Output comma-separated IDs for use in npm scripts
  if (allIds.length > 0) {
    process.stdout.write(allIds.join(','));
  }
} catch (error) {
  console.error('Error reading audit exceptions:', error.message);
  process.exit(1);
}
