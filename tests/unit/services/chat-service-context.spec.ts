import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatRequest } from '../../../src-electron/services/chat/interfaces/ChatMessage.js';

const mockProvider = {
  chat: vi.fn(async () => {}),
  chatWithOptions: vi.fn(async () => {}),
  chatWithTools: vi.fn(async () => {}),
  supportsTools: vi.fn(() => false),
};

vi.mock('../../../src-electron/services/chat/factories/ChatProviderFactory.js', () => {
  return {
    ChatProviderFactory: {
      createProvider: vi.fn(() => mockProvider),
    },
    ProviderType: {
      OLLAMA: 'ollama',
    },
  };
});

const mockAudit = {
  createWrappedCallback: vi.fn((_request, _providerType, callback) => ({
    callback,
    complete: vi.fn(),
  })),
  getAuditLogs: vi.fn(() => []),
};

vi.mock('../../../src-electron/services/chat/audit/AuditService.js', () => ({
  AuditService: {
    getInstance: vi.fn(() => mockAudit),
  },
}));

const loadThread = vi.fn();

vi.mock('../../../src-electron/repository/thread-repository.js', () => ({
  threadRepository: {
    loadThread,
  },
  ThreadRepository: class {},
  default: class {},
}));

describe('ChatService - conversation context handling', () => {
  let ChatService: typeof import('../../../src-electron/services/chat/ChatService.js').ChatService;
  let service: InstanceType<typeof ChatService>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-import after clearing mocks to ensure ChatService sees the same mocked modules
    const mod = await import('../../../src-electron/services/chat/ChatService.js');
    ChatService = mod.ChatService;
    service = new ChatService(
      'ollama',
      {
        url: 'http://localhost:11434',
        apiKey: 'test-key',
        model: 'llama3:latest',
      },
      false,
    );
  });

  it('prepends stored thread history before sending provider request', async () => {
    loadThread.mockReturnValue({
      id: 'thread-1',
      messages: [
        { id: 'm2', role: 'assistant', content: 'How can I help?', createdAt: 20 },
        { id: 'm1', role: 'user', content: 'Hello', createdAt: 10 },
      ],
    });

    const request: ChatRequest = {
      threadId: 'thread-1',
      model: 'llama3:latest',
      streaming: false,
      messages: [{ id: 'm3', role: 'user', content: 'Need more info' }],
    };

    await service.chat(request);

    expect(mockProvider.chat).toHaveBeenCalledTimes(1);
    const forwardedRequest = mockProvider.chat.mock.calls[0][0] as ChatRequest;
    expect(forwardedRequest.threadId).toBe('thread-1');
    expect(forwardedRequest.messages.map((m) => m.content)).toEqual([
      'Hello',
      'How can I help?',
      'Need more info',
    ]);
  });

  it('skips duplicate messages by id or clientMessageId when merging history', async () => {
    loadThread.mockReturnValue({
      id: 'thread-dup',
      messages: [
        {
          id: 'dup-id',
          clientMessageId: 'client-1',
          role: 'user',
          content: 'Saved copy',
          createdAt: 5,
        },
      ],
    });

    const request: ChatRequest = {
      threadId: 'thread-dup',
      model: 'llama3:latest',
      streaming: false,
      messages: [
        {
          id: 'dup-id',
          clientMessageId: 'client-1',
          role: 'user',
          content: 'Pending copy',
        },
        { id: 'fresh-id', role: 'user', content: 'Brand new prompt' },
      ],
    };

    await service.chat(request);

    const forwardedRequest = mockProvider.chat.mock.calls[0][0] as ChatRequest;
    expect(forwardedRequest.messages).toHaveLength(2);
    expect(forwardedRequest.messages[1]?.id).toBe('fresh-id');
  });

  it('falls back to original payload when no thread history exists', async () => {
    loadThread.mockReturnValue({ id: 'empty-thread', messages: [] });

    const request: ChatRequest = {
      threadId: 'empty-thread',
      model: 'llama3:latest',
      streaming: true,
      messages: [{ id: 'solo', role: 'user', content: 'Just once' }],
    };

    await service.chat(request);

    const forwardedRequest = mockProvider.chat.mock.calls[0][0] as ChatRequest;
    expect(forwardedRequest.messages).toHaveLength(1);
    expect(forwardedRequest.messages[0]?.id).toBe('solo');
  });
});

