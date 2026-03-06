/**
 * ThreadRepository — Captured JSON fixture tests (scenarios 20–25)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  loadFixtureThroughPipeline,
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

describe('ThreadRepository — captured JSON fixtures', () => {
  let repo: ThreadRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSequence();
    repo = new ThreadRepository();
  });

  it('scenario 20: successful OpenAI turn', async () => {
    const messages = await loadFixtureThroughPipeline(
      repo,
      mockThreadApi,
      'turns/openai-small-turn.json',
    );
    expect(messages.length).toBeGreaterThanOrEqual(2);
    const user = messages.find((m) => m.role === 'user')!;
    const assistant = messages.find((m) => m.role === 'assistant')!;
    expect(user.content.length).toBeGreaterThan(0);
    expect(assistant.content.length).toBeGreaterThan(0);
    expect(assistant.provider?.toLowerCase()).toBe('openai');
    expect(assistant.isHidden).not.toBe(true);
  });

  it('scenario 21: successful Claude turn', async () => {
    const messages = await loadFixtureThroughPipeline(
      repo,
      mockThreadApi,
      'turns/claude-small-turn.json',
    );
    expect(messages.length).toBeGreaterThanOrEqual(2);
    const assistant = messages.find((m) => m.role === 'assistant')!;
    expect(assistant.provider?.toLowerCase()).toBe('claude');
    expect(assistant.content.length).toBeGreaterThan(0);
  });

  it('scenario 23: tool call response', async () => {
    const messages = await loadFixtureThroughPipeline(
      repo,
      mockThreadApi,
      'tool-calls/openai-tool-calling.json',
    );
    expect(messages.length).toBeGreaterThanOrEqual(2);
    const withTools = messages.filter((m) => m.toolUses && m.toolUses.length > 0);
    expect(withTools.length).toBeGreaterThan(0);
    expect(withTools[0].toolUses![0].name).toBe('read_file');
  });

  it('scenario 24: guard blocked', async () => {
    const messages = await loadFixtureThroughPipeline(
      repo,
      mockThreadApi,
      'guard/guard-blocked.json',
    );
    expect(messages).toHaveLength(2);
    expect(messages.find((m) => m.role === 'user')!.isHidden).not.toBe(true);
    expect(messages.find((m) => m.role === 'assistant')!.content).toContain('PII');
  });

  it('scenario 25: error response', async () => {
    const messages = await loadFixtureThroughPipeline(
      repo,
      mockThreadApi,
      'errors/error-400-invalid-request.json',
    );
    expect(messages.find((m) => m.role === 'assistant')!.content).toContain('error');
    expect(messages.some((m) => m.isHidden !== true)).toBe(true);
  });
});
