/**
 * Shared test data folder path for unit and E2E tests.
 * Use this when tests need to reference real files under tests/data/.
 */

import path from 'node:path';

/**
 * Resolves the absolute path to tests/data/.
 * Safe to call from unit tests (Vitest) or E2E (Playwright); assumes cwd is project root.
 */
export function getTestDataFolderPath(): string {
  return path.resolve(process.cwd(), 'tests', 'data');
}
