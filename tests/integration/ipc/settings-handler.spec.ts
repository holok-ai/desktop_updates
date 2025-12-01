import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_HOLO_API_URL } from '../../../src-shared/constants/api.constant';

const handlers = new Map<string, (...args: any[]) => any>();
const sentEvents: Array<{ channel: string; args: unknown[] }> = [];

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

  const BrowserWindow = {
    getAllWindows: () => [
      {
        webContents: {
          send: (channel: string, ...args: unknown[]) => sentEvents.push({ channel, args }),
        },
      },
    ],
  } as any;

  // expose helper
  // @ts-ignore
  globalThis.__mock_ipcMain = ipcMain;

  return { ipcMain, BrowserWindow };
});

vi.mock('electron-log', () => ({ default: { info: vi.fn() } }));

vi.mock('../../../src-electron/services/settings.service', () => ({
  SettingsService: class {
    constructor() {}
    getAllSettings() {
      return {
        mokuWebUrl: 'u',
        mokuApiUrl: 'a',
        holoApiUrl: DEFAULT_HOLO_API_URL,
        theme: 'light',
        autoUpdate: true,
        updateAvailable: false,
        latestVersion: '',
      };
    }
    getSetting(k: any) {
      return (this.getAllSettings() as any)[k];
    }
    setSetting() {}
    setSettings() {}
    resetToDefaults() {}
    getMokuWebUrl() {
      return 'u';
    }
    getMokuApiUrl() {
      return 'a';
    }
    getHoloApiUrl() {
      return DEFAULT_HOLO_API_URL;
    }
    getStorePath() {
      return '/tmp';
    }
  },
}));

import {
  registerSettingsHandlers,
  unregisterSettingsHandlers,
} from 'src-electron/ipc-handlers/settings-handler';

// @ts-ignore
const ipcMain = globalThis.__mock_ipcMain;

describe('IPC: settings-handler', () => {
  beforeEach(() => {
    unregisterSettingsHandlers();
    handlers.clear();
    registerSettingsHandlers();
  });

  it('settings:getAll returns all settings', async () => {
    const res = await ipcMain.__invoke('settings:getAll');
    expect(res).toHaveProperty('mokuWebUrl');
  });

  it('settings:get returns specific setting', async () => {
    const res = await ipcMain.__invoke('settings:get', 'mokuWebUrl');
    expect(res).toBe('u');
  });

  it('settings:set and setMultiple succeed', async () => {
    await expect(ipcMain.__invoke('settings:set', 'mokuWebUrl', 'v')).resolves.toBeUndefined();
    await expect(
      ipcMain.__invoke('settings:setMultiple', { mokuWebUrl: 'v' }),
    ).resolves.toBeUndefined();
  });

  it('settings:reset succeeds and getMokuWebUrl/getMokuApiUrl/getStorePath', async () => {
    await expect(ipcMain.__invoke('settings:reset')).resolves.toBeUndefined();
    const a = await ipcMain.__invoke('settings:getMokuWebUrl');
    expect(a).toBe('u');
    const b = await ipcMain.__invoke('settings:getMokuApiUrl');
    expect(b).toBe('a');
    const p = await ipcMain.__invoke('settings:getStorePath');
    expect(p).toBe('/tmp');
  });
});
