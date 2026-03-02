/**
 * ThreadRepository.loadThread + loadThreadMessages — Behavior tests
 *
 * loadThread: loads metadata only and caches thread meta.
 * loadThreadMessages: always loads messages from API and runs inspectors.
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
import type {
  ThreadDTO,
  MessageDTO,
  PagedResponse,
} from '../../../src-electron/services/mokuapi/thread.types';

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

describe('ThreadRepository.loadThread', () => {
  let repo: ThreadRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new ThreadRepository();
  });

  it('returns null when getThread API fails', async () => {
    mockThreadApi.getThread.mockResolvedValue(apiFail(404, 'Not found'));

    const result = await repo.loadThread('thread-1');

    expect(result).toBeNull();
    expect(mockThreadApi.getThread).toHaveBeenCalledWith('thread-1');
  });

  it('returns thread metadata (messages empty) when getThread succeeds', async () => {
    const dto = fakeThreadDTO();
    mockThreadApi.getThread.mockResolvedValue(apiOk(dto));

    const result = await repo.loadThread('thread-1');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('thread-1');
    expect(result!.title).toBe('Test Thread');
    expect(result!.messages).toHaveLength(0);
  });

  it('caches thread metadata so getThread is not called twice', async () => {
    const dto = fakeThreadDTO();
    mockThreadApi.getThread.mockResolvedValue(apiOk(dto));

    await repo.loadThread('thread-1');
    mockThreadApi.getThread.mockClear();

    await repo.loadThread('thread-1');

    expect(mockThreadApi.getThread).not.toHaveBeenCalled();
  });

  it('correctly maps DTO timestamps to epoch ms', async () => {
    const dto = fakeThreadDTO({
      createdAt: '2025-06-15T12:30:00Z',
      updatedAt: '2025-06-15T13:00:00Z',
    });

    mockThreadApi.getThread.mockResolvedValue(apiOk(dto));

    const result = await repo.loadThread('thread-1');

    expect(result!.createdAt).toBe(new Date('2025-06-15T12:30:00Z').getTime());
    expect(result!.updatedAt).toBe(new Date('2025-06-15T13:00:00Z').getTime());
  });

  it('returns a clone — mutating the result does not affect cache', async () => {
    const dto = fakeThreadDTO();

    mockThreadApi.getThread.mockResolvedValue(apiOk(dto));

    const result1 = await repo.loadThread('thread-1');
    result1!.title = 'MUTATED';

    const result2 = await repo.loadThread('thread-1');

    expect(result2!.title).toBe('Test Thread');
  });

  it('handles thread with deleted status', async () => {
    const dto = fakeThreadDTO({ status: 'deleted' });
    mockThreadApi.getThread.mockResolvedValue(apiOk(dto));

    const result = await repo.loadThread('thread-1');

    expect(result!.status).toBe('deleted');
    expect(result!.deletedAt).toBeGreaterThan(0);
  });

  it('handles thread with project assignment', async () => {
    const dto = fakeThreadDTO({ projectId: 'proj-1', type: 'project' });
    mockThreadApi.getThread.mockResolvedValue(apiOk(dto));

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

    const result = await repo.loadThread('thread-1');

    expect(result!.createdAt).toBe(new Date('2025-06-15T12:30:00.123Z').getTime());
    expect(result!.updatedAt).toBe(new Date('2025-06-15T13:00:00Z').getTime());
  });

  it('preserves metadata from thread DTO', async () => {
    const dto = fakeThreadDTO({
      metadata: { agentId: 'agent-1', initialProvider: 'anthropic', customField: 42 },
    });
    mockThreadApi.getThread.mockResolvedValue(apiOk(dto));

    const result = await repo.loadThread('thread-1');

    expect(result!.metadata.agentId).toBe('agent-1');
    expect(result!.metadata.initialProvider).toBe('anthropic');
    expect((result!.metadata as Record<string, unknown>).customField).toBe(42);
  });
});

describe('ThreadRepository.loadThreadMessages', () => {
  let repo: ThreadRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new ThreadRepository();
  });

  it('returns empty array when getMessages API fails', async () => {
    mockThreadApi.getMessages.mockResolvedValue(apiFail(500, 'Message service down'));

    const result = await repo.loadThreadMessages('thread-1');

    expect(result).toHaveLength(0);
  });

  it('maps messages and preserves order', async () => {
    const msg1 = fakeMessageDTO({
      id: 'm1',
      role: 'user',
      content: 'Q1',
      createdAt: '2025-06-01T00:00:01Z',
    });
    const msg2 = fakeMessageDTO({
      id: 'm2',
      role: 'assistant',
      content: 'A1',
      createdAt: '2025-06-01T00:00:02Z',
    });
    const msg3 = fakeMessageDTO({
      id: 'm3',
      role: 'user',
      content: 'Q2',
      createdAt: '2025-06-01T00:00:03Z',
    });

    mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedMessages([msg1, msg2, msg3])));

    const result = await repo.loadThreadMessages('thread-1');

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('m1');
    expect(result[1].role).toBe('assistant');
    expect(result[2].content).toBe('Q2');
  });

  it('normalizes branchId to 3-part format', async () => {
    const msg = fakeMessageDTO({ branchId: '2.1' });

    mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedMessages([msg])));

    const result = await repo.loadThreadMessages('thread-1');

    expect(result[0].branchId).toBe('2.1.0');
  });

  it('defaults null branchId to 1.0.0', async () => {
    const msg = fakeMessageDTO({ branchId: null });

    mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedMessages([msg])));

    const result = await repo.loadThreadMessages('thread-1');

    expect(result[0].branchId).toBe('1.0.0');
  });

  it('handles assistant message with empty content and rawData → sets content to "empty"', async () => {
    const userMsg = fakeMessageDTO({
      id: 'user-msg',
      role: 'user',
      content: 'Hello',
      createdAt: '2025-06-01T00:00:00Z',
    });
    const assistantMsg = fakeMessageDTO({
      id: 'assistant-msg',
      role: 'assistant',
      content: '',
      rawData: { someKey: 'someValue' },
      createdAt: '2025-06-01T00:00:02Z',
    });

    mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedMessages([userMsg, assistantMsg])));

    const result = await repo.loadThreadMessages('thread-1');

    const assistant = result.find((m) => m.id === 'assistant-msg');
    expect(assistant).toBeDefined();
    expect(assistant!.content).toBe('empty');
  });

  it('handles message with >3 part branchId — truncates to 3 parts', async () => {
    const msg = fakeMessageDTO({ branchId: '1.2.3.4.5' });

    mockThreadApi.getMessages.mockResolvedValue(apiOk(pagedMessages([msg])));

    const result = await repo.loadThreadMessages('thread-1');

    expect(result[0].branchId).toBe('1.2.3');
  });
});
