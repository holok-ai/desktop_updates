import { describe, it, expect, vi } from 'vitest';

describe('thread-handler helper functions', () => {
  it('generateId returns a string', async () => {
    // ensure electron is mocked before importing the module
    vi.resetModules();
    vi.doMock('electron', () => ({
      BrowserWindow: { getAllWindows: () => [] },
      contextBridge: { exposeInMainWorld: vi.fn() },
      ipcRenderer: { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn(), send: vi.fn() },
    }));
    const mod = await import('../../../src-electron/ipc-handlers/thread-handler');
    const id = (mod as any).generateId();
    expect(typeof id).toBe('string');
  });

  it('broadcast calls webContents.send for each window', async () => {
    // mock BrowserWindow.getAllWindows
    const win = { webContents: { send: vi.fn() } } as any;
    vi.resetModules();
    vi.doMock('electron', () => ({
      BrowserWindow: { getAllWindows: () => [win] },
      contextBridge: { exposeInMainWorld: vi.fn() },
      ipcRenderer: { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn(), send: vi.fn() },
    }));
    const mod = await import('../../../src-electron/ipc-handlers/thread-handler');
    (mod as any).broadcast('thread:created', { id: '1' });
    expect(win.webContents.send).toHaveBeenCalledWith('thread:created', { id: '1' });
  });
});


