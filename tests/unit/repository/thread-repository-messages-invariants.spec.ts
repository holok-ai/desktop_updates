/**
 * ThreadRepository — Fixture invariant tests (property-based)
 *
 * Cross-cutting properties that must hold across all fixtures.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadFixtureThroughPipeline,
  loadCapture,
  listFixtures,
  listFixturesRecursive,
  validateMessageDTO,
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

describe('ThreadRepository — fixture invariants', () => {
  let repo: ThreadRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSequence();
    repo = new ThreadRepository();
  });

  it('Property 1: schema validator rejects incomplete DTOs', () => {
    const REQUIRED_FIELDS = [
      'id',
      'threadId',
      'createdAt',
      'updatedAt',
      'role',
      'content',
      'rawData',
      'status',
    ] as const;

    const validBase: Record<string, unknown> = {
      id: 'msg-1',
      threadId: 'thread-1',
      branchId: '1.0.0',
      model: 'gpt-4',
      provider: 'openai',
      role: 'user',
      content: 'hello',
      rawData: null,
      options: null,
      status: 'success',
      tokens: null,
      createdUserId: null,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    };

    for (const field of REQUIRED_FIELDS) {
      const incomplete = { ...validBase };
      delete incomplete[field];
      const errors = validateMessageDTO(incomplete);
      expect(errors.length, `Removing "${field}" should produce errors`).toBeGreaterThan(0);
      expect(
        errors.some((e) => e.field.includes(field)),
        `Expected error for "${field}"`,
      ).toBe(true);
    }

    const allRemoved = { ...validBase };
    for (const field of REQUIRED_FIELDS) delete allRemoved[field];
    expect(validateMessageDTO(allRemoved).length).toBeGreaterThanOrEqual(REQUIRED_FIELDS.length);
  });

  it('Property 2: every fixture produces at least one visible message', async () => {
    const subdirs = ['turns', 'guard', 'errors', 'tool-calls', 'edge-cases'];
    const allFixtures = subdirs.flatMap((d) => listFixtures(d));
    const providerFixtures = listFixturesRecursive('providers').filter(
      (f) => !f.includes('/error-handling/'),
    );
    const combined = [...allFixtures, ...providerFixtures];

    for (const fixturePath of combined) {
      const messages = await loadFixtureThroughPipeline(repo, mockThreadApi, fixturePath);
      expect(
        messages.filter((m) => m.isHidden !== true).length,
        `"${fixturePath}" produced no visible messages`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('Property 3: error-payload fixtures hide assistant messages', async () => {
    const errorPayloadFixtures = ['errors/openai_gpt-4-error-error-payload-400-1.json'];
    for (const fixturePath of errorPayloadFixtures) {
      const messages = await loadFixtureThroughPipeline(repo, mockThreadApi, fixturePath);
      for (const a of messages.filter((m) => m.role === 'assistant')) {
        expect(a.isHidden, `"${fixturePath}": assistant should be hidden`).toBe(true);
      }
    }
  });

  it('Property 4: guard fixtures hide guard messages and keep user visible', async () => {
    const guardFixtures = listFixtures('guard').filter((f) => !f.endsWith('guard-blocked.json'));
    for (const fixturePath of guardFixtures) {
      const messages = await loadFixtureThroughPipeline(repo, mockThreadApi, fixturePath);
      expect(
        messages.filter((m) => m.role === 'user' && m.isHidden !== true).length,
      ).toBeGreaterThanOrEqual(1);
      expect(
        messages.filter((m) => m.role === 'assistant' && m.isHidden === true).length,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('Property 5: tool-call fixtures produce toolUses', async () => {
    for (const fixturePath of listFixtures('tool-calls')) {
      const messages = await loadFixtureThroughPipeline(repo, mockThreadApi, fixturePath);
      expect(
        messages.filter((m) => m.role === 'assistant' && m.toolUses && m.toolUses.length > 0)
          .length,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('Property 6: turn fixtures preserve role alternation', async () => {
    for (const fixturePath of listFixtures('turns')) {
      const messages = await loadFixtureThroughPipeline(repo, mockThreadApi, fixturePath);
      expect(messages.length).toBeGreaterThanOrEqual(2);
      expect(messages[0].role).toBe('user');
      for (let i = 0; i < messages.length; i++) {
        expect(messages[i].role).toBe(i % 2 === 0 ? 'user' : 'assistant');
      }
    }
  });

  it('Property 7: referenced fixture files exist on disk', () => {
    const testFiles = [
      'thread-repository-messages.spec.ts',
      'thread-repository-messages-captured.spec.ts',
      'thread-repository-messages-generated.spec.ts',
      'thread-repository-messages-providers.spec.ts',
      'thread-repository-messages-invariants.spec.ts',
    ];

    const fixturePathPattern =
      /['"]((turns|guard|errors|tool-calls|edge-cases|providers)\/[a-zA-Z0-9_/.@-]+\.json)['"]/g;
    const referencedPaths = new Set<string>();

    for (const testFile of testFiles) {
      const fullPath = resolve(__dirname, testFile);
      if (!existsSync(fullPath)) continue;
      const content = readFileSync(fullPath, 'utf-8');
      let match: RegExpExecArray | null;
      while ((match = fixturePathPattern.exec(content)) !== null) {
        referencedPaths.add(match[1]);
      }
    }

    expect(referencedPaths.size).toBeGreaterThan(0);
    for (const fixturePath of referencedPaths) {
      const fullPath = resolve(FIXTURES_DIR, fixturePath);
      expect(existsSync(fullPath), `"${fixturePath}" does not exist`).toBe(true);
    }
  });

  it('Property 8: clean fixtures preserve message count', async () => {
    for (const fixturePath of listFixtures('turns')) {
      const dtos = loadCapture(fixturePath);
      const messages = await loadFixtureThroughPipeline(repo, mockThreadApi, fixturePath);
      expect(messages.length, `"${fixturePath}"`).toBe(dtos.length);
    }
  });

  it('Property 9: guard fixtures preserve or expand message count', async () => {
    for (const fixturePath of listFixtures('guard')) {
      const dtos = loadCapture(fixturePath);
      const messages = await loadFixtureThroughPipeline(repo, mockThreadApi, fixturePath);
      expect(messages.length, `"${fixturePath}"`).toBeGreaterThanOrEqual(dtos.length);
    }
  });

  it('Property 10: duplicate fixtures reduce message count', async () => {
    const fixturePath = 'edge-cases/openai_gpt-4-pass-duplicate-audit-records-1.json';
    const dtos = loadCapture(fixturePath);
    const messages = await loadFixtureThroughPipeline(repo, mockThreadApi, fixturePath);
    expect(messages.length).toBeLessThan(dtos.length);
  });

  it('Property 11: provider fixtures have 3-part branchIds', async () => {
    const providerFixtures = listFixturesRecursive('providers').filter(
      (f) => !f.includes('/error-handling/'),
    );
    for (const fixturePath of providerFixtures) {
      const messages = await loadFixtureThroughPipeline(repo, mockThreadApi, fixturePath);
      for (const msg of messages) {
        expect(msg.branchId.split('.').length, `"${fixturePath}" branchId "${msg.branchId}"`).toBe(
          3,
        );
      }
    }
  });

  it('Property 12: provider fixtures have user + assistant messages', async () => {
    const providerFixtures = listFixturesRecursive('providers').filter(
      (f) => !f.includes('/error-handling/'),
    );
    for (const fixturePath of providerFixtures) {
      const messages = await loadFixtureThroughPipeline(repo, mockThreadApi, fixturePath);
      expect(
        messages.some((m) => m.role === 'user'),
        `"${fixturePath}": no user`,
      ).toBe(true);
      expect(
        messages.some((m) => m.role === 'assistant'),
        `"${fixturePath}": no assistant`,
      ).toBe(true);
    }
  });
});
