/**
 * ThreadRepository — Generated fixture coverage (turns, guard, errors, tool-calls, edge-cases)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadFixtureThroughPipeline,
  loadCapture,
  resetSequence,
  ThreadRepository,
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

describe('ThreadRepository — generated fixtures', () => {
  let repo: ThreadRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSequence();
    repo = new ThreadRepository();
  });

  // ── Turns ────────────────────────────────────────────────────────

  describe('turns', () => {
    it('successful-turn-1: 2 messages, user→assistant, provider=openai', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        mockThreadApi,
        'turns/openai_gpt-4-pass-successful-turn-1.json',
      );
      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
      expect(messages[1].provider).toBe('openai');
    });

    it('multi-turn-conversation-1: 6 messages, role alternation', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        mockThreadApi,
        'turns/openai_gpt-4-pass-multi-turn-conversation-1.json',
      );
      expect(messages).toHaveLength(6);
      for (let i = 0; i < messages.length; i++) {
        expect(messages[i].role).toBe(i % 2 === 0 ? 'user' : 'assistant');
      }
    });
  });

  // ── Guard ────────────────────────────────────────────────────────

  describe('guard', () => {
    it('guard-blocked-1: guard messages hidden, user visible', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        mockThreadApi,
        'guard/openai_gpt-4-pass-guard-blocked-1.json',
      );
      expect(messages).toHaveLength(3);
      const visible = messages.filter((m) => !m.isHidden);
      expect(visible).toHaveLength(1);
      expect(visible[0].role).toBe('user');
      expect(visible[0].guardExecution).toBe('fail');
    });

    it('guard-double-encoded-1: still detected and hidden', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        mockThreadApi,
        'guard/openai_gpt-4-pass-guard-double-encoded-1.json',
      );
      expect(messages).toHaveLength(3);
      expect(messages.filter((m) => !m.isHidden)).toHaveLength(1);
    });

    it('guard-passed-1: guard hidden, user + assistant visible', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        mockThreadApi,
        'guard/openai_gpt-4-pass-guard-passed-1.json',
      );
      expect(messages).toHaveLength(4);
      const visible = messages.filter((m) => !m.isHidden);
      expect(visible).toHaveLength(2);
      expect(visible[0].guardExecution).toBe('pass');
      expect(visible[1].role).toBe('assistant');
    });
  });

  // ── Errors ───────────────────────────────────────────────────────

  describe('errors', () => {
    it('error-payload-400-1: assistant hidden by GuardInspector', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        mockThreadApi,
        'errors/openai_gpt-4-error-error-payload-400-1.json',
      );
      expect(messages).toHaveLength(2);
      expect(messages.find((m) => m.role === 'assistant')!.isHidden).toBe(true);
      expect(messages.find((m) => m.role === 'user')!.isHidden).not.toBe(true);
    });

    it('timeout-1: assistant not hidden', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        mockThreadApi,
        'errors/openai_gpt-4-error-timeout-1.json',
      );
      expect(messages).toHaveLength(2);
      expect(messages.find((m) => m.role === 'assistant')!.isHidden).not.toBe(true);
    });

    it('rate-limited-1: assistant not hidden', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        mockThreadApi,
        'errors/openai_gpt-4-error-rate-limited-1.json',
      );
      expect(messages).toHaveLength(2);
      expect(messages.find((m) => m.role === 'assistant')!.isHidden).not.toBe(true);
    });

    it('invalid-request-400-1: assistant not hidden', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        mockThreadApi,
        'errors/openai_claude-opus-4-6-error-invalid-request-400-1.json',
      );
      expect(messages).toHaveLength(2);
      expect(messages.find((m) => m.role === 'assistant')!.isHidden).not.toBe(true);
    });
  });

  // ── Tool-calls ───────────────────────────────────────────────────

  describe('tool-calls', () => {
    it('tool-call-in-rawdata-1: toolUses extracted', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        mockThreadApi,
        'tool-calls/openai_gpt-4-pass-tool-call-in-rawdata-1.json',
      );
      expect(messages).toHaveLength(2);
      const assistant = messages.find((m) => m.role === 'assistant')!;
      expect(assistant.toolUses!.length).toBeGreaterThan(0);
      expect(assistant.toolUses![0].name).toBe('read_file');
    });
  });

  // ── Edge-cases ───────────────────────────────────────────────────

  describe('edge-cases', () => {
    it('orphan-assistant-1: placeholder inserted', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        mockThreadApi,
        'edge-cases/openai_gpt-4-pass-orphan-assistant-1.json',
      );
      expect(messages.length).toBeGreaterThanOrEqual(2);
      expect(messages.find((m) => m.role === 'user')!.content).toBe('');
    });

    it('duplicate-audit-records-1: deduplication reduces count', async () => {
      const inputDtos = loadCapture('edge-cases/openai_gpt-4-pass-duplicate-audit-records-1.json');
      const messages = await loadFixtureThroughPipeline(
        repo,
        mockThreadApi,
        'edge-cases/openai_gpt-4-pass-duplicate-audit-records-1.json',
      );
      expect(messages.length).toBeLessThan(inputDtos.length);
    });

    it('empty-content-with-rawdata-1: content = "empty"', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        mockThreadApi,
        'edge-cases/openai_gpt-4-pass-empty-content-with-rawdata-1.json',
      );
      expect(messages.find((m) => m.role === 'assistant')!.content).toBe('empty');
    });

    it('null-branch-id-1: all branchIds = "1.0.0"', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        mockThreadApi,
        'edge-cases/openai_gpt-4-pass-null-branch-id-1.json',
      );
      for (const msg of messages) expect(msg.branchId).toBe('1.0.0');
    });

    it('null-content-1: content = ""', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        mockThreadApi,
        'edge-cases/openai_gpt-4-pass-null-content-1.json',
      );
      expect(messages.find((m) => m.role === 'assistant')!.content).toBe('');
    });

    it('two-part-branch-id-1: normalized to 3-part', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        mockThreadApi,
        'edge-cases/openai_gpt-4-pass-two-part-branch-id-1.json',
      );
      for (const msg of messages) expect(msg.branchId).toBe('2.1.0');
    });

    it('over-long-branch-id-1: truncated to 3 parts', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        mockThreadApi,
        'edge-cases/openai_gpt-4-pass-over-long-branch-id-1.json',
      );
      for (const msg of messages) expect(msg.branchId).toBe('1.2.3');
    });

    it('desktop-options-blocked-1: wasBlockedByGuard = true', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        mockThreadApi,
        'edge-cases/openai_gpt-4-pass-desktop-options-blocked-1.json',
      );
      expect(messages.find((m) => m.role === 'assistant')!.desktopOptions!.wasBlockedByGuard).toBe(
        true,
      );
    });

    it('desktop-options-selected-branch-1: isSelectedBranch = true', async () => {
      const messages = await loadFixtureThroughPipeline(
        repo,
        mockThreadApi,
        'edge-cases/openai_gpt-4-pass-desktop-options-selected-branch-1.json',
      );
      expect(messages.find((m) => m.role === 'assistant')!.desktopOptions!.isSelectedBranch).toBe(
        true,
      );
    });
  });
});
