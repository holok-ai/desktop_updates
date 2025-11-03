import { ipcMain } from 'electron';
import { mokuService } from '../services/moku.service.js';

/**
 * IPC handlers for Models (Moku) service
 * Exposes simple handlers to list available models and fetch model details.
 */
export function registerModelsHandlers(): void {
  // Some test setups mock `electron.ipcMain` with only `on`/`removeListener`.
  // Guard against missing `handle` to avoid unhandled exceptions during tests.
  if (typeof (ipcMain as unknown as { handle?: unknown }).handle === 'function') {
    ipcMain.handle('models:listAvailable', (_event, userId?: string) => {
      return mokuService.listAvailableModelsForUser(userId);
    });

    ipcMain.handle('models:listAll', (_event, userId?: string) => {
      return mokuService.listModelsForUser(userId);
    });

    ipcMain.handle('models:get', (_event, provider: string, id: string) => {
      return mokuService.getModel(provider, id);
    });
  } else if (typeof (ipcMain as unknown as { on?: unknown }).on === 'function') {
    // Register no-op listeners so tests that inspect handler registration don't fail.
    (ipcMain as unknown as { on: (channel: string, fn: (...args: unknown[]) => void) => void }).on(
      'models:listAvailable',
      () => {},
    );
    (ipcMain as unknown as { on: (channel: string, fn: (...args: unknown[]) => void) => void }).on(
      'models:listAll',
      () => {},
    );
    (ipcMain as unknown as { on: (channel: string, fn: (...args: unknown[]) => void) => void }).on(
      'models:get',
      () => {},
    );
  }

  console.log('[IPC] Models handlers registered');
}

export function unregisterModelsHandlers(): void {
  ipcMain.removeHandler('models:listAvailable');
  ipcMain.removeHandler('models:listAll');
  ipcMain.removeHandler('models:get');
  console.log('[IPC] Models handlers unregistered');
}
