/**
 * ThreadMessageService — unit tests for message domain
 *
 * Tests cover:
 *   - sendChatMessage: input validation, payload construction
 *   - appendMessage: wire payload construction (camelCase → snake_case)
 *   - submitPromptToChat: end-to-end chat flow
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

Object.defineProperty(window, 'electronAPI', {
  value: {
    thread: mockThreadApi,
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

let messageService: import('$lib/services/thread-message.service').ThreadMessageService;

beforeEach(async () => {
  vi.clearAllMocks();

  // Reset modules to get a fresh singleton
  vi.resetModules();

  const mod = await import('$lib/services/thread-message.service');
  messageService = mod.ThreadMessageService.getInstance();
});

// ═══════════════════════════════════════════════════════════════════
// sendChatMessage
// ═══════════════════════════════════════════════════════════════════

describe('sendChatMessage', () => {
  it('returns error when threadId is empty', async () => {
    const result = await messageService.sendChatMessage('', 'b1', { prompt: 'hi' });
    expect(result.success).toBe(false);
    expect(result.errorText).toContain('threadId and branchId are required');
  });

  it('returns error when branchId is empty', async () => {
    const result = await messageService.sendChatMessage('t1', '', { prompt: 'hi' });
    expect(result.success).toBe(false);
    expect(result.errorText).toContain('threadId and branchId are required');
  });

  it('constructs payload with thread_id and branch_id added', async () => {
    mockChatApi.chat.mockResolvedValue(apiOk(undefined));

    await messageService.sendChatMessage('t1', 'b1', { prompt: 'hi', streaming: true });

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

    const result = await messageService.sendChatMessage('t1', 'b1', {});
    expect(result).toEqual(expected);
  });
});

// ═══════════════════════════════════════════════════════════════════
// appendMessage
// ═══════════════════════════════════════════════════════════════════

describe('appendMessage', () => {
  it('maps camelCase fields to snake_case in wire payload', async () => {
    mockThreadApi.appendMessage.mockResolvedValue(
      apiOk({
        message: { id: 'm1', role: 'user', content: 'hi', createdAt: Date.now() },
        thread: {},
      }),
    );

    await messageService.appendMessage('t1', {
      role: 'user',
      content: 'hello',
      clientMessageId: 'cid-1',
      branchId: '1.0.0',
      modelName: 'gpt-4',
    });

    expect(mockThreadApi.appendMessage).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({
        role: 'user',
        content: 'hello',
        client_message_id: 'cid-1',
        branch_id: '1.0.0',
        model_name: 'gpt-4',
      }),
    );
  });

  it('omits optional snake_case fields when not provided', async () => {
    mockThreadApi.appendMessage.mockResolvedValue(
      apiOk({
        message: { id: 'm1', role: 'user', content: 'hi', createdAt: Date.now() },
        thread: {},
      }),
    );

    await messageService.appendMessage('t1', {
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

    const result = await messageService.submitPromptToChat('t1', '2.0.0', 'gpt-4', messages);

    expect(result.success).toBe(true);
    expect(mockChatApi.createServiceForThread).toHaveBeenCalledWith('t1', '2.0.0', 'gpt-4', '');
    expect(mockChatApi.chat).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi' },
        ],
        streaming: true,
        model: 'gpt-4',
        thread_id: 't1',
        branch_id: '2.0.0',
      }),
    );
  });

  it('returns failure when chat send fails', async () => {
    mockChatApi.createServiceForThread.mockResolvedValue(apiOk(undefined));
    mockChatApi.chat.mockResolvedValue(apiFail(-1, 'Chat failed'));

    const result = await messageService.submitPromptToChat('t1', '1.0.0', 'gpt-4', []);

    expect(result.success).toBe(false);
    expect(result.errorText).toBe('Chat failed');
  });

  it('returns failure on exception', async () => {
    mockChatApi.createServiceForThread.mockRejectedValue(new Error('boom'));

    const result = await messageService.submitPromptToChat('t1', '1.0.0', 'gpt-4', []);

    expect(result.success).toBe(false);
    expect(result.errorText).toBe('boom');
  });
});
