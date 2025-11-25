import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ToolDefinition, ToolResult } from '../../../src-electron/services/file-tools.service';

async function* streamChatChunks() {
  yield { choices: [{ delta: { content: 'a' } }] };
  yield { choices: [{ delta: { content: '' } }] };
  yield { choices: [{ delta: { content: 'b' } }] };
}

async function* streamOptionsChunks() {
  yield { choices: [{ delta: { content: 'x' } }] };
}

async function* streamToolCallChunks() {
  yield { choices: [{ delta: { function_call: { name: 'read_file', arguments: '{"path":' } } }] };
  yield { choices: [{ delta: { function_call: { arguments: '"/tmp/test.txt"}' } } }] };
}

async function* streamToolFinalChunks() {
  yield { choices: [{ delta: { content: 'final-response' } }] };
}

describe('OpenAIChatProvider', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('streams tokens for chat() using provided model', async () => {
    const calls: any[] = [];

    class MockOpenAI {
      chat = {
        completions: {
          create: async (_opts: any) => {
            calls.push(_opts);
            return streamChatChunks();
          },
        },
      };
    }

    vi.doMock('openai', () => ({ default: MockOpenAI }));

    const { OpenAIChatProvider } = await import(
      '../../../src-electron/services/chat/providers/OpenAIChatProvider'
    );

    const prov = new OpenAIChatProvider('http://x', 'k', 'mymodel');
    const tokens: string[] = [];
    await prov.chat({ model: 'the-model', messages: [{ role: 'user', content: 'hi' }] }, (t) =>
      tokens.push(t),
    );

    expect(tokens).toEqual(['a', 'b']);
    expect(calls[0].model).toBe('the-model');
  });

  it('uses default model when request.model missing and non-streaming returns final content', async () => {
    const calls: any[] = [];
    class MockOpenAI {
      chat: any;
      constructor(_opts: any) {
        this.chat = {
          completions: {
            create: async (opts: any) => {
              calls.push(opts);
              return { choices: [{ message: { content: 'final' } }] };
            },
          },
        };
      }
    }

    vi.doMock('openai', () => ({ default: MockOpenAI }));
    const { OpenAIChatProvider } = await import(
      '../../../src-electron/services/chat/providers/OpenAIChatProvider'
    );

    // construct provider with empty defaultModel to trigger internal fallback
    const prov = new OpenAIChatProvider('http://x', 'k', '');
    const received: string[] = [];
    await prov.chat({ model: '', messages: [], streaming: false }, (t) => received.push(t));

    expect(received).toEqual(['final']);
    // model passed to API should be fallback default
    expect(calls[0].model).toBe('gpt-3.5-turbo');
  });

  it('chatWithOptions passes optional parameters and streams tokens', async () => {
    const calls: any[] = [];

    class MockOpenAI {
      chat = {
        completions: {
          create: async (opts: any) => {
            calls.push(opts);
            return streamOptionsChunks();
          },
        },
      };
    }

    vi.doMock('openai', () => ({ default: MockOpenAI }));
    const { OpenAIChatProvider } = await import(
      '../../../src-electron/services/chat/providers/OpenAIChatProvider'
    );

    const prov = new OpenAIChatProvider('http://x', 'k', 'model1');
    const tokens: string[] = [];
    await prov.chatWithOptions(
      { model: 'm1', messages: [], options: { temperature: 0.5, maxTokens: 10 }, streaming: true },
      (t) => tokens.push(t),
    );

    expect(tokens).toEqual(['x']);
    expect(calls[0].temperature).toBe(0.5);
    expect(calls[0].max_tokens).toBe(10);
    expect(calls[0].stream).toBe(true);
  });

  it('chatWithOptions non-streaming returns final content if present', async () => {
    const calls: any[] = [];
    class MockOpenAI {
      chat = {
        completions: {
          create: async (opts: any) => {
            calls.push(opts);
            return { choices: [{ message: { content: 'done' } }] };
          },
        },
      };
    }

    vi.doMock('openai', () => ({ default: MockOpenAI }));
    const { OpenAIChatProvider } = await import(
      '../../../src-electron/services/chat/providers/OpenAIChatProvider'
    );

    const prov = new OpenAIChatProvider('http://x', 'k', 'model1');
    const received: string[] = [];
    await prov.chatWithOptions({ model: 'm2', messages: [], options: {}, streaming: false }, (t) =>
      received.push(t),
    );

    expect(received).toEqual(['done']);
    expect(calls[0].model).toBe('m2');
  });

  it('supportsTools returns true only for GPT-4 defaults', async () => {
    class MockOpenAI {
      chat = { completions: { create: vi.fn() } };
    }

    vi.doMock('openai', () => ({ default: MockOpenAI }));
    const { OpenAIChatProvider } = await import(
      '../../../src-electron/services/chat/providers/OpenAIChatProvider'
    );

    const gpt4Provider = new OpenAIChatProvider('http://x', 'k', 'gpt-4o');
    const gpt35Provider = new OpenAIChatProvider('http://x', 'k', 'gpt-3.5-turbo');

    expect(gpt4Provider.supportsTools()).toBe(true);
    expect(gpt35Provider.supportsTools()).toBe(false);
  });

  it('chatWithTools handles streaming function calls and loops results into conversation', async () => {
    const createCalls: any[] = [];

    class MockOpenAI {
      chat = {
        completions: {
          create: vi.fn(async (opts: any) => {
            createCalls.push(opts);
            if (opts.stream) {
              return createCalls.length === 1 ? streamToolCallChunks() : streamToolFinalChunks();
            }
            throw new Error('unexpected non-stream call');
          }),
        },
      };
    }

    vi.doMock('openai', () => ({ default: MockOpenAI }));
    const { OpenAIChatProvider } = await import(
      '../../../src-electron/services/chat/providers/OpenAIChatProvider'
    );

    const provider = new OpenAIChatProvider('http://x', 'k', 'gpt-4');
    const tokens: string[] = [];
    const toolCalls: any[] = [];
    const result: ToolResult = { success: true, data: { ok: true } as any };
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

    await provider.chatWithTools(
      { model: 'gpt-4o', streaming: true, messages: [{ role: 'user', content: 'need file' }] },
      tools,
      (token) => tokens.push(token),
      async (toolUse) => {
        toolCalls.push(toolUse);
        return result;
      },
    );

    expect(tokens).toEqual(['final-response']);
    expect(toolCalls[0].name).toBe('read_file');
    expect(toolCalls[0].input).toEqual({ path: '/tmp/test.txt' });
    expect(createCalls).toHaveLength(2);
    const secondMessages = createCalls[1].messages;
    expect(secondMessages[secondMessages.length - 2].role).toBe('assistant');
    expect(secondMessages[secondMessages.length - 1]).toMatchObject({
      role: 'function',
      name: 'read_file',
    });
  });

  it('chatWithTools handles non-streaming function calls and returns when no tool call', async () => {
    const createCalls: any[] = [];

    class MockOpenAI {
      chat = {
        completions: {
          create: vi.fn(async (opts: any) => {
            createCalls.push(opts);
            if (!opts.stream && createCalls.length === 1) {
              return {
                choices: [
                  {
                    finish_reason: 'function_call',
                    message: {
                      role: 'assistant',
                      function_call: {
                        name: 'read_folder',
                        arguments: '{"path":"/tmp"}',
                      },
                    },
                  },
                ],
              };
            }
            return {
              choices: [
                {
                  finish_reason: 'stop',
                  message: { role: 'assistant', content: 'done' },
                },
              ],
            };
          }),
        },
      };
    }

    vi.doMock('openai', () => ({ default: MockOpenAI }));
    const { OpenAIChatProvider } = await import(
      '../../../src-electron/services/chat/providers/OpenAIChatProvider'
    );

    const provider = new OpenAIChatProvider('http://x', 'k', 'gpt-4');
    const tokens: string[] = [];
    const toolCalls: any[] = [];
    const tools: ToolDefinition[] = [
      {
        name: 'read_folder',
        description: 'Read a folder',
        input_schema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    ];

    await provider.chatWithTools(
      { model: 'gpt-4', streaming: false, messages: [{ role: 'user', content: 'list folder' }] },
      tools,
      (token) => tokens.push(token),
      async (toolUse) => {
        toolCalls.push(toolUse);
        return { success: true };
      },
    );

    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].name).toBe('read_folder');
    expect(tokens).toEqual(['done']);
    expect(createCalls).toHaveLength(2);
    expect(createCalls[0].functions).toHaveLength(1);
  });
});
