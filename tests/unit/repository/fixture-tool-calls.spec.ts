/**
 * Fixture-driven tests: tool-calls
 *
 * Discovers all fixtures in tool-calls/ and asserts content-aware expectations
 * for tool call extraction from rawData and content blocks.
 *
 * Properties covered: 1 (non-zero output), 11 (tool call extraction with valid names)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadFixtureThroughPipeline,
  listFixtures,
  loadCapture,
  ThreadRepository,
} from './thread-messages-test-helpers';
import type { MockThreadApi } from './thread-messages-test-helpers';
import { assertValidBranchIds, assertNoDuplicateIds } from './fixture-assertion-helpers';

// ── Mocks (must be at module scope, hoisted) ───────────────────────

const mockThreadApi = vi.hoisted(() => ({
  getThread: vi.fn(),
  getThreads: vi.fn(),
  getMessages: vi.fn(),
  createThread: vi.fn(),
  updateThread: vi.fn(),
  deleteThread: vi.fn(),
  updateRequestBranch: vi.fn(),
  updateRequestDesktopOptions: vi.fn(),
}));

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }));
vi.mock('../../../src-electron/services/file-storage.service', () => ({
  fileStorageService: { deleteThreadFiles: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../../../src-electron/services/title-generator.service', () => ({
  titleGeneratorService: {
    generateTitle: vi.fn((text: string) => text.slice(0, 40)),
    ensureUniqueTitle: vi.fn((title: string) => title),
  },
}));
vi.mock('../../../src-electron/services/mokuapi/thread-api.service', () => ({
  threadApiService: mockThreadApi,
}));

// ── Fixture discovery ──────────────────────────────────────────────

const toolCallFixtures = listFixtures('tool-calls');

// ── Tool call detection helper ─────────────────────────────────────

/**
 * Check if a DTO has tool call data in rawData or content blocks.
 * - rawData is an object containing a `tool_calls` array
 * - content is an array containing objects with `type === 'tool_use'`
 */
function dtoHasToolCalls(dto: { rawData: unknown; content: unknown }): boolean {
  // Check rawData.tool_calls
  if (
    dto.rawData !== null &&
    dto.rawData !== undefined &&
    typeof dto.rawData === 'object' &&
    Array.isArray((dto.rawData as Record<string, unknown>).tool_calls)
  ) {
    return true;
  }

  // Check content blocks with type === 'tool_use'
  if (Array.isArray(dto.content)) {
    return dto.content.some(
      (block: unknown) =>
        typeof block === 'object' &&
        block !== null &&
        (block as Record<string, unknown>).type === 'tool_use',
    );
  }

  return false;
}

// ── Tests ──────────────────────────────────────────────────────────

describe('Fixture-driven: tool-calls', () => {
  let repo: ThreadRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new ThreadRepository();
  });

  it('discovers at least one tool-call fixture', () => {
    expect(toolCallFixtures.length, 'No fixtures found in tool-calls/').toBeGreaterThan(0);
  });

  // ── Property 1: universal invariants per fixture ─────────────────

  describe('universal invariants', () => {
    it.each(toolCallFixtures)(
      'non-zero output, valid branchIds, no duplicate IDs: %s',
      async (fixturePath) => {
        const messages = await loadFixtureThroughPipeline(
          repo,
          mockThreadApi as MockThreadApi,
          fixturePath,
        );

        // Property 1: non-zero output
        expect(messages.length, `${fixturePath}: expected non-zero output`).toBeGreaterThan(0);

        // Also check branchIds and deduplication
        assertValidBranchIds(messages, fixturePath);
        assertNoDuplicateIds(messages, fixturePath);
      },
    );
  });

  // ── Property 11: tool call extraction with valid names ───────────

  describe('tool call extraction with valid names', () => {
    it.each(toolCallFixtures)(
      'fixtures with tool_calls produce non-empty toolUses with valid names: %s',
      async (fixturePath) => {
        const dtos = loadCapture(fixturePath);
        const toolCallDtos = dtos.filter((d) => d.role === 'assistant' && dtoHasToolCalls(d));

        if (toolCallDtos.length === 0) return; // not applicable

        const messages = await loadFixtureThroughPipeline(
          repo,
          mockThreadApi as MockThreadApi,
          fixturePath,
        );

        for (const dto of toolCallDtos) {
          const msg = messages.find((m) => m.id === dto.id);
          expect(
            msg,
            `${fixturePath}: tool-call message ${dto.id} should exist in output`,
          ).toBeDefined();

          expect(
            msg!.toolUses,
            `${fixturePath}: message ${dto.id} should have toolUses`,
          ).toBeDefined();

          expect(
            msg!.toolUses!.length,
            `${fixturePath}: message ${dto.id} should have non-empty toolUses`,
          ).toBeGreaterThan(0);

          for (const toolUse of msg!.toolUses!) {
            expect(
              toolUse.name,
              `${fixturePath}: toolUse in message ${dto.id} should have a non-empty name`,
            ).toBeTruthy();
            expect(typeof toolUse.name, `${fixturePath}: toolUse name should be a string`).toBe(
              'string',
            );
            expect(
              toolUse.name.length,
              `${fixturePath}: toolUse name should be non-empty`,
            ).toBeGreaterThan(0);
          }
        }
      },
    );
  });
});
