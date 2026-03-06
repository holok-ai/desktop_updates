/**
 * Fixture-driven tests: edge-cases
 *
 * Discovers all fixtures in edge-cases/ and asserts content-aware expectations
 * for null content, branchId normalization, deduplication, orphan placeholders,
 * and desktop options extraction.
 *
 * Properties covered: 1 (non-zero output), 3 (branchId), 4 (no duplicates),
 *                     5 (null content), 6 (orphan assistant)
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

const edgeCaseFixtures = listFixtures('edge-cases');

// ── Tests ──────────────────────────────────────────────────────────

describe('Fixture-driven: edge-cases', () => {
  let repo: ThreadRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new ThreadRepository();
  });

  it('discovers at least one edge-case fixture', () => {
    expect(edgeCaseFixtures.length, 'No fixtures found in edge-cases/').toBeGreaterThan(0);
  });

  // ── Property 1, 3, 4: universal invariants per fixture ─────────

  describe('universal invariants', () => {
    it.each(edgeCaseFixtures)(
      'non-zero output, valid branchIds, no duplicate IDs: %s',
      async (fixturePath) => {
        const messages = await loadFixtureThroughPipeline(
          repo,
          mockThreadApi as MockThreadApi,
          fixturePath,
        );
        expect(messages.length, `${fixturePath}: expected non-zero output`).toBeGreaterThan(0);
        assertValidBranchIds(messages, fixturePath);
        assertNoDuplicateIds(messages, fixturePath);
      },
    );
  });

  // ── Property 5: null content transformation ────────────────────

  describe('null content transformation', () => {
    it.each(edgeCaseFixtures)(
      'null/empty content DTOs produce "" or "empty": %s',
      async (fixturePath) => {
        const dtos = loadCapture(fixturePath);
        const nullContentDtos = dtos.filter(
          (d) => d.content === null || d.content === '' || d.content === undefined,
        );

        if (nullContentDtos.length === 0) return; // not applicable to this fixture

        const messages = await loadFixtureThroughPipeline(
          repo,
          mockThreadApi as MockThreadApi,
          fixturePath,
        );

        for (const dto of nullContentDtos) {
          // Find the corresponding output message by id
          const msg = messages.find((m) => m.id === dto.id);
          if (!msg) continue; // may have been deduplicated

          const hasRawData =
            dto.rawData !== null &&
            dto.rawData !== undefined &&
            (typeof dto.rawData !== 'object' || Object.keys(dto.rawData as object).length > 0);

          if (hasRawData) {
            expect(msg.content, `${fixturePath}: null content with rawData should be "empty"`).toBe(
              'empty',
            );
          } else {
            expect(msg.content, `${fixturePath}: null content without rawData should be ""`).toBe(
              '',
            );
          }
        }
      },
    );
  });

  // ── Property 6: orphan assistant placeholder insertion ─────────

  describe('orphan assistant placeholder insertion', () => {
    it.each(edgeCaseFixtures)(
      'orphan assistants get synthetic user placeholder: %s',
      async (fixturePath) => {
        const dtos = loadCapture(fixturePath);

        // Detect orphan assistants: assistant DTOs with no preceding user in same branch
        const branchFirstRole = new Map<string, string>();
        const orphanBranches: string[] = [];
        for (const dto of dtos) {
          const branch = dto.branchId ?? 'unknown';
          if (!branchFirstRole.has(branch)) {
            branchFirstRole.set(branch, dto.role ?? 'unknown');
            if (dto.role === 'assistant') {
              orphanBranches.push(branch);
            }
          }
        }

        if (orphanBranches.length === 0) return; // not applicable

        const messages = await loadFixtureThroughPipeline(
          repo,
          mockThreadApi as MockThreadApi,
          fixturePath,
        );

        for (const branch of orphanBranches) {
          const branchMessages = messages.filter((m) =>
            m.branchId.startsWith(branch.split('.').slice(0, 2).join('.')),
          );
          const firstAssistantIdx = branchMessages.findIndex((m) => m.role === 'assistant');

          expect(
            firstAssistantIdx,
            `${fixturePath}: expected assistant in branch ${branch}`,
          ).toBeGreaterThanOrEqual(0);

          if (firstAssistantIdx > 0) {
            const preceding = branchMessages[firstAssistantIdx - 1];
            expect(
              preceding.role,
              `${fixturePath}: synthetic placeholder should be a user message`,
            ).toBe('user');
            expect(
              preceding.content,
              `${fixturePath}: synthetic placeholder should have empty content`,
            ).toBe('');
          } else {
            // If assistant is first, the pipeline should have inserted a placeholder before it
            // meaning the output should have more messages than the input DTOs for this branch
            expect(
              messages.length,
              `${fixturePath}: orphan assistant should trigger placeholder insertion`,
            ).toBeGreaterThan(dtos.length);
          }
        }
      },
    );
  });

  // ── Desktop options extraction ─────────────────────────────────

  describe('desktop options extraction', () => {
    it.each(edgeCaseFixtures)(
      'DTOs with options have desktopOptions in output: %s',
      async (fixturePath) => {
        const dtos = loadCapture(fixturePath);
        const dtosWithOptions = dtos.filter(
          (d) => d.options !== null && d.options !== undefined && typeof d.options === 'object',
        );

        if (dtosWithOptions.length === 0) return; // not applicable

        const messages = await loadFixtureThroughPipeline(
          repo,
          mockThreadApi as MockThreadApi,
          fixturePath,
        );

        for (const dto of dtosWithOptions) {
          const msg = messages.find((m) => m.id === dto.id);
          expect(msg, `${fixturePath}: message ${dto.id} should exist in output`).toBeDefined();
          expect(
            msg!.desktopOptions,
            `${fixturePath}: message ${dto.id} should have desktopOptions extracted`,
          ).toBeDefined();
        }
      },
    );
  });

  // ── DuplicationInspector: duplicate messages reduced ──────────────

  describe('DuplicationInspector reduces duplicate messages', () => {
    it.each(edgeCaseFixtures)(
      'duplicate DTOs produce fewer output messages: %s',
      async (fixturePath) => {
        if (!fixturePath.includes('duplicate')) return;

        const dtos = loadCapture(fixturePath);
        const messages = await loadFixtureThroughPipeline(
          repo,
          mockThreadApi as MockThreadApi,
          fixturePath,
        );

        // Duplicate fixture has 3 DTOs (1 user + 2 identical assistants)
        // DuplicationInspector should keep only the earliest, so output < input
        expect(
          messages.length,
          `${fixturePath}: output should have fewer messages than input due to dedup`,
        ).toBeLessThan(dtos.length);

        // No two visible messages should share the same (role, content, branchId)
        const keys = messages.map((m) => `${m.role}:${m.content}:${m.branchId}`);
        const uniqueKeys = new Set(keys);
        expect(uniqueKeys.size, `${fixturePath}: no duplicate (role,content,branch) keys`).toBe(
          keys.length,
        );
      },
    );
  });

  // ── ObserverPromptsInspector: observer messages filtered out ──────

  describe('ObserverPromptsInspector removes observer messages', () => {
    it.each(edgeCaseFixtures)(
      'messages with branchId 0.0.0 are removed from output: %s',
      async (fixturePath) => {
        if (!fixturePath.includes('observer')) return;

        const dtos = loadCapture(fixturePath);
        const observerDtos = dtos.filter((d) => d.branchId === '0.0.0' || d.branchId === '0.0.0.0');
        if (observerDtos.length === 0) return;

        const messages = await loadFixtureThroughPipeline(
          repo,
          mockThreadApi as MockThreadApi,
          fixturePath,
        );

        // Observer messages should be completely removed (not just hidden)
        for (const dto of observerDtos) {
          const found = messages.find((m) => m.id === dto.id);
          expect(
            found,
            `${fixturePath}: observer message ${dto.id} should be removed entirely`,
          ).toBeUndefined();
        }

        // Output count should be less than input count
        expect(
          messages.length,
          `${fixturePath}: output should have fewer messages after observer removal`,
        ).toBeLessThan(dtos.length);

        // Non-observer messages should still be present
        const normalDtos = dtos.filter((d) => d.branchId !== '0.0.0' && d.branchId !== '0.0.0.0');
        expect(messages.length).toBe(normalDtos.length);
      },
    );
  });

  // ── ResponseCompletedInspector: response.completed hidden + toolUses attached

  describe('ResponseCompletedInspector hides payload and attaches toolUses', () => {
    it.each(edgeCaseFixtures)(
      'response.completed messages hidden, toolUses on assistant: %s',
      async (fixturePath) => {
        if (!fixturePath.includes('response-completed')) return;

        const dtos = loadCapture(fixturePath);
        const messages = await loadFixtureThroughPipeline(
          repo,
          mockThreadApi as MockThreadApi,
          fixturePath,
        );

        // Find DTOs with response.completed content
        const completedDtos = dtos.filter((d) => {
          if (typeof d.content !== 'string') return false;
          try {
            const parsed = JSON.parse(d.content);
            return parsed?.type === 'response.completed';
          } catch {
            return false;
          }
        });

        // response.completed messages should be hidden
        for (const dto of completedDtos) {
          const msg = messages.find((m) => m.id === dto.id);
          expect(msg, `${fixturePath}: response.completed msg should exist`).toBeDefined();
          expect(msg!.isHidden, `${fixturePath}: response.completed should be hidden`).toBe(true);
        }

        // The visible assistant should have toolUses attached
        const visibleAssistants = messages.filter((m) => m.role === 'assistant' && !m.isHidden);
        const withTools = visibleAssistants.filter((m) => m.toolUses && m.toolUses.length > 0);
        expect(
          withTools.length,
          `${fixturePath}: at least one visible assistant should have toolUses`,
        ).toBeGreaterThan(0);

        // Verify tool names are valid strings
        for (const msg of withTools) {
          for (const tool of msg.toolUses!) {
            expect(tool.name).toBeTruthy();
            expect(tool.status).toBe('complete');
          }
        }
      },
    );
  });
});
