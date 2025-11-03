import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ClaudeChatProvider', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('streams tokens via messages.stream', async () => {
    const { ClaudeChatProvider } = await import(
      '../../../src-electron/services/chat/providers/ClaudeChatProvider'
    );
    const provider = new ClaudeChatProvider('http://c', 'k', 'm');
    // patch internal client to simulate messages.stream API
    provider['client'] = {
      messages: {
        stream: (_opts: any) => ({
          on: (_ev: string, cb: (t: string) => void) => {
            cb('tok1');
            return { finalMessage: async () => ({}) };
          },
        }),
        create: async (_opts: any) => ({ content: [{ type: 'text', text: 'final' }] }),
      },
    } as any;
    const tokens: string[] = [];
    await provider.chat({ messages: [], model: 'm', streaming: true } as any, (t) =>
      tokens.push(t),
    );
    expect(tokens).toEqual(['tok1']);
  });

  it('handles non-streaming messages.create', async () => {
    vi.mock('@anthropic-ai/sdk', () => {
      class ClientMock {
        messages = {
          stream: (_opts: any) => ({ on: () => ({ finalMessage: async () => ({}) }) }),
          create: async (_opts: any) => ({ content: [{ type: 'text', text: 'final' }] }),
        };
      }
      return { default: ClientMock };
    });

    const { ClaudeChatProvider } = await import(
      '../../../src-electron/services/chat/providers/ClaudeChatProvider'
    );
    const provider = new ClaudeChatProvider('http://c', 'k', 'm');
    const tokens: string[] = [];
    await provider.chat({ messages: [], model: 'm', streaming: false } as any, (t) =>
      tokens.push(t),
    );
    expect(tokens).toEqual(['final']);
  });
});
