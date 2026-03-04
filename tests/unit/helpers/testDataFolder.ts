/**
 * Unit test helper for tests/data/ and allowed-folders setup.
 *
 * Use getTestDataFolderPath() when you need the absolute path to tests/data/.
 * Use getTestDataAllowedPaths() when constructing FileToolsService or ToolOrchestrator
 * (or when stubbing settings) so that tests/data/ is treated as an allowed folder.
 *
 * @example
 * beforeEach(() => {
 *   const allowedPaths = getTestDataAllowedPaths();
 *   fileToolsService = new FileToolsService(allowedPaths);
 * });
 */

import { getTestDataFolderPath } from '../../helpers/testDataFolder.js';

export { getTestDataFolderPath };

/**
 * Returns an array containing the test data folder path, for use as the allowed
 * paths list when constructing FileToolsService or when stubbing the settings
 * layer so the folder is permitted during unit tests.
 */
export function getTestDataAllowedPaths(): string[] {
  return [getTestDataFolderPath()];
}
