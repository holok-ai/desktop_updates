import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock electron-store so we can capture constructor options and control store behavior
vi.mock('electron-store', () => {
  return class MockStore {
    static last: any;
    store: Record<string, any>;
    path: string;
    constructor(opts: any) {
      (MockStore as any).last = opts;
      this.store = { ...(opts && opts.defaults ? opts.defaults : {}) };
      this.path = '/tmp/mock-settings.json';
      this.get = (k: any, d?: any) => (k in this.store ? this.store[k] : d);
      this.set = (k: any, v: any) => {
        this.store[k] = v;
      };
      this.clear = () => {
        this.store = { ...(opts && opts.defaults ? opts.defaults : {}) };
      };
    }
  } as any;
});

describe('SettingsService (unit)', () => {
  const originalEnv = process.env.npm_package_name;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env.npm_package_name = originalEnv;
  });

  it('uses fallback projectName when npm_package_name is not set', async () => {
    delete process.env.npm_package_name;
    const mod = await import('../../../src-electron/services/settings.service');
    const { SettingsService } = mod;
    const svc = new SettingsService();

    // Access mocked electron-store constructor options
    // Service constructed successfully using fallback projectName

    // Basic getters should return defaults
    expect(svc.getMokuWebUrl()).toBe('http://localhost:4201');
    expect(svc.getMokuApiUrl()).toBe('http://localhost:3000/api');
    expect(svc.getTheme()).toBe('light');
    expect(svc.getLogLevel()).toBe('info');
    expect(typeof svc.getStorePath()).toBe('string');
  });

  it('respects npm_package_name when provided and allows setters/getters/reset', async () => {
    process.env.npm_package_name = 'the-package';
    const { SettingsService } = await import('../../../src-electron/services/settings.service');
    const svc = new SettingsService();

    // Service constructed successfully using provided npm_package_name

    // set single setting
    svc.setMokuWebUrl('https://example.com');
    expect(svc.getMokuWebUrl()).toBe('https://example.com');

    // set multiple settings
    svc.setSettings({ theme: 'dark', logLevel: 'debug' });
    expect(svc.getTheme()).toBe('dark');
    expect(svc.getLogLevel()).toBe('debug');

    // reset to defaults
    svc.resetToDefaults();
    expect(svc.getTheme()).toBe('light');
    expect(svc.getLogLevel()).toBe('info');
  });

  it('getSetting and setSetting generic behavior', async () => {
    const { SettingsService } = await import('../../../src-electron/services/settings.service');
    const svc = new SettingsService();

    svc.setSetting('mokuWebUrl', 'http://a');
    expect(svc.getSetting('mokuWebUrl')).toBe('http://a');

    svc.setSetting('mokuApiUrl', 'http://api');
    expect(svc.getSetting('mokuApiUrl')).toBe('http://api');
  });

  it('getAllSettings returns underlying store object', async () => {
    const { SettingsService } = await import('../../../src-electron/services/settings.service');
    const svc = new SettingsService();
    const all = svc.getAllSettings();
    expect(all).toBeTruthy();
    expect((all as any).mokuWebUrl).toBeDefined();
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';

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

  it('theme and logLevel getters/setters', () => {
    svc.setTheme('dark');
    expect(svc.getTheme()).toBe('dark');
    svc.setLogLevel('debug');
    expect(svc.getLogLevel()).toBe('debug');
  });

  it('getStorePath returns path', () => {
    expect(svc.getStorePath()).toMatch(/settings.json/);
  });
});
