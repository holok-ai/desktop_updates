/**
 * ThreadFacade — unit tests for facade-level coordination methods
 *
 * Tests cover:
 *   - getMessages: merge interceptor (Message + Stream domains)
 *   - calculateNextBranchId: branchId parsing and next-ID logic
 *   - createVariation: branchId generation and append flow
 *   - buildDisplayItems: delegation smoke test
 *   - Delegation smoke tests for pass-through methods
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Message } from '$lib/types/thread.type';
import type { ApiResponse } from '../../../src-electron/preload';

// ── Helpers ───────────────────────────────────────────────────────

function apiOk<T>(data: T): ApiResponse<T> {
  return { success: true, data, errorCode: 0, errorText: '' };
}
function apiFail<T>(errorCode: number, errorText: string): ApiResponse<T> {
  return { success: false, data: null, errorCode, errorText } as ApiResponse<T>;
}

function msg(
  overrides: Partial<Message> & { id: string; branchId: string; role: Message['role'] },
): Message {
  return {
    threadId: 'thread-1',
    content: `content-${overrides.id}`,
    createdAt: Date.now(),
    ...overrides,
  };
}

// ── Mock electronAPI ──────────────────────────────────────────────

const mockThreadApi = {
  getAll: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  softDelete: vi.fn(),
  renameThread: vi.fn(),
  getMessages: vi.fn(),
  moveToProject: vi.fn(),
  appendMessage: vi.fn(),
  updateMessage: vi.fn(),
  updateMessageBranch: vi.fn(),
  updateMessageDesktopOptions: vi.fn(),
  deleteBranch: vi.fn(),
  onThreadCreated: vi.fn(() => vi.fn()),
  onThreadUpdated: vi.fn(() => vi.fn()),
  onThreadDeleted: vi.fn(() => vi.fn()),
};

const mockChatApi = {
  createServiceForThread: vi.fn(),
  chat: vi.fn(),
  onToken: vi.fn(() => vi.fn()),
  onToolUse: vi.fn(() => vi.fn()),
  onToolStatus: vi.fn(() => vi.fn()),
  getAuditLogs: vi.fn(),
};

const mockModelsApi = {
  getAgent: vi.fn(),
  getModelsForApplication: vi.fn(),
  listAllApplications: vi.fn(),
  listAll: vi.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: {
    thread: mockThreadApi,
    chat: mockChatApi,
    models: mockModelsApi,
    auth: {},
    settings: {},
    system: {},
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    onMenuCommand: vi.fn(),
  },
  writable: true,
  configurable: true,
});

vi.mock('$lib/stores/thread.store', () => ({
  threads: {
    setThreads: vi.fn(),
    addThread: vi.fn(),
    updateThread: vi.fn(),
    deleteThread: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
}));

let facade: typeof import('$lib/services/thread-facade').threadFacade;

beforeEach(async () => {
  vi.clearAllMocks();

  // Reset singletons for BaseElectronService-based services
  const baseModule = await import('$lib/services/base-electron.service');
  const BaseClass = baseModule.BaseElectronService as unknown as {
    instances: Map<string, unknown>;
  };
  if (BaseClass.instances) {
    BaseClass.instances.clear();
  }

  vi.resetModules();

  const mod = await import('$lib/services/thread-facade');
  facade = mod.threadFacade;
});

// ═══════════════════════════════════════════════════════════════════
// getMessages (merge interceptor)
// ═══════════════════════════════════════════════════════════════════

describe('getMessages', () => {
  it('returns API messages as-is when no streaming session active', async () => {
    const apiMessages = [msg({ id: 'u1', branchId: '1.0.0', role: 'user' })];
    mockThreadApi.getMessages.mockResolvedValue(apiOk(apiMessages));

    const result = await facade.getMessages('t1');

    expect(result.success).toBe(true);
    expect(result.data).toBe(apiMessages);
  });

  it('returns API result directly when API call fails', async () => {
    mockThreadApi.getMessages.mockResolvedValue(apiFail(-1, 'error'));

    const result = await facade.getMessages('t1');

    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// calculateNextBranchId
// ═══════════════════════════════════════════════════════════════════

describe('calculateNextBranchId', () => {
  it('returns "1.0.0" when messages array is empty', () => {
    const result = facade.calculateNextBranchId([]);
    expect(result).toBe('1.0.0');
  });

  it('increments row for main lane (lane 0)', () => {
    const result = facade.calculateNextBranchId([], '3.0.0');
    expect(result).toBe('4.0.0');
  });

  it('increments iteration for branch lane (lane != 0)', () => {
    const result = facade.calculateNextBranchId([], '2.1.0');
    expect(result).toBe('2.1.1');
  });

  it('increments iteration when already > 0', () => {
    const result = facade.calculateNextBranchId([], '2.1.5');
    expect(result).toBe('2.1.6');
  });

  it('finds last main lane message when no branchId provided', () => {
    const messages = [
      msg({ id: '1', branchId: '1.0.0', role: 'user' }),
      msg({ id: '2', branchId: '1.0.0', role: 'assistant' }),
      msg({ id: '3', branchId: '2.0.0', role: 'user' }),
      msg({ id: '4', branchId: '2.1.0', role: 'user' }),
    ];
    const result = facade.calculateNextBranchId(messages);
    expect(result).toBe('3.0.0');
  });

  it('falls back to last message when no main lane messages exist', () => {
    const messages = [
      msg({ id: '1', branchId: '1.1.0', role: 'user' }),
      msg({ id: '2', branchId: '1.2.0', role: 'user' }),
    ];
    const result = facade.calculateNextBranchId(messages);
    expect(result).toBe('1.2.1');
  });

  it('handles whitespace-only branchId by falling back to messages', () => {
    const messages = [msg({ id: '1', branchId: '1.0.0', role: 'user' })];
    const result = facade.calculateNextBranchId(messages, '   ');
    expect(result).toBe('2.0.0');
  });

  it('returns "1.0.0" when messages empty and branchId is whitespace', () => {
    const result = facade.calculateNextBranchId([], '   ');
    expect(result).toBe('1.0.0');
  });

  it('handles malformed branchId (no dots) gracefully', () => {
    const result = facade.calculateNextBranchId([], 'garbage');
    expect(result).toBe('1.0.0');
  });

  it('handles branchId with only row part', () => {
    const result = facade.calculateNextBranchId([], '5');
    expect(result).toBe('6.0.0');
  });
});

// ═══════════════════════════════════════════════════════════════════
// createVariation
// ═══════════════════════════════════════════════════════════════════

describe('createVariation', () => {
  const fakeThread = {
    id: 'thread-1',
    title: 'Test Thread',
    description: '',
    status: 'active' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    messages: [],
    metadata: {},
  };

  it('appends a user message with a new branchId', async () => {
    mockThreadApi.getMessages.mockResolvedValue(apiOk([]));
    mockThreadApi.appendMessage.mockResolvedValue(
      apiOk({
        message: { id: 'new-msg', role: 'user', content: 'variation', createdAt: Date.now() },
        thread: fakeThread,
      }),
    );

    const original = msg({
      id: 'orig',
      branchId: '1.0.0',
      role: 'user',
      content: 'original',
      modelId: 'gpt-4',
    });
    const result = await facade.createVariation(fakeThread, original, 'new content');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.message.content).toBe('new content');
      expect(result.message.role).toBe('user');
      expect(result.newBranchId).toBeTruthy();
    }
  });

  it('uses originalMessage content when variationContent is undefined', async () => {
    mockThreadApi.getMessages.mockResolvedValue(apiOk([]));
    mockThreadApi.appendMessage.mockResolvedValue(
      apiOk({
        message: {
          id: 'new-msg',
          role: 'user',
          content: 'original content',
          createdAt: Date.now(),
        },
        thread: fakeThread,
      }),
    );

    const original = msg({
      id: 'orig',
      branchId: '1.0.0',
      role: 'user',
      content: 'original content',
    });
    const result = await facade.createVariation(fakeThread, original);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.message.content).toBe('original content');
    }
  });

  it('uses provided modelId over original message modelId', async () => {
    mockThreadApi.getMessages.mockResolvedValue(apiOk([]));
    mockThreadApi.appendMessage.mockResolvedValue(
      apiOk({
        message: { id: 'new-msg', role: 'user', content: 'test', createdAt: Date.now() },
        thread: fakeThread,
      }),
    );

    const original = msg({ id: 'orig', branchId: '1.0.0', role: 'user', modelId: 'old-model' });
    const result = await facade.createVariation(fakeThread, original, 'test', 'new-model');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.message.modelId).toBe('new-model');
    }

    expect(mockThreadApi.appendMessage).toHaveBeenCalledWith(
      'thread-1',
      expect.objectContaining({ metadata: { modelId: 'new-model' } }),
    );
  });

  it('uses currentMessages if provided instead of fetching from API', async () => {
    mockThreadApi.appendMessage.mockResolvedValue(
      apiOk({
        message: { id: 'new-msg', role: 'user', content: 'test', createdAt: Date.now() },
        thread: fakeThread,
      }),
    );

    const existing = [msg({ id: 'e1', branchId: '1.0.0', role: 'user' })];
    const original = msg({ id: 'orig', branchId: '1.0.0', role: 'user' });

    await facade.createVariation(fakeThread, original, 'test', undefined, existing);

    expect(mockThreadApi.getMessages).not.toHaveBeenCalled();
  });

  it('returns failure when appendMessage fails', async () => {
    mockThreadApi.getMessages.mockResolvedValue(apiOk([]));
    mockThreadApi.appendMessage.mockResolvedValue(apiFail(-1, 'append failed'));

    const original = msg({ id: 'orig', branchId: '1.0.0', role: 'user' });
    const result = await facade.createVariation(fakeThread, original);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('append failed');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// buildDisplayItems — delegation smoke test
// ═══════════════════════════════════════════════════════════════════

describe('buildDisplayItems (delegation)', () => {
  it('delegates to ThreadDisplay.buildDisplayItems and returns DisplayItems', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user', content: 'Hello' }),
      msg({ id: 'a1', branchId: '1.0.0', role: 'assistant', content: 'Hi' }),
    ];

    const items = facade.buildDisplayItems(messages);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('message');
    if (items[0].type === 'message') {
      expect(items[0].pair.request.id).toBe('u1');
      expect(items[0].pair.responses[0].id).toBe('a1');
    }
  });

  it('returns empty array for empty input', () => {
    expect(facade.buildDisplayItems([])).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Delegation smoke tests
// ═══════════════════════════════════════════════════════════════════

describe('delegation smoke tests', () => {
  it('rename delegates to threadCrudService', async () => {
    mockThreadApi.renameThread.mockResolvedValue(apiOk({ id: 't1', title: 'New' }));
    const result = await facade.rename('t1', 'New');
    expect(result.success).toBe(true);
    expect(mockThreadApi.renameThread).toHaveBeenCalledWith('t1', 'New');
  });

  it('delete delegates to threadCrudService', async () => {
    mockThreadApi.delete.mockResolvedValue(apiOk(true));
    const result = await facade.delete('t1');
    expect(result.success).toBe(true);
  });

  it('subscribeToStream delegates to threadStreamService', () => {
    const cb = vi.fn();
    const unsub = facade.subscribeToStream('t1', '1.0.0', cb);
    expect(typeof unsub).toBe('function');
  });

  it('deleteBranch delegates to threadBranchService', async () => {
    mockThreadApi.deleteBranch.mockResolvedValue(apiOk(undefined));
    const result = await facade.deleteBranch('t1', '1.1.0');
    expect(result.success).toBe(true);
  });
});
