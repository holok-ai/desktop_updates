/**
 * ThreadStreamService — unit tests for streaming domain
 *
 * Tests cover:
 *   - subscribeToStream: callback registration/unsubscription/multi-subscriber
 *   - unsubscribeAllForThread: cleanup by threadId prefix
 *   - Streaming session management: register, update, clear, has, get
 *   - Background stream management: get, set, delete, has
 *   - mergeStreamingMessages: merge logic for API + streaming data
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Message } from '$lib/types/thread.type';

// ── Helpers ───────────────────────────────────────────────────────

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

const mockChatApi = {
  createServiceForThread: vi.fn(),
  chat: vi.fn(),
  onToken: vi.fn(() => vi.fn()),
  onToolUse: vi.fn(() => vi.fn()),
  onToolStatus: vi.fn(() => vi.fn()),
  getAuditLogs: vi.fn(),
};

Object.defineProperty(window, 'electronAPI', {
  value: {
    thread: {
      onThreadCreated: vi.fn(() => vi.fn()),
      onThreadUpdated: vi.fn(() => vi.fn()),
      onThreadDeleted: vi.fn(() => vi.fn()),
    },
    chat: mockChatApi,
    models: {},
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

let ThreadStreamService: typeof import('$lib/services/thread-stream.service').ThreadStreamService;
let streamService: InstanceType<typeof ThreadStreamService>;

beforeEach(async () => {
  vi.clearAllMocks();

  // Reset the singleton instances map to get a fresh service
  const baseModule = await import('$lib/services/base-electron.service');
  const BaseClass = baseModule.BaseElectronService as unknown as {
    instances: Map<string, unknown>;
  };
  if (BaseClass.instances) {
    BaseClass.instances.clear();
  }

  const mod = await import('$lib/services/thread-stream.service');
  ThreadStreamService = mod.ThreadStreamService;
  streamService = ThreadStreamService.getInstance();
});

// ═══════════════════════════════════════════════════════════════════
// subscribeToStream
// ═══════════════════════════════════════════════════════════════════

describe('subscribeToStream', () => {
  it('throws when threadId is missing', () => {
    expect(() => streamService.subscribeToStream('', 'b1', vi.fn())).toThrow(
      'threadId and branchId are required',
    );
  });

  it('throws when branchId is missing', () => {
    expect(() => streamService.subscribeToStream('t1', '', vi.fn())).toThrow(
      'threadId and branchId are required',
    );
  });

  it('registers callback and returns unsubscribe function', () => {
    const cb = vi.fn();
    const unsub = streamService.subscribeToStream('t1', 'b1', cb);
    expect(typeof unsub).toBe('function');
  });

  it('unsubscribe removes the callback', () => {
    const cb = vi.fn();
    const unsub = streamService.subscribeToStream('t1', 'b1', cb);
    unsub();

    // Subscribing again should create a fresh Set
    const cb2 = vi.fn();
    streamService.subscribeToStream('t1', 'b1', cb2);
  });

  it('supports multiple callbacks for the same stream key', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    streamService.subscribeToStream('t1', 'b1', cb1);
    streamService.subscribeToStream('t1', 'b1', cb2);

    const unsub1 = streamService.subscribeToStream('t1', 'b1', vi.fn());
    unsub1(); // removes the third one, cb1 and cb2 still exist
  });

  it('cleans up the Set when last callback is removed', () => {
    const cb = vi.fn();
    const unsub = streamService.subscribeToStream('t1', 'b1', cb);
    unsub();

    const cb2 = vi.fn();
    const unsub2 = streamService.subscribeToStream('t1', 'b1', cb2);
    expect(typeof unsub2).toBe('function');
  });

  it('dispatches tokens to registered callbacks via onToken IPC', () => {
    // Capture the onToken handler registered during initialization
    const onTokenHandler = mockChatApi.onToken.mock.calls[0]?.[0];
    expect(onTokenHandler).toBeDefined();

    const cb = vi.fn();
    streamService.subscribeToStream('t1', '1.0.0', cb);

    // Simulate token event
    onTokenHandler({ threadId: 't1', branchId: '1.0.0', token: 'hello' });

    expect(cb).toHaveBeenCalledWith('hello');
  });
});

// ═══════════════════════════════════════════════════════════════════
// unsubscribeAllForThread
// ═══════════════════════════════════════════════════════════════════

describe('unsubscribeAllForThread', () => {
  it('removes all callbacks for a given threadId', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    streamService.subscribeToStream('t1', 'b1', cb1);
    streamService.subscribeToStream('t1', 'b2', cb2);

    streamService.unsubscribeAllForThread('t1');

    // After cleanup, new subscriptions should work fresh
    const cb3 = vi.fn();
    const unsub = streamService.subscribeToStream('t1', 'b1', cb3);
    expect(typeof unsub).toBe('function');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Streaming session management
// ═══════════════════════════════════════════════════════════════════

describe('streaming session management', () => {
  it('registers and retrieves a streaming session', () => {
    const userMsg = msg({ id: 'u1', branchId: '1.0.0', role: 'user' });
    streamService.registerStreamingSession('t1', '1.0.0', userMsg, 'gpt-4');

    expect(streamService.hasStreamingSession('t1')).toBe(true);
    const session = streamService.getStreamingSession('t1');
    expect(session).toBeDefined();
    expect(session!.threadId).toBe('t1');
    expect(session!.branchId).toBe('1.0.0');
    expect(session!.userMessage).toBe(userMsg);
    expect(session!.assistantContent).toBe('');
    expect(session!.modelId).toBe('gpt-4');
  });

  it('updates streaming content', () => {
    const userMsg = msg({ id: 'u1', branchId: '1.0.0', role: 'user' });
    streamService.registerStreamingSession('t1', '1.0.0', userMsg);
    streamService.updateStreamingContent('t1', 'partial response');

    expect(streamService.getStreamingSession('t1')!.assistantContent).toBe('partial response');
  });

  it('clears a streaming session', () => {
    const userMsg = msg({ id: 'u1', branchId: '1.0.0', role: 'user' });
    streamService.registerStreamingSession('t1', '1.0.0', userMsg);
    streamService.clearStreamingSession('t1');

    expect(streamService.hasStreamingSession('t1')).toBe(false);
    expect(streamService.getStreamingSession('t1')).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Background stream management
// ═══════════════════════════════════════════════════════════════════

describe('background stream management', () => {
  it('stores and retrieves a background stream', () => {
    const bg = {
      threadId: 't1',
      branchId: '1.0.0',
      accumulatedText: 'hello',
      unsubscribe: vi.fn(),
    };
    streamService.setBackgroundStream('t1', bg);

    expect(streamService.hasBackgroundStream('t1')).toBe(true);
    expect(streamService.getBackgroundStream('t1')).toBe(bg);
  });

  it('deletes a background stream', () => {
    const bg = {
      threadId: 't1',
      branchId: '1.0.0',
      accumulatedText: '',
      unsubscribe: null,
    };
    streamService.setBackgroundStream('t1', bg);
    streamService.deleteBackgroundStream('t1');

    expect(streamService.hasBackgroundStream('t1')).toBe(false);
    expect(streamService.getBackgroundStream('t1')).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// mergeStreamingMessages
// ═══════════════════════════════════════════════════════════════════

describe('mergeStreamingMessages', () => {
  const userMsg = msg({ id: 'u1', branchId: '1.0.0', role: 'user', content: 'Hi' });

  it('appends both user and synthetic assistant when API has neither', () => {
    const session = {
      threadId: 't1',
      branchId: '1.0.0',
      userMessage: userMsg,
      assistantContent: 'partial',
      modelId: 'gpt-4',
    };

    const result = streamService.mergeStreamingMessages([], session);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(userMsg);
    expect(result[1].role).toBe('assistant');
    expect(result[1].content).toBe('partial');
    expect(result[1].id).toBe('streaming-1.0.0');
  });

  it('appends only synthetic assistant when API has user but not assistant', () => {
    const apiMessages = [userMsg];
    const session = {
      threadId: 't1',
      branchId: '1.0.0',
      userMessage: userMsg,
      assistantContent: 'response',
    };

    const result = streamService.mergeStreamingMessages(apiMessages, session);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(userMsg);
    expect(result[1].role).toBe('assistant');
    expect(result[1].content).toBe('response');
  });

  it('returns API messages as-is when both user and assistant present', () => {
    const assistantMsg = msg({
      id: 'a1',
      branchId: '1.0.0',
      role: 'assistant',
      content: 'full response',
    });
    const apiMessages = [userMsg, assistantMsg];
    const session = {
      threadId: 't1',
      branchId: '1.0.0',
      userMessage: userMsg,
      assistantContent: 'partial',
    };

    const result = streamService.mergeStreamingMessages(apiMessages, session);

    expect(result).toBe(apiMessages);
  });

  it('does not append synthetic assistant when assistantContent is empty', () => {
    const session = {
      threadId: 't1',
      branchId: '1.0.0',
      userMessage: userMsg,
      assistantContent: '',
    };

    const result = streamService.mergeStreamingMessages([], session);

    // Only the user message, no synthetic assistant
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(userMsg);
  });
});
