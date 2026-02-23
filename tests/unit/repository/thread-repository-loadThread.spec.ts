/**
 * ThreadRepository.loadThread — Branch coverage tests
 *
 * Tests the internal branching logic of loadThread, loadCachedThread,
 * and loadUncachedThread. Mocks threadApiService at the service layer.
 *
 * Branches covered:
 *   loadThread:
 *     1. Thread IS in cache → delegates to loadCachedThread
 *     2. Thread NOT in cache → delegates to loadUncachedThread
 *
 *   loadCachedThread:
 *     3. API messages succeed, returns messages → replaces cache
 *     4. API messages succeed, returns empty, cache had messages → keeps cached
 *     5. API messages succeed, returns empty, cache was empty → empty
 *     6. API messages fail → keeps cached messages, logs error
 *
 *   loadUncachedThread:
 *     7. getThread fails → returns null
 *     8. getThread succeeds, getMessages succeeds → full thread with messages
 *     9. getThread succeeds, getMessages fails → thread with empty messages
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiOk, apiFail } from '../../../src-electron/types/api-response';

// ── Mock dependencies ──────────────────────────────────────────────

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

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp' },
}));

vi.mock('../../../src-electron/services/file-storage.service', () => ({
  fileStorageService: {
    deleteThreadFiles: vi.fn().mockResolvedValue(undefined),
  },
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

// ── Import after mocks ─────────────────────────────────────────────

import { ThreadRepository } from '../../../src-electron/repository/thread-repository';
import type { ThreadDTO, MessageDTO, PagedResponse } from '../../../src-electron/services/mokuapi/thread.types';

// ── Helpers ────────────────────────────────────────────────────────

function fakeThreadDTO(overrides: Partial<ThreadDTO> = {}): ThreadDTO {
  return {
    id: 'thread-1',
    title: 'Test Thread',
    description: '',
    type: 'personal',
    ownerId: 'user-1',
    projectId: null,
    createdUserId: 'user-1',
    status: 'active',
    createdAt: '2025-06-01T00:00:00Z',
    updatedAt: '2025-06-01T00:00:00Z',
    deletedAt: '',
    metadata: {},
    ...overrides,
  };
}

function fakeMessageDTO(overrides: Partial<MessageDTO> = {}): MessageDTO {
  return {
    id: 'msg-1',
    threadId: 'thread-1',
    branchId: '1.0.0',
    model: 'gpt-4',
    provider: 'openai',
    role: 'user',
    content: 'Hello world',
    rawData: null,
    status: null,
    options: null,
    createdUserId: 'user-1',
    createdAt: '2025-06-01T00:00:01Z',
    updatedAt: '2025-06-01T00:00:01Z',
    ...overrides,
  };
}

function pagedMessages(messages: MessageDTO[]): PagedResponse<MessageDTO> {
  return {
    content: messages,
    page: 0,
    size: 1000,
    totalElements: messages.length,
    totalPages: 1,
    first: true,
    last: true,
    hasNext: false,
    hasPrevious: false,
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('ThreadRepository.loadThread — branch coverage', () => {
  let repo: ThreadRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new ThreadRepository();
  });

  // ── loadUncachedThread branches ──────────────────────────────

  describe('when thread is NOT in cache (loadUncachedThread)', () => {
    it('returns null when getThread API fails', async () => {
      mockThreadApi.getThread.mockResolvedValue(apiFail(404, 'Not found'));

      const result = await repo.loadThread('thread-1');

      expect(result).toBeNull();
      expect(mockThreadApi.getThread).toHaveBeenCalledWith('thread-1');
    });

    it('returns thread with messages when both APIs succeed', async () => {
      const dto = fakeThreadDTO();
      const msgDto = fakeMessageDTO({ content: 'Hello from API' });

      mockThreadApi.getThread.mockResolvedValue(apiOk(dto));
      mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedMessages([msgDto])));

      const result = await repo.loadThread('thread-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('thread-1');
      expect(result!.title).toBe('Test Thread');
      expect(result!.messages).toHaveLength(1);
      expect(result!.messages[0].content).toBe('Hello from API');
    });

    it('returns thread with empty messages when getMessages API fails', async () => {
      const dto = fakeThreadDTO();

      mockThreadApi.getThread.mockResolvedValue(apiOk(dto));
      mockThreadApi.getMessages.mockResolvedValue(apiFail(500, 'Message service down'));

      const result = await repo.loadThread('thread-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('thread-1');
      expect(result!.messages).toHaveLength(0);
    });

    it('caches the thread after loading from API', async () => {
      const dto = fakeThreadDTO();
      mockThreadApi.getThread.mockResolvedValue(apiOk(dto));
      mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedMessages([])));

      await repo.loadThread('thread-1');

      // Second call should NOT call getThread again — it should use cache path
      mockThreadApi.getThread.mockClear();
      mockThreadApi.getMessages.mockClear();
      mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedMessages([])));

      await repo.loadThread('thread-1');

      expect(mockThreadApi.getThread).not.toHaveBeenCalled();
      // getMessages IS still called (cache path refreshes messages)
      expect(mockThreadApi.getMessages).toHaveBeenCalledTimes(1);
    });

    it('correctly maps DTO timestamps to epoch ms', async () => {
      const dto = fakeThreadDTO({
        createdAt: '2025-06-15T12:30:00Z',
        updatedAt: '2025-06-15T13:00:00Z',
      });

      mockThreadApi.getThread.mockResolvedValue(apiOk(dto));
      mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedMessages([])));

      const result = await repo.loadThread('thread-1');

      expect(result!.createdAt).toBe(new Date('2025-06-15T12:30:00Z').getTime());
      expect(result!.updatedAt).toBe(new Date('2025-06-15T13:00:00Z').getTime());
    });

    it('handles multiple messages and sorts/maps them correctly', async () => {
      const dto = fakeThreadDTO();
      const msg1 = fakeMessageDTO({ id: 'm1', role: 'user', content: 'Q1', createdAt: '2025-06-01T00:00:01Z' });
      const msg2 = fakeMessageDTO({ id: 'm2', role: 'assistant', content: 'A1', createdAt: '2025-06-01T00:00:02Z' });
      const msg3 = fakeMessageDTO({ id: 'm3', role: 'user', content: 'Q2', createdAt: '2025-06-01T00:00:03Z' });

      mockThreadApi.getThread.mockResolvedValue(apiOk(dto));
      mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedMessages([msg1, msg2, msg3])));

      const result = await repo.loadThread('thread-1');

      expect(result!.messages).toHaveLength(3);
      expect(result!.messages[0].id).toBe('m1');
      expect(result!.messages[1].role).toBe('assistant');
      expect(result!.messages[2].content).toBe('Q2');
    });

    it('normalizes branchId to 3-part format', async () => {
      const dto = fakeThreadDTO();
      const msg = fakeMessageDTO({ branchId: '2.1' }); // 2-part, should become 2.1.0

      mockThreadApi.getThread.mockResolvedValue(apiOk(dto));
      mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedMessages([msg])));

      const result = await repo.loadThread('thread-1');

      expect(result!.messages[0].branchId).toBe('2.1.0');
    });

    it('defaults null branchId to 1.0.0', async () => {
      const dto = fakeThreadDTO();
      const msg = fakeMessageDTO({ branchId: null });

      mockThreadApi.getThread.mockResolvedValue(apiOk(dto));
      mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedMessages([msg])));

      const result = await repo.loadThread('thread-1');

      expect(result!.messages[0].branchId).toBe('1.0.0');
    });
  });

  // ── loadCachedThread branches ────────────────────────────────

  describe('when thread IS in cache (loadCachedThread)', () => {
    async function seedCache(repo: ThreadRepository, messages: MessageDTO[] = []) {
      // Load thread from API first to populate cache
      const dto = fakeThreadDTO();
      mockThreadApi.getThread.mockResolvedValue(apiOk(dto));
      mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedMessages(messages)));
      await repo.loadThread('thread-1');
      vi.clearAllMocks();
    }

    it('replaces cached messages when API returns new messages', async () => {
      // Seed cache with one message
      const oldMsg = fakeMessageDTO({ id: 'old-msg', content: 'Old message' });
      await seedCache(repo, [oldMsg]);

      // Second load — API returns different messages
      const newMsg = fakeMessageDTO({ id: 'new-msg', content: 'New message' });
      mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedMessages([newMsg])));

      const result = await repo.loadThread('thread-1');

      expect(result!.messages).toHaveLength(1);
      expect(result!.messages[0].id).toBe('new-msg');
      expect(result!.messages[0].content).toBe('New message');
      // getThread should NOT be called (cached path)
      expect(mockThreadApi.getThread).not.toHaveBeenCalled();
    });

    it('keeps cached messages when API returns empty but cache has messages', async () => {
      // Seed cache with messages
      const msg = fakeMessageDTO({ id: 'cached-msg', content: 'Cached content' });
      await seedCache(repo, [msg]);

      // Second load — API returns empty
      mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedMessages([])));

      const result = await repo.loadThread('thread-1');

      // Should keep the cached message
      expect(result!.messages).toHaveLength(1);
      expect(result!.messages[0].id).toBe('cached-msg');
    });

    it('returns empty messages when both cache and API are empty', async () => {
      // Seed cache with no messages
      await seedCache(repo, []);

      // Second load — API also returns empty
      mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedMessages([])));

      const result = await repo.loadThread('thread-1');

      expect(result!.messages).toHaveLength(0);
    });

    it('keeps cached messages when getMessages API fails', async () => {
      // Seed cache with messages
      const msg = fakeMessageDTO({ id: 'survived-msg', content: 'Survived' });
      await seedCache(repo, [msg]);

      // Second load — API fails
      mockThreadApi.getMessages.mockResolvedValue(apiFail(500, 'Service unavailable'));

      const result = await repo.loadThread('thread-1');

      // Should keep the cached message despite API error
      expect(result!.messages).toHaveLength(1);
      expect(result!.messages[0].content).toBe('Survived');
    });

    it('does not call getThread on cached path', async () => {
      await seedCache(repo);

      mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedMessages([])));
      await repo.loadThread('thread-1');

      expect(mockThreadApi.getThread).not.toHaveBeenCalled();
    });
  });

  // ── Return value isolation (clone) ───────────────────────────

  describe('return value isolation', () => {
    it('returns a clone — mutating the result does not affect cache', async () => {
      const dto = fakeThreadDTO();
      const msg = fakeMessageDTO({ content: 'Original' });

      mockThreadApi.getThread.mockResolvedValue(apiOk(dto));
      mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedMessages([msg])));

      const result1 = await repo.loadThread('thread-1');
      result1!.title = 'MUTATED';
      result1!.messages[0].content = 'MUTATED';

      // Reload from cache — should not see mutations
      mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedMessages([msg])));
      const result2 = await repo.loadThread('thread-1');

      expect(result2!.title).toBe('Test Thread');
      expect(result2!.messages[0].content).toBe('Original');
    });
  });

  // ── Edge cases ───────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles thread with deleted status', async () => {
      const dto = fakeThreadDTO({ status: 'deleted' });
      mockThreadApi.getThread.mockResolvedValue(apiOk(dto));
      mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedMessages([])));

      const result = await repo.loadThread('thread-1');

      expect(result!.status).toBe('deleted');
      expect(result!.deletedAt).toBeGreaterThan(0);
    });

    it('handles thread with project assignment', async () => {
      const dto = fakeThreadDTO({ projectId: 'proj-1', type: 'project' });
      mockThreadApi.getThread.mockResolvedValue(apiOk(dto));
      mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedMessages([])));

      const result = await repo.loadThread('thread-1');

      expect(result!.projectId).toBe('proj-1');
      expect(result!.type).toBe('project');
    });

    it('handles server timestamps without timezone (assumes UTC)', async () => {
      const dto = fakeThreadDTO({
        createdAt: '2025-06-15 12:30:00.123',
        updatedAt: '2025-06-15 13:00:00',
      });
      mockThreadApi.getThread.mockResolvedValue(apiOk(dto));
      mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedMessages([])));

      const result = await repo.loadThread('thread-1');

      // Should parse as UTC
      expect(result!.createdAt).toBe(new Date('2025-06-15T12:30:00.123Z').getTime());
      expect(result!.updatedAt).toBe(new Date('2025-06-15T13:00:00Z').getTime());
    });

    it('handles assistant message with empty content and rawData → sets content to "empty"', async () => {
      const dto = fakeThreadDTO();
      // Include a user message first to prevent PlaceholderInspector from adding one
      const userMsg = fakeMessageDTO({ id: 'user-msg', role: 'user', content: 'Hello', createdAt: '2025-06-01T00:00:00Z' });
      const assistantMsg = fakeMessageDTO({
        id: 'assistant-msg',
        role: 'assistant',
        content: '',
        rawData: { someKey: 'someValue' },
        createdAt: '2025-06-01T00:00:02Z',
      });

      mockThreadApi.getThread.mockResolvedValue(apiOk(dto));
      mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedMessages([userMsg, assistantMsg])));

      const result = await repo.loadThread('thread-1');

      // Find the assistant message (second after the user message)
      const assistant = result!.messages.find(m => m.id === 'assistant-msg');
      expect(assistant).toBeDefined();
      expect(assistant!.content).toBe('empty');
    });

    it('handles message with >3 part branchId — truncates to 3 parts', async () => {
      const dto = fakeThreadDTO();
      const msg = fakeMessageDTO({ branchId: '1.2.3.4.5' });

      mockThreadApi.getThread.mockResolvedValue(apiOk(dto));
      mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedMessages([msg])));

      const result = await repo.loadThread('thread-1');

      expect(result!.messages[0].branchId).toBe('1.2.3');
    });

    it('preserves metadata from thread DTO', async () => {
      const dto = fakeThreadDTO({
        metadata: { agentId: 'agent-1', initialProvider: 'anthropic', customField: 42 },
      });
      mockThreadApi.getThread.mockResolvedValue(apiOk(dto));
      mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedMessages([])));

      const result = await repo.loadThread('thread-1');

      expect(result!.metadata.agentId).toBe('agent-1');
      expect(result!.metadata.initialProvider).toBe('anthropic');
      expect((result!.metadata as Record<string, unknown>).customField).toBe(42);
    });
  });
});
