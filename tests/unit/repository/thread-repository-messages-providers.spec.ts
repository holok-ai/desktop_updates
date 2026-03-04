/**
 * ThreadRepository — Provider fixture coverage (OPENAI, CLAUDE, OLLAMA)
 *
 * Tests real captured API responses from provider directories through the full pipeline.
 * Error-handling fixtures are NOT MessageDTO[] — they are error envelopes validated separately.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  loadFixtureThroughPipeline,
  listFixturesRecursive,
  resetSequence,
  ThreadRepository,
  FIXTURES_DIR,
} from './thread-messages-test-helpers';

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

/** Provider subdirectories containing MessageDTO[] fixtures */
const PROVIDER_SUBDIRS = [
  'providers/OPENAI/prompts/small',
  'providers/OPENAI/prompts/medium',
  'providers/OPENAI/prompts/large',
  'providers/OPENAI/prompts/long-turn',
  'providers/OPENAI/tool-calling',
  'providers/CLAUDE/prompts/small',
  'providers/CLAUDE/prompts/medium',
  'providers/CLAUDE/prompts/large',
  'providers/CLAUDE/prompts/long-turn',
  'providers/CLAUDE/tool-calling',
  'providers/OLLAMA/prompts/small',
  'providers/OLLAMA/prompts/medium',
  'providers/OLLAMA/prompts/large',
  'providers/OLLAMA/prompts/long-turn',
];

function allProviderFixtures(): string[] {
  return PROVIDER_SUBDIRS.flatMap((subdir) => listFixturesRecursive(subdir));
}

function fixturesForProvider(provider: string): string[] {
  return allProviderFixtures().filter((f) => f.includes(`providers/${provider}/`));
}

describe('ThreadRepository — provider fixtures', () => {
  let repo: ThreadRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSequence();
    repo = new ThreadRepository();
  });

  // ── All provider fixtures pass schema + pipeline ─────────────────

  describe('schema validation and pipeline', () => {
    const fixtures = allProviderFixtures();

    it(`found ${fixtures.length} provider fixtures`, () => {
      expect(fixtures.length).toBeGreaterThan(0);
    });

    it.each(fixtures)('%s: loads through pipeline', async (fixturePath) => {
      const messages = await loadFixtureThroughPipeline(repo, mockThreadApi, fixturePath);
      expect(messages.length).toBeGreaterThanOrEqual(2);
      expect(messages.some((m) => m.isHidden !== true)).toBe(true);
    });
  });

  // ── Provider-specific: provider name lowercased ──────────────────

  describe('OPENAI fixtures', () => {
    it.each(fixturesForProvider('OPENAI'))('%s: provider = "openai"', async (fixturePath) => {
      const messages = await loadFixtureThroughPipeline(repo, mockThreadApi, fixturePath);
      for (const a of messages.filter((m) => m.role === 'assistant')) {
        expect(a.provider?.toLowerCase()).toBe('openai');
      }
    });
  });

  describe('CLAUDE fixtures', () => {
    it.each(fixturesForProvider('CLAUDE'))('%s: provider = "claude"', async (fixturePath) => {
      const messages = await loadFixtureThroughPipeline(repo, mockThreadApi, fixturePath);
      for (const a of messages.filter((m) => m.role === 'assistant')) {
        expect(a.provider?.toLowerCase()).toBe('claude');
      }
    });
  });

  describe('OLLAMA fixtures', () => {
    it.each(fixturesForProvider('OLLAMA'))('%s: provider = "ollama"', async (fixturePath) => {
      const messages = await loadFixtureThroughPipeline(repo, mockThreadApi, fixturePath);
      for (const a of messages.filter((m) => m.role === 'assistant')) {
        expect(a.provider?.toLowerCase()).toBe('ollama');
      }
    });
  });

  // ── BranchId normalization ───────────────────────────────────────

  describe('branchId normalization', () => {
    it('all provider fixtures have 3-part branchIds after pipeline', async () => {
      for (const fixturePath of allProviderFixtures()) {
        const messages = await loadFixtureThroughPipeline(repo, mockThreadApi, fixturePath);
        for (const msg of messages) {
          expect(
            msg.branchId.split('.').length,
            `"${fixturePath}" branchId "${msg.branchId}"`,
          ).toBe(3);
        }
      }
    });
  });

  // ── Tool-calling fixtures ────────────────────────────────────────

  describe('tool-calling fixtures', () => {
    const toolFixtures = allProviderFixtures().filter((f) => f.includes('/tool-calling/'));

    it.each(toolFixtures)('%s: has tool data', async (fixturePath) => {
      const messages = await loadFixtureThroughPipeline(repo, mockThreadApi, fixturePath);
      const assistants = messages.filter((m) => m.role === 'assistant');
      expect(assistants.length).toBeGreaterThan(0);
      const hasToolData = assistants.some(
        (a) =>
          (a.toolUses && a.toolUses.length > 0) ||
          (a.rawData &&
            typeof a.rawData === 'object' &&
            a.rawData !== null &&
            ('tool_calls' in (a.rawData as Record<string, unknown>) ||
              'tool_use' in (a.rawData as Record<string, unknown>))),
      );
      expect(hasToolData, `"${fixturePath}": no tool data`).toBe(true);
    });
  });

  // ── Long-turn fixtures ───────────────────────────────────────────

  describe('long-turn fixtures', () => {
    const longTurnFixtures = allProviderFixtures().filter((f) => f.includes('/long-turn/'));

    it.each(longTurnFixtures)('%s: has >2 messages', async (fixturePath) => {
      const messages = await loadFixtureThroughPipeline(repo, mockThreadApi, fixturePath);
      expect(messages.length, `"${fixturePath}" should be multi-turn`).toBeGreaterThan(2);
    });
  });

  // ── Error-handling fixtures (non-MessageDTO shape) ───────────────

  describe('error-handling fixtures (non-MessageDTO)', () => {
    const errorFixtures = listFixturesRecursive('providers').filter((f) =>
      f.includes('/error-handling/'),
    );

    it.each(errorFixtures)('%s: is a valid error envelope', (fixturePath) => {
      const fullPath = resolve(FIXTURES_DIR, fixturePath);
      const raw = JSON.parse(readFileSync(fullPath, 'utf-8'));
      expect(Array.isArray(raw)).toBe(false);
      expect(raw).toHaveProperty('provider');
      expect(raw).toHaveProperty('error');
    });
  });
});
