import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ToolDefinition, ToolResult } from '../../../src-electron/services/file-tools.service';

async function* streamChatChunks() {
  yield { choices: [{ delta: { content: 'p1' } }] };
  yield { choices: [{ delta: { content: 'p2' } }] };
}

describe('PerplexityChatProvider', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('constructs Perplexity client with normalized endpoint and default model', async () => {
    const ctorArgs: any[] = [];

    const MockPerplexity = vi.fn().mockImplementation((opts: any) => {
      ctorArgs.push(opts);
      return {
        chat: {
          completions: {
            create: vi.fn(async () => ({
              choices: [{ message: { content: 'ok' } }],
            })),
          },
        },
      };
    });

    vi.doMock('@perplexity-ai/perplexity_ai', () => ({ default: MockPerplexity }));

    const { PerplexityChatProvider } = await import(
      '../../../src-electron/services/chat/providers/PerplexityChatProvider'
    );

    const provider = new PerplexityChatProvider('', 'api-key', '');
    const tokens: string[] = [];
    await provider.chat({ model: 'pplx-70b-online', messages: [], streaming: false }, (t) =>
      tokens.push(t),
    );

    expect(ctorArgs[0]).toMatchObject({
      apiKey: 'api-key',
      baseURL: 'https://api.perplexity.ai',
    });
    expect(tokens).toEqual(['ok']);
  });

  it('streams chat tokens using Perplexity SDK', async () => {
    const createCalls: any[] = [];

    const MockPerplexity = vi.fn().mockImplementation((_opts: any) => ({
      chat: {
        completions: {
          create: vi.fn(async (opts: any) => {
            createCalls.push(opts);
            return streamChatChunks();
          }),
        },
      },
    }));

    vi.doMock('@perplexity-ai/perplexity_ai', () => ({ default: MockPerplexity }));

    const { PerplexityChatProvider } = await import(
      '../../../src-electron/services/chat/providers/PerplexityChatProvider'
    );

    const provider = new PerplexityChatProvider('https://custom/', 'k', 'pplx-7b-chat');
    const tokens: string[] = [];
    await provider.chat(
      { model: 'pplx-7b-chat', messages: [{ role: 'user', content: 'hi' }], streaming: true },
      (t) => tokens.push(t),
    );

    expect(tokens).toEqual(['p1', 'p2']);
    expect(createCalls[0].model).toBe('pplx-7b-chat');
    expect(createCalls[0].stream).toBe(true);
  });

  it('supportsTools always returns true', async () => {
    const MockPerplexity = vi.fn().mockImplementation((_opts: any) => ({
      chat: { completions: { create: vi.fn() } },
    }));

    vi.doMock('@perplexity-ai/perplexity_ai', () => ({ default: MockPerplexity }));

    const { PerplexityChatProvider } = await import(
      '../../../src-electron/services/chat/providers/PerplexityChatProvider'
    );

    const provider = new PerplexityChatProvider('', 'key', 'pplx-70b-online');
    expect(provider.supportsTools()).toBe(true);
  });

  it('chatWithTools loops tool JSON responses and emits final answer', async () => {
    const createCalls: any[] = [];

    const MockPerplexity = vi.fn().mockImplementation((_opts: any) => ({
      chat: {
        completions: {
          create: vi.fn(async () => {
            createCalls.push({});
            if (createCalls.length === 1) {
              return {
                choices: [
                  {
                    message: {
                      content: '{"tool":"read_file","input":{"path":"/tmp/demo.txt"}}',
                    },
                  },
                ],
              };
            }
            return {
              choices: [
                {
                  message: {
                    content: 'final-from-perplexity',
                  },
                },
              ],
            };
          }),
        },
      },
    }));

    vi.doMock('@perplexity-ai/perplexity_ai', () => ({ default: MockPerplexity }));

    const { PerplexityChatProvider } = await import(
      '../../../src-electron/services/chat/providers/PerplexityChatProvider'
    );

    const provider = new PerplexityChatProvider('', 'key', 'pplx-70b-online');
    const tokens: string[] = [];
    const toolCalls: any[] = [];
    const tools: ToolDefinition[] = [
      {
        name: 'read_file',
        description: 'Read a file',
        input_schema: {
          type: 'object',
          properties: { path: { type: 'string' } },
          required: ['path'],
        },
      },
    ];
    const toolResult: ToolResult = { success: true, data: { ok: true } as any };

    await provider.chatWithTools(
      { model: 'pplx-70b-online', messages: [{ role: 'user', content: 'hi' }], streaming: true },
      tools,
      (t) => tokens.push(t),
      async (toolUse) => {
        toolCalls.push(toolUse);
        return toolResult;
      },
    );

    expect(toolCalls[0]).toMatchObject({
      name: 'read_file',
      input: { path: '/tmp/demo.txt' },
    });
    expect(tokens).toEqual(['final-from-perplexity']);
    expect(createCalls.length).toBe(2);
  });
});

