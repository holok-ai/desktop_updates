/**
 * Shared test helpers for thread-repository message tests.
 *
 * USAGE: Each test file must set up its own mocks using vi.hoisted() + vi.mock()
 * at module scope (see setupMockThreadApi pattern below), then pass the mock
 * to helper functions.
 *
 * Pattern for each test file:
 * ```
 * const mockThreadApi = vi.hoisted(() => ({ getMessages: vi.fn(), ... }));
 * vi.mock('electron-log', ...);
 * vi.mock('...thread-api.service', () => ({ threadApiService: mockThreadApi }));
 * ```
 */
import { expect } from 'vitest';
import { readdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import { apiOk } from '../../../src-electron/types/api-response';
import { loadCapture, pagedCapture, pagedMessages } from '../../fixtures/api-captures/loader';
import {
  validateMessageDTOArray,
  formatErrors,
} from '../../fixtures/api-captures/schema-validator';

// Re-export for convenience
export { loadCapture, pagedCapture, pagedMessages } from '../../fixtures/api-captures/loader';
export {
  validateMessageDTO,
  validateMessageDTOArray,
  formatErrors,
} from '../../fixtures/api-captures/schema-validator';
export {
  fakeMessageDTO,
  resetSequence,
  successfulTurn,
  multiTurnConversation,
  guardPassedTurn,
  guardPassedTurnOrder2,
  guardBlockedTurn,
  guardDoubleEncodedTurn,
  errorPayloadResponse,
  timeoutResponse,
  rateLimitedResponse,
  invalidRequestResponse,
  orphanAssistant,
  duplicateAuditRecords,
  emptyContentWithRawData,
  nullBranchId,
  overLongBranchId,
  nullContent,
  toolCallInRawData,
  toolUseInContentBlocks,
  desktopOptionsBlocked,
  desktopOptionsSelectedBranch,
} from '../../fixtures/api-captures/message-scenarios';

export { ThreadRepository } from '../../../src-electron/repository/thread-repository';
export type { Message } from '../../../src-electron/types/thread.types';
export type { MessageDTO } from '../../../src-electron/services/mokuapi/thread.types';

// ── Fixtures directory ─────────────────────────────────────────────

export const FIXTURES_DIR = resolve(__dirname, '../../../tests/fixtures/api-captures');

// ── Mock type ──────────────────────────────────────────────────────

export interface MockThreadApi {
  getMessages: ReturnType<(typeof import('vitest'))['vi']['fn']>;
  [key: string]: ReturnType<(typeof import('vitest'))['vi']['fn']>;
}

// ── Helpers ─────────────────────────────────────────────────────────

import type { Message } from '../../../src-electron/types/thread.types';
import type { MessageDTO } from '../../../src-electron/services/mokuapi/thread.types';
import { ThreadRepository } from '../../../src-electron/repository/thread-repository';

/**
 * Load a thread through the uncached path with the given messages.
 */
export async function loadWithMessages(
  repo: ThreadRepository,
  mockApi: MockThreadApi,
  messages: MessageDTO[],
): Promise<{ messages: Message[] }> {
  mockApi.getMessages.mockResolvedValue(apiOk(pagedMessages(messages)));
  const loaded = await repo.loadThreadMessages('thread-1');
  return { messages: loaded };
}

/**
 * Load a JSON fixture file through the full pipeline.
 * Fails fast with the fixture path when schema validation detects drift.
 */
export async function loadFixtureThroughPipeline(
  repo: ThreadRepository,
  mockApi: MockThreadApi,
  fixturePath: string,
): Promise<Message[]> {
  const dtos = loadCapture(fixturePath);

  const schemaErrors = validateMessageDTOArray(dtos);
  expect(
    schemaErrors,
    `Schema drift in "${fixturePath}":\n${formatErrors(schemaErrors)}`,
  ).toHaveLength(0);

  mockApi.getMessages.mockResolvedValue(apiOk(pagedCapture(fixturePath)));
  return repo.loadThreadMessages('thread-1');
}

/**
 * List all .json files in a subdirectory of the fixtures dir.
 */
export function listFixtures(subdir: string): string[] {
  const dir = resolve(FIXTURES_DIR, subdir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => `${subdir}/${f}`);
}

/**
 * Recursively list all .json files under a subdirectory of the fixtures dir.
 * Returns paths relative to FIXTURES_DIR.
 */
export function listFixturesRecursive(subdir: string): string[] {
  const dir = resolve(FIXTURES_DIR, subdir);
  if (!existsSync(dir)) return [];
  const results: string[] = [];

  function walk(currentDir: string, prefix: string): void {
    const entries = readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const relPath = `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        walk(resolve(currentDir, entry.name), relPath);
      } else if (entry.name.endsWith('.json')) {
        results.push(relPath);
      }
    }
  }

  walk(dir, subdir);
  return results;
}
