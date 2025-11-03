import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('OpenAIChatProvider', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('streams tokens when stream=true', async () => {
    const { OpenAIChatProvider } = await import(
      '../../../src-electron/services/chat/providers/OpenAIChatProvider'
    );
    const provider = new OpenAIChatProvider('http://x', 'k', 'm');
    // patch internal client to return an async iterable stream
    provider['client'] = {
      chat: {
        completions: {
          create: async (_opts: any) =>
            (async function* () {
              yield { choices: [{ delta: { content: 'a' } }] };
              yield { choices: [{ delta: { content: 'b' } }] };
            })(),
        },
      },
    } as any;
    const tokens: string[] = [];
    await provider.chat({ messages: [], model: 'm', streaming: true } as any, (t) =>
      tokens.push(t),
    );
    expect(tokens).toEqual(['a', 'b']);
  });

  it('handles non-streaming response', async () => {
    const { OpenAIChatProvider: OpenAIChatProvider2 } = await import(
      '../../../src-electron/services/chat/providers/OpenAIChatProvider'
    );
    const provider2 = new OpenAIChatProvider2('http://x', 'k', 'm');
    provider2['client'] = {
      chat: {
        completions: {
          create: async (_opts: any) => ({ choices: [{ message: { content: 'final' } }] }),
        },
      },
    } as any;
    const tokens: string[] = [];
    await provider2.chat({ messages: [], model: 'm', streaming: false } as any, (t) =>
      tokens.push(t),
    );
    expect(tokens).toEqual(['final']);
  });
});
