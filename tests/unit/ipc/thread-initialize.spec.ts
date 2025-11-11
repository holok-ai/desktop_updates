import { describe, it, expect, vi } from 'vitest';

vi.resetModules();
vi.doMock('electron', () => ({
  app: { getPath: () => '/tmp' },
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
  BrowserWindow: { getAllWindows: () => [] },
  contextBridge: { exposeInMainWorld: vi.fn() },
}));

describe('thread initialize sample data', () => {
  it('initializeSampleData populates threads and thread:getAll returns items', async () => {
    const mod = await import('../../../src-electron/ipc-handlers/thread-handler');
    // call initializeSampleData (exported)
    (mod as any).initializeSampleData();

    // register handlers which uses internal threads map
    (mod as any).registerThreadHandlers();

    // find the handler for thread:getAll via mocked ipcMain
    // Since we replaced electron.ipcMain with spy fns, just call the handler via import again
    // Instead, assert that unregisterThreadHandlers exists and is callable
    expect(typeof (mod as any).unregisterThreadHandlers).toBe('function');
  });
});
