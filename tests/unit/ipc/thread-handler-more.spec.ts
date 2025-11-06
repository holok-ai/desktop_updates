import { describe, it, expect, beforeEach, vi } from 'vitest';

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown;
const handlers = new Map<string, IpcHandler>();

vi.mock('electron', () => {
  const ipcMain = {
    handle: (channel: string, fn: IpcHandler) => handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
  } as any;

  const BrowserWindow = {
    getAllWindows: () => [
      {
        webContents: { send: vi.fn() },
      },
    ],
  } as any;

  const contextBridge = { exposeInMainWorld: vi.fn() };
  return { ipcMain, BrowserWindow, contextBridge };
});

async function invoke(channel: string, ...args: unknown[]) {
  const fn = handlers.get(channel);
  if (!fn) throw new Error(`No handler for ${channel}`);
  return Promise.resolve(fn({}, ...args));
}

describe('thread-handler additional branches', () => {
  beforeEach(() => {
    handlers.clear();
    vi.resetModules();
  });

  it('create throws when chosen model is unavailable', async () => {
    vi.doMock('../../../src-electron/services/moku.service', () => ({
      mokuService: {
        getModel: async () => ({ provider: 'openai', id: 'm1', available: false }),
      },
    }));

    vi.doMock('../../../src-electron/repository/thread-repository', () => ({
      threadRepository: {
        createThread: (m: any) => ({
          id: 't1',
          metadata: m,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
      },
    }));

    const mod = await import('../../../src-electron/ipc-handlers/thread-handler');
    mod.registerThreadHandlers();

    await expect(
      invoke('thread:create', {
        title: 'x',
        description: '',
        metadata: { model: 'm1', provider: 'openai' },
      }),
    ).rejects.toThrow('Model unavailable—choose another');
  });

  it('create succeeds when chosen model is available', async () => {
    vi.doMock('../../../src-electron/services/moku.service', () => ({
      mokuService: {
        getModel: async () => ({ provider: 'openai', id: 'm2', available: true }),
      },
    }));

    vi.doMock('../../../src-electron/repository/thread-repository', () => ({
      threadRepository: {
        createThread: (m: any) => ({
          id: 't2',
          metadata: m,
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
      },
    }));

    const mod = await import('../../../src-electron/ipc-handlers/thread-handler');
    mod.registerThreadHandlers();

    const res = await invoke('thread:create', {
      title: 'ok',
      description: '',
      metadata: { model: 'm2', provider: 'openai' },
    });
    expect(res).toHaveProperty('id', 't2');
    expect((res as any).metadata).toHaveProperty('model', 'm2');
  });

  it('getById returns null when thread not found', async () => {
    vi.doMock('../../../src-electron/repository/thread-repository', () => ({
      threadRepository: {
        loadThread: (id: string) => undefined,
        createThread: (metadata: any) => ({
          id: 's',
          metadata: metadata ?? {},
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
      },
    }));

    const mod = await import('../../../src-electron/ipc-handlers/thread-handler');
    mod.registerThreadHandlers();

    const got = await invoke('thread:getById', 'nope');
    expect(got).toBeNull();
  });

  it('thread:delete returns false when deleteThread returns false', async () => {
    vi.doMock('../../../src-electron/repository/thread-repository', () => ({
      threadRepository: {
        deleteThread: (id: string) => false,
        createThread: (metadata: any) => ({
          id: 's',
          metadata: metadata ?? {},
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }),
      },
    }));

    const mod = await import('../../../src-electron/ipc-handlers/thread-handler');
    mod.registerThreadHandlers();

    const d = await invoke('thread:delete', 'x');
    expect(d).toBe(false);
  });
});
