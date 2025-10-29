import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('settings-handler branches', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('getSettingsService initializes when not set', async () => {
    let constructed = 0;

    // mock electron ipcMain used by registerSettingsHandlers
    vi.doMock('electron', () => ({
      ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
      default: {},
    }));

    // mock SettingsService to count constructions
    vi.doMock('../../../src-electron/services/settings.service', () => ({
      SettingsService: class {
        constructor() {
          constructed += 1;
        }
        getAllSettings() {
          return { mokuWebUrl: 'u', mokuApiUrl: 'a', theme: 'light', logLevel: 'info' };
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
        getStorePath() {
          return '/tmp';
        }
      },
    }));

    const mod = await import('../../../src-electron/ipc-handlers/settings-handler');
    // first call should construct
    const s1 = mod.getSettingsService();
    expect(constructed).toBe(1);

    // second call should return same instance (no new construction)
    const s2 = mod.getSettingsService();
    expect(s1).toBe(s2);
    expect(constructed).toBe(1);
  });

  it('registerSettingsHandlers sets service and handlers are registered', async () => {
    // Prepare mocks
    const handlers = new Map<string, (...args: any[]) => any>();
    const ipcMain = {
      handle: (channel: string, fn: (...args: any[]) => any) => handlers.set(channel, fn),
      removeHandler: (channel: string) => handlers.delete(channel),
    } as any;

    vi.doMock('electron', () => ({ ipcMain, default: {} }));

    // simple SettingsService mock
    vi.doMock('../../../src-electron/services/settings.service', () => ({
      SettingsService: class {
        getAllSettings() {
          return { mokuWebUrl: 'u', mokuApiUrl: 'a', theme: 'light', logLevel: 'info' };
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
        getStorePath() {
          return '/tmp';
        }
      },
    }));

    const mod = await import('../../../src-electron/ipc-handlers/settings-handler');
    // register handlers
    mod.registerSettingsHandlers();

    // verify handlers exist for a few channels
    expect(handlers.has('settings:getAll')).toBeTruthy();
    expect(handlers.has('settings:set')).toBeTruthy();
    expect(handlers.has('settings:getMokuWebUrl')).toBeTruthy();

    // unregister should remove them
    mod.unregisterSettingsHandlers();
    expect(handlers.size).toBe(0);
  });
});
