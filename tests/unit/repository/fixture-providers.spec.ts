/**
 * Fixture-driven tests: providers
 *
 * Discovers all fixtures recursively under providers/ and asserts content-aware
 * expectations across OPENAI, CLAUDE, and OLLAMA providers.
 *
 * Properties covered: 1 (non-zero output), 11 (tool-calling), 14 (prompt size bounds),
 *                     15 (provider field matches path), 16 (error fixtures have indicators)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  loadFixtureThroughPipeline,
  listFixturesRecursive,
  loadCapture,
  ThreadRepository,
  FIXTURES_DIR,
} from './thread-messages-test-helpers';
import type { MockThreadApi } from './thread-messages-test-helpers';
import {
  assertValidBranchIds,
  assertNoDuplicateIds,
  fixtureCategory,
  providerFromPath,
  assertPromptSizeBounds,
  assertContentMatchesPrompt,
} from './fixture-assertion-helpers';
import type { PromptSize } from './fixture-assertion-helpers';

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

const allProviderFixtures = listFixturesRecursive('providers');

/** Check if a fixture is a valid MessageDTO array (not error metadata). */
function isMessageDTOArray(fixturePath: string): boolean {
  try {
    const data = loadCapture(fixturePath);
    return Array.isArray(data);
  } catch {
    return false;
  }
}

// Separate pipeline-loadable fixtures from error metadata files
const pipelineFixtures = allProviderFixtures.filter(isMessageDTOArray);
const errorMetadataFixtures = allProviderFixtures.filter(
  (f) => fixtureCategory(f) === 'error-handling' && !isMessageDTOArray(f),
);

// Filtered lists by category
const promptFixtures = pipelineFixtures.filter((f) => {
  const cat = fixtureCategory(f);
  return cat === 'small' || cat === 'medium' || cat === 'large' || cat === 'long-turn';
});
const toolCallingFixtures = pipelineFixtures.filter((f) => fixtureCategory(f) === 'tool-calling');
const errorPipelineFixtures = pipelineFixtures.filter(
  (f) => fixtureCategory(f) === 'error-handling',
);

// ── Tests ──────────────────────────────────────────────────────────

describe('Fixture-driven: providers', () => {
  let repo: ThreadRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new ThreadRepository();
  });

  it('discovers at least one provider fixture', () => {
    expect(allProviderFixtures.length, 'No fixtures found in providers/').toBeGreaterThan(0);
  });

  // ── Property 1, 3, 4: universal invariants ───────────────────────

  describe('universal invariants', () => {
    it.each(pipelineFixtures)(
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

  // ── Property 14: prompt size content bounds ──────────────────────

  describe('prompt size content bounds', () => {
    it.each(promptFixtures)('content within size bounds: %s', async (fixturePath) => {
      const category = fixtureCategory(fixturePath) as PromptSize;
      const messages = await loadFixtureThroughPipeline(
        repo,
        mockThreadApi as MockThreadApi,
        fixturePath,
      );
      assertPromptSizeBounds(messages, category, fixturePath);
    });
  });

  // ── Content-aware: key terms from user prompt in assistant response

  describe('content matches user prompt key terms', () => {
    it.each(promptFixtures)(
      'assistant response contains prompt key terms: %s',
      async (fixturePath) => {
        const category = fixtureCategory(fixturePath) as PromptSize;
        const dtos = loadCapture(fixturePath);
        const messages = await loadFixtureThroughPipeline(
          repo,
          mockThreadApi as MockThreadApi,
          fixturePath,
        );
        assertContentMatchesPrompt(messages, dtos, category, fixturePath);
      },
    );
  });

  // ── Property 15: provider field matches directory path ───────────

  describe('provider field matches directory path', () => {
    it.each(pipelineFixtures)('assistant provider matches path: %s', async (fixturePath) => {
      const expectedProvider = providerFromPath(fixturePath);
      const messages = await loadFixtureThroughPipeline(
        repo,
        mockThreadApi as MockThreadApi,
        fixturePath,
      );
      const assistants = messages.filter((m) => m.role === 'assistant');
      for (const msg of assistants) {
        if (msg.provider) {
          expect(msg.provider.toLowerCase(), `${fixturePath}: provider mismatch`).toBe(
            expectedProvider,
          );
        }
      }
    });
  });

  // ── Property 16: error fixtures contain error indicators ─────────

  describe('error fixtures contain error indicators', () => {
    if (errorMetadataFixtures.length > 0) {
      it.each(errorMetadataFixtures)('error metadata fixture exists: %s', (fixturePath) => {
        // Error metadata files are not MessageDTO arrays — they represent
        // API error responses. Verify they contain error information.
        const raw = JSON.parse(readFileSync(resolve(FIXTURES_DIR, fixturePath), 'utf-8'));
        expect(raw.error, `${fixturePath}: should have error field`).toBeDefined();
      });
    }

    if (errorPipelineFixtures.length > 0) {
      it.each(errorPipelineFixtures)(
        'pipeline error fixture has hidden or error message: %s',
        async (fixturePath) => {
          const messages = await loadFixtureThroughPipeline(
            repo,
            mockThreadApi as MockThreadApi,
            fixturePath,
          );
          const hasErrorIndicator = messages.some(
            (m) => m.isHidden === true || (m.content && /error|fail|block/i.test(m.content)),
          );
          expect(
            hasErrorIndicator,
            `${fixturePath}: should have at least one hidden or error-indicating message`,
          ).toBe(true);
        },
      );
    }
  });

  // ── Property 11: tool-calling fixtures have toolUses ─────────────

  describe('tool-calling fixtures have toolUses', () => {
    it.each(toolCallingFixtures)(
      'at least one assistant has non-empty toolUses: %s',
      async (fixturePath) => {
        const messages = await loadFixtureThroughPipeline(
          repo,
          mockThreadApi as MockThreadApi,
          fixturePath,
        );
        const assistantsWithTools = messages.filter(
          (m) => m.role === 'assistant' && m.toolUses && m.toolUses.length > 0,
        );
        expect(
          assistantsWithTools.length,
          `${fixturePath}: should have at least one assistant with toolUses`,
        ).toBeGreaterThan(0);

        for (const msg of assistantsWithTools) {
          for (const toolUse of msg.toolUses!) {
            expect(toolUse.name, `${fixturePath}: toolUse should have non-empty name`).toBeTruthy();
          }
        }
      },
    );
  });
});
