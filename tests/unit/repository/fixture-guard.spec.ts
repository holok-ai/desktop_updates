/**
 * Fixture-driven tests: guard
 *
 * Discovers all fixtures in guard/ and asserts content-aware expectations
 * for guard pass/fail/block detection, hidden guard messages, and visible
 * user messages.
 *
 * Properties covered: 1 (non-zero output), 8 (guard-passed), 9 (guard-blocked),
 *                     10 (guard message visibility)
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

const guardFixtures = listFixtures('guard');

// ── Classification helpers ─────────────────────────────────────────

/** Guard-passed fixtures: filename contains "guard-passed". */
const guardPassedFixtures = guardFixtures.filter((f) => f.includes('guard-passed'));

/**
 * Guard-blocked fixtures that go through the guard inspector flow:
 * filename contains "guard-blocked" or "guard-double-encoded",
 * but NOT the bare "guard-blocked.json" which uses a different error format.
 */
const guardInspectorBlockedFixtures = guardFixtures.filter(
  (f) =>
    (f.includes('guard-blocked') || f.includes('guard-double-encoded')) &&
    !f.endsWith('/guard-blocked.json'),
);

/**
 * All fixtures that go through the guard inspector (have "Check the following"
 * pattern): guard-passed + guard-inspector-blocked.
 */
const guardInspectorFixtures = [...guardPassedFixtures, ...guardInspectorBlockedFixtures];

// ── Tests ──────────────────────────────────────────────────────────

describe('Fixture-driven: guard', () => {
  let repo: ThreadRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new ThreadRepository();
  });

  it('discovers at least one guard fixture', () => {
    expect(guardFixtures.length, 'No fixtures found in guard/').toBeGreaterThan(0);
  });

  // ── Property 1: universal invariants per fixture ─────────────────

  describe('universal invariants', () => {
    it.each(guardFixtures)(
      'non-zero output, valid branchIds, no duplicate IDs: %s',
      async (fixturePath) => {
        const messages = await loadFixtureThroughPipeline(
          repo,
          mockThreadApi as MockThreadApi,
          fixturePath,
        );

        // Property 1: non-zero output
        expect(messages.length, `${fixturePath}: expected non-zero output`).toBeGreaterThan(0);

        assertValidBranchIds(messages, fixturePath);
        assertNoDuplicateIds(messages, fixturePath);
      },
    );
  });

  // ── Property 8: guard-passed detection ───────────────────────────

  describe('guard-passed detection', () => {
    it.each(guardPassedFixtures)(
      'visible user has guardExecution=pass and non-null guardMessageId: %s',
      async (fixturePath) => {
        const messages = await loadFixtureThroughPipeline(
          repo,
          mockThreadApi as MockThreadApi,
          fixturePath,
        );

        const visibleUsers = messages.filter((m) => !m.isHidden && m.role === 'user');
        expect(
          visibleUsers.length,
          `${fixturePath}: expected at least one visible user`,
        ).toBeGreaterThan(0);

        const hasGuardPass = visibleUsers.some(
          (m) => m.guardExecution === 'pass' && m.guardMessageId !== null,
        );
        expect(
          hasGuardPass,
          `${fixturePath}: expected a visible user with guardExecution='pass' and non-null guardMessageId`,
        ).toBe(true);
      },
    );
  });

  // ── Property 9: guard-blocked detection ──────────────────────────

  describe('guard-blocked detection', () => {
    it.each(guardInspectorBlockedFixtures)(
      'visible user has guardExecution=fail: %s',
      async (fixturePath) => {
        const messages = await loadFixtureThroughPipeline(
          repo,
          mockThreadApi as MockThreadApi,
          fixturePath,
        );

        const visibleUsers = messages.filter((m) => !m.isHidden && m.role === 'user');
        expect(
          visibleUsers.length,
          `${fixturePath}: expected at least one visible user`,
        ).toBeGreaterThan(0);

        const hasGuardFail = visibleUsers.some((m) => m.guardExecution === 'fail');
        expect(
          hasGuardFail,
          `${fixturePath}: expected a visible user with guardExecution='fail'`,
        ).toBe(true);
      },
    );
  });

  // ── Guard error text on blocked fixtures ──────────────────────────

  describe('guard error text on blocked fixtures', () => {
    it.each(guardInspectorBlockedFixtures)(
      'visible user has non-empty guardError string: %s',
      async (fixturePath) => {
        const messages = await loadFixtureThroughPipeline(
          repo,
          mockThreadApi as MockThreadApi,
          fixturePath,
        );

        const blockedUser = messages.find(
          (m) => !m.isHidden && m.role === 'user' && m.guardExecution === 'fail',
        );
        expect(blockedUser, `${fixturePath}: expected a blocked user message`).toBeDefined();
        expect(
          blockedUser!.guardError,
          `${fixturePath}: guardError should be a non-empty string`,
        ).toBeTruthy();
        expect(typeof blockedUser!.guardError).toBe('string');
      },
    );
  });

  // ── guardMessageId points to hidden guard response ────────────────

  describe('guardMessageId points to hidden guard response', () => {
    it.each(guardInspectorFixtures)(
      'guardMessageId references a hidden assistant message: %s',
      async (fixturePath) => {
        const messages = await loadFixtureThroughPipeline(
          repo,
          mockThreadApi as MockThreadApi,
          fixturePath,
        );

        const annotatedUser = messages.find(
          (m) => !m.isHidden && m.role === 'user' && m.guardMessageId !== null,
        );
        expect(annotatedUser, `${fixturePath}: expected annotated user`).toBeDefined();

        const guardResponse = messages.find((m) => m.id === annotatedUser!.guardMessageId);
        expect(
          guardResponse,
          `${fixturePath}: guardMessageId should reference an existing message`,
        ).toBeDefined();
        expect(
          guardResponse!.isHidden,
          `${fixturePath}: guard response message should be hidden`,
        ).toBe(true);
      },
    );
  });

  // ── Property 10: guard message visibility ────────────────────────

  describe('guard message visibility', () => {
    it.each(guardInspectorFixtures)(
      '"Check the following" messages are hidden, at least one visible exists: %s',
      async (fixturePath) => {
        const dtos = loadCapture(fixturePath);
        const messages = await loadFixtureThroughPipeline(
          repo,
          mockThreadApi as MockThreadApi,
          fixturePath,
        );

        // Find DTOs whose content contains "Check the following"
        const guardDtoIds = dtos
          .filter((d) => typeof d.content === 'string' && d.content.includes('Check the following'))
          .map((d) => d.id);

        // All such messages should be hidden in the output
        for (const id of guardDtoIds) {
          const msg = messages.find((m) => m.id === id);
          expect(msg, `${fixturePath}: guard message ${id} should exist`).toBeDefined();
          expect(
            msg!.isHidden,
            `${fixturePath}: guard message ${id} with "Check the following" should be hidden`,
          ).toBe(true);
        }

        // At least one visible message must exist
        const visibleMessages = messages.filter((m) => !m.isHidden);
        expect(
          visibleMessages.length,
          `${fixturePath}: expected at least one visible message`,
        ).toBeGreaterThan(0);
      },
    );
  });
});
