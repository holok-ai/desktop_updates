import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('OllamaChatProvider', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('streams tokens from ollama chat', async () => {
    const { OllamaChatProvider } = await import(
      '../../../src-electron/services/chat/providers/OllamaChatProvider'
    );
    const provider = new OllamaChatProvider('http://e', 'k', 'm');
    // patch internal ollama client to return an async iterable
    provider['ollama'] = {
      chat: (_opts: any) =>
        (async function* () {
          yield { message: { content: 'x' } };
          yield { message: { content: 'y' } };
        })(),
    } as any;
    const tokens: string[] = [];
    await provider.chat({ messages: [], model: 'm', streaming: true } as any, (t) =>
      tokens.push(t),
    );
    expect(tokens).toEqual(['x', 'y']);
  });

  it('handles non-streaming ollama response', async () => {
    const { OllamaChatProvider: OllamaChatProvider2 } = await import(
      '../../../src-electron/services/chat/providers/OllamaChatProvider'
    );
    const provider2 = new OllamaChatProvider2('http://e', 'k', 'm');
    provider2['ollama'] = {
      chat: async (_opts: any) => ({ message: { content: 'final' } }),
    } as any;
    const tokens: string[] = [];
    await provider2.chat({ messages: [], model: 'm', streaming: false } as any, (t) =>
      tokens.push(t),
    );
    expect(tokens).toEqual(['final']);
  });
});
