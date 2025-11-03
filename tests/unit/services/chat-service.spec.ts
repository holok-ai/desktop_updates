import { describe, it, expect, vi } from 'vitest';

describe('ChatService (integration shim)', () => {
  it('calls provider.chat and completes audit wrapper', async () => {
    const tokens: string[] = [];

    // Mock provider with chat method
    const provider = {
      chat: vi.fn(async (_request: any, cb: (t: string) => void) => {
        cb('tok1');
        cb('tok2');
      }),
      chatWithOptions: vi.fn(async (_req: any, cb: (t: string) => void) => {
        cb('opt1');
      }),
    };

    // Mock factory to return our provider
    vi.doMock('../../../src-electron/services/chat/factories/ChatProviderFactory', () => ({
      ChatProviderFactory: { createProvider: () => provider },
      ProviderType: { ollama: 'ollama' },
    }));

    // Mock AuditService
    const complete = vi.fn();
    const createWrappedCallback = vi.fn(
      (request: any, _provider: any, onToken?: (t: string) => void) => {
        return {
          callback: (t: string) => onToken?.(t),
          complete,
        };
      },
    );
    vi.doMock('../../../src-electron/services/chat/audit/AuditService', () => ({
      AuditService: { getInstance: () => ({ createWrappedCallback, getAuditLogs: () => [] }) },
    }));

    const { ChatService } = await import('../../../src-electron/services/chat/ChatService');

    const svc = new ChatService('ollama', { endpoint: 'http://x' } as any, true);

    await svc.chat({ model: 'm', messages: [] } as any, (t) => tokens.push(t));
    expect(tokens).toEqual(['tok1', 'tok2']);
    expect(complete).toHaveBeenCalled();

    tokens.length = 0;
    await svc.chatWithOptions({ model: 'm', messages: [], options: {} } as any, (t) =>
      tokens.push(t),
    );
    expect(tokens).toEqual(['opt1']);
  });
});
