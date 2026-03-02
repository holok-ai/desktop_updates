/**
 * ThreadFacade — unit tests for facade-level logic
 *
 * Domain service delegation is tested in the domain service specs:
 *   - thread-crud.service.spec.ts    (create, isAgentAvailable, etc.)
 *   - thread-message.service.spec.ts (sendChatMessage, appendMessage, submitPromptToChat)
 *   - thread-stream.service.spec.ts  (subscribeToStream)
 *   - thread-branch.service.spec.ts  (selectBranchLane, deleteBranch)
 *
 * Tests here cover:
 *   - calculateNextBranchId: sync branchId calculation from messages array (logic lives in facade)
 *   - createVariation:       cross-domain message creation with branchId generation (logic lives in facade)
 *   - getMessages:           streaming session merge logic (logic lives in facade)
 *   - buildDisplayItems:     delegation smoke test
 *   - sendChatMessage:       delegation smoke test
 *   - appendMessage:         delegation smoke test
 *   - submitPromptToChat:    delegation smoke test
 *   - create:                delegation smoke test
 *   - isAgentAvailable:      delegation smoke test
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

// vi.mock is hoisted, so mockStreamService must be defined with vi.hoisted
const mockStreamService = vi.hoisted(() => ({
  subscribeToStream: vi.fn(() => vi.fn()),
  unsubscribeAllForThread: vi.fn(),
  registerStreamingSession: vi.fn(),
  updateStreamingContent: vi.fn(),
  clearStreamingSession: vi.fn(),
  hasStreamingSession: vi.fn(() => false),
  getStreamingSession: vi.fn(() => undefined),
  mergeStreamingMessages: vi.fn((msgs: Message[]) => msgs),
  getBackgroundStream: vi.fn(() => undefined),
  setBackgroundStream: vi.fn(),
  deleteBackgroundStream: vi.fn(),
  hasBackgroundStream: vi.fn(() => false),
  subscribeToToolUse: vi.fn(() => vi.fn()),
  clearToolCalls: vi.fn(),
}));

vi.mock('$lib/services/thread-stream.service', () => ({
  threadStreamService: mockStreamService,
}));

import { threadFacade } from '$lib/services/thread-facade';

beforeEach(() => {
  vi.clearAllMocks();
  mockStreamService.getStreamingSession.mockReturnValue(undefined);
  mockStreamService.mergeStreamingMessages.mockImplementation((msgs: Message[]) => msgs);
});

// ═══════════════════════════════════════════════════════════════════
// calculateNextBranchId
// Sync method — takes messages[] directly, no API call
// ═══════════════════════════════════════════════════════════════════

describe('calculateNextBranchId', () => {
  it('returns "1.0.0" when messages array is empty', () => {
    expect(threadFacade.calculateNextBranchId([])).toBe('1.0.0');
  });

  it('increments row for main lane (lane 0)', () => {
    expect(threadFacade.calculateNextBranchId([], '3.0.0')).toBe('4.0.0');
  });

  it('increments iteration for branch lane (lane != 0)', () => {
    expect(threadFacade.calculateNextBranchId([], '2.1.0')).toBe('2.1.1');
  });

  it('increments iteration when already > 0', () => {
    expect(threadFacade.calculateNextBranchId([], '2.1.5')).toBe('2.1.6');
  });

  it('finds last main lane message when no branchId provided', () => {
    const messages = [
      msg({ id: '1', branchId: '1.0.0', role: 'user' }),
      msg({ id: '2', branchId: '1.0.0', role: 'assistant' }),
      msg({ id: '3', branchId: '2.0.0', role: 'user' }),
      msg({ id: '4', branchId: '2.1.0', role: 'user' }), // branch lane — skipped
    ];
    // Last main lane message is '2.0.0', so next is '3.0.0'
    expect(threadFacade.calculateNextBranchId(messages)).toBe('3.0.0');
  });

  it('falls back to last message when no main lane messages exist', () => {
    const messages = [
      msg({ id: '1', branchId: '1.1.0', role: 'user' }),
      msg({ id: '2', branchId: '1.2.0', role: 'user' }),
    ];
    // Last message is '1.2.0' (branch lane) → increments iteration → '1.2.1'
    expect(threadFacade.calculateNextBranchId(messages)).toBe('1.2.1');
  });

  it('ignores whitespace-only lastMessageBranchId and uses messages instead', () => {
    const messages = [msg({ id: '1', branchId: '1.0.0', role: 'user' })];
    expect(threadFacade.calculateNextBranchId(messages, '   ')).toBe('2.0.0');
  });

  it('handles malformed branchId (no dots) gracefully', () => {
    // parseInt('garbage') = NaN → 0 for row/lane/iter → main lane → '1.0.0'
    expect(threadFacade.calculateNextBranchId([], 'garbage')).toBe('1.0.0');
  });

  it('handles branchId with only row part', () => {
    // parts[1]=undefined → lane=0 → main lane → '6.0.0'
    expect(threadFacade.calculateNextBranchId([], '5')).toBe('6.0.0');
  });
});

// ═══════════════════════════════════════════════════════════════════
// getMessages — streaming session merge logic
// ═══════════════════════════════════════════════════════════════════

describe('getMessages', () => {
  it('returns API messages as-is when no streaming session is active', async () => {
    const messages = [msg({ id: 'm1', branchId: '1.0.0', role: 'user' })];
    mockThreadApi.getMessages.mockResolvedValue(apiOk(messages));

    const result = await threadFacade.getMessages('thread-1');

    expect(result.success).toBe(true);
    expect(result.data).toEqual(messages);
    expect(mockStreamService.mergeStreamingMessages).not.toHaveBeenCalled();
  });

  it('merges streaming session data when a session is active', async () => {
    const messages = [msg({ id: 'm1', branchId: '1.0.0', role: 'user' })];
    const merged = [...messages, msg({ id: 'streaming', branchId: '1.0.0', role: 'assistant' })];
    const fakeSession = { threadId: 'thread-1', content: '...' };

    mockThreadApi.getMessages.mockResolvedValue(apiOk(messages));
    mockStreamService.getStreamingSession.mockReturnValue(fakeSession);
    mockStreamService.mergeStreamingMessages.mockReturnValue(merged);

    const result = await threadFacade.getMessages('thread-1');

    expect(mockStreamService.mergeStreamingMessages).toHaveBeenCalledWith(messages, fakeSession);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(merged);
  });

  it('returns failure and skips merge when API call fails', async () => {
    mockThreadApi.getMessages.mockResolvedValue(apiFail(-1, 'not found'));

    const result = await threadFacade.getMessages('thread-1');

    expect(result.success).toBe(false);
    expect(mockStreamService.mergeStreamingMessages).not.toHaveBeenCalled();
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

  it('appends a user message and returns success with new branchId', async () => {
    mockThreadApi.getMessages.mockResolvedValue(apiOk([]));
    mockThreadApi.appendMessage.mockResolvedValue(
      apiOk({
        message: { id: 'new-msg', role: 'user', content: 'variation', createdAt: Date.now() },
        thread: fakeThread,
      }),
    );

    const original = msg({ id: 'orig', branchId: '1.0.0', role: 'user', content: 'original' });
    const result = await threadFacade.createVariation(fakeThread, original, 'variation content');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.message.content).toBe('variation content');
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
    const result = await threadFacade.createVariation(fakeThread, original);

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
    const result = await threadFacade.createVariation(fakeThread, original, 'test', 'new-model');

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

    await threadFacade.createVariation(fakeThread, original, 'test', undefined, existing);

    expect(mockThreadApi.getMessages).not.toHaveBeenCalled();
  });

  it('returns failure when appendMessage fails', async () => {
    mockThreadApi.getMessages.mockResolvedValue(apiOk([]));
    mockThreadApi.appendMessage.mockResolvedValue(apiFail(-1, 'append failed'));

    const original = msg({ id: 'orig', branchId: '1.0.0', role: 'user' });
    const result = await threadFacade.createVariation(fakeThread, original);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('append failed');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// buildDisplayItems — delegation smoke test
// (Full coverage is in tests/unit/utils/thread-display.spec.ts)
// ═══════════════════════════════════════════════════════════════════

describe('buildDisplayItems', () => {
  it('delegates to ThreadDisplay and returns DisplayItems', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user', content: 'Hello' }),
      msg({ id: 'a1', branchId: '1.0.0', role: 'assistant', content: 'Hi' }),
    ];

    const items = threadFacade.buildDisplayItems(messages);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe('message');
    if (items[0].type === 'message') {
      expect(items[0].pair.request.id).toBe('u1');
      expect(items[0].pair.responses[0].id).toBe('a1');
    }
  });

  it('returns empty array for empty input', () => {
    expect(threadFacade.buildDisplayItems([])).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// sendChatMessage — delegation smoke test
// (Full coverage is in thread-message.service.spec.ts)
// ═══════════════════════════════════════════════════════════════════

describe('sendChatMessage', () => {
  it('returns error when threadId is empty', async () => {
    const result = await threadFacade.sendChatMessage('', 'b1', { prompt: 'hi' });
    expect(result.success).toBe(false);
    expect(result.errorText).toContain('threadId and branchId are required');
  });

  it('constructs payload with thread_id and branch_id added', async () => {
    mockChatApi.chat.mockResolvedValue(apiOk(undefined));
    await threadFacade.sendChatMessage('t1', 'b1', { prompt: 'hi', streaming: true });
    expect(mockChatApi.chat).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ thread_id: 't1', branch_id: 'b1' }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// appendMessage — delegation smoke test
// (Full coverage is in thread-message.service.spec.ts)
// ═══════════════════════════════════════════════════════════════════

describe('appendMessage', () => {
  it('maps camelCase fields to snake_case in wire payload', async () => {
    mockThreadApi.appendMessage.mockResolvedValue(
      apiOk({
        message: { id: 'm1', role: 'user', content: 'hi', createdAt: Date.now() },
        thread: {},
      }),
    );

    await threadFacade.appendMessage('t1', {
      role: 'user',
      content: 'hello',
      clientMessageId: 'cid-1',
      branchId: '1.0.0',
      modelName: 'gpt-4',
    });

    expect(mockThreadApi.appendMessage).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({
        client_message_id: 'cid-1',
        branch_id: '1.0.0',
        model_name: 'gpt-4',
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// submitPromptToChat — delegation smoke test
// (Full coverage is in thread-message.service.spec.ts)
// ═══════════════════════════════════════════════════════════════════

describe('submitPromptToChat', () => {
  it('creates chat service and sends message', async () => {
    mockChatApi.createServiceForThread.mockResolvedValue(apiOk(undefined));
    mockChatApi.chat.mockResolvedValue(apiOk(undefined));

    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user', content: 'Hello' }),
      msg({ id: 'a1', branchId: '1.0.0', role: 'assistant', content: 'Hi' }),
    ];

    const result = await threadFacade.submitPromptToChat('t1', '2.0.0', 'gpt-4', messages);

    expect(result.success).toBe(true);
    expect(mockChatApi.createServiceForThread).toHaveBeenCalledWith('t1', '2.0.0', 'gpt-4', '');
  });

  it('returns failure when chat send fails', async () => {
    mockChatApi.createServiceForThread.mockResolvedValue(apiOk(undefined));
    mockChatApi.chat.mockResolvedValue(apiFail(-1, 'Chat failed'));

    const result = await threadFacade.submitPromptToChat('t1', '1.0.0', 'gpt-4', []);

    expect(result.success).toBe(false);
    expect(result.errorText).toBe('Chat failed');
  });
});

// ═══════════════════════════════════════════════════════════════════
// create — delegation smoke test
// (Full coverage is in thread-crud.service.spec.ts)
// ═══════════════════════════════════════════════════════════════════

describe('create', () => {
  it('returns failure when agent is not found', async () => {
    mockModelsApi.getAgent.mockResolvedValue(apiFail(-1, 'not found'));

    const result = await threadFacade.create('Title', null, 'agent-missing');
    expect(result.success).toBe(false);
    expect(result.errorText).toContain('Agent not found');
  });

  it('builds metadata with agent info and creates thread', async () => {
    const agent = {
      id: 'agent-1',
      provider: 'openai',
      slug: 'my-agent',
      models: [{ id: 'm1', title: 'GPT-4', accessName: 'gpt-4', provider: 'openai' }],
    };
    mockModelsApi.getAgent.mockResolvedValue(apiOk(agent));
    mockThreadApi.create.mockResolvedValue(apiOk({ id: 'new-thread', title: 'Title' }));

    const result = await threadFacade.create('Title', 'proj-1', 'agent-1');

    expect(mockThreadApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Title',
        projectId: 'proj-1',
        metadata: expect.objectContaining({
          agentId: 'agent-1',
          initialProvider: 'openai',
        }),
      }),
    );
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// isAgentAvailable — delegation smoke test
// (Full coverage is in thread-crud.service.spec.ts)
// ═══════════════════════════════════════════════════════════════════

describe('isAgentAvailable', () => {
  it('returns false for null agentId', async () => {
    expect(await threadFacade.isAgentAvailable(null)).toBe(false);
  });

  it('returns true when agent is in list', async () => {
    mockModelsApi.listAllApplications.mockResolvedValue(
      apiOk([{ id: 'agent-1', title: 'My Agent' }]),
    );
    expect(await threadFacade.isAgentAvailable('agent-1')).toBe(true);
  });

  it('returns false when agent not in list', async () => {
    mockModelsApi.listAllApplications.mockResolvedValue(
      apiOk([{ id: 'other-agent', title: 'Other' }]),
    );
    expect(await threadFacade.isAgentAvailable('agent-1')).toBe(false);
  });
});
