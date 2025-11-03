import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ChatRequest } from '../../../src-electron/services/chat/interfaces/ChatMessage';

// Mock the external Ollama client so unit tests don't try to connect to a real
// Ollama server. We provide a simple chat implementation that yields token
// pieces for streaming and returns a message for non-streaming.
vi.mock('ollama', () => {
  return {
    Ollama: class {
      opts: any;
      constructor(opts: any) {
        this.opts = opts;
      }
      async chat(req: any) {
        if (req.stream) {
          // async iterable of parts
          async function* gen() {
            const tokens = ['hello'];
            for (const t of tokens) {
              yield { message: { content: t } };
            }
          }
          return gen();
        }
        return { message: { content: 'hello' } };
      }
    },
  };
});

describe('ChatService (unit)', () => {
  let ChatService: typeof import('../../../src-electron/services/chat/ChatService').ChatService;
  let service: InstanceType<typeof ChatService>;

  beforeEach(async () => {
    // Import under test after mocking
    const mod = await import('../../../src-electron/services/chat/ChatService');
    ChatService = mod.ChatService;
    service = new ChatService(
      'ollama',
      {
        url: 'http://localhost:11434',
        apiKey: 'ollama',
        model: 'llama3:latest',
      },
      false,
    );
  });

  it('should create ChatService instance', () => {
    expect(service).toBeDefined();
  });

  it('should send a basic chat request and receive streaming response', async () => {
    const request: ChatRequest = {
      messages: [{ role: 'user', content: 'Say "hello" and nothing else.' }],
      streaming: true,
      model: 'llama3:latest',
    };

    let receivedTokens = '';
    const onTokenReceived = (token: string): void => {
      receivedTokens += token;
    };

    await service.chat(request, onTokenReceived);

    expect(receivedTokens.length).toBeGreaterThan(0);
    expect(receivedTokens.toLowerCase()).toContain('hello');
  }, 30000);

  it('should send a chat request with options', async () => {
    const request = {
      messages: [{ role: 'user', content: 'Reply with just the number 5.' }],
      streaming: true,
      model: 'llama3:latest',
      options: {
        temperature: 0.1,
        maxTokens: 10,
      },
    };

    let receivedTokens = '';
    const onTokenReceived = (token: string): void => {
      receivedTokens += token;
    };

    await service.chatWithOptions(request as any, onTokenReceived);

    expect(receivedTokens.length).toBeGreaterThan(0);
  }, 30000);

  it('should get audit logs when audit is enabled', async () => {
    const mod = await import('../../../src-electron/services/chat/ChatService');
    const ChatServiceWithAudit = mod.ChatService;
    const serviceWithAudit = new ChatServiceWithAudit(
      'ollama',
      {
        url: 'http://localhost:11434',
        apiKey: 'ollama',
        model: 'llama3:latest',
      },
      true, // Enable audit
    );

    const logs = serviceWithAudit.getAuditLogs();
    expect(logs).toBeDefined();
  });
});
