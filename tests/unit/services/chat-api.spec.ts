import { describe, it, expect, vi } from 'vitest';

describe('ChatApiService (ollama stub)', () => {
  it('streams tokens via onTokenReceived', async () => {
    // Mock Ollama class used by ChatApiService. Define stream inside the
    // factory so it is available when the mock is hoisted.
    vi.mock('ollama', () => {
      async function* stream() {
        yield { message: { content: 'a' } };
        yield { message: { content: 'b' } };
      }
      class MockOllama {
        constructor(_opts: any) {}
        chat() {
          return stream();
        }
      }
      return { Ollama: MockOllama };
    });

    const { ChatApiService } = await import('../../../src-electron/services/chat/ChatApiService');

    const received: string[] = [];
    const svc = new ChatApiService('http://mock', 'm');
    await svc.chat({ model: 'm', messages: [] } as any, (t) => received.push(t));

    expect(received).toEqual(['a', 'b']);
  });
});
