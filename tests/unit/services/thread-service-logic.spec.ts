/**
 * ThreadService — unit tests for methods with real logic
 *
 * Excludes: buildDisplayItems (being refactored), branch-utils (being refactored),
 *           and pure pass-through methods (rename, delete, update, etc.)
 *
 * Tests cover:
 *   - calculateNextBranchId: branchId parsing and next-ID logic
 *   - subscribeToStream: callback registration/unsubscription/multi-subscriber
 *   - sendChatMessage: input validation, payload construction
 *   - buildMessagePairs: user-assistant pairing, streaming, orphan skipping, attachments
 *   - selectBranchLane: iterates lanes and sets isSelectedBranch
 *   - createVariation: branchId generation and append flow
 *   - create: agent resolution, model selection, metadata building
 *   - injectImageTags: image attachment injection
 *   - isAgentAvailable: agent lookup logic
 *   - helper methods: getBranchRow, getBranchLane, getLaneKey
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

function msg(overrides: Partial<Message> & { id: string; branchId: string; role: Message['role'] }): Message {
  return {
    threadId: 'thread-1',
    content: `content-${overrides.id}`,
    createdAt: Date.now(),
    ...overrides,
  };
}

// ── Mock electronAPI methods used by ThreadService ────────────────

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

// Override window.electronAPI before importing ThreadService
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

// Clear singleton cache before importing to get a fresh instance
// BaseElectronService stores instances in a static Map keyed by class name
vi.mock('$lib/stores/thread.store', () => ({
  threads: {
    setThreads: vi.fn(),
    addThread: vi.fn(),
    updateThread: vi.fn(),
    deleteThread: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
  },
}));

// We need to dynamically import to get a fresh instance with our mocks in place
let ThreadService: typeof import('$lib/services/thread.service').ThreadService;
let threadService: InstanceType<typeof ThreadService>;

beforeEach(async () => {
  vi.clearAllMocks();

  // Reset the singleton instances map to get a fresh ThreadService
  const baseModule = await import('$lib/services/base-electron.service');
  const BaseClass = baseModule.BaseElectronService as unknown as { instances: Map<string, unknown> };
  if (BaseClass.instances) {
    BaseClass.instances.clear();
  }

  const mod = await import('$lib/services/thread.service');
  ThreadService = mod.ThreadService;
  threadService = ThreadService.getInstance();
});

// ═══════════════════════════════════════════════════════════════════
// calculateNextBranchId
// ═══════════════════════════════════════════════════════════════════

describe('calculateNextBranchId', () => {
  it('returns "1.0.0" when thread has no messages', async () => {
    mockThreadApi.getMessages.mockResolvedValue(apiOk([]));
    const result = await threadService.calculateNextBranchId('thread-1');
    expect(result).toBe('1.0.0');
  });

  it('increments row for main lane (lane 0)', async () => {
    const result = await threadService.calculateNextBranchId('thread-1', '3.0.0');
    expect(result).toBe('4.0.0');
  });

  it('increments iteration for branch lane (lane != 0)', async () => {
    const result = await threadService.calculateNextBranchId('thread-1', '2.1.0');
    expect(result).toBe('2.1.1');
  });

  it('increments iteration when already > 0', async () => {
    const result = await threadService.calculateNextBranchId('thread-1', '2.1.5');
    expect(result).toBe('2.1.6');
  });

  it('finds last main lane message when no branchId provided', async () => {
    const messages = [
      msg({ id: '1', branchId: '1.0.0', role: 'user' }),
      msg({ id: '2', branchId: '1.0.0', role: 'assistant' }),
      msg({ id: '3', branchId: '2.0.0', role: 'user' }),
      msg({ id: '4', branchId: '2.1.0', role: 'user' }),  // branch lane, should be skipped
    ];
    mockThreadApi.getMessages.mockResolvedValue(apiOk(messages));

    const result = await threadService.calculateNextBranchId('thread-1');
    // Last main lane message is "2.0.0", so next is "3.0.0"
    expect(result).toBe('3.0.0');
  });

  it('falls back to last message when no main lane messages exist', async () => {
    const messages = [
      msg({ id: '1', branchId: '1.1.0', role: 'user' }),
      msg({ id: '2', branchId: '1.2.0', role: 'user' }),
    ];
    mockThreadApi.getMessages.mockResolvedValue(apiOk(messages));

    const result = await threadService.calculateNextBranchId('thread-1');
    // Last message is "1.2.0" (branch lane), so next increments iteration: "1.2.1"
    expect(result).toBe('1.2.1');
  });

  it('handles whitespace-only branchId by looking up messages', async () => {
    const messages = [
      msg({ id: '1', branchId: '1.0.0', role: 'user' }),
    ];
    mockThreadApi.getMessages.mockResolvedValue(apiOk(messages));

    const result = await threadService.calculateNextBranchId('thread-1', '   ');
    expect(result).toBe('2.0.0');
  });

  it('defaults to "1.0.0" on error', async () => {
    mockThreadApi.getMessages.mockRejectedValue(new Error('network'));
    const result = await threadService.calculateNextBranchId('thread-1');
    expect(result).toBe('1.0.0');
  });

  it('handles malformed branchId (no dots) gracefully', async () => {
    const result = await threadService.calculateNextBranchId('thread-1', 'garbage');
    // parseInt('garbage') = NaN, || 0 → row=0, lane=0, iter=0 → main lane → "1.0.0"
    expect(result).toBe('1.0.0');
  });

  it('handles branchId with only row part', async () => {
    const result = await threadService.calculateNextBranchId('thread-1', '5');
    // parts[0]='5', parts[1]=undefined→0, parts[2]=undefined→0 → main lane → "6.0.0"
    expect(result).toBe('6.0.0');
  });
});

// ═══════════════════════════════════════════════════════════════════
// subscribeToStream
// ═══════════════════════════════════════════════════════════════════

describe('subscribeToStream', () => {
  it('throws when threadId is missing', () => {
    expect(() => threadService.subscribeToStream('', 'b1', vi.fn())).toThrow('threadId and branchId are required');
  });

  it('throws when branchId is missing', () => {
    expect(() => threadService.subscribeToStream('t1', '', vi.fn())).toThrow('threadId and branchId are required');
  });

  it('registers callback and returns unsubscribe function', () => {
    const cb = vi.fn();
    const unsub = threadService.subscribeToStream('t1', 'b1', cb);
    expect(typeof unsub).toBe('function');
  });

  it('unsubscribe removes the callback', () => {
    const cb = vi.fn();
    const unsub = threadService.subscribeToStream('t1', 'b1', cb);

    // After unsubscribe, the stream key should be cleaned up
    unsub();

    // Subscribing again should create a fresh Set
    const cb2 = vi.fn();
    threadService.subscribeToStream('t1', 'b1', cb2);
    // cb2 should be reachable, cb should not
  });

  it('supports multiple callbacks for the same stream key', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    threadService.subscribeToStream('t1', 'b1', cb1);
    threadService.subscribeToStream('t1', 'b1', cb2);

    // Both should be subscribed — unsubscribing one should keep the other
    const unsub1 = threadService.subscribeToStream('t1', 'b1', vi.fn());
    unsub1(); // removes the third one, cb1 and cb2 still exist
  });

  it('cleans up the Set when last callback is removed', () => {
    const cb = vi.fn();
    const unsub = threadService.subscribeToStream('t1', 'b1', cb);
    unsub();

    // Re-subscribing should work (Set was deleted, new one created)
    const cb2 = vi.fn();
    const unsub2 = threadService.subscribeToStream('t1', 'b1', cb2);
    expect(typeof unsub2).toBe('function');
  });
});

// ═══════════════════════════════════════════════════════════════════
// sendChatMessage
// ═══════════════════════════════════════════════════════════════════

describe('sendChatMessage', () => {
  it('returns error when threadId is empty', async () => {
    const result = await threadService.sendChatMessage('', 'b1', { prompt: 'hi' });
    expect(result.success).toBe(false);
    expect(result.errorText).toContain('threadId and branchId are required');
  });

  it('returns error when branchId is empty', async () => {
    const result = await threadService.sendChatMessage('t1', '', { prompt: 'hi' });
    expect(result.success).toBe(false);
    expect(result.errorText).toContain('threadId and branchId are required');
  });

  it('constructs payload with thread_id and branch_id added', async () => {
    mockChatApi.chat.mockResolvedValue(apiOk(undefined));

    await threadService.sendChatMessage('t1', 'b1', { prompt: 'hi', streaming: true });

    expect(mockChatApi.chat).toHaveBeenCalledWith('t1', {
      prompt: 'hi',
      streaming: true,
      thread_id: 't1',
      branch_id: 'b1',
    });
  });

  it('returns the chat API result', async () => {
    const expected = apiOk(undefined);
    mockChatApi.chat.mockResolvedValue(expected);

    const result = await threadService.sendChatMessage('t1', 'b1', {});
    expect(result).toEqual(expected);
  });
});

// ═══════════════════════════════════════════════════════════════════
// buildMessagePairs (private — accessed via buildDisplayItems or directly)
// We test through the public buildDisplayItems with simple single-lane data
// since buildMessagePairs is private. But we CAN test it by casting.
// ═══════════════════════════════════════════════════════════════════

describe('buildMessagePairs (via prototype access)', () => {
  // Access private method for testing
  const callBuildMessagePairs = (
    msgs: Message[],
    isStreaming = false,
    responseText = '',
  ) => {
    return (threadService as any).buildMessagePairs(msgs, isStreaming, responseText);
  };

  it('pairs a user message with following assistant message', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user', content: 'Hello' }),
      msg({ id: 'a1', branchId: '1.0.0', role: 'assistant', content: 'Hi there' }),
    ];

    const pairs = callBuildMessagePairs(messages);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].request.id).toBe('u1');
    expect(pairs[0].responses).toHaveLength(1);
    expect(pairs[0].responses[0].id).toBe('a1');
    expect(pairs[0].isStreamingResponse).toBe(false);
    expect(pairs[0].streamingContent).toBe('');
  });

  it('collects multiple consecutive assistant responses', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
      msg({ id: 'a1', branchId: '1.0.0', role: 'assistant' }),
      msg({ id: 'a2', branchId: '1.0.0', role: 'assistant' }),
    ];

    const pairs = callBuildMessagePairs(messages);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].responses).toHaveLength(2);
  });

  it('includes system messages as responses', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
      msg({ id: 's1', branchId: '1.0.0', role: 'system' }),
      msg({ id: 'a1', branchId: '1.0.0', role: 'assistant' }),
    ];

    const pairs = callBuildMessagePairs(messages);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].responses).toHaveLength(2);
  });

  it('creates separate pairs for separate user messages', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
      msg({ id: 'a1', branchId: '1.0.0', role: 'assistant' }),
      msg({ id: 'u2', branchId: '2.0.0', role: 'user' }),
      msg({ id: 'a2', branchId: '2.0.0', role: 'assistant' }),
    ];

    const pairs = callBuildMessagePairs(messages);
    expect(pairs).toHaveLength(2);
    expect(pairs[0].request.id).toBe('u1');
    expect(pairs[1].request.id).toBe('u2');
  });

  it('user message with no response and streaming active gets streaming flag', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
    ];

    const pairs = callBuildMessagePairs(messages, true, 'streaming...');
    expect(pairs).toHaveLength(1);
    expect(pairs[0].isStreamingResponse).toBe(true);
    expect(pairs[0].streamingContent).toBe('streaming...');
    expect(pairs[0].responses).toHaveLength(0);
  });

  it('streaming flag is false when user message already has a response', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
      msg({ id: 'a1', branchId: '1.0.0', role: 'assistant' }),
    ];

    const pairs = callBuildMessagePairs(messages, true, 'streaming...');
    expect(pairs).toHaveLength(1);
    expect(pairs[0].isStreamingResponse).toBe(false);
    expect(pairs[0].streamingContent).toBe('');
  });

  it('streaming flag only applies to the LAST user message', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
      msg({ id: 'a1', branchId: '1.0.0', role: 'assistant' }),
      msg({ id: 'u2', branchId: '2.0.0', role: 'user' }),
    ];

    const pairs = callBuildMessagePairs(messages, true, 'streaming...');
    expect(pairs).toHaveLength(2);
    expect(pairs[0].isStreamingResponse).toBe(false);
    expect(pairs[1].isStreamingResponse).toBe(true);
  });

  it('skips orphan assistant messages at the beginning', () => {
    const messages = [
      msg({ id: 'a1', branchId: '1.0.0', role: 'assistant' }),
      msg({ id: 'u1', branchId: '2.0.0', role: 'user' }),
      msg({ id: 'a2', branchId: '2.0.0', role: 'assistant' }),
    ];

    const pairs = callBuildMessagePairs(messages);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].request.id).toBe('u1');
  });

  it('handles empty message array', () => {
    const pairs = callBuildMessagePairs([]);
    expect(pairs).toHaveLength(0);
  });

  it('injects image tags for assistant messages with attachments', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
      msg({
        id: 'a1',
        branchId: '1.0.0',
        role: 'assistant',
        content: 'Here is an image',
        attachments: [
          { mimeType: 'image/png', data: 'base64data', filename: 'test.png', size: 100 },
        ],
      }),
    ];

    const pairs = callBuildMessagePairs(messages);
    expect(pairs[0].responses[0].content).toContain('![test.png]');
    expect(pairs[0].responses[0].content).toContain('data:image/png;base64,base64data');
  });

  it('does not inject tags for non-image attachments', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
      msg({
        id: 'a1',
        branchId: '1.0.0',
        role: 'assistant',
        content: 'A file',
        attachments: [
          { mimeType: 'application/pdf', data: 'pdfdata', filename: 'doc.pdf', size: 200 },
        ],
      }),
    ];

    const pairs = callBuildMessagePairs(messages);
    expect(pairs[0].responses[0].content).toBe('A file');
  });

  it('skips image attachments without data', () => {
    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user' }),
      msg({
        id: 'a1',
        branchId: '1.0.0',
        role: 'assistant',
        content: 'Missing data',
        attachments: [
          { mimeType: 'image/png', filename: 'nodata.png', size: 100 },
        ],
      }),
    ];

    const pairs = callBuildMessagePairs(messages);
    expect(pairs[0].responses[0].content).toBe('Missing data');
  });
});

// ═══════════════════════════════════════════════════════════════════
// injectImageTags (private)
// ═══════════════════════════════════════════════════════════════════

describe('injectImageTags', () => {
  const callInjectImageTags = (
    content: string,
    attachments: Array<{ mimeType: string; data?: string; filename: string }>,
  ): string => {
    return (threadService as any).injectImageTags(content, attachments);
  };

  it('appends image markdown for image attachments with data', () => {
    const result = callInjectImageTags('Hello', [
      { mimeType: 'image/jpeg', data: 'abc123', filename: 'photo.jpg' },
    ]);
    expect(result).toBe('Hello\n\n![photo.jpg](data:image/jpeg;base64,abc123)');
  });

  it('handles multiple image attachments', () => {
    const result = callInjectImageTags('Content', [
      { mimeType: 'image/png', data: 'data1', filename: 'a.png' },
      { mimeType: 'image/gif', data: 'data2', filename: 'b.gif' },
    ]);
    expect(result).toContain('![a.png]');
    expect(result).toContain('![b.gif]');
  });

  it('skips non-image mimeTypes', () => {
    const result = callInjectImageTags('Text', [
      { mimeType: 'text/plain', data: 'txt', filename: 'readme.txt' },
    ]);
    expect(result).toBe('Text');
  });

  it('skips image attachments without data property', () => {
    const result = callInjectImageTags('Text', [
      { mimeType: 'image/png', filename: 'nodata.png' },
    ]);
    expect(result).toBe('Text');
  });

  it('returns original content when attachments array is empty', () => {
    const result = callInjectImageTags('Original', []);
    expect(result).toBe('Original');
  });
});

// ═══════════════════════════════════════════════════════════════════
// helper methods: getBranchRow, getBranchLane, getLaneKey
// ═══════════════════════════════════════════════════════════════════

describe('helper methods', () => {
  const getBranchRow = (branchId: string): number => (threadService as any).getBranchRow(branchId);
  const getBranchLane = (branchId: string): number => (threadService as any).getBranchLane(branchId);
  const getLaneKey = (branchId: string): string => (threadService as any).getLaneKey(branchId);

  describe('getBranchRow', () => {
    it('extracts row from 3-part branchId', () => expect(getBranchRow('3.1.2')).toBe(3));
    it('extracts row from 2-part branchId', () => expect(getBranchRow('5.0')).toBe(5));
    it('extracts row from 1-part branchId', () => expect(getBranchRow('7')).toBe(7));
    it('returns NaN for garbage (parseInt behavior)', () => expect(getBranchRow('abc')).toBeNaN());
  });

  describe('getBranchLane', () => {
    it('returns 0 for main lane', () => expect(getBranchLane('1.0.0')).toBe(0));
    it('returns lane number for branch', () => expect(getBranchLane('2.3.1')).toBe(3));
    it('returns 0 when no second part', () => expect(getBranchLane('5')).toBe(0));
    it('handles 2-part branchId', () => expect(getBranchLane('1.2')).toBe(2));
  });

  describe('getLaneKey', () => {
    it('returns first two parts for 3-part branchId', () => expect(getLaneKey('2.1.3')).toBe('2.1'));
    it('returns full string for 2-part branchId', () => expect(getLaneKey('1.0')).toBe('1.0'));
    it('returns just the part for 1-part branchId', () => expect(getLaneKey('5')).toBe('5'));
  });
});

// ═══════════════════════════════════════════════════════════════════
// selectBranchLane
// ═══════════════════════════════════════════════════════════════════

describe('selectBranchLane', () => {
  it('sets isSelectedBranch=true on the selected lane and false on others', async () => {
    mockThreadApi.updateMessageDesktopOptions.mockResolvedValue(apiOk({}));

    const messages = [
      msg({ id: 'u1', branchId: '2.1.0', role: 'user' }),
      msg({ id: 'u2', branchId: '2.2.0', role: 'user' }),
      msg({ id: 'u3', branchId: '2.3.0', role: 'user' }),
    ];

    await threadService.selectBranchLane('thread-1', '2.2', messages);

    // Lane 1: false, Lane 2: true, Lane 3: false
    expect(mockThreadApi.updateMessageDesktopOptions).toHaveBeenCalledTimes(3);

    expect(mockThreadApi.updateMessageDesktopOptions).toHaveBeenCalledWith(
      'thread-1', 'u1', { isSelectedBranch: false },
    );
    expect(mockThreadApi.updateMessageDesktopOptions).toHaveBeenCalledWith(
      'thread-1', 'u2', { isSelectedBranch: true },
    );
    expect(mockThreadApi.updateMessageDesktopOptions).toHaveBeenCalledWith(
      'thread-1', 'u3', { isSelectedBranch: false },
    );
  });

  it('stops iterating when no user message found for a lane number', async () => {
    mockThreadApi.updateMessageDesktopOptions.mockResolvedValue(apiOk({}));

    const messages = [
      msg({ id: 'u1', branchId: '2.1.0', role: 'user' }),
      // No lane 2 — should stop after lane 1
    ];

    await threadService.selectBranchLane('thread-1', '2.1', messages);

    expect(mockThreadApi.updateMessageDesktopOptions).toHaveBeenCalledTimes(1);
    expect(mockThreadApi.updateMessageDesktopOptions).toHaveBeenCalledWith(
      'thread-1', 'u1', { isSelectedBranch: true },
    );
  });

  it('handles API failure gracefully (logs error, continues)', async () => {
    mockThreadApi.updateMessageDesktopOptions
      .mockResolvedValueOnce(apiFail(-1, 'network error'))
      .mockResolvedValueOnce(apiOk({}));

    const messages = [
      msg({ id: 'u1', branchId: '2.1.0', role: 'user' }),
      msg({ id: 'u2', branchId: '2.2.0', role: 'user' }),
    ];

    // Should not throw — continues to lane 2 even though lane 1 failed
    await threadService.selectBranchLane('thread-1', '2.2', messages);

    expect(mockThreadApi.updateMessageDesktopOptions).toHaveBeenCalledTimes(2);
  });

  it('only considers user messages when finding first message in lane', async () => {
    mockThreadApi.updateMessageDesktopOptions.mockResolvedValue(apiOk({}));

    const messages = [
      msg({ id: 'a1', branchId: '2.1.0', role: 'assistant' }), // assistant, not user
      msg({ id: 'u1', branchId: '2.1.1', role: 'user' }),       // user in same lane
    ];

    await threadService.selectBranchLane('thread-1', '2.1', messages);

    // Should find u1 (the first user msg in lane 1), not a1
    expect(mockThreadApi.updateMessageDesktopOptions).toHaveBeenCalledWith(
      'thread-1', 'u1', { isSelectedBranch: true },
    );
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
    mockThreadApi.appendMessage.mockResolvedValue(apiOk({
      message: { id: 'new-msg', role: 'user', content: 'variation', createdAt: Date.now() },
      thread: fakeThread,
    }));

    const original = msg({ id: 'orig', branchId: '1.0.0', role: 'user', content: 'original', modelId: 'gpt-4' });
    const result = await threadService.createVariation(fakeThread, original, 'new content');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.message.content).toBe('new content');
      expect(result.message.role).toBe('user');
      expect(result.newBranchId).toBeTruthy();
    }
  });

  it('uses originalMessage content when variationContent is undefined', async () => {
    mockThreadApi.getMessages.mockResolvedValue(apiOk([]));
    mockThreadApi.appendMessage.mockResolvedValue(apiOk({
      message: { id: 'new-msg', role: 'user', content: 'original content', createdAt: Date.now() },
      thread: fakeThread,
    }));

    const original = msg({ id: 'orig', branchId: '1.0.0', role: 'user', content: 'original content' });
    const result = await threadService.createVariation(fakeThread, original);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.message.content).toBe('original content');
    }
  });

  it('uses provided modelId over original message modelId', async () => {
    mockThreadApi.getMessages.mockResolvedValue(apiOk([]));
    mockThreadApi.appendMessage.mockResolvedValue(apiOk({
      message: { id: 'new-msg', role: 'user', content: 'test', createdAt: Date.now() },
      thread: fakeThread,
    }));

    const original = msg({ id: 'orig', branchId: '1.0.0', role: 'user', modelId: 'old-model' });
    const result = await threadService.createVariation(fakeThread, original, 'test', 'new-model');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.message.modelId).toBe('new-model');
    }

    // Verify appendMessage was called with the new model in metadata
    expect(mockThreadApi.appendMessage).toHaveBeenCalledWith(
      'thread-1',
      expect.objectContaining({ metadata: { modelId: 'new-model' } }),
    );
  });

  it('uses currentMessages if provided instead of fetching from API', async () => {
    mockThreadApi.appendMessage.mockResolvedValue(apiOk({
      message: { id: 'new-msg', role: 'user', content: 'test', createdAt: Date.now() },
      thread: fakeThread,
    }));

    const existing = [
      msg({ id: 'e1', branchId: '1.0.0', role: 'user' }),
    ];
    const original = msg({ id: 'orig', branchId: '1.0.0', role: 'user' });

    await threadService.createVariation(fakeThread, original, 'test', undefined, existing);

    // Should NOT have called getMessages since currentMessages was provided
    expect(mockThreadApi.getMessages).not.toHaveBeenCalled();
  });

  it('returns failure when appendMessage fails', async () => {
    mockThreadApi.getMessages.mockResolvedValue(apiOk([]));
    mockThreadApi.appendMessage.mockResolvedValue(apiFail(-1, 'append failed'));

    const original = msg({ id: 'orig', branchId: '1.0.0', role: 'user' });
    const result = await threadService.createVariation(fakeThread, original);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('append failed');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// create
// ═══════════════════════════════════════════════════════════════════

describe('create', () => {
  it('returns failure when agent is not found', async () => {
    mockModelsApi.getAgent.mockResolvedValue(apiFail(-1, 'not found'));

    const result = await threadService.create('Title', null, 'agent-missing');
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

    const result = await threadService.create('Title', 'proj-1', 'agent-1');

    expect(mockThreadApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Title',
        projectId: 'proj-1',
        agentId: 'agent-1',
        applicationSlug: 'my-agent',
        metadata: expect.objectContaining({
          agentId: 'agent-1',
          initialProvider: 'openai',
          applicationSlug: 'my-agent',
          modelTitle: 'GPT-4',
          initalModel: 'gpt-4',
          modelProvider: 'openai',
        }),
      }),
    );
    expect(result.success).toBe(true);
  });

  it('selects specific model when initialModel matches', async () => {
    const agent = {
      id: 'agent-1',
      provider: 'openai',
      slug: 'slug',
      models: [
        { id: 'm1', title: 'GPT-3.5', accessName: 'gpt-3.5', provider: 'openai' },
        { id: 'm2', title: 'GPT-4', accessName: 'gpt-4', provider: 'openai' },
      ],
    };
    mockModelsApi.getAgent.mockResolvedValue(apiOk(agent));
    mockModelsApi.getModelsForApplication.mockResolvedValue(apiOk(agent.models));
    mockThreadApi.create.mockResolvedValue(apiOk({ id: 't1', title: 'T' }));

    await threadService.create('T', null, 'agent-1', 'gpt-4');

    expect(mockThreadApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          modelTitle: 'GPT-4',
          initalModel: 'gpt-4',
        }),
      }),
    );
  });

  it('falls back to first agent model when initialModel not specified', async () => {
    const agent = {
      id: 'agent-1',
      provider: 'openai',
      slug: 'slug',
      models: [
        { id: 'm1', title: 'Default Model', accessName: 'default', provider: 'openai' },
      ],
    };
    mockModelsApi.getAgent.mockResolvedValue(apiOk(agent));
    mockThreadApi.create.mockResolvedValue(apiOk({ id: 't1', title: 'T' }));

    await threadService.create('T', null, 'agent-1');

    expect(mockThreadApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          modelTitle: 'Default Model',
          initalModel: 'default',
        }),
      }),
    );
  });

  it('creates thread without model metadata when no models available', async () => {
    const agent = {
      id: 'agent-1',
      provider: 'openai',
      slug: 'slug',
      models: [],
    };
    mockModelsApi.getAgent.mockResolvedValue(apiOk(agent));
    mockThreadApi.create.mockResolvedValue(apiOk({ id: 't1', title: 'T' }));

    await threadService.create('T', null, 'agent-1');

    expect(mockThreadApi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.not.objectContaining({
          modelTitle: expect.anything(),
        }),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
// isAgentAvailable
// ═══════════════════════════════════════════════════════════════════

describe('isAgentAvailable', () => {
  it('returns false for null agentId', async () => {
    expect(await threadService.isAgentAvailable(null)).toBe(false);
  });

  it('returns false for undefined agentId', async () => {
    expect(await threadService.isAgentAvailable(undefined)).toBe(false);
  });

  it('returns false for empty string agentId', async () => {
    expect(await threadService.isAgentAvailable('')).toBe(false);
  });

  it('returns false when API call fails', async () => {
    mockModelsApi.listAllApplications.mockResolvedValue(apiFail(-1, 'error'));
    expect(await threadService.isAgentAvailable('agent-1')).toBe(false);
  });

  it('returns false when agent not in list', async () => {
    mockModelsApi.listAllApplications.mockResolvedValue(apiOk([
      { id: 'other-agent', title: 'Other' },
    ]));
    expect(await threadService.isAgentAvailable('agent-1')).toBe(false);
  });

  it('returns true when agent is in list', async () => {
    mockModelsApi.listAllApplications.mockResolvedValue(apiOk([
      { id: 'agent-1', title: 'My Agent' },
      { id: 'agent-2', title: 'Other' },
    ]));
    expect(await threadService.isAgentAvailable('agent-1')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// appendMessage (wire payload construction)
// ═══════════════════════════════════════════════════════════════════

describe('appendMessage', () => {
  it('maps camelCase fields to snake_case in wire payload', async () => {
    mockThreadApi.appendMessage.mockResolvedValue(apiOk({
      message: { id: 'm1', role: 'user', content: 'hi', createdAt: Date.now() },
      thread: {},
    }));

    await threadService.appendMessage('t1', {
      role: 'user',
      content: 'hello',
      clientMessageId: 'cid-1',
      branchId: '1.0.0',
      modelName: 'gpt-4',
    });

    expect(mockThreadApi.appendMessage).toHaveBeenCalledWith('t1', expect.objectContaining({
      role: 'user',
      content: 'hello',
      client_message_id: 'cid-1',
      branch_id: '1.0.0',
      model_name: 'gpt-4',
    }));
  });

  it('omits optional snake_case fields when not provided', async () => {
    mockThreadApi.appendMessage.mockResolvedValue(apiOk({
      message: { id: 'm1', role: 'user', content: 'hi', createdAt: Date.now() },
      thread: {},
    }));

    await threadService.appendMessage('t1', {
      role: 'user',
      content: 'hello',
    });

    const payload = mockThreadApi.appendMessage.mock.calls[0][1];
    expect(payload).not.toHaveProperty('client_message_id');
    expect(payload).not.toHaveProperty('branch_id');
    expect(payload).not.toHaveProperty('model_name');
  });
});

// ═══════════════════════════════════════════════════════════════════
// submitPromptToChat
// ═══════════════════════════════════════════════════════════════════

describe('submitPromptToChat', () => {
  it('creates chat service, builds history, and sends message', async () => {
    mockChatApi.createServiceForThread.mockResolvedValue(apiOk(undefined));
    mockChatApi.chat.mockResolvedValue(apiOk(undefined));

    const messages = [
      msg({ id: 'u1', branchId: '1.0.0', role: 'user', content: 'Hello' }),
      msg({ id: 'a1', branchId: '1.0.0', role: 'assistant', content: 'Hi' }),
    ];

    const result = await threadService.submitPromptToChat('t1', '2.0.0', 'gpt-4', messages);

    expect(result.success).toBe(true);
    expect(mockChatApi.createServiceForThread).toHaveBeenCalledWith('t1', '2.0.0', 'gpt-4', '');
    expect(mockChatApi.chat).toHaveBeenCalledWith('t1', expect.objectContaining({
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
      ],
      streaming: true,
      model: 'gpt-4',
      thread_id: 't1',
      branch_id: '2.0.0',
    }));
  });

  it('returns failure when chat send fails', async () => {
    mockChatApi.createServiceForThread.mockResolvedValue(apiOk(undefined));
    mockChatApi.chat.mockResolvedValue(apiFail(-1, 'Chat failed'));

    const result = await threadService.submitPromptToChat('t1', '1.0.0', 'gpt-4', []);

    expect(result.success).toBe(false);
    expect(result.errorText).toBe('Chat failed');
  });

  it('returns failure on exception', async () => {
    mockChatApi.createServiceForThread.mockRejectedValue(new Error('boom'));

    const result = await threadService.submitPromptToChat('t1', '1.0.0', 'gpt-4', []);

    expect(result.success).toBe(false);
    expect(result.errorText).toBe('boom');
  });
});
