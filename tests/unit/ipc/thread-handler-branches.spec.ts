import { describe, it, expect, vi, beforeEach } from 'vitest';

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown;
const handlers = new Map<string, IpcHandler>();

const sentEvents: Array<{ channel: string; args: unknown[] }> = [];

vi.mock('electron', () => {
  const ipcMain = {
    handle: (channel: string, fn: IpcHandler) => handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
  };

  const BrowserWindow = {
    getAllWindows: () => [
      {
        webContents: {
          send: (channel: string, ...args: unknown[]) => sentEvents.push({ channel, args }),
        },
      },
    ],
  } as any;

  const contextBridge = { exposeInMainWorld: vi.fn() };
  const ipcRenderer = { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn(), send: vi.fn() };
  return { ipcMain, BrowserWindow, contextBridge, ipcRenderer };
});

// Import after mocks
import {
  registerThreadHandlers,
  unregisterThreadHandlers,
} from '../../../src-electron/ipc-handlers/thread-handler';

async function invoke(channel: string, ...args: unknown[]): Promise<any> {
  const fn = handlers.get(channel);
  if (!fn) throw new Error(`No handler for ${channel}`);
  return await Promise.resolve(fn({}, ...args));
}

describe('thread-handler additional branches', () => {
  beforeEach(() => {
    unregisterThreadHandlers();
    handlers.clear();
    sentEvents.length = 0;
    registerThreadHandlers();
  });

  it('update throws when thread not found', async () => {
    await expect(invoke('thread:update', 'missing-id', { title: 'x' })).rejects.toThrow(
      'not found',
    );
    // no broadcast should have been sent
    expect(sentEvents.find((e) => e.channel === 'thread:updated')).toBeFalsy();
  });

  it('delete returns false when id missing and does not broadcast', async () => {
    const ok = await invoke('thread:delete', 'missing-id');
    expect(ok).toBe(false);
    expect(sentEvents.find((e) => e.channel === 'thread:deleted')).toBeFalsy();
  });
});
