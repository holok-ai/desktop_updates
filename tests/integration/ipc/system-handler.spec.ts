import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const handlers = new Map<string, (...args: any[]) => any>();

vi.mock('electron', () => {
  const ipcMain = {
    handle: (channel: string, fn: (...args: any[]) => any) => handlers.set(channel, fn),
    removeHandler: (channel: string) => handlers.delete(channel),
    __invoke: async (channel: string, ...args: any[]) => {
      const fn = handlers.get(channel);
      if (!fn) throw new Error(`No handler for ${channel}`);
      return await fn({}, ...args);
    },
  } as any;

  const app = {
    getPath: (name: string) => `/mock/${name}`,
  };

  // expose helper
  // @ts-ignore
  globalThis.__mock_ipcMain = ipcMain;

  return { ipcMain, app };
});

import {
  registerSystemHandlers,
  unregisterSystemHandlers,
} from 'src-electron/ipc-handlers/system-handler';
// @ts-ignore
const ipcMain = globalThis.__mock_ipcMain;

describe('IPC: system-handler', () => {
  beforeEach(() => {
    unregisterSystemHandlers();
    handlers.clear();
    registerSystemHandlers();
    // ensure process.versions.electron exists during tests
    try {
      Object.defineProperty(process.versions, 'electron', {
        value: '1.0.0-test',
        configurable: true,
      });
    } catch (e) {
      // ignore if not configurable
    }
  });
  afterEach(() => {
    try {
      // cleanup added property if present
      if (Object.prototype.hasOwnProperty.call(process.versions, 'electron')) {
        delete (process.versions as any).electron;
      }
    } catch (e) {
      // ignore
    }
  });

  it('system:platform returns platform', async () => {
    const p = await ipcMain.__invoke('system:platform');
    expect(typeof p).toBe('string');
  });

  it('system:version returns electron version string', async () => {
    const v = await ipcMain.__invoke('system:version');
    expect(typeof v).toBe('string');
  });

  it('system:getPath returns mocked path', async () => {
    const path = await ipcMain.__invoke('system:getPath', 'home');
    expect(path).toBe('/mock/home');
  });
});
