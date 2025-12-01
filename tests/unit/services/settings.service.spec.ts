import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DEFAULT_HOLO_API_URL } from '../../../src-shared/constants/api.constant';

// Mock electron-store so we can capture constructor options and control store behavior
vi.mock('electron-store', () => {
  return {
    default: class MockStore {
      store: Record<string, any>;
      path = '/tmp/settings.json';
      private defaults: Record<string, any>;
      constructor(opts: any) {
        this.defaults = { ...(opts?.defaults || {}) };
        this.store = { ...this.defaults };
      }
      get(key: string, fallback?: any) {
        return this.store[key] ?? fallback;
      }
      set(key: string, value: any) {
        this.store[key] = value;
      }
      clear() {
        // restore to defaults (behaviour expected by SettingsService.resetToDefaults)
        this.store = { ...this.defaults };
      }
    },
  };
});

// Mock electron app used by SettingsService to avoid accessing real app paths during unit tests
vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }));

describe('SettingsService (unit)', () => {
  const originalEnv = process.env.npm_package_name;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env.npm_package_name = originalEnv;
  });

  it('initializes with defaults when npm_package_name is not set', async () => {
    delete process.env.npm_package_name;
    const mod = await import('../../../src-electron/services/settings.service');
    const { SettingsService } = mod;
    const svc = new SettingsService();

    // Access mocked electron-store constructor options
    // Service constructed successfully using fallback projectName

    // Basic getters should return defaults
    expect(svc.getMokuWebUrl()).toBe('http://localhost:4200');
    expect(svc.getMokuApiUrl()).toBe('http://localhost:8080');
    expect(svc.getHoloApiUrl()).toBe(DEFAULT_HOLO_API_URL);
    expect(svc.getTheme()).toBe('light');
    // new fields present with defaults
    const auto = svc.getSetting('autoUpdate');
    expect(auto).toBeDefined();
    // if boolean, ensure true, otherwise just defined
    if (typeof auto === 'boolean') expect(auto).toBe(true);
    expect(svc.getSetting('updateAvailable')).toBe(false);
    expect(svc.getSetting('latestVersion')).toBe('');
    expect(typeof svc.getStorePath()).toBe('string');
  });

  it('allows setters/getters/reset', async () => {
    const { SettingsService } = await import('../../../src-electron/services/settings.service');
    const svc = new SettingsService();

    // Service constructed successfully using provided npm_package_name

    // set single setting
    svc.setMokuWebUrl('https://example.com');
    expect(svc.getMokuWebUrl()).toBe('https://example.com');

    // set multiple settings
    svc.setSettings({ theme: 'dark', autoUpdate: false, latestVersion: '1.2.3' });
    expect(svc.getTheme()).toBe('dark');
    expect(svc.getSetting('autoUpdate')).toBe(false);
    expect(svc.getSetting('latestVersion')).toBe('1.2.3');

    // reset to defaults
    svc.resetToDefaults();
    expect(svc.getTheme()).toBe('light');
  });

  it('getSetting and setSetting generic behavior', async () => {
    const { SettingsService } = await import('../../../src-electron/services/settings.service');
    const svc = new SettingsService();

    svc.setSetting('mokuWebUrl', 'http://a');
    expect(svc.getSetting('mokuWebUrl')).toBe('http://a');

    svc.setSetting('mokuApiUrl', 'http://api');
    expect(svc.getSetting('mokuApiUrl')).toBe('http://api');

    svc.setSetting('holoApiUrl', 'https://example.com');
    expect(svc.getSetting('holoApiUrl')).toBe('https://example.com');
  });

  it('getAllSettings returns underlying store object', async () => {
    const { SettingsService } = await import('../../../src-electron/services/settings.service');
    const svc = new SettingsService();
    const all = svc.getAllSettings();
    expect(all).toBeTruthy();
    expect((all as any).mokuWebUrl).toBeDefined();
    const au = (all as any).autoUpdate;
    expect(au).toBeDefined();
    if (typeof au === 'boolean') expect(au).toBe(true);
  });
});
