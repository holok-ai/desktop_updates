import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_HOLO_API_URL } from '../../../src-shared/constants/api.constant';

vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      store: Record<string, any>;
      path = '/tmp/settings.json';
      constructor(opts: any) {
        this.store = { ...(opts?.defaults || {}) };
      }
      get(key: string, fallback?: any) {
        return this.store[key] ?? fallback;
      }
      set(key: string, value: any) {
        this.store[key] = value;
      }
      clear() {
        this.store = {};
      }
    },
  };
});

// Mock electron to provide app.getPath used by SettingsService
vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }));

vi.mock('electron-log', () => ({ default: { info: vi.fn() } }));

import { SettingsService } from '../../../src-electron/services/settings.service';

describe('SettingsService', () => {
  let svc: SettingsService;
  beforeEach(() => {
    svc = new SettingsService();
  });

  it('getAllSettings returns defaults', () => {
    const all = svc.getAllSettings();
    expect(all.mokuWebUrl).toBeDefined();
    expect(all.mokuApiUrl).toBeDefined();
    expect((all as any).holoApiUrl).toBe(DEFAULT_HOLO_API_URL);
  });

  it('get/set setting', () => {
    svc.setSetting('mokuWebUrl', 'http://a');
    expect(svc.getSetting('mokuWebUrl')).toBe('http://a');
  });

  it('setSettings updates multiple', () => {
    svc.setSettings({ mokuWebUrl: 'u', mokuApiUrl: 'a' });
    expect(svc.getMokuWebUrl()).toBe('u');
    expect(svc.getMokuApiUrl()).toBe('a');
  });

  it('resetToDefaults clears store', () => {
    svc.setSetting('mokuWebUrl', 'x');
    svc.resetToDefaults();
    const all = svc.getAllSettings();
    expect(all.mokuWebUrl).not.toBe('x');
  });

  it('theme getter/setter and new fields', () => {
    svc.setTheme('dark');
    expect(svc.getTheme()).toBe('dark');
    svc.setSettings({ autoCheckUpdates: false, latestVersion: '9.9.9', updateAvailable: true });
    expect(svc.getSetting('autoCheckUpdates')).toBe(false);
    expect(svc.getSetting('latestVersion')).toBe('9.9.9');
    expect(svc.getSetting('updateAvailable')).toBe(true);
  });

  it('getStorePath returns path', () => {
    expect(svc.getStorePath()).toMatch(/settings.json/);
  });
});
