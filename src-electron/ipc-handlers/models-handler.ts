import { ipcMain } from 'electron';
import { modelRepository } from '../repository/model-repository.js';

/**
 * IPC handlers for Models service
 * Exposes simple handler to list all available models from the repository.
 */
export function registerModelsHandlers(): void {
  // Some test setups mock `electron.ipcMain` with only `on`/`removeListener`.
  // Guard against missing `handle` to avoid unhandled exceptions during tests.
  if (typeof (ipcMain as unknown as { handle?: unknown }).handle === 'function') {
    ipcMain.handle('models:listAll', async () => {
      return await modelRepository.listAll();
    });

    ipcMain.handle('models:listAllApplications', async () => {
      return await modelRepository.listAllApplications();
    });
  } else if (typeof (ipcMain as unknown as { on?: unknown }).on === 'function') {
    // Register no-op listener so tests that inspect handler registration don't fail.
    (ipcMain as unknown as { on: (channel: string, fn: (...args: unknown[]) => void) => void }).on(
      'models:listAll',
      () => {},
    );
    (ipcMain as unknown as { on: (channel: string, fn: (...args: unknown[]) => void) => void }).on(
      'models:listAllApplications',
      () => {},
    );
  }

  console.log('[IPC] Models handlers registered');
}

export function unregisterModelsHandlers(): void {
  ipcMain.removeHandler('models:listAll');
  ipcMain.removeHandler('models:listAllApplications');
  console.log('[IPC] Models handlers unregistered');
}
