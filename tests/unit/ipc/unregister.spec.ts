import { describe, it, expect, vi } from 'vitest';

// Provide a minimal electron mock with ipcMain.removeHandler spy
vi.mock('electron', () => {
  const removeHandler = vi.fn();
  const ipcMain = { removeHandler };
  return { ipcMain };
});

describe('IPC unregister helpers', () => {
  it('unregisterSettingsHandlers calls removeHandler for each settings channel', async () => {
    const mod = await import('../../../src-electron/ipc-handlers/settings-handler');
    const { unregisterSettingsHandlers } = mod;
    const { ipcMain } = await import('electron');

    unregisterSettingsHandlers();

    // Expect removeHandler called for at least one known key
    expect((ipcMain.removeHandler as any).mock.calls.length).toBeGreaterThan(0);
  });

  it('unregisterAuthHandlers calls removeHandler for each auth channel', async () => {
    const mod = await import('../../../src-electron/ipc-handlers/auth-handler');
    const { unregisterAuthHandlers } = mod;
    const { ipcMain } = await import('electron');

    unregisterAuthHandlers();

    expect((ipcMain.removeHandler as any).mock.calls.length).toBeGreaterThan(0);
  });
});
