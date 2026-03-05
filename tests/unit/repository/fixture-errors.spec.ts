/**
 * Fixture-driven tests: errors
 *
 * Discovers all fixtures in errors/ and asserts content-aware expectations
 * for error status preservation, hidden error payloads, and non-zero output.
 *
 * Properties covered: 1 (non-zero output), 7 (error payload hidden)
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

const errorFixtures = listFixtures('errors');

// ── Error payload detection helper ─────────────────────────────────

const GUARD_ERROR_REQUIRED_FIELDS = ['requestId', 'seq', 'error'] as const;

/**
 * Check if a DTO's content is a guard error payload (matches isGuardErrorPayload).
 * These are JSON objects with type=error, status=400, and requestId/seq/error fields.
 */
function isErrorPayloadContent(content: unknown): boolean {
  if (typeof content !== 'string') return false;
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return false;
    if (parsed.type !== 'error' || parsed.status !== 400) return false;
    for (const field of GUARD_ERROR_REQUIRED_FIELDS) {
      if (!(field in parsed)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

// ── Tests ──────────────────────────────────────────────────────────

describe('Fixture-driven: errors', () => {
  let repo: ThreadRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new ThreadRepository();
  });

  it('discovers at least one error fixture', () => {
    expect(errorFixtures.length, 'No fixtures found in errors/').toBeGreaterThan(0);
  });

  // ── Property 1: universal invariants per fixture ─────────────────

  describe('universal invariants', () => {
    it.each(errorFixtures)(
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

  // ── Property 7: error payload messages are hidden ────────────────

  describe('error payload messages are hidden', () => {
    it.each(errorFixtures)(
      'error-payload assistant DTOs produce hidden output: %s',
      async (fixturePath) => {
        const dtos = loadCapture(fixturePath);
        const errorPayloadDtos = dtos.filter(
          (d) => d.role === 'assistant' && isErrorPayloadContent(d.content),
        );

        if (errorPayloadDtos.length === 0) return; // not an error-payload fixture

        const messages = await loadFixtureThroughPipeline(
          repo,
          mockThreadApi as MockThreadApi,
          fixturePath,
        );

        for (const dto of errorPayloadDtos) {
          const msg = messages.find((m) => m.id === dto.id);
          expect(msg, `${fixturePath}: error-payload message ${dto.id} should exist`).toBeDefined();
          expect(
            msg!.isHidden,
            `${fixturePath}: error-payload message ${dto.id} should be hidden`,
          ).toBe(true);
        }
      },
    );
  });
});
