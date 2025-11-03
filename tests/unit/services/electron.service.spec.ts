import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { electronService } from '$lib/services/electron.service';
import type { ElectronAPI } from 'src-electron/preload';

describe('electron.service', () => {
  const win = window as unknown as Window & { electronAPI?: ElectronAPI };
  const original = { ...win.electronAPI } as ElectronAPI;

  beforeEach(() => {
    // Restore default stub behaviors before each test
    win.electronAPI = { ...original };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getPlatform proxies to electronAPI.system.platform', async () => {
    const spy = vi
      .spyOn((win.electronAPI as ElectronAPI).system, 'platform')
      .mockResolvedValue('darwin');
    const platform = await electronService.getPlatform();
    expect(platform).toBe('darwin');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('getVersion proxies to electronAPI.system.version', async () => {
    const spy = vi
      .spyOn((win.electronAPI as ElectronAPI).system, 'version')
      .mockResolvedValue('1.2.3');
    const version = await electronService.getVersion();
    expect(version).toBe('1.2.3');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('throws if electronAPI is unavailable', async () => {
    const prev = win.electronAPI;
    // simulate undefined electronAPI
    (win as unknown as Record<string, unknown>)['electronAPI'] = undefined;
    await expect(electronService.getPlatform()).rejects.toThrow('Electron API not available');
    // restore
    win.electronAPI = prev as ElectronAPI;
  });

  it('log methods forward to electronAPI.log', () => {
    const info = vi
      .spyOn((win.electronAPI as ElectronAPI).log, 'info')
      .mockImplementation(() => {});
    const warn = vi
      .spyOn((win.electronAPI as ElectronAPI).log, 'warn')
      .mockImplementation(() => {});
    const error = vi
      .spyOn((win.electronAPI as ElectronAPI).log, 'error')
      .mockImplementation(() => {});

    electronService.log.info('hello', 1, true);
    electronService.log.warn('warn');
    electronService.log.error('err', { a: 1 });

    expect(info).toHaveBeenCalledWith('hello', 1, true);
    expect(warn).toHaveBeenCalledWith('warn');
    expect(error).toHaveBeenCalledWith('err', { a: 1 });
  });
});
