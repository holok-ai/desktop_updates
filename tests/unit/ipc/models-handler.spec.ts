import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown;
const handlers = new Map<string, IpcHandler>();

vi.mock('electron', () => {
  const ipcMain = {
    handle: (channel: string, fn: IpcHandler) => handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
  } as any;

  const contextBridge = { exposeInMainWorld: vi.fn() };
  return { ipcMain, contextBridge };
});

// Import after mocks
import {
  registerModelsHandlers,
  unregisterModelsHandlers,
} from '../../../src-electron/ipc-handlers/models-handler';

async function invoke(channel: string, ...args: unknown[]): Promise<any> {
  const fn = handlers.get(channel);
  if (!fn) throw new Error(`No handler for ${channel}`);
  return await Promise.resolve(fn({}, ...args));
}

describe('models IPC handlers', () => {
  beforeEach(() => {
    handlers.clear();
    registerModelsHandlers();
  });

  afterEach(() => {
    unregisterModelsHandlers();
  });

  it('lists available models via IPC', async () => {
    const list = await invoke('models:listAvailable');
    expect(Array.isArray(list)).toBe(true);
    expect(list.every((m: any) => m.available)).toBe(true);
  });

  it('gets specific model via IPC', async () => {
    const all = await invoke('models:listAll');
    expect(all.length).toBeGreaterThan(0);
    const sample = all[0];
    const got = await invoke('models:get', sample.provider, sample.id);
    expect(got).toBeTruthy();
    expect(got.id).toBe(sample.id);
  });
});
