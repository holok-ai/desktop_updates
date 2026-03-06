/**
 * Fixture-driven tests: turns
 *
 * Discovers all fixtures in turns/ and asserts content-aware expectations
 * for role alternation, output count matching, and non-zero output.
 *
 * Properties covered: 1 (non-zero output), 12 (role alternation),
 *                     13 (output count = DTO count)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadFixtureThroughPipeline,
  listFixtures,
  loadCapture,
  ThreadRepository,
} from './thread-messages-test-helpers';
import type { MockThreadApi } from './thread-messages-test-helpers';
import {
  assertValidBranchIds,
  assertNoDuplicateIds,
  extractUserPromptKeyTerms,
} from './fixture-assertion-helpers';

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

const turnFixtures = listFixtures('turns');

// ── Helpers ────────────────────────────────────────────────────────

/** Check if DTOs contain content the pipeline legitimately filters out. */
function hasPipelineFilterableContent(
  dtos: Array<{ content: unknown; branchId: string | null }>,
): boolean {
  return (
    dtos.some((d) => {
      if (typeof d.content !== 'string') return false;
      try {
        const parsed = JSON.parse(d.content);
        return parsed?.object === 'chat.completion.chunk' || parsed?.type === 'response.completed';
      } catch {
        return false;
      }
    }) || dtos.some((d) => d.branchId === '0.0.0.0' || d.branchId === '0.0.0')
  );
}

/** Check if DTOs have alternating user/assistant roles. */
function hasAlternatingRoles(roles: (string | null)[]): boolean {
  for (let i = 1; i < roles.length; i++) {
    const prev = roles[i - 1];
    const curr = roles[i];
    if (prev === 'user' && curr !== 'assistant') return false;
    if (prev === 'assistant' && curr !== 'user') return false;
  }
  return true;
}

/** Check if a fixture is multi-turn (DTO count > 2 with alternating roles). */
function isMultiTurn(dtos: { role: string | null }[]): boolean {
  return dtos.length > 2 && hasAlternatingRoles(dtos.map((d) => d.role));
}

// ── Tests ──────────────────────────────────────────────────────────

describe('Fixture-driven: turns', () => {
  let repo: ThreadRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new ThreadRepository();
  });

  it('discovers at least one turn fixture', () => {
    expect(turnFixtures.length, 'No fixtures found in turns/').toBeGreaterThan(0);
  });

  // ── Property 1: universal invariants per fixture ─────────────────

  describe('universal invariants', () => {
    it.each(turnFixtures)(
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

  // ── Property 12: role alternation in multi-turn fixtures ─────────

  describe('role alternation in multi-turn fixtures', () => {
    it.each(turnFixtures)(
      'multi-turn fixtures preserve alternating user/assistant roles: %s',
      async (fixturePath) => {
        const dtos = loadCapture(fixturePath);

        if (!isMultiTurn(dtos)) return; // only applies to multi-turn fixtures

        const messages = await loadFixtureThroughPipeline(
          repo,
          mockThreadApi as MockThreadApi,
          fixturePath,
        );

        const outputRoles = messages.map((m) => m.role);

        expect(
          hasAlternatingRoles(outputRoles),
          `${fixturePath}: output roles should alternate user/assistant, got: [${outputRoles.join(', ')}]`,
        ).toBe(true);
      },
    );
  });

  // ── Property 13: output count matches DTO count ──────────────────

  describe('output count matches DTO count for successful turns', () => {
    it.each(turnFixtures)(
      'output message count equals input DTO count: %s',
      async (fixturePath) => {
        const dtos = loadCapture(fixturePath);
        const messages = await loadFixtureThroughPipeline(
          repo,
          mockThreadApi as MockThreadApi,
          fixturePath,
        );

        if (hasPipelineFilterableContent(dtos)) {
          // Pipeline legitimately filters observer prompts, streaming chunks, etc.
          expect(
            messages.length,
            `${fixturePath}: output count (${messages.length}) should be ≤ DTO count (${dtos.length})`,
          ).toBeLessThanOrEqual(dtos.length);
          expect(
            messages.length,
            `${fixturePath}: output should be non-empty after filtering`,
          ).toBeGreaterThan(0);
        } else {
          expect(
            messages.length,
            `${fixturePath}: output count (${messages.length}) should equal DTO count (${dtos.length})`,
          ).toBe(dtos.length);
        }
      },
    );
  });

  // ── Content-aware: key terms from user prompt in assistant response

  describe('assistant response contains prompt key terms', () => {
    it.each(turnFixtures)(
      'assistant content references user prompt topic: %s',
      async (fixturePath) => {
        const dtos = loadCapture(fixturePath);
        const messages = await loadFixtureThroughPipeline(
          repo,
          mockThreadApi as MockThreadApi,
          fixturePath,
        );

        const keyTerms = extractUserPromptKeyTerms(dtos);
        if (keyTerms.length === 0) return;

        const assistant = messages.find((m) => m.role === 'assistant');
        if (!assistant) return;

        const contentLower = assistant.content.toLowerCase();
        const matched = keyTerms.filter((t) => contentLower.includes(t));
        expect(
          matched.length,
          `${fixturePath}: assistant should contain ≥1 key term from prompt. ` +
            `Terms: [${keyTerms.join(', ')}], preview: "${assistant.content.slice(0, 80)}..."`,
        ).toBeGreaterThan(0);
      },
    );
  });
});
