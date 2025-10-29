import { describe, it, expect, beforeEach, vi } from 'vitest';

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown;
const handlers = new Map<string, IpcHandler>();

vi.mock('electron', () => {
  const ipcMain = {
    handle: (channel: string, fn: IpcHandler) => handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
  } as any;
  const BrowserWindow = { getAllWindows: () => [] } as any;
  const contextBridge = { exposeInMainWorld: vi.fn() };
  return { ipcMain, BrowserWindow, contextBridge };
});

async function invoke(channel: string, ...args: unknown[]) {
  const fn = handlers.get(channel);
  if (!fn) throw new Error(`No handler for ${channel}`);
  return Promise.resolve(fn({}, ...args));
}

describe('thread-handler extra branches', () => {
  beforeEach(() => {
    handlers.clear();
    vi.resetModules();
  });

  it('getAll maps archived and defaults invalid status to active', async () => {
    // mock threads-service
    vi.doMock('../../../src-electron/services/threads-service', () => ({
      threadsService: {
        listThreads: () => [
          {
            id: '1',
            metadata: { title: 'A', status: 'archived' },
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
          {
            id: '2',
            metadata: { title: 'B', status: 123 },
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
        // provide createThread used by initializeSampleData
        createThread: (metadata: any) => ({
          id: 'x',
          metadata: metadata ?? {},
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
      },
    }));

    const mod = await import('../../../src-electron/ipc-handlers/thread-handler');
    mod.registerThreadHandlers();

    const list = await invoke('thread:getAll');
    expect(Array.isArray(list)).toBe(true);
    expect(list[0].status).toBe('archived');
    expect(list[1].status).toBe('active');
  });

  it('create throws when createThread returns undefined', async () => {
    vi.doMock('../../../src-electron/services/threads-service', () => ({
      threadsService: {
        createThread: () => undefined,
      },
    }));

    const mod = await import('../../../src-electron/ipc-handlers/thread-handler');
    mod.registerThreadHandlers();

    await expect(
      invoke('thread:create', { title: 'x', description: '', metadata: {} }),
    ).rejects.toThrow('Failed to convert created thread');
  });

  it('addAssistantResponse throws when loadThread returns undefined', async () => {
    vi.doMock('../../../src-electron/services/threads-service', () => ({
      threadsService: {
        addAssistantResponse: () => ({
          id: 'm1',
          role: 'assistant',
          content: 'r',
          createdAt: Date.now(),
        }),
        loadThread: () => undefined,
        createThread: (metadata: any) => ({
          id: 'x',
          metadata: metadata ?? {},
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
      },
    }));

    const mod = await import('../../../src-electron/ipc-handlers/thread-handler');
    mod.registerThreadHandlers();

    await expect(invoke('thread:addAssistantResponse', 't1', 'resp')).rejects.toThrow(
      'Failed to convert thread after assistant response',
    );
  });

  it('savePromptAndResponses throws when conversion fails', async () => {
    vi.doMock('../../../src-electron/services/threads-service', () => ({
      threadsService: {
        savePromptAndResponses: () => ({
          thread: undefined,
          promptMessage: { id: 'p', role: 'user', content: 'q', createdAt: Date.now() },
          responseMessages: [],
        }),
        createThread: (metadata: any) => ({
          id: 'x',
          metadata: metadata ?? {},
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
      },
    }));

    const mod = await import('../../../src-electron/ipc-handlers/thread-handler');
    mod.registerThreadHandlers();

    await expect(invoke('thread:savePromptAndResponses', null, 'Q', [])).rejects.toThrow(
      'Failed to convert thread after savePromptAndResponses',
    );
  });

  it('update accepts and applies valid status values', async () => {
    vi.doMock('../../../src-electron/services/threads-service', () => ({
      threadsService: {
        loadThread: (id: string) => ({
          id,
          metadata: { title: 't' },
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
        saveThread: (t: any) => ({ ...t }),
        createThread: (metadata: any) => ({
          id: 'x',
          metadata: metadata ?? {},
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
      },
    }));

    const mod = await import('../../../src-electron/ipc-handlers/thread-handler');
    mod.registerThreadHandlers();

    const updated = await invoke('thread:update', 'tid', { status: 'archived' });
    expect(updated).toHaveProperty('status', 'archived');
  });
});
